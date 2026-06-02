import { readFileSync } from 'node:fs'
import StyleDictionary from 'style-dictionary'
import {
  FIGTREE_RESOLVED,
  FIGTREE_THEME_NESTED,
  FIGTREE_ALIASES,
  FIGTREE_VERSIONS,
  FIGTREE_SET_META,
  figtreeResolved,
  figtreeThemeNested,
  figtreeAliases,
  figtreeVersions,
  figtreeSetMeta,
} from './sd/figtree-format.js'

// Register Figtree's custom parser + formats before building.
StyleDictionary.registerParser(figtreeSetMeta) // lifts per-set $version pre-merge
StyleDictionary.registerFormat({ name: FIGTREE_RESOLVED, format: figtreeResolved })
StyleDictionary.registerFormat({ name: FIGTREE_THEME_NESTED, format: figtreeThemeNested })
StyleDictionary.registerFormat({ name: FIGTREE_ALIASES, format: figtreeAliases })
StyleDictionary.registerFormat({ name: FIGTREE_VERSIONS, format: figtreeVersions })

// Legacy CSS-var name → new DTCG id. Read here (NOT a token source) and handed
// to the aliases format. Delete the file + the `aliases` platform post-migration.
const aliases = JSON.parse(readFileSync(new URL('./tokens/aliases.json', import.meta.url)))

/** @type {import('style-dictionary').Config} */
export default {
  // Three DTCG tiers merge into one tree; refs resolve across all three.
  source: ['tokens/primitive.json', 'tokens/semantic.json', 'tokens/component.json'],
  parsers: [FIGTREE_SET_META],
  platforms: {
    // CSS custom properties the app reads — --color-action-primary, etc.
    css: {
      transformGroup: 'css',
      buildPath: 'src/tokens/generated/',
      files: [
        {
          destination: 'variables.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },

    // styled-components theme (generated): theme.color.action.primary →
    // var(--color-action-primary, <fallback>). Replaces the hand-kept theme.js.
    js: {
      transformGroup: 'css', // kebab names so the var() matches the css platform
      buildPath: 'src/tokens/generated/',
      files: [{ destination: 'theme.js', format: FIGTREE_THEME_NESTED }],
    },

    // The Figtree resolved bindable map — { id, cssVar, value, tier, type }.
    figtree: {
      transformGroup: 'css', // reuse css names so cssVar matches the css platform
      buildPath: '.figtree/',
      files: [
        { destination: 'resolved.json', format: FIGTREE_RESOLVED },
        { destination: 'versions.json', format: FIGTREE_VERSIONS },
      ],
    },

    // Legacy back-compat alias layer (migration window only). Imported by the
    // app alongside variables.css so old `--primaryAction` keeps resolving.
    aliases: {
      transformGroup: 'css',
      buildPath: 'src/tokens/generated/',
      files: [{ destination: 'aliases.css', format: FIGTREE_ALIASES, options: { aliases } }],
    },
  },
}
