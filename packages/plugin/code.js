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

figma.ui.onmessage = (msg) => {
  if (msg.type === 'reload-tokens') sendTokens();
  else if (msg.type === 'notify') figma.notify(msg.message);
  else if (msg.type === 'close') figma.closePlugin();
};

// Push the current tokens as soon as the UI is up.
sendTokens();
