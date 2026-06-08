import { createAuthClient } from 'better-auth/react'
import { betterPlugins } from './betterPlugins'

export const authClient = createAuthClient({
  plugins: betterPlugins,
})
