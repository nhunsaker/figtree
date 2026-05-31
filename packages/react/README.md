# @metatoy/figtree-react

React provider for [Figtree](https://github.com/nhunsaker/figtree) design
tokens. Ships in your app bundle — zero runtime dependencies beyond React.

```bash
npm install @metatoy/figtree-react
```

## Usage

```jsx
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

When the app is opened with `?preview=<id>`, the provider fetches the
proposed token set from the local Figtree server, applies it as CSS custom
properties on `:root`, and polls for live updates. If the server isn't
running it falls back silently to the committed tokens — preview never
breaks production.

## Hooks

```jsx
import { useToken, useTokens, useIsPreview, usePreviewState } from '@metatoy/figtree-react'

const primary = useToken('color-primary')          // single token value
const tokens = useTokens()                          // full active token set
const isPreviewing = useIsPreview()                 // boolean
const { isPreview, previewId, clearPreview } = usePreviewState()
```

See the [main README](https://github.com/nhunsaker/figtree#readme) for the
full workflow.
