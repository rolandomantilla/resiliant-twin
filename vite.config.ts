import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"] },
  optimizeDeps: { include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/react-router"] },
  plugins: [
    // Must come before tsconfigPaths so import protection sees `@/` imports.
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/*.server.*", "**/src/lib/db.*", "**/src/env/server.*", "**/src/server/**"],
          excludeFiles: ["**/node_modules/**", "**/src/server/auth.*", "**/src/server/protectedServerFn.*"],
        },
      },
    }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    nitro({ preset: "bun" }),
    viteReact(),
  ],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      external: ["bun"],
    },
  },
  server: {
    fs: { strict: false },
    allowedHosts: true,
  },
});

export default config;
