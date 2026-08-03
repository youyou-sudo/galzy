import { mkdirSync, writeFileSync } from 'node:fs'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteCompression from 'vite-plugin-compression';
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BUILD_ID = process.env.BUILD_ID || `dev-${Date.now().toString(36)}`

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
  },

  // ssr: {
  //   noExternal: true,
  // },
  build: {
    ssrManifest: true,
    ssr: true,
    minify: 'oxc',
    modulePreload: false,
    rolldownOptions: {
      treeshake: true,
    },
  },
  plugins: [
    {
      name: 'galzy:build-id',
      resolveId(id) {
        if (id === 'virtual:build-id') return '\0virtual:build-id'
      },
      load(id) {
        if (id === '\0virtual:build-id') {
          return `export const BUILD_ID = ${JSON.stringify(BUILD_ID)};`
        }
      },
      buildEnd(error) {
        if (!error) {
          mkdirSync('dist', { recursive: true })
          writeFileSync('dist/.build-id', BUILD_ID)
        }
      },
    },
    devtools(),
    tailwindcss(),
    tanstackStart(),
    react(),
    viteCompression({ algorithm: 'gzip', ext: '.gz' }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
    babel({ presets: [reactCompilerPreset()] }),
    // tanstackRouter({
    //   autoCodeSplitting: true,
    // }),
  ],
})

export default config
