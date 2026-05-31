# Figtree example

Reference wiring for consuming the published Figtree packages in a React
app. Not a workspace member — it depends on
[`@metatoy/figtree-react`](https://www.npmjs.com/package/@metatoy/figtree-react)
and [`@metatoy/figtree-cli`](https://www.npmjs.com/package/@metatoy/figtree-cli)
straight from npm, exactly as a real consumer would.

## Files

| File | Purpose |
|---|---|
| `main.jsx` | Wraps the app in `FigtreeProvider` + `PreviewBanner` |
| `.storybook/preview.jsx` | Applies the same provider to every story |
| `figtree.config.json` | Config read by the `figtree` CLI |
| `sd.config.js` | Style Dictionary config (CSS + JS token output) |

## Run it

```bash
npm install            # pulls @metatoy/figtree-react + @metatoy/figtree-cli
npm run figtree        # starts the local token bridge (figtree dev)
```

> These files are an integration reference, not a full runnable app — they
> assume your own `App`, `index.html`, and generated `tokens/` exist. See the
> [root README](../README.md) for the end-to-end workflow.
