# Changelog

All notable changes to the Figtree packages — `@metatoy/figtree-react` and
`@metatoy/figtree-cli` — are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/). The two
published packages are versioned together; releases are cut by publishing a
GitHub Release tagged `vX.Y.Z`, which triggers the npm publish workflow.

## [Unreleased]

## [1.2.0] - 2026-06-01

The 3-tier **DTCG token taxonomy**: tokens are authored as DTCG sets and built
by Style Dictionary into one resolved bindable map that the bridge serves,
capture annotates against, and the plugin syncs to Figma. Replaces the POC's
`PRIMITIVE_RE` auto-bind heuristic and the runtime esbuild-eval resolver, and
removes the "two token lists" divergence (one build, one map).

> **⚠ Breaking (bridge HTTP contract):** `GET /tokens/resolved` now returns
> `[{ id, cssVar, value, tier, type }]` (was `[{ name, value, kind }]`). The
> bundled plugin and `figtree-seed` are updated in lockstep. The common
> consumer path — `FigtreeProvider` + a flat `tokenPath` — is unchanged and
> fully back-compatible, which is why this is a minor (not major) release.

### Added
- **`@metatoy/figtree-cli`**
  - `tokenSources` config — watch the DTCG token sets and re-run Style
    Dictionary on change (`figtree dev` also builds once on startup).
  - `GET /tokens/latest` now derives a flat `{ cssVar: value }` map from the
    SD-built `.figtree/resolved.json` when no legacy flat `tokenPath` exists, so
    the DTCG taxonomy works without a hand-maintained flat token file.
  - `figtree init` scaffolds `tokenSources` for the 3-tier layout.
- **`@metatoy/figtree-seed`** (private) — tier + property-affinity auto-bind:
  captured fills/strokes/text/radius bind to the right component tokens
  (`fill→bg`, `stroke→border`, text→`text`, `cornerRadius→radius`), tier-ranked
  (`component > semantic > primitive`) with fallback.
- **`@metatoy/figtree-plugin`** (private) — "Sync Variables" creates grouped
  Figma Variables (a collection per tier; names mirror the DTCG path with
  `/` groups) and binds captured nodes by grouped name. Single default mode
  (theme modes / aliasing are a rename-free upgrade).
- Reference token pipeline in `example/`: DTCG sets, Style Dictionary config +
  custom formats (resolved map, nested theme, legacy aliases, per-set versions),
  legacy `aliases.json` dual-emit, `$version`/`$deprecated` support.

### Changed
- **`@metatoy/figtree-cli`** — `GET /tokens/resolved` serves the new resolved-map
  schema (see breaking note above). `figtree dev` startup log lists
  `tokenSources` instead of a single `tokenPath`.
- **`@metatoy/figtree-react`** — no functional changes; version aligned with the
  jointly-released CLI.

### Removed
- **`@metatoy/figtree-seed`** — the esbuild-bundle-and-eval token resolver
  (`resolveTokens.js` / `resolveBindableTokens`). `figtree-seed resolve` is now a
  thin wrapper that runs `style-dictionary build`; Style Dictionary is the sole
  producer of the resolved map.

## [1.1.0] - 2026-05-31

### Added
- `packages/plugin` — Figma plugin that reads the file's local Variables,
  maps them to the token shape, POSTs a preview to the bridge, and opens the
  app at `?preview=<id>`. Posts as `text/plain` to skip the CORS preflight.
  _(Not published to npm.)_
- `.github/workflows/release.yml` — publishing a GitHub Release builds and
  publishes both packages to npm at the release's tag version.

## [1.0.2] - 2026-05-31

### Changed
- No functional changes. Release cut to verify the automated
  GitHub Release → npm publish pipeline end to end.

## [1.0.1] - 2026-05-31

### Changed
- No functional changes to the packages. First version published via the
  automated release workflow (previously published manually).

## [1.0.0] - 2026-05-31

### Added
- **`@metatoy/figtree-react`** — the provider that ships in the app bundle:
  - `FigtreeProvider` — loads committed tokens, applies them as CSS custom
    properties, and overlays a live preview set when `?preview=<id>` is
    present; polls the bridge and falls back silently if it's unreachable.
  - `PreviewBanner` — renders only while a preview is active; nothing in
    production.
  - Hooks: `useTokens`, `useToken`, `useIsPreview`, `usePreviewState`.
  - Zero runtime dependencies beyond React; ships ESM + CJS.
- **`@metatoy/figtree-cli`** — the local dev bridge (never in production):
  - Hono server: `POST/GET/PUT/DELETE /preview`, `GET /tokens/latest`,
    `GET /health`.
  - `chokidar` token-file watcher.
  - Commands: `figtree dev`, `figtree init`, `figtree commit` (opens a GitHub
    PR with the updated token file).
- JavaScript implementation built with **esbuild** (no TypeScript dependency);
  types provided via JSDoc.

[Unreleased]: https://github.com/nhunsaker/figtree/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/nhunsaker/figtree/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/nhunsaker/figtree/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/nhunsaker/figtree/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/nhunsaker/figtree/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nhunsaker/figtree/releases/tag/v1.0.0
