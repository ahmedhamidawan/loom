/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { orbitBrowserVite } from "@galaxyproject/orbit-browser/vite";
import { defineConfig } from "vite";

export default defineConfig(async ({ command }) => ({
  ...(await orbitBrowserVite({
    command,
    flavorRoot: fileURLToPath(new URL(".", import.meta.url)),
    // Visualization plugins the artifact pane mounts, from where Galaxy serves them.
    galaxyPaths: ["/static/plugins/visualizations"],
  })),
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.{js,ts}"],
  },
}));
