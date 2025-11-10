declare namespace NodeJS {
  interface ProcessEnv {
    readonly DB_URL: string;
    readonly DB_PASSWORD: string;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: <vite>
interface ImportMetaEnv {
  readonly VITE_USER_ID: string;
  readonly VITE_PUBLIC_ENDPOINT: string;
  readonly VITE_PUBLIC_ENDPOINT2: string;
}
