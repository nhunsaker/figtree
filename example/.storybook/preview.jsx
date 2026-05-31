import React from 'react'
import { FigtreeProvider } from '@metatoy/figtree-react'
import { figtreeConfig } from '../figtree.config'

// The same FigtreeProvider that wraps the real app also wraps every
// Storybook story. Token behaviour is identical in both contexts.

/** @type {import('@storybook/react').Preview} */
const preview = {
  decorators: [
    (Story) => (
      <FigtreeProvider config={figtreeConfig}>
        <Story />
      </FigtreeProvider>
    ),
  ],
}

export default preview
