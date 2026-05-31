import { build, context } from 'esbuild'

// @metatoy/figtree-react ships both ESM and CJS. React stays external so the
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
  console.log('@metatoy/figtree-react — watching for changes...')
} else {
  await Promise.all(builds.map((b) => build(b)))
  console.log('@metatoy/figtree-react — built dist/index.js + dist/index.mjs')
}
