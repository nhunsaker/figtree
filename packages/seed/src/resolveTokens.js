import { build } from 'esbuild'
import { writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRequire } from 'module'

// Extracts the *bindable* token map from a styled-components theme module:
// every value of the form `var(--NAME, FALLBACK)`. Raw primitives that aren't
// wrapped in var() are intentionally excluded (the app never reads them as CSS
// custom properties). See storybook-to-figma-spec.md → Resolver.

// Matches a value that is exactly a single var(): captures NAME and the
// fallback (which may itself contain commas/parens, e.g. shadows/rgba()).
const VAR_RE = /^var\(\s*--([A-Za-z0-9_-]+)\s*,\s*([\s\S]*)\)\s*$/
const PRIMITIVE_RE = /^(?:gray|blue|red|green|orange|purple|black|white)\d*$|^transparent$/

const parseVar = (value) => {
  if (typeof value !== 'string') return null
  const m = value.match(VAR_RE)
  if (!m) return null
  return { name: m[1], value: m[2].trim() }
}

const classify = (name) => (PRIMITIVE_RE.test(name) ? 'primitive' : 'semantic')

/**
 * Bundle-and-evaluate the theme module so template-literal values are resolved
 * (static text parsing can't see `${tokens.blue5}`). esbuild resolves the
 * theme's own imports (tokens.json, utils) standalone — no app runtime needed.
 *
 * @param {string} themePath absolute or cwd-relative path to theme.js
 * @returns {Promise<Array<{name:string,value:string,kind:'semantic'|'primitive'}>>}
 */
export const resolveBindableTokens = async (themePath) => {
  const out = await build({
    entryPoints: [themePath],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    // Many codebases (incl. this one) put JSX in .js files, and the theme's
    // import graph can reach them. Parse .js as JSX so bundling doesn't choke.
    loader: { '.js': 'jsx' },
    jsx: 'automatic',
  })
  const tmp = join(tmpdir(), `figtree-theme-${process.pid}-${Date.now()}.cjs`)
  writeFileSync(tmp, out.outputFiles[0].text)
  let mod
  try {
    mod = createRequire(import.meta.url)(tmp)
  } finally {
    rmSync(tmp, { force: true })
  }
  const theme = (mod && mod.default) || mod
  const tokens = []
  for (const [, value] of Object.entries(theme)) {
    const parsed = parseVar(value)
    if (parsed) tokens.push({ ...parsed, kind: classify(parsed.name) })
  }
  return tokens
}
