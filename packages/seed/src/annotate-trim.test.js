import { describe, it, expect } from 'vitest'
import { annotateTree, buildTokenIndex } from './annotateTokens.js'
import { tightenRoot } from './capture.js'

const clone = (o) => JSON.parse(JSON.stringify(o))

// --- Worker D fixtures ---
const RESOLVED = [
  { id: 'button.primary.bg.default', value: 'rgb(15, 101, 239)', tier: 'component', type: 'color' },
  { id: 'button.primary.text.default', value: 'rgb(255, 255, 255)', tier: 'component', type: 'color' },
  { id: 'button.radius', value: '8px', tier: 'component', type: 'dimension' },
  { id: 'color.gray.900', value: 'rgb(17, 24, 39)', tier: 'primitive', type: 'color' },
  { id: 'size.spacing.4', value: '16px', tier: 'primitive', type: 'dimension' },
]
const makeButtonTree = () => ({
  type: 'FRAME', name: 'Story', x: 0, y: 0, width: 320, height: 200, fills: [], strokes: [],
  children: [{
    type: 'FRAME', name: 'Wrapper-1', x: 0, y: 0, width: 320, height: 200, fills: [], strokes: [],
    children: [{
      type: 'FRAME', name: 'Wrapper-2', x: 0, y: 0, width: 320, height: 200, fills: [], strokes: [],
      children: [{
        type: 'FRAME', name: 'Button/Primary', x: 24, y: 24, width: 82, height: 38,
        fills: [{ type: 'SOLID', raw: 'rgb(15, 101, 239)' }], strokes: [], cornerRadius: 8,
        children: [{
          type: 'TEXT', name: 'Primary', x: 12, y: 8, width: 58, height: 22,
          fills: [{ type: 'SOLID', raw: 'rgb(255, 255, 255)' }], strokes: [], children: [],
        }],
      }],
    }],
  }],
})

// --- Worker E ---
describe('annotation invariance — before/after tighten', () => {
  const index = buildTokenIndex(RESOLVED)
  const findByName = (node, name) =>
    !node ? null
    : node.name === name ? node
    : (node.children || []).reduce((hit, c) => hit || findByName(c, name), null)
  const annotated = (node, acc = []) => {
    if (!node) return acc
    if (node.figtree) acc.push(node)
    for (const c of node.children || []) annotated(c, acc)
    return acc
  }
  const before = annotateTree(clone(makeButtonTree()), index)
  const after = annotateTree(tightenRoot(clone(makeButtonTree())), index)
  it('binds the button frame fill + cornerRadius identically before & after tighten', () => {
    // tighten must actually descend the pass-through wrappers: the button is
    // now the root (and was cropped to its content box). Pins tighten isn't inert.
    expect(after.name).toBe('Button/Primary')
    expect(after.width).toBe(82)
    const bBtn = findByName(before, 'Button/Primary')
    const aBtn = findByName(after, 'Button/Primary')
    expect(bBtn).toBeTruthy()
    expect(aBtn).toBeTruthy()
    expect(aBtn.figtree.tokens).toEqual(bBtn.figtree.tokens)
    expect(bBtn.figtree.tokens).toEqual({ fill: 'button.primary.bg.default', cornerRadius: 'button.radius' })
  })
  it('binds the TEXT fill identically before & after tighten', () => {
    const bTxt = findByName(before, 'Primary')
    const aTxt = findByName(after, 'Primary')
    expect(bTxt.type).toBe('TEXT')
    expect(aTxt.type).toBe('TEXT')
    expect(aTxt.figtree.tokens).toEqual(bTxt.figtree.tokens)
    expect(bTxt.figtree.tokens.fill).toBe('button.primary.text.default')
  })
  it('preserves the set of annotated nodes (only un-annotated wrappers are dropped)', () => {
    const bSets = annotated(before).map((n) => n.figtree.tokens)
    const aSets = annotated(after).map((n) => n.figtree.tokens)
    expect(bSets).toHaveLength(2)
    expect(aSets).toHaveLength(2)
    const norm = (sets) => sets.map((t) => JSON.stringify(t)).sort()
    expect(norm(aSets)).toEqual(norm(bSets))
  })
})

// --- Worker F ---
const CARD_RESOLVED = [
  { id: 'color.bg.surface', cssVar: '--color-bg-surface', value: 'rgb(255, 255, 255)', tier: 'semantic', type: 'color' },
]
const makeCardTree = () => ({
  type: 'FRAME', name: 'transparent-container', x: 0, y: 0, width: 200, height: 120, fills: [], strokes: [],
  children: [{
    type: 'FRAME', name: 'card', x: 20, y: 20, width: 160, height: 80,
    fills: [{ type: 'SOLID', raw: 'rgb(255, 255, 255)' }], strokes: [],
    children: [{ type: 'TEXT', name: 'title', x: 10, y: 10, width: 120, height: 20, characters: 'Card title' }],
  }],
})
describe('tighten preserves annotated surfaces', () => {
  const index = buildTokenIndex(CARD_RESOLVED)
  it('keeps a token-bound card surface through tighten + annotate', () => {
    const result = annotateTree(tightenRoot(clone(makeCardTree())), index)
    expect(result.name).toBe('card')
    expect(result.fills).toHaveLength(1)
    expect(result.fills[0].raw).toBe('rgb(255, 255, 255)')
    expect(result.figtree.tokens.fill).toBe('color.bg.surface')
  })
  it('drops a purely transparent wrapper losslessly (no binding to lose)', () => {
    const w = annotateTree(clone({ type: 'FRAME', name: 'w', x: 0, y: 0, width: 10, height: 10, fills: [], strokes: [], children: [] }), buildTokenIndex(CARD_RESOLVED))
    expect(w.figtree).toBeUndefined()
  })
})
