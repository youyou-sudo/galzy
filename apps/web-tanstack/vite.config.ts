import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const isnoExternal = env.NODE_ENV = 'production'
  return {
    resolve: {
      tsconfigPaths: true,
    },

    ssr: {
      noExternal: isnoExternal,
    },

    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
      target: "esnext",
      minify: "esbuild",
      rollupOptions: {
        treeshake: true,
      },
    },

    define: {
      global: "globalThis",
    },

    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),

      tanstackRouter({
        autoCodeSplitting: true,
      }),
    ],
  }
})
