import { defineConfig } from "vite";
import babel from 'vite-plugin-babel';
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
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

    react(),
    babel({
      babelConfig: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),

    tanstackRouter({
      autoCodeSplitting: true,
    }),
  ],
}
)
