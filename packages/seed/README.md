# @metatoy/figtree-seed

Storybook → Figma capture for Figtree. This package holds the **heavy**
pieces (esbuild now; Playwright later) so the bridge (`@metatoy/figtree-cli`)
and `@metatoy/figtree-react` stay lean.

The full design lives in the team's internal spec (kept out of the repo).

## Status

Early — not yet published (`private`). Implemented so far:

- **`resolveBindableTokens(themePath)`** (`src/resolveTokens.js`) — extracts the
  *bindable* token map (every `var(--NAME, FALLBACK)` value the app honors) from
  a styled-components theme by bundling it with esbuild and evaluating it, so
  template-literal values resolve. Raw primitives (not wrapped in `var()`) are
  excluded. Returns `[{ name, value, kind: 'semantic' | 'primitive' }]`.
- **`figtree-seed resolve`** — reads `figtree.config.json` (`themePath`),
  resolves the bindable map, and writes `.figtree/resolved.json`. The bridge
  (`figtree dev`) serves this at `GET /tokens/resolved`; the plugin's
  **Sync Variables from code** button consumes it.

  ```bash
  figtree-seed resolve   # → .figtree/resolved.json
  ```

Planned: the `figtree seed` command (headless capture via Playwright + vendored
`htmlToFigma`), token annotation, artifact + index output.
