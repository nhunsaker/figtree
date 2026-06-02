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
| `sd.config.js` | Style Dictionary config (3-tier DTCG → all outputs) |
| `sd/figtree-format.js` | Custom SD parser + formats (resolved map, theme, aliases, versions) |
| `tokens/{primitive,semantic,component}.json` | The DTCG token sets (source of truth, committed) |
| `tokens/aliases.json` | Legacy CSS-var name → new DTCG id (migration only) |

## Token build pipeline

The DTCG sets are the source of truth; **Style Dictionary builds everything
else** from them:

```bash
npm run tokens         # style-dictionary build → all outputs below
```

| Output (generated, gitignored) | Consumer |
|---|---|
| `src/tokens/generated/variables.css` | the app (imported globally) |
| `src/tokens/generated/aliases.css` | the app, during migration — `--primaryAction: var(--color-action-primary)` |
| `src/tokens/generated/theme.js` | styled-components theme (`var(--…, fallback)`) |
| `.figtree/resolved.json` | bridge `/tokens/resolved`, capture annotator, plugin Sync Variables |
| `.figtree/versions.json` | per-set `$version` (drift detection) |

`figtree dev` runs this build on startup and re-runs it whenever a
`tokenSources` file changes — so the resolved map the plugin/seed consume is
always fresh. In **CI**, run `npm run tokens` (or `npm run build`) **before**
anything that consumes `dist/`, `.figtree/`, or the generated CSS/theme; commit
only the `tokens/*.json` sources, never the generated outputs.

## Run it

```bash
npm install            # pulls @metatoy/figtree-react + @metatoy/figtree-cli + style-dictionary
npm run tokens         # build tokens (also runs automatically under `figtree dev`)
npm run figtree        # starts the local token bridge (figtree dev)
```

> These files are an integration reference, not a full runnable app — they
> assume your own `App` and `index.html` exist. See the
> [root README](../README.md) for the end-to-end workflow.
