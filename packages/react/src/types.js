// Type definitions for @figtree/react, expressed as JSDoc typedefs.
// These carry no runtime code — they exist purely for editor tooling and docs.

/**
 * @typedef {string | number} TokenValue
 */

/**
 * A flat map of token name → value.
 * @typedef {Object.<string, TokenValue>} TokenSet
 */

/**
 * @typedef {Object} PreviewConfig
 * @property {boolean} enabled
 *   Whether to allow preview mode at all. Set to false in production builds.
 *   e.g. `enabled: process.env.NODE_ENV !== 'production'`
 * @property {string} [origin]
 *   Where the local Figtree CLI is running. Defaults to http://localhost:7777
 * @property {number} [pollInterval]
 *   How often to poll for token updates while a preview is active,
 *   in milliseconds. Defaults to 1500.
 */

/**
 * @typedef {Object} FigtreeConfig
 * @property {string} namespace Your app or design system namespace.
 * @property {TokenSet} tokens
 *   Committed token set — bundled at build time. Always used in production.
 *   Used as fallback if preview fails.
 * @property {PreviewConfig} [preview]
 *   Preview configuration. Omit or set enabled: false to disable entirely.
 */

/**
 * @typedef {Object} TokenContextValue
 * @property {TokenSet} tokens Currently active token set (committed or preview).
 * @property {boolean} isPreview True when a preview token set is loaded.
 * @property {string | null} previewId The active preview ID, or null.
 * @property {() => void} clearPreview
 *   Clears the preview, removes the query param, loads committed tokens.
 */

export {}
