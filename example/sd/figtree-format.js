// Figtree custom Style Dictionary outputs.
//
// The key piece of the token pipeline: a "resolved bindable map" that Figtree's
// bridge serves, capture annotates against, and the plugin syncs to Figma. One
// build, one map — this is what retires the runtime esbuild-eval resolver and
// fixes the "two token lists" problem.

/**
 * Derive the token tier from the source file a token came from.
 * @param {string} filePath
 * @returns {'primitive'|'semantic'|'component'|'unknown'}
 */
export const tierOfFile = (filePath = '') =>
  /primitive\./.test(filePath) ? 'primitive'
  : /semantic\./.test(filePath) ? 'semantic'
  : /component\./.test(filePath) ? 'component'
  : 'unknown'

export const FIGTREE_RESOLVED = 'figtree/resolved-map'
export const FIGTREE_THEME_NESTED = 'figtree/theme-nested'
export const FIGTREE_ALIASES = 'figtree/aliases-css'
export const FIGTREE_VERSIONS = 'figtree/versions'
export const FIGTREE_SET_META = 'figtree/set-meta'

// ─── set-level metadata parser ───────────────────────────────────────────────
// Per-set `$version` lives at each token file's root. SD merges all sources
// into one tree, so three root `$version` keys collide ("token collision")
// during merge — and per-set versions wouldn't survive anyway. This parser runs
// PER FILE before the merge: it lifts `$version` out (stashing it by file) and
// strips it from the tree, so the merge is clean and versions are preserved for
// the `figtree/versions` output. (A preprocessor runs post-merge — too late.)
const _setVersions = {}
export const figtreeSetMeta = {
  name: FIGTREE_SET_META,
  pattern: /\.json$/,
  parser: ({ filePath, contents }) => {
    const obj = JSON.parse(contents)
    if (obj.$version != null) {
      _setVersions[tierOfFile(filePath)] = obj.$version
      delete obj.$version
    }
    return obj
  },
}

/** format: figtree/versions — { primitive, semantic, component } → version. */
export const figtreeVersions = () =>
  JSON.stringify(_setVersions, null, 2) + '\n'

const cssNameOf = (id) => '--' + String(id).split('.').join('-')

/**
 * format: figtree/resolved-map
 * Emits the bindable map: one entry per token. Schema:
 * { id, cssVar, value, tier, type } plus { deprecated, replacedBy } when set.
 */
export const figtreeResolved = ({ dictionary }) => {
  const deprecated = []
  const out = dictionary.allTokens.map((t) => {
    const entry = {
      id: t.path.join('.'), //            color.action.primary
      cssVar: '--' + t.path.join('-'), // --color-action-primary
      value: t.$value ?? t.value, //      resolved (refs followed); SD v4 DTCG → $value
      tier: tierOfFile(t.filePath), //    primitive | semantic | component
      type: t.$type ?? t.type, //         color | dimension | fontWeight | …
    }
    if (t.$deprecated) {
      entry.deprecated = true
      const rb = t.$extensions && t.$extensions.figtree && t.$extensions.figtree.replacedBy
      if (rb) entry.replacedBy = rb
      deprecated.push(entry.id + (rb ? ` → ${rb}` : ''))
    }
    return entry
  })
  if (deprecated.length) {
    console.warn(`  ⚠ ${deprecated.length} deprecated token(s): ` + deprecated.join(', '))
  }
  return JSON.stringify(out, null, 2) + '\n'
}

/**
 * format: figtree/aliases-css — legacy back-compat layer (migration window).
 * Reads `options.aliases` ({ legacyName: "new.dtcg.id" }) and emits
 *   --legacyName: var(--new-dtcg-id);
 * Each target is validated against the built tokens; unknown targets warn and
 * are skipped. Drop this platform once nothing references the legacy names.
 */
export const figtreeAliases = ({ dictionary, options }) => {
  const aliases = (options && options.aliases) || {}
  const known = new Set(dictionary.allTokens.map((t) => t.path.join('.')))
  const lines = ['/* AUTO-GENERATED legacy alias layer — @deprecated, remove after migration. */', ':root {']
  const missing = []
  for (const legacy of Object.keys(aliases)) {
    if (legacy.startsWith('$')) continue // skip $comment / metadata keys
    const targetId = aliases[legacy]
    if (!known.has(targetId)) { missing.push(`${legacy} → ${targetId}`); continue }
    lines.push(`  --${legacy}: var(${cssNameOf(targetId)}); /* @deprecated → ${targetId} */`)
  }
  lines.push('}', '')
  if (missing.length) {
    console.warn(`  ⚠ aliases.json: ${missing.length} unknown target(s) skipped: ` + missing.join(', '))
  }
  return lines.join('\n')
}

/**
 * format: figtree/theme-nested
 * Emits a nested object of `var(--kebab, <fallback>)` strings so a
 * styled-components theme can read `theme.color.action.primary`. The fallback
 * is the committed value, so with no preview active rendering is unchanged.
 */
export const figtreeThemeNested = ({ dictionary }) => {
  const root = {}
  for (const t of dictionary.allTokens) {
    const cssVar = '--' + t.path.join('-')
    let node = root
    for (let i = 0; i < t.path.length - 1; i++) {
      const k = t.path[i]
      node[k] = node[k] || {}
      node = node[k]
    }
    node[t.path[t.path.length - 1]] = `var(${cssVar}, ${t.$value ?? t.value})`
  }
  return (
    '// AUTO-GENERATED by Style Dictionary — do not edit.\n' +
    'export default ' +
    JSON.stringify(root, null, 2) +
    '\n'
  )
}
