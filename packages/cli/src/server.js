import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid'

const PREVIEW_TTL_MS = 1000 * 60 * 60 * 24 // 24 hours

/**
 * @param {string} namespace
 * @param {() => import('./types').TokenSet} getLatestTokens
 */
export const createServer = (namespace, getLatestTokens) => {
  /** @type {Map<string, import('./types').PreviewEntry>} */
  const previews = new Map()

  // Prune expired previews every hour
  setInterval(() => {
    const now = Date.now()
    for (const [id, entry] of previews) {
      if (now - entry.createdAt > PREVIEW_TTL_MS) {
        previews.delete(id)
      }
    }
  }, 1000 * 60 * 60)

  const app = new Hono()

  // Allow requests from any origin — the plugin UI and the React app
  // are on different origins from the local server
  app.use('*', cors({ origin: '*' }))

  // ─── POST /preview ────────────────────────────────────────────────────────
  // Figma plugin POSTs a proposed token set here.
  // Returns a short preview ID the React app can use via ?preview=<id>
  app.post('/preview', async (c) => {
    const tokens = await c.req.json()
    const id = nanoid(8)
    previews.set(id, { tokens, createdAt: Date.now() })
    const url = `?preview=${id}`
    return c.json({ id, url })
  })

  // ─── GET /preview/:id ─────────────────────────────────────────────────────
  // React app polls this while a preview is active.
  app.get('/preview/:id', (c) => {
    const entry = previews.get(c.req.param('id'))
    if (!entry) {
      return c.json({ error: 'Preview not found or expired' }, 404)
    }
    return c.json(entry.tokens)
  })

  // ─── PUT /preview/:id ─────────────────────────────────────────────────────
  // Plugin updates an existing preview in-place (live edit mode).
  app.put('/preview/:id', async (c) => {
    const id = c.req.param('id')
    if (!previews.has(id)) {
      return c.json({ error: 'Preview not found' }, 404)
    }
    const tokens = await c.req.json()
    previews.set(id, { tokens, createdAt: Date.now() })
    return c.json({ id, updated: true })
  })

  // ─── DELETE /preview/:id ──────────────────────────────────────────────────
  // Plugin clears a preview when designer exits without committing.
  app.delete('/preview/:id', (c) => {
    previews.delete(c.req.param('id'))
    return c.json({ deleted: true })
  })

  // ─── GET /tokens/latest ───────────────────────────────────────────────────
  // Returns the latest committed tokens from disk.
  // Plugin fetches this on open to pre-populate the editor.
  app.get('/tokens/latest', (c) => {
    return c.json(getLatestTokens())
  })

  // ─── GET /health ──────────────────────────────────────────────────────────
  app.get('/health', (c) => {
    return c.json({
      ok: true,
      namespace,
      activePreviews: previews.size,
    })
  })

  return app
}
