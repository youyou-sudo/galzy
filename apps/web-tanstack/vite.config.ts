import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    target: "es2022",
    minify: "esbuild",
    cssCodeSplit: true,
    rollupOptions: {
      treeshake: true,
    },
  },
  define: {
    global: "globalThis",
  },
  plugins: [
    devtools(),
    tailwindcss({
      optimize: true,
    }),
    tanstackStart(),
    nitro({
      preset: "bun",
      compressPublicAssets: true,
    }),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tanstackRouter({
      autoCodeSplitting: true,
    }),
  ],
});

export default config;
