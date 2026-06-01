// Figtree Figma plugin — main thread (sandbox).
//
// Has access to the Figma document API but NOT to the network. Its job is to
// read the file's local Variables, flatten them into Figtree's token shape
// ({ name: value }), and hand them to the UI iframe, which does the HTTP work.

figma.showUI(__html__, { width: 380, height: 560 });

// ─── value conversion ───────────────────────────────────────────────────────

const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');

const rgbaToHex = ({ r, g, b, a = 1 }) => {
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? `${hex}${toHex(a)}` : hex;
};

// Map a resolved Figma variable value to a CSS-ready token value.
const toTokenValue = (resolvedType, value) => {
  if (value == null) return '';
  switch (resolvedType) {
    case 'COLOR':
      return rgbaToHex(value);
    case 'FLOAT':
      // Most numeric tokens here are dimensions (radius/spacing). 0 stays 0.
      return value === 0 ? '0' : `${value}px`;
    default:
      return String(value); // STRING / BOOLEAN
  }
};

// Figma variable names can be grouped with "/" (e.g. "color/primaryAction").
// CSS custom properties can't contain "/", so flatten to the leaf name.
const toTokenName = (name) => name.split('/').pop().trim();

// ─── token collection ───────────────────────────────────────────────────────

async function collectTokens() {
  const tokens = {};
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const defaultModeByCollection = {};
  for (const c of collections) defaultModeByCollection[c.id] = c.defaultModeId;

  const vars = await figma.variables.getLocalVariablesAsync();
  for (const v of vars) {
    const modeId = defaultModeByCollection[v.variableCollectionId];
    let value = v.valuesByMode[modeId];

    // Resolve one level of alias (e.g. semantic → primitive).
    if (value && value.type === 'VARIABLE_ALIAS') {
      const target = await figma.variables.getVariableByIdAsync(value.id);
      if (target) {
        const targetMode = defaultModeByCollection[target.variableCollectionId];
        value = target.valuesByMode[targetMode];
      }
    }

    tokens[toTokenName(v.name)] = toTokenValue(v.resolvedType, value);
  }
  return tokens;
}

// ─── message bridge to the UI ────────────────────────────────────────────────

async function sendTokens() {
  try {
    const tokens = await collectTokens();
    figma.ui.postMessage({ type: 'tokens', tokens });
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: String(err) });
  }
}

// ─── Variable sync (code → Figma) ────────────────────────────────────────────
// Create/update Figma Variables from the resolved bindable token map. Only the
// main thread can use the figma.variables API, so the UI hands us the list.

const hexToRgba = (hex) => {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 4) h = h.split('').map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return {
    r: n(0), g: n(2), b: n(4),
    a: h.length >= 8 ? n(6) : 1,
  };
};

// Map a resolved token value to a Figma variable type + value.
const toFigmaValue = (value) => {
  const v = String(value).trim();
  if (v === 'transparent') return { type: 'COLOR', value: { r: 0, g: 0, b: 0, a: 0 } };
  if (/^#([0-9a-fA-F]{3,8})$/.test(v)) return { type: 'COLOR', value: hexToRgba(v) };
  const num = v.match(/^(-?\d+(?:\.\d+)?)px$/) || v.match(/^(-?\d+(?:\.\d+)?)$/);
  if (num) return { type: 'FLOAT', value: parseFloat(num[1]) };
  return { type: 'STRING', value: v }; // shadows, 'none', etc.
};

async function syncVariables(tokens) {
  const COLLECTION = 'figtree';
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let col = collections.find((c) => c.name === COLLECTION);
  if (!col) col = figma.variables.createVariableCollection(COLLECTION);
  const modeId = col.defaultModeId;

  const existing = await figma.variables.getLocalVariablesAsync();
  const byName = new Map(
    existing.filter((v) => v.variableCollectionId === col.id).map((v) => [v.name, v]),
  );

  let created = 0, updated = 0, skipped = 0;
  for (const t of tokens) {
    const fv = toFigmaValue(t.value);
    let v = byName.get(t.name);
    if (v && v.resolvedType !== fv.type) { skipped++; continue; } // type changed — leave it
    if (!v) { v = figma.variables.createVariable(t.name, col, fv.type); created++; }
    else updated++;
    v.setValueForMode(modeId, fv.value);
  }
  return { created, updated, skipped, collection: COLLECTION };
}

// ─── Materialize a captured LayerNode → Figma nodes, binding tokens ──────────

// name → Variable, for the `figtree` collection synced from code.
async function figtreeVarMap() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const col = cols.find((c) => c.name === 'figtree');
  const map = new Map();
  if (col) {
    const vars = await figma.variables.getLocalVariablesAsync();
    for (const v of vars) if (v.variableCollectionId === col.id) map.set(v.name, v);
  }
  return map;
}

// Infer a numeric weight + italic from a Figma style name ("Semi Bold Italic"…).
const STYLE_WEIGHT = [
  [/thin|hairline/i, 100], [/extra\s?light|ultra\s?light/i, 200], [/light/i, 300],
  [/medium/i, 500], [/semi\s?bold|demi\s?bold/i, 600],
  [/extra\s?bold|ultra\s?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700],
  [/regular|normal|book/i, 400],
];
const styleWeight = (style) => {
  for (const pair of STYLE_WEIGHT) if (pair[0].test(style)) return pair[1];
  return 400;
};
const styleIsItalic = (style) => /italic|oblique/i.test(style);

// family → [styles], loaded once (the font list can be large).
let _fontsByFamily = null;
async function fontsByFamily() {
  if (_fontsByFamily) return _fontsByFamily;
  const map = new Map();
  const list = await figma.listAvailableFontsAsync();
  for (const f of list) {
    const fam = f.fontName.family;
    if (!map.has(fam)) map.set(fam, []);
    map.get(fam).push(f.fontName.style);
  }
  _fontsByFamily = map;
  return map;
}

// Pick the available font whose style is closest to the target weight/italic,
// trying the captured family first, then sensible fallbacks. Preserves weight
// even when the exact family/style name isn't installed.
async function pickFont(family, weight, italic) {
  const byFam = await fontsByFamily();
  const want = weight || 400;
  for (const fam of [family, 'Inter', 'Roboto', 'Helvetica Neue', 'Arial']) {
    const styles = byFam.get(fam);
    if (!styles || !styles.length) continue;
    let cands = styles.filter((s) => styleIsItalic(s) === !!italic);
    if (!cands.length) cands = styles.slice();
    cands.sort((a, b) => Math.abs(styleWeight(a) - want) - Math.abs(styleWeight(b) - want));
    try { await figma.loadFontAsync({ family: fam, style: cands[0] }); return { family: fam, style: cands[0] }; }
    catch (e) {}
  }
  try { await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' }); } catch (e) {}
  return { family: 'Roboto', style: 'Regular' };
}

const cleanPaint = (p) => ({
  type: 'SOLID',
  color: { r: p.color.r, g: p.color.g, b: p.color.b },
  opacity: p.opacity == null ? 1 : p.opacity,
});

const bindPaint = (paint, varMap, tokenName) => {
  const v = tokenName && varMap.get(tokenName);
  if (!v) return paint;
  try { return figma.variables.setBoundVariableForPaint(paint, 'color', v); } catch (e) { return paint; }
};

async function materialize(node, varMap) {
  const tokens = (node.figtree && node.figtree.tokens) || {};

  if (node.type === 'TEXT') {
    const t = figma.createText();
    t.fontName = await pickFont(node.fontFamily || 'Inter', node.fontWeight, node.italic);
    t.characters = node.characters || '';
    if (node.fontSize) t.fontSize = node.fontSize;
    if (node.letterSpacing != null) t.letterSpacing = { unit: 'PIXELS', value: node.letterSpacing };
    if (node.lineHeight) {
      t.lineHeight = node.lineHeight.unit === 'PIXELS'
        ? { unit: 'PIXELS', value: node.lineHeight.value }
        : { unit: 'AUTO' };
    }
    if (node.textAlign) t.textAlignHorizontal = node.textAlign;
    if (node.fills && node.fills[0]) t.fills = [bindPaint(cleanPaint(node.fills[0]), varMap, tokens.fill)];
    t.name = node.name || 'text';
    return t;
  }

  const f = figma.createFrame();
  f.name = node.name || 'frame';
  f.fills = node.fills && node.fills[0] ? [bindPaint(cleanPaint(node.fills[0]), varMap, tokens.fill)] : [];
  if (node.strokes && node.strokes[0]) {
    f.strokes = [bindPaint(cleanPaint(node.strokes[0]), varMap, tokens.stroke)];
    if (node.strokeWeight) f.strokeWeight = node.strokeWeight;
  }
  if (typeof node.cornerRadius === 'number') {
    f.cornerRadius = node.cornerRadius;
    const v = tokens.cornerRadius && varMap.get(tokens.cornerRadius);
    if (v) for (const field of ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']) {
      try { f.setBoundVariable(field, v); } catch (e) {}
    }
  } else if (Array.isArray(node.cornerRadius)) {
    const [tl, tr, br, bl] = node.cornerRadius;
    f.topLeftRadius = tl; f.topRightRadius = tr; f.bottomRightRadius = br; f.bottomLeftRadius = bl;
  }
  if (Array.isArray(node.effects) && node.effects.length) {
    f.effects = node.effects.map((e) => ({
      type: e.type, visible: true, blendMode: 'NORMAL',
      radius: e.radius || 0, spread: e.spread || 0,
      offset: e.offset || { x: 0, y: 0 },
      color: {
        r: e.color.color.r, g: e.color.color.g, b: e.color.color.b,
        a: e.color.opacity == null ? 1 : e.color.opacity,
      },
    }));
  }
  if (node.opacity != null) f.opacity = node.opacity;
  f.clipsContent = !!node.clipsContent;

  const auto = node.layout && node.layout.mode && node.layout.mode !== 'NONE';
  if (auto) {
    f.layoutMode = node.layout.mode;
    f.primaryAxisAlignItems = node.layout.primaryAxisAlign || 'MIN';
    f.counterAxisAlignItems = node.layout.counterAxisAlign || 'MIN';
    f.itemSpacing = node.layout.itemSpacing || 0;
    f.paddingTop = node.layout.paddingTop || 0;
    f.paddingRight = node.layout.paddingRight || 0;
    f.paddingBottom = node.layout.paddingBottom || 0;
    f.paddingLeft = node.layout.paddingLeft || 0;
  } else if (node.width && node.height) {
    f.resize(node.width, node.height);
  }

  for (const child of node.children || []) {
    const c = await materialize(child, varMap);
    f.appendChild(c);
    if (!auto) { c.x = child.x || 0; c.y = child.y || 0; }
  }
  return f;
}

async function insertNode(root) {
  const varMap = await figtreeVarMap();
  const node = await materialize(root, varMap);
  figma.currentPage.appendChild(node);
  node.x = Math.round(figma.viewport.center.x - node.width / 2);
  node.y = Math.round(figma.viewport.center.y - node.height / 2);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

figma.ui.onmessage = (msg) => {
  if (msg.type === 'reload-tokens') sendTokens();
  else if (msg.type === 'sync-variables') {
    syncVariables(msg.tokens)
      .then((r) => figma.ui.postMessage({
        type: 'sync-result',
        created: r.created, updated: r.updated, skipped: r.skipped, collection: r.collection,
      }))
      .catch((err) => figma.ui.postMessage({ type: 'error', message: String(err) }));
  }
  else if (msg.type === 'insert-node') {
    insertNode(msg.node)
      .then(() => figma.ui.postMessage({ type: 'insert-result', ok: true }))
      .catch((err) => figma.ui.postMessage({ type: 'error', message: String(err) }));
  }
  else if (msg.type === 'notify') figma.notify(msg.message);
  else if (msg.type === 'close') figma.closePlugin();
};

// Push the current tokens as soon as the UI is up.
sendTokens();
