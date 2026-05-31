# Storybook → Figma capture — `figtree seed`

Status: **draft / RFC (rev 2 — post technical review)**.
`schemaVersion: 1`.

## Goal

One CLI command generates, per Storybook **story**, a JSON description of the
rendered component (geometry, fills, strokes, corner radius, effects,
typography, layout) that the Figtree **Figma plugin** materializes as a native
design element — built on the **`htmlToFigma`** engine (MIT). Crucially it
**links property values to design tokens when they match**, so imported
components arrive pre-bound to Figma Variables.

- **Storybook** is the source for *discovering* components (one story = one captured variant).
- Per-component captures are stored **next to the story file**; a generated **index** lets the plugin (via the bridge) find them.

## Prerequisites (v1)

`figtree seed` requires **both** to be running:
1. A reachable **Storybook** (`seed.storybookUrl`) — we do not auto-start it.
2. The **bridge** (`figtree dev`) — seed fetches the resolved token map from it
   (`GET /tokens/resolved`) so the resolver logic lives in one place.

## Command

```bash
figtree seed [--only <glob>] [--changed]
```
- Run from the **project root** (where `figtree.config.json` lives). The root
  is needed only to resolve each story's `importPath` → absolute path for
  co-located output. **No source parsing** — discovery/capture come from
  Storybook + the rendered DOM.
- (`--states` was dropped for v1 — see States.)

## Config (new `figtree.config.json` fields)

```jsonc
{
  "namespace": "callout_admin_ui",
  "tokenPath": "tokens/tokens.json",
  "themePath": "src/styles/theme.js",   // source of the resolved bindable map
  "port": 7777,
  "seed": {
    "storybookUrl": "http://localhost:6006",
    "include": ["**/*.stories.@(jsx|tsx)"],   // optional filter on importPath
    "indexPath": ".figtree/index.json"          // generated index (see Layout)
  }
}
```

## Flow

1. **Resolve Storybook.** Fetch the index, trying `${url}/index.json` (SB7/8)
   then falling back to `${url}/stories.json` (SB6). Entries are
   `{ id, title, name, importPath, tags, type }`. **Note:** the index does
   *not* contain `argTypes`/args — each *story* is already one baked variant,
   which is exactly what v1 captures.

2. **Discover stories** from the index (no filesystem scan). Filter by
   `seed.include` against `importPath`. `importPath`
   (`./src/components/StyledComponents/Button.stories.jsx`) → absolute path →
   co-located output location.

3. **Get the resolved token map** — `GET ${bridge}/tokens/resolved` (see
   Resolver). Build a value→token index for matching.

4. **Launch headless Chromium** (Playwright). Inject the bundled `htmlToFigma`
   once per page, then for each selected story:
   ```js
   await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`);
   await page.waitForFunction(/* Storybook 'storyRendered' fired */);
   await page.evaluate(() => document.fonts.ready);
   await page.waitForLoadState('networkidle');
   const layers = await page.evaluate(
     () => window.htmlToFigma(document.querySelector('#storybook-root'))
   );
   ```
   - `htmlToFigma` returns Builder's **`LayerNode`** tree (Figma-shaped).
   - **Normalize geometry** relative to the captured root (root at `0,0`).
     Known gap: CSS `transform` distorts `getBoundingClientRect`.
   - **States (v1):** authored stories only — one capture per story. Forcing
     `:hover`/`:focus`/`:disabled` (CDP `forcePseudoState` / pseudo-states
     addon) is a future flag.

5. **Annotate tokens.** Walk the `LayerNode` tree; for each bindable property
   (fill color, stroke color, corner radius, stroke weight, item spacing,
   padding, shadow color), compute the normalized value and look it up in the
   resolved-token index. Attach a side-channel per node (does not alter the
   `LayerNode` shape, so the upstream materializer still works):
   ```jsonc
   "figtree": {
     "tokens":     { "fill": "primaryAction", "cornerRadius": "borderRadius" },
     "candidates": { "fill": ["primaryAction","primaryInputBorderActive","sideMenuBackgroundColor"] }
   }
   ```

6. **Write outputs** (see Layout) and **update the index**.

## Artifact format

**Decision: adopt Builder's `LayerNode` as the base** (so its materializer
works unchanged) and add the `figtree` annotation side-channel per node. One
file **per component (story file)**, containing all its stories:

```jsonc
{
  "schemaVersion": 1,
  "component": "Button",
  "importPath": "./src/components/StyledComponents/Button.stories.jsx",
  "capturedAt": "2026-05-31T22:00:00Z",
  "stories": [
    {
      "id": "components-button--default",
      "name": "Default",
      "hash": "sha256:…",          // content hash for --changed
      "root": { /* LayerNode tree + per-node `figtree` annotations */ }
    }
  ]
}
```

`LayerNode` carries Figma-shaped props (`type`, `x/y/width/height`, `fills`,
`strokes`, `strokeWeight`, `cornerRadius`, and for text `characters`,
`fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`,
`children`). v1 materializes **one frame per story**; assembling stories into a
Figma **component set** with variant properties is a future enhancement.

## Property catalog (what the capturer reads & saves)

Geometry via `getBoundingClientRect`; everything else via `getComputedStyle`.
🔑 = candidate for token binding (its `raw`/normalized value is matched).

| Group | CSS source | Figma target (LayerNode) | 🔑 |
|---|---|---|---|
| Geometry | bounding rect | `x`,`y`,`width`,`height` (root-relative) | |
| Fill | `background-color` | SOLID fill | 🔑 color |
| Fill | `background-image` linear/radial | gradient fill | |
| Fill | `background-image: url()` | image fill (bytes/URL — see Images) | |
| Opacity | `opacity` | `opacity` | |
| Stroke | `border-{side}-color/width/style` | strokes / `strokeTopWeight…` | 🔑 color |
| Corner | `border-{corner}-radius` | `cornerRadius` / `rectangleCornerRadii` | 🔑 number |
| Effect | `box-shadow` | DROP_SHADOW / INNER_SHADOW | 🔑 shadow color |
| Effect | `filter: blur()` | LAYER_BLUR | |
| Text | text node value | `characters` | |
| Text | `font-family` | `fontName.family` (+ load/fallback) | |
| Text | `font-weight`+`font-style` | `fontName.style` (weight→style map) | |
| Text | `font-size` | `fontSize` | |
| Text | `line-height` | `lineHeight` | |
| Text | `letter-spacing` | `letterSpacing` | |
| Text | `text-align` | `textAlignHorizontal` | |
| Text | `color` | text fill | 🔑 color |
| Text | `text-transform`/`text-decoration` | case / decoration | |
| Layout | `display`/`flex-direction` | `layoutMode` H/V | |
| Layout | `justify-content`/`align-items` | primary/counter axis align | |
| Layout | `gap` | `itemSpacing` | 🔑 spacing |
| Layout | `padding-{side}` | `paddingTop…` | 🔑 spacing |
| Layout | `position`/`overflow` | abs vs auto-layout / `clipsContent` | |
| Image | `<img>` `src` | image fill | |
| Vector | `<svg>` `outerHTML` | `createNodeFromSvg` | |

**Skip:** `display:none`, `visibility:hidden|collapse`, ~zero-area nodes with
no visible border/bg, and `SCRIPT/STYLE/LINK/META/HEAD/NOSCRIPT`.
**Pseudo-elements** (`::before/::after`) — future (often hold icons).

## Token matching

- **Exact match only**, normalized: colors → canonical `#rrggbbaa` lowercase
  (`transparent` → `#00000000`); dimensions → px number. No fuzzy/nearest in v1.
- **Match source:** the **resolved bindable token map** (below).
- **Collisions** are real even within the bindable set:
  - `#0F65EF` → `primaryAction`, `primaryInputBorderActive`, `sideMenuBackgroundColor`
  - `#EE3322` → `red5`, `secondaryColor`, `errorColor`
  - `#D7D7D7` → `gray3`, `primaryInputBorder`, `tableBorderColor`
  - **v1 policy:** deterministic best-guess (semantic > primitive, then config
    order) recorded as `tokens.*`; **all** matches recorded as `candidates.*`
    so the plugin can offer a switch. Role/context-aware selection is future.
- **Binding prerequisite (plugin side):** the named token must exist as a Figma
  Variable. Run "Sync Variables" first or create on demand; else fall back to
  the literal value.

## Resolver: the resolved bindable token map (the long pole)

The bindable set = exactly the CSS custom properties the app honors — the
`var(--NAME, FALLBACK)` entries in `theme.js`. **Raw primitives are excluded**
(`theme.blue5 = '#0F65EF'` is a literal the app never reads as `--blue5`; only
`primaryAction = var(--primaryAction, #0F65EF)` is bindable). This is why the
button bg `#0F65EF` resolves to `primaryAction`, not `blue5`.

**Approach (recommended): bundle-and-evaluate, not static parse.**
Static text parsing fails because values are template literals
(`` `var(--primaryAction, ${tokens.blue5})` `` → source shows `${tokens.blue5}`,
not the value). Instead:
1. `esbuild.build({ entryPoints:[themePath], bundle:true, format:'cjs', write:false })`
   — esbuild resolves `theme.js`'s own imports (`tokens.json`, `utils/misc`)
   standalone, no app runtime needed (esbuild is already a dep).
2. Evaluate the bundle, read the exported `theme` object's resolved string values.
3. For each value matching `var(--NAME, FALLBACK)`, extract `NAME` and parse
   `FALLBACK` with a **real `var()` parser** (the fallback can contain commas/
   parens, e.g. shadows: `var(--x, 0px 0px 0px 4px #C9D8FC)`).
4. Emit `{ name, value, kind }`. `kind` heuristic: primitive =
   `^(gray|blue|red|green|orange|purple|black|white)\d*$` or `transparent`;
   else semantic. (Heuristic — a semantic token literally named `red` would
   misclassify; acceptable for v1.)

**Ownership/data flow:** the resolver lives in `@metatoy/figtree-cli`; the
**bridge** computes the map (from `themePath`) and serves it at
`GET /tokens/resolved` (cached to `.figtree/resolved.json`). `seed` consumes
that endpoint — no duplicated resolver logic.

> ⚠️ This step is the implementation risk. If the bundle-and-evaluate approach
> proves messy, that's the signal to do the deferred **token refactor** (tiered
> `tokens.json` with semantic aliases) so the resolved map is just data.

## Bridge endpoints (added)

- `GET /tokens/resolved` → `[{ name, value, kind }]` (CORS `*`).
- `GET /artifacts` → the index (list of components/stories + metadata).
- `GET /artifact?id=<storyId>` → the artifact for a story. **Looked up by id in
  the index — never an arbitrary filesystem path** (avoids path traversal).
- All are GETs (CORS-simple); reachable via the app's existing `/figtree/*`
  proxy. The bridge sets `Access-Control-Allow-Origin: *`.

## Plugin side (consumer)

- "Insert from Storybook" → `GET /artifacts` → pick component/story →
  `GET /artifact?id=…` → materialize the `LayerNode` (ported Builder
  materializer) → for each node's `figtree.tokens.*`, **rebind** that Figma
  property to the named Variable (fall back to literal if the Variable is
  missing).
- **Fonts:** before creating text, `figma.loadFontAsync({ family, style })`.
  Map numeric `font-weight` → Figma style name (family-specific). If the
  family/style isn't available, fall back to a default and flag — otherwise
  `setCharacters` throws.

## Layout & git

- **Per-component captures:** next to the story, `Button.figtree.json`.
- **Generated index + resolved map:** under **`.figtree/`** (`index.json`,
  `resolved.json`) — kept out of `tokens/` so generated artifacts don't mix
  with the hand-authored token source. *(Changed from the earlier
  `tokens/artifacts.json`; `seed.indexPath` is configurable if you prefer the
  old location.)*
- **Git:** **commit** `*.figtree.json` (reviewable, versioned with the
  component, shareable with the team); **gitignore** `.figtree/resolved.json`
  (derived cache). *(Recommendation — open to gitignoring captures instead if
  they prove noisy.)*

## Packaging

- `seed` ships in **`@metatoy/figtree-seed`** (Playwright + vendored
  `htmlToFigma`), keeping the bridge and `@metatoy/figtree-react` lean — normal
  installs never pull Chromium.
- `htmlToFigma` vendored (MIT — retain copyright/license notice); deprecated
  upstream, so we own maintenance.

## Idempotency

- Per-story `hash` (sha256 of the captured `root`) stored in the artifact +
  index. `--changed` re-captures only stories whose hash changed since last run.

## Open / future

- Pseudo-elements and forced interaction states (hover/disabled/focus).
- Story → Figma **component set** with variant properties.
- Gradients, images (embed bytes vs URL), `transform` fidelity.
- Role/context-aware token disambiguation.
- Nearest-color matching (opt-in, ΔE threshold).

## Recommendations made in this revision (flag to veto)

1. **Artifact base = Builder `LayerNode` + annotations** (not a bespoke schema) — avoids double transform, reuses their materializer.
2. **Resolver = esbuild bundle-and-evaluate** of `theme.js` (not static parse / not app-runtime import).
3. **Generated files under `.figtree/`** (index + resolved cache), not `tokens/`. Per-component captures still next to stories.
4. **Commit `*.figtree.json`, gitignore `.figtree/resolved.json`.**
5. **`seed` requires the bridge running** (to fetch `/tokens/resolved`) — couples them, but keeps one resolver.
6. **Artifact endpoint serves by `id`**, not path.
