import { createContext, useContext } from 'react'

/** @type {import('react').Context<import('./types').TokenContextValue | null>} */
export const TokenContext = createContext(null)

/** @returns {import('./types').TokenContextValue} */
export const useTokenContext = () => {
  const ctx = useContext(TokenContext)
  if (!ctx) {
    throw new Error('Figtree hooks must be used inside <FigtreeProvider>')
  }
  return ctx
}
