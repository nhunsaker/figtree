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

figma.ui.onmessage = (msg) => {
  if (msg.type === 'reload-tokens') sendTokens();
  else if (msg.type === 'sync-variables') {
    syncVariables(msg.tokens)
      .then((r) => figma.ui.postMessage({ type: 'sync-result', ...r }))
      .catch((err) => figma.ui.postMessage({ type: 'error', message: String(err) }));
  }
  else if (msg.type === 'notify') figma.notify(msg.message);
  else if (msg.type === 'close') figma.closePlugin();
};

// Push the current tokens as soon as the UI is up.
sendTokens();
