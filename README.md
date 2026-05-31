# Figtree

Design token bridge between Figma and your React app.

## Packages

| Package | Description |
|---|---|
| `@metatoy/figtree-react` | React provider — ships in your app bundle |
| `@metatoy/figtree-cli` | Local dev server — never touches production |

---

## Setup

### 1. Install

```bash
# In your React app
npm install @metatoy/figtree-react

# As a dev dependency
npm install -D @metatoy/figtree-cli
```

### 2. Add scripts

```json
// package.json
{
  "scripts": {
    "figtree": "figtree dev"
  }
}
```

### 3. Create config

```bash
npx @metatoy/figtree-cli init
```

> The `figtree` command is the binary shipped by `@metatoy/figtree-cli`.
> If you've already run the `npm install -D @metatoy/figtree-cli` from
> step 1, `npx figtree init` works too (it resolves from local
> `node_modules/.bin`). Before that install, use the full package name
> as shown above — otherwise `npx figtree` can't find the executable and
> errors with `could not determine executable to run`.

This creates `figtree.config.json`:

```json
{
  "namespace": "my-app",
  "tokenPath": "tokens/tokens.json",
  "styleDictionaryConfig": "sd.config.js",
  "port": 7777
}
```

### 4. Provide your committed tokens

The provider needs a committed token set — a flat `name → value` object
that's bundled at build time and used in production. The next step imports
it from `tokens/generated/tokens`, so that module has to exist.

To get started, create it by hand (e.g. `src/tokens/generated/tokens.js`,
matching the relative path you import from):

```js
// src/tokens/generated/tokens.js
export const tokens = {
  'color-primary': '#3B5BDB',
  'color-bg': '#ffffff',
  'color-text': '#1a1a1a',
  'space-md': '16px',
}
```

Each key becomes a CSS custom property on `:root` (`--color-primary`, …)
and is readable via `useToken('color-primary')`.

> **Generating it instead:** the `figtree` CLI can run Style Dictionary
> from a `tokens/tokens.json` source on every change. Note that Style
> Dictionary's built-in `javascript/es6` format emits *individual* named
> consts (`export const ColorPrimary = …`), **not** a single `tokens`
> object — so to keep the `import { tokens }` shape above, use a custom
> format that exports one object, or hand-maintain this file.

### 5. Wrap your app

```jsx
// main.jsx
import { FigtreeProvider, PreviewBanner } from '@metatoy/figtree-react'
import { tokens } from './tokens/generated/tokens'

const config = {
  namespace: 'my-app',
  tokens,
  preview: {
    enabled: import.meta.env.MODE !== 'production',
    origin: 'http://localhost:7777',
  },
}

<FigtreeProvider config={config}>
  <App />
  <PreviewBanner />   {/* renders nothing in production */}
</FigtreeProvider>
```

### 6. Wrap Storybook stories

```jsx
// .storybook/preview.jsx
import { FigtreeProvider } from '@metatoy/figtree-react'
import { figtreeConfig } from '../figtree.config'

export const decorators = [
  (Story) => (
    <FigtreeProvider config={figtreeConfig}>
      <Story />
    </FigtreeProvider>
  ),
]
```

---

## Usage

### Start the local bridge

```bash
npm run figtree
# → Figtree running at http://localhost:7777
```

### Preview tokens in your app

1. Figma plugin POSTs token changes to `http://localhost:7777/preview`
2. Plugin gets back a preview ID
3. Plugin opens `your-app.com?preview=<id>`
4. Your whole app renders with the proposed tokens live
5. Designer iterates, clicks commit when happy

### Commit tokens via PR

```bash
npx figtree commit \
  --owner my-org \
  --repo my-repo \
  --pat ghp_xxx \
  --message "Update primary color to indigo"
```

---

## Environment behaviour

| Environment | Preview enabled | Token source |
|---|---|---|
| `development` | ✅ Yes | bundled + preview overlay |
| `staging` | ✅ Yes (if configured) | bundled + preview overlay |
| `production` | ❌ Never | bundled only |

Preview is disabled in production at three independent levels:
1. `enabled: false` from `NODE_ENV` check
2. Bundler tree-shakes the preview fetch branch
3. No local server running anyway

---

## Hooks

```jsx
import { useToken, useTokens, useIsPreview, usePreviewState } from '@metatoy/figtree-react'

// Single token value
const primary = useToken('color-primary')

// All active tokens
const tokens = useTokens()

// Check if preview is active
const isPreviewing = useIsPreview()

// Full preview controls
const { isPreview, previewId, clearPreview } = usePreviewState()
```

---

## Repo layout

```
packages/react   @metatoy/figtree-react — the provider that ships in user apps
packages/cli     @metatoy/figtree-cli — the local dev server (never in prod)
example/         reference sample app wiring (main, sd.config, storybook)
```

---

## Publishing (maintainers)

Both packages are published to npm as public scoped packages. `dist/` is
built automatically on publish via each package's `prepublishOnly` script.

```bash
# one-time: authenticate
npm login

# from each package directory
cd packages/react && npm publish
cd packages/cli   && npm publish
```

Bump versions before publishing (e.g. `npm version patch` in each package).
