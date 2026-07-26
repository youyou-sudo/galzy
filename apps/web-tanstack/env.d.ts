/// <reference types="vite/client" />

type ImportMetaEnv = {}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Server-side environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly BETTER_AUTH_URL: string
      readonly API_HOST: string
      readonly NODE_ENV: 'development' | 'production' | 'test'
    }
  }
}

export { }
