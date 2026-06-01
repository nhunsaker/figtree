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

- **`figtree-seed capture`** (`src/captureCli.js`) — Playwright runner that
  visits every story in your running Storybook, injects the walker (below),
  captures the rendered root, annotates tokens against `.figtree/resolved.json`,
  and writes:
  - one **`<Component>.figtree.json`** *next to each story file* (containing
    all of that component's stories), and
  - **`.figtree/index.json`** — a story-id → artifact map (with content hashes
    for `--changed`).

  ```bash
  # one-time setup
  npm install playwright
  npx playwright install chromium

  # capture
  figtree-seed capture                          # uses seed.storybookUrl in figtree.config.json
  figtree-seed capture --only=Button.stories    # filter by importPath/title/id
  figtree-seed capture --changed                # only re-capture stories whose hash changed
  figtree-seed capture --storybook-url=https://callout-admin-ui.dev.buzzfeed.io/storybook
  ```

  **Dev Storybook URL** (callout_admin_ui):
  `https://callout-admin-ui.dev.buzzfeed.io/storybook` — exposes `/index.json`
  and `/iframe.html` and currently has the StyledComponents/Button stories
  (default / outline / outline-dark / outline-red / red / …). Set it in
  `figtree.config.json` once:

  ```jsonc
  {
    "seed": { "storybookUrl": "https://callout-admin-ui.dev.buzzfeed.io/storybook" }
  }
  ```

  The captured artifacts are then served by the bridge at
  `GET /artifacts` (the index) and `GET /artifact?id=<storyId>` (one
  artifact, looked up by id — never a raw filesystem path).

- **`captureRoot(el)`** (`src/capture.js`) — in-page DOM walker (our own
  capture engine, no `htmlToFigma` dependency). Maps element →
  FRAME/RECTANGLE/TEXT `LayerNode` with fills, strokes, corner radius, single
  box-shadow, text (family/weight/size/line-height/letter-spacing/align/color),
  flex → auto-layout + padding, and geometry relative to each parent. Designed
  to run via Playwright's `page.evaluate`; pure helpers (color/dim/shadow
  parsing) unit-tested. Scope (v1) supports the design-system primitive case;
  gradients/grid/transform/pseudo-elements are deferred.
- **`annotateTree(node, index)`** (`src/annotateTokens.js`) — walks a captured
  tree, attaches a `figtree.tokens` / `figtree.candidates` side-channel to each
  node whose bindable values (fill, stroke, corner radius, effect color) match
  the resolved bindable map. Idempotent; preserves raw values for the plugin
  materializer.

Validated end-to-end against the real resolved map: a Button DOM (jsdom) →
`captureRoot` → `annotateTree` binds `fill`/`stroke` → `primaryAction`,
`cornerRadius` → `borderRadius`, text fill → `white`, with all candidates
recorded.

Planned: the **plugin materializer** (turns each `LayerNode` into a Figma
component bound to Variables via `setBoundVariable`); pseudo-elements and
forced interaction states; component-set assembly from per-story captures.
