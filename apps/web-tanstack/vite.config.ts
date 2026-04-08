import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from "@vitejs/plugin-react";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      treeshake: true,
      output: {
        manualChunks: undefined,
      },
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
    react({
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
