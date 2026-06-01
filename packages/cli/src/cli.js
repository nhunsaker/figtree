import { program } from 'commander'
import { serve } from '@hono/node-server'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import pc from 'picocolors'
import { createServer } from './server'
import { watchTokenFile } from './watch'
import { runStyleDictionary } from './transform'
import { openTokenPR } from './github'

// ─── config loader ────────────────────────────────────────────────────────────

/** @returns {import('./types').FigtreeCliConfig} */
const loadConfig = () => {
  const configPath = resolve(process.cwd(), 'figtree.config.json')
  if (!existsSync(configPath)) {
    console.error(pc.red('\n✗ No figtree.config.json found.\n'))
    console.error(
      pc.dim('  Run ') +
        pc.cyan('figtree init') +
        pc.dim(' to create one, or see the docs.\n'),
    )
    process.exit(1)
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'))
}

// ─── program ──────────────────────────────────────────────────────────────────

program
  .name('figtree')
  .description('Figtree design token bridge')
  .version('1.0.0')

// ─── dev (default) ────────────────────────────────────────────────────────────

program
  .command('dev', { isDefault: true })
  .description('Start the local token bridge server')
  .option('-p, --port <port>', 'port to listen on', '7777')
  .action(async (opts) => {
    const config = loadConfig()
    const port = config.port ?? parseInt(opts.port)

    console.log(pc.bold('\nFigtree'))
    console.log(pc.dim('  Namespace :') + ` ${config.namespace}`)
    console.log(pc.dim('  Tokens    :') + ` ${config.tokenPath}`)
    console.log(pc.dim('  Port      :') + ` ${port}`)

    const { read, stop } = watchTokenFile(config.tokenPath, (tokens) => {
      const count = Object.keys(tokens).length
      console.log(pc.cyan(`  → Tokens reloaded`) + pc.dim(` (${count} values)`))
      if (config.styleDictionaryConfig) {
        runStyleDictionary(config.styleDictionaryConfig)
      }
    })

    // Resolved bindable token map + captured-component artifacts produced by
    // figtree-seed. Read fresh on each request so re-seeding is picked up
    // without restarting the bridge.
    const figtreeDir = resolve(process.cwd(), '.figtree')
    const resolvedPath = resolve(figtreeDir, 'resolved.json')
    const indexPath = resolve(figtreeDir, 'index.json')

    const readJson = (p) => {
      if (!existsSync(p)) return null
      try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
    }
    const readResolved = () => {
      const data = readJson(resolvedPath)
      return data && (Array.isArray(data) ? data : data.tokens)
    }
    const readIndex = () => readJson(indexPath)

    // Look up an artifact by story id via the index. NEVER trust a raw path
    // from the caller (path-traversal safe).
    const readArtifact = (storyId) => {
      const idx = readIndex()
      const entry = idx && idx.stories && idx.stories[storyId]
      if (!entry) return null
      const artPath = resolve(process.cwd(), entry.artifact)
      // Sanity: artifact path must be inside cwd.
      if (!artPath.startsWith(process.cwd() + '/')) return null
      return readJson(artPath)
    }

    const app = createServer(config.namespace, read, readResolved, readIndex, readArtifact)

    serve({ fetch: app.fetch, port }, () => {
      console.log(
        pc.dim('\n  Preview URL :') +
          pc.cyan(` http://localhost:${port}/preview`),
      )
      console.log(
        pc.dim('  Latest      :') +
          pc.cyan(` http://localhost:${port}/tokens/latest`),
      )
      console.log(
        pc.dim('  Health      :') +
          pc.cyan(` http://localhost:${port}/health`),
      )
      console.log(pc.dim('\n  Watching for token file changes...\n'))
    })

    process.on('SIGINT', () => {
      stop()
      console.log(pc.dim('\n  Stopped.\n'))
      process.exit(0)
    })
  })

// ─── init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Create a figtree.config.json in the current directory')
  .action(() => {
    const configPath = resolve(process.cwd(), 'figtree.config.json')
    if (existsSync(configPath)) {
      console.log(pc.yellow('  figtree.config.json already exists'))
      return
    }
    /** @type {import('./types').FigtreeCliConfig} */
    const defaults = {
      namespace: 'my-app',
      tokenPath: 'tokens/tokens.json',
      styleDictionaryConfig: 'sd.config.js',
      port: 7777,
    }
    writeFileSync(configPath, JSON.stringify(defaults, null, 2) + '\n')
    console.log(pc.green('  ✓ Created figtree.config.json'))
  })

// ─── commit ───────────────────────────────────────────────────────────────────

program
  .command('commit')
  .description('Open a GitHub PR with the current token file')
  .requiredOption('--owner <owner>', 'GitHub org or user')
  .requiredOption('--repo <repo>', 'GitHub repo name')
  .requiredOption('--pat <pat>', 'GitHub personal access token')
  .option('--message <message>', 'PR / commit title', 'Update design tokens')
  .action(async (opts) => {
    const config = loadConfig()
    const content = readFileSync(
      resolve(process.cwd(), config.tokenPath),
      'utf-8',
    )

    console.log(pc.dim('\n  Opening PR...'))

    try {
      const url = await openTokenPR({
        owner: opts.owner,
        repo: opts.repo,
        tokenPath: config.tokenPath,
        content,
        message: opts.message,
        pat: opts.pat,
      })
      console.log(pc.green(`  ✓ PR opened: `) + pc.cyan(url) + '\n')
    } catch (err) {
      console.error(pc.red('  ✗ Failed to open PR:'), err)
      process.exit(1)
    }
  })

program.parse()
