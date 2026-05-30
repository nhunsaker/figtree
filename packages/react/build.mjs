import { build, context } from 'esbuild'

// @figtree/react ships both ESM and CJS. React stays external so the
// provider has zero bundled runtime deps beyond React itself.
const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  external: ['react'],
  sourcemap: true,
  target: 'es2020',
  jsx: 'automatic',
}

const builds = [
  { ...shared, format: 'esm', outfile: 'dist/index.mjs' },
  { ...shared, format: 'cjs', outfile: 'dist/index.js' },
]

if (process.argv.includes('--watch')) {
  const ctxs = await Promise.all(builds.map((b) => context(b)))
  await Promise.all(ctxs.map((c) => c.watch()))
  console.log('@figtree/react — watching for changes...')
} else {
  await Promise.all(builds.map((b) => build(b)))
  console.log('@figtree/react — built dist/index.js + dist/index.mjs')
}
