import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteCompression from 'vite-plugin-compression';
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
      output: {
        manualChunks(id) {
          const nid = id.replaceAll('\\', '/')
          if (nid.includes('node_modules/react/') || nid.includes('node_modules/react-dom/') || nid.includes('node_modules/scheduler/')) {
            return 'react-vendor'
          }
          if (nid.includes('node_modules/@tanstack/')) {
            return 'tanstack-vendor'
          }
          if (
            nid.includes('node_modules/@radix-ui/') ||
            nid.includes('node_modules/lucide-react/') ||
            nid.includes('node_modules/motion/') ||
            nid.includes('node_modules/class-variance-authority/') ||
            nid.includes('node_modules/clsx/') ||
            nid.includes('node_modules/tailwind-merge/')
          ) {
            return 'ui-vendor'
          }
          if (nid.includes('node_modules/better-auth/')) {
            return 'better-auth-vendor'
          }
        },
      },
    },
  },
  plugins: [
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
