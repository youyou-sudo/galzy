import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", 'react-dom'],
  },

  ssr: {
    noExternal: true,
  },
  build: {
    ssrManifest: true,
    ssr: true,
    minify: "oxc",
    modulePreload: false,
    rolldownOptions: {
      treeshake: true,
    },
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
});

export default config;
