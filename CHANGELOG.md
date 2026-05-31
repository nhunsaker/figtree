# Changelog

All notable changes to the Figtree packages — `@metatoy/figtree-react` and
`@metatoy/figtree-cli` — are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/). The two
published packages are versioned together; releases are cut by publishing a
GitHub Release tagged `vX.Y.Z`, which triggers the npm publish workflow.

## [Unreleased]

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

[Unreleased]: https://github.com/nhunsaker/figtree/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/nhunsaker/figtree/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/nhunsaker/figtree/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nhunsaker/figtree/releases/tag/v1.0.0
