# @metatoy/figtree-cli

Local token bridge server and dev tooling for
[Figtree](https://github.com/nhunsaker/figtree). A dev dependency only —
it never touches production.

```bash
npm install -D @metatoy/figtree-cli
```

## Commands

```bash
figtree init      # create a figtree.config.json
figtree dev       # start the local token bridge server (default command)
figtree commit \  # open a GitHub PR with the current token file
  --owner my-org --repo my-repo --pat ghp_xxx \
  --message "Update primary color to indigo"
```

## What `figtree dev` does

- Serves the preview API the Figma plugin and your React app talk to:
  `POST/GET/PUT/DELETE /preview`, `GET /tokens/latest`, `GET /health`.
- Watches your source `tokens.json` and, if configured, re-runs Style
  Dictionary on every change.

Configure it with `figtree.config.json`:

```json
{
  "namespace": "my-app",
  "tokenPath": "tokens/tokens.json",
  "styleDictionaryConfig": "sd.config.js",
  "port": 7777
}
```

See the [main README](https://github.com/nhunsaker/figtree#readme) for the
full workflow.
