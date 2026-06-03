import { describe, it, expect } from 'vitest'
import { hasContent, contentBBox, tightenRoot } from './capture.js'

const clone = (o) => JSON.parse(JSON.stringify(o))

// === WORKER A (single-component + hasContent) ===
describe('tightenRoot — single component', () => {
  const makeFixture = () => ({
    type: 'FRAME', name: 'story', x: 0, y: 0, width: 1248, height: 86,
    fills: [], strokes: [],
    children: [{
      type: 'FRAME', name: 'wrapper-1', x: 0, y: 0, width: 1248, height: 86,
      fills: [], strokes: [],
      children: [{
        type: 'FRAME', name: 'wrapper-2', x: 0, y: 0, width: 1248, height: 86,
        fills: [], strokes: [],
        children: [{
          type: 'FRAME', name: 'button', x: 24, y: 24, width: 82, height: 38,
          fills: [{ type: 'SOLID' }], strokes: [],
          children: [{
            type: 'TEXT', name: 'Primary', x: 12, y: 8, width: 58, height: 22,
            fills: [{ type: 'SOLID' }], strokes: [], children: [],
          }],
        }],
      }],
    }],
  })
  it('descends through transparent wrappers and crops to the button', () => {
    const root = clone(makeFixture())
    const kept = tightenRoot(root)
    expect(kept.name).toBe('button')
    expect(kept.width).toBe(82)
    expect(kept.height).toBe(38)
    expect(kept.x).toBe(0)
    expect(kept.y).toBe(0)
    expect(kept.fills.length).toBeGreaterThan(0)
    const text = kept.children.find((c) => c.type === 'TEXT')
    expect(text).toBeTruthy()
    expect(text.name).toBe('Primary')
  })
})
describe('hasContent', () => {
  it('returns true for a transparent wrapper containing a filled button', () => {
    const wrapper = {
      type: 'FRAME', x: 0, y: 0, width: 1248, height: 86, fills: [], strokes: [],
      children: [{
        type: 'FRAME', x: 24, y: 24, width: 82, height: 38,
        fills: [{ type: 'SOLID' }], strokes: [], children: [],
      }],
    }
    expect(hasContent(wrapper)).toBe(true)
  })
  it('returns false for a truly empty frame', () => {
    const empty = { type: 'FRAME', x: 0, y: 0, width: 10, height: 10, fills: [], strokes: [], children: [] }
    expect(hasContent(empty)).toBe(false)
  })
  it('returns true for a bare TEXT node', () => {
    const text = { type: 'TEXT', x: 0, y: 0, width: 58, height: 22, fills: [], strokes: [], children: [] }
    expect(hasContent(text)).toBe(true)
  })
})

// === WORKER B (multi-child row + contentBBox) ===
const makeRowFixture = () => ({
  type: 'FRAME', name: 'container', x: 0, y: 0, width: 282, height: 40,
  fills: [], strokes: [],
  children: [{
    type: 'FRAME', name: 'row', x: 0, y: 0, width: 282, height: 40,
    fills: [], strokes: [],
    children: [
      { type: 'FRAME', name: 'button1', x: 0,   y: 0, width: 82, height: 40, fills: [{ type: 'SOLID' }], strokes: [], children: [] },
      { type: 'FRAME', name: 'button2', x: 100, y: 0, width: 82, height: 40, fills: [{ type: 'SOLID' }], strokes: [], children: [] },
      { type: 'FRAME', name: 'button3', x: 200, y: 0, width: 82, height: 40, fills: [{ type: 'SOLID' }], strokes: [], children: [] },
    ],
  }],
})
describe('tightenRoot — multi-child row', () => {
  it('stops at the row and keeps all three button children', () => {
    const result = tightenRoot(clone(makeRowFixture()))
    expect(result.name).toBe('row')
    expect(result.children).toHaveLength(3)
    expect(result.children.map((c) => c.name)).toEqual(['button1', 'button2', 'button3'])
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.width).toBe(282)
    expect(result.height).toBe(40)
    expect(result.children.map((c) => c.x)).toEqual([0, 100, 200])
    expect(result.children.every((c) => c.y === 0)).toBe(true)
  })
  it('contentBBox of the row bounds the full group in row-local coords', () => {
    const row = clone(makeRowFixture()).children[0]
    row.x = 50
    row.y = 30
    expect(contentBBox(row)).toEqual({ minX: 0, minY: 0, maxX: 282, maxY: 40 })
  })
  it('crops a non-origin content group and shifts children back to the origin', () => {
    const offsetRow = {
      type: 'FRAME', name: 'container', x: 0, y: 0, width: 320, height: 80,
      fills: [], strokes: [],
      children: [{
        type: 'FRAME', name: 'row', x: 0, y: 0, width: 320, height: 80,
        fills: [], strokes: [],
        children: [
          { type: 'FRAME', name: 'button1', x: 24,  y: 12, width: 82, height: 40, fills: [{ type: 'SOLID' }], strokes: [], children: [] },
          { type: 'FRAME', name: 'button2', x: 124, y: 12, width: 82, height: 40, fills: [{ type: 'SOLID' }], strokes: [], children: [] },
          { type: 'FRAME', name: 'button3', x: 224, y: 12, width: 82, height: 40, fills: [{ type: 'SOLID' }], strokes: [], children: [] },
        ],
      }],
    }
    const result = tightenRoot(clone(offsetRow))
    expect(result.name).toBe('row')
    // contentBBox: minX=24, minY=12, maxX=306, maxY=52 → tight extent 282 x 40
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.width).toBe(282)
    expect(result.height).toBe(40)
    // each child shifted DOWN by (24, 12): 24→0, 124→100, 224→200
    expect(result.children.map((c) => c.x)).toEqual([0, 100, 200])
    expect(result.children.every((c) => c.y === 0)).toBe(true)
  })
})

// === WORKER C (visual-surface card + edge cases) ===
describe('tightenRoot — visual-surface card', () => {
  const makeFixture = () => ({
    type: 'FRAME', name: 'container', x: 0, y: 0, width: 320, height: 200,
    fills: [], strokes: [],
    children: [{
      type: 'FRAME', name: 'card', x: 16, y: 16, width: 240, height: 140,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], strokes: [],
      children: [
        { type: 'TEXT', name: 'Title', x: 16, y: 16, width: 80, height: 20, fills: [], strokes: [], children: [] },
        { type: 'FRAME', name: 'body', x: 16, y: 48, width: 200, height: 60, fills: [], strokes: [], children: [
          { type: 'TEXT', name: 'Body text', x: 0, y: 0, width: 120, height: 16, fills: [], strokes: [], children: [] },
        ]},
      ],
    }],
  })
  it('stops descent at the card (self-visual surface), keeping it instead of skipping', () => {
    const result = tightenRoot(clone(makeFixture()))
    expect(result.name).toBe('card')
    expect(result.fills.length).toBe(1)
    expect(result.fills[0].type).toBe('SOLID')
  })
  it('retains the card children (title + body subtree)', () => {
    const result = tightenRoot(clone(makeFixture()))
    const names = result.children.map((c) => c.name)
    expect(names).toEqual(['Title', 'body'])
    expect(result.children[1].children[0].name).toBe('Body text')
  })
  it('crops to the card full size since the card itself paints', () => {
    const result = tightenRoot(clone(makeFixture()))
    expect(result.width).toBe(240)
    expect(result.height).toBe(140)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.children[0].x).toBe(16)
    expect(result.children[0].y).toBe(16)
  })
})
describe('edge cases', () => {
  it('contentBBox is null for a transparent, content-free tree', () => {
    const tree = { type: 'FRAME', name: 'empty', x: 0, y: 0, width: 100, height: 50, fills: [], strokes: [], children: [] }
    expect(contentBBox(tree)).toBe(null)
  })
  it('contentBBox is null when only transparent children exist', () => {
    const tree = { type: 'FRAME', name: 'wrapper', x: 0, y: 0, width: 100, height: 50, fills: [], strokes: [], children: [
      { type: 'FRAME', name: 'inner', x: 10, y: 10, width: 20, height: 20, fills: [], strokes: [], children: [] },
    ]}
    expect(contentBBox(tree)).toBe(null)
  })
  it('tightenRoot returns the tree without throwing and leaves size unchanged', () => {
    const tree = { type: 'FRAME', name: 'empty', x: 5, y: 7, width: 100, height: 50, fills: [], strokes: [], children: [] }
    const result = tightenRoot(clone(tree))
    expect(result).toBeTruthy()
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })
})
