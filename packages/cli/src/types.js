// Type definitions for @figtree/cli, expressed as JSDoc typedefs.
// No runtime code — purely for editor tooling and docs.

/**
 * A flat map of token name → value.
 * @typedef {Object.<string, string | number>} TokenSet
 */

/**
 * @typedef {Object} PreviewEntry
 * @property {TokenSet} tokens
 * @property {number} createdAt
 */

/**
 * @typedef {Object} FigtreeCliConfig
 * @property {string} namespace
 *   Matches the namespace in your FigtreeProvider config.
 * @property {string} tokenPath Path to your source tokens.json file.
 * @property {string} [styleDictionaryConfig]
 *   Optional path to style-dictionary config — runs build on token change.
 * @property {number} [port] Port for the local server. Defaults to 7777.
 */

export {}
