#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { resolveBindableTokens } from './resolveTokens.js'

// figtree-seed — Storybook → Figma capture tooling.
// v1 implements `resolve`: write the resolved bindable token map that the
// bridge serves and the plugin consumes. (Headless capture lands next.)

const cwd = process.cwd()

const loadConfig = () => {
  const p = resolve(cwd, 'figtree.config.json')
  if (!existsSync(p)) {
    console.error('✗ No figtree.config.json in', cwd)
    process.exit(1)
  }
  return JSON.parse(readFileSync(p, 'utf-8'))
}

const cmd = process.argv[2] || 'resolve'

if (cmd === 'resolve') {
  const config = loadConfig()
  const themePath = resolve(cwd, config.themePath || 'src/styles/theme.js')
  if (!existsSync(themePath)) {
    console.error('✗ themePath not found:', themePath, '\n  Set "themePath" in figtree.config.json.')
    process.exit(1)
  }

  const tokens = await resolveBindableTokens(themePath)
  const outDir = resolve(cwd, '.figtree')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'resolved.json')
  writeFileSync(
    outPath,
    JSON.stringify(
      { schemaVersion: 1, generatedAt: new Date().toISOString(), tokens },
      null,
      2,
    ) + '\n',
  )

  const s = tokens.filter((t) => t.kind === 'semantic').length
  console.log(
    `✓ Resolved ${tokens.length} bindable tokens (${s} semantic, ${tokens.length - s} primitive)`,
  )
  console.log('  → .figtree/resolved.json')
} else {
  console.error(`Unknown command: ${cmd}\nUsage: figtree-seed resolve`)
  process.exit(1)
}
