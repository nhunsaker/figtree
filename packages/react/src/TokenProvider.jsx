import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TokenContext } from './context'
import { applyTokens } from './apply'

/**
 * @param {{ config: import('./types').FigtreeConfig, children: React.ReactNode }} props
 */
export const FigtreeProvider = ({ config, children }) => {
  const [activeTokens, setActiveTokens] = useState(config.tokens)
  const [isPreview, setIsPreview] = useState(false)
  const [previewId, setPreviewId] = useState(null)
  const pollRef = useRef(null)

  // ─── committed token loader ───────────────────────────────────────────────
  const loadCommitted = useCallback(() => {
    applyTokens(config.tokens)
    setActiveTokens(config.tokens)
    setIsPreview(false)
    setPreviewId(null)
  }, [config.tokens])

  // ─── preview token loader ─────────────────────────────────────────────────
  const loadPreview = useCallback(
    async (id) => {
      const origin = config.preview?.origin ?? 'http://localhost:7777'
      try {
        const res = await fetch(`${origin}/preview/${id}`)
        if (!res.ok) throw new Error('preview not found')
        const tokens = await res.json()
        applyTokens(tokens)
        setActiveTokens(tokens)
        setIsPreview(true)
        setPreviewId(id)
        return true
      } catch {
        // local server not running, preview expired, or network error
        // fall back silently — never break the app
        loadCommitted()
        return false
      }
    },
    [config.preview?.origin, loadCommitted],
  )

  // ─── clear preview + remove query param ──────────────────────────────────
  const clearPreview = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const params = new URLSearchParams(location.search)
    params.delete('preview')
    const qs = params.toString()
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname)
    loadCommitted()
  }, [loadCommitted])

  // ─── initialise on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const previewEnabled = config.preview?.enabled ?? false
    const id = new URLSearchParams(location.search).get('preview')

    // bail out immediately if preview is disabled or no param present
    if (!previewEnabled || !id) {
      loadCommitted()
      return
    }

    // load the preview, then start polling so Figma changes reflect live
    loadPreview(id).then((ok) => {
      if (!ok) return
      const interval = config.preview?.pollInterval ?? 1500
      pollRef.current = setInterval(() => loadPreview(id), interval)
    })

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, []) // intentionally empty — only runs on mount

  return (
    <TokenContext.Provider value={{ tokens: activeTokens, isPreview, previewId, clearPreview }}>
      {children}
    </TokenContext.Provider>
  )
}
