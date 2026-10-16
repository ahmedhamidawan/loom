/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { orbitBrowserVite } from "@galaxyproject/orbit-browser/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  ...orbitBrowserVite({ command, flavorRoot: fileURLToPath(new URL(".", import.meta.url)) }),
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.{js,ts}"],
  },
}));
