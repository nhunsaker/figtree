// Token annotation for captured layer values.
//
// Exact, normalized matching against the resolved bindable token map:
//   colors → canonical #rrggbbaa (lowercase); dimensions → px number.
// On collision, best-guess is semantic-over-primitive (then resolved order),
// and ALL matches are kept as `candidates` so the plugin can offer a switch.

const expandHex = (h) => {
  h = h.toLowerCase()
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
  if (h.length === 6) h += 'ff'
  return '#' + h
}
const toHex2 = (n) =>
  Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
const alphaHex = (a) => toHex2(Math.max(0, Math.min(1, a)) * 255)

/** Normalize any CSS color to canonical `#rrggbbaa`, or null if not a color. */
export const normalizeColor = (value) => {
  if (value == null) return null
  const s = String(value).trim().toLowerCase()
  if (s === 'transparent') return '#00000000'
  let m = s.match(/^#([0-9a-f]{3,8})$/)
  if (m) return expandHex(m[1])
  m = s.match(/^rgba?\(\s*([^)]+)\)$/)
  if (m) {
    const p = m[1].split(',').map((x) => x.trim())
    if (p.length < 3) return null
    const a = p[3] !== undefined ? parseFloat(p[3]) : 1
    return '#' + toHex2(+p[0]) + toHex2(+p[1]) + toHex2(+p[2]) + alphaHex(a)
  }
  return null
}

/** Normalize a CSS length to a px number, or null. */
export const normalizeDimension = (value) => {
  if (value == null) return null
  const m = String(value).trim().match(/^(-?\d+(?:\.\d+)?)(?:px)?$/)
  return m ? parseFloat(m[1]) : null
}

/** Build value→[token] indexes (colors, dims) from the resolved bindable map. */
export const buildTokenIndex = (resolved) => {
  const colors = new Map()
  const dims = new Map()
  const add = (map, key, t) => {
    if (key == null) return
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(t)
  }
  for (const t of resolved) {
    const c = normalizeColor(t.value)
    if (c) add(colors, c, t)
    else add(dims, normalizeDimension(t.value), t)
  }
  return { colors, dims }
}

// Best-guess: semantic before primitive; stable sort keeps resolved order
// among same-kind matches. Returns { token, candidates }.
const pick = (cands) => {
  if (!cands || !cands.length) return { token: null, candidates: [] }
  const best = [...cands].sort(
    (a, b) => (a.kind === 'semantic' ? 0 : 1) - (b.kind === 'semantic' ? 0 : 1),
  )[0]
  return { token: best.name, candidates: cands.map((c) => c.name) }
}

export const matchColor = (index, value) => {
  const c = normalizeColor(value)
  return c ? pick(index.colors.get(c)) : { token: null, candidates: [] }
}

export const matchDimension = (index, value) => {
  const d = normalizeDimension(value)
  return d == null ? { token: null, candidates: [] } : pick(index.dims.get(d))
}

// Walk a captured LayerNode tree and attach `figtree.tokens` / `.candidates`
// to each node whose bindable values match a token. Mutates and returns the
// tree. (The plugin materializer reads these to bind Figma Variables.)
export const annotateTree = (node, index) => {
  const tokens = {}
  const candidates = {}
  const set = (key, res) => {
    if (res.token) { tokens[key] = res.token; candidates[key] = res.candidates }
  }
  if (node.fills && node.fills[0]) set('fill', matchColor(index, node.fills[0].raw))
  if (node.strokes && node.strokes[0]) set('stroke', matchColor(index, node.strokes[0].raw))
  if (typeof node.cornerRadius === 'number') set('cornerRadius', matchDimension(index, node.cornerRadius))
  if (Array.isArray(node.effects)) {
    node.effects.forEach((e, i) => { if (e.color) set(`effect${i}`, matchColor(index, e.color.raw)) })
  }
  if (Object.keys(tokens).length) node.figtree = { tokens, candidates }
  if (Array.isArray(node.children)) node.children.forEach((c) => annotateTree(c, index))
  return node
}
