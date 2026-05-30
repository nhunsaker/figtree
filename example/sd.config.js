/** @type {import('style-dictionary').Config} */
export default {
  source: ['tokens/tokens.json'],
  platforms: {
    // CSS custom properties — imported in index.css
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

    // JavaScript constants — imported by FigtreeProvider
    js: {
      transformGroup: 'js',
      buildPath: 'src/tokens/generated/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
        },
      ],
    },
  },
}
