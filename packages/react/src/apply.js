/**
 * Writes all token values as CSS custom properties on :root.
 * Applies globally — affects the entire app.
 *
 * @param {import('./types').TokenSet} tokens
 * @returns {void}
 */
export const applyTokens = (tokens) => {
  const root = document.documentElement
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, String(value))
  })
}

/**
 * Removes token CSS custom properties from :root.
 * Called when clearing a preview to restore the committed set.
 *
 * @param {import('./types').TokenSet} tokens
 * @returns {void}
 */
export const clearTokenOverrides = (tokens) => {
  const root = document.documentElement
  Object.keys(tokens).forEach((key) => {
    root.style.removeProperty(`--${key}`)
  })
}
