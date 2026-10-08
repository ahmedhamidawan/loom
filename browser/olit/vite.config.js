import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { defines, viteConfigCharts } from "./vite.config.charts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Wherever the workspace hoisted it; scripts/install_pyodide.js puts the wheels in temp/ beside
// that node_modules.
const PYODIDE = path.dirname(createRequire(import.meta.url).resolve("pyodide/package.json"));
const WHEELS = path.join(PYODIDE, "..", "..", "temp", "pyodide");

/** Pyodide and the wheels Olit loads beside it, copied next to the bundle Galaxy serves. */
const copyPyodide = {
  name: "olit-pyodide-copy",
  writeBundle(options) {
    const dest = path.join(options.dir, "pyodide");
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(PYODIDE, dest, { recursive: true });
    for (const wheel of fs.readdirSync(WHEELS).filter((f) => f.endsWith(".whl"))) {
      fs.copyFileSync(path.join(WHEELS, wheel), path.join(dest, wheel));
    }
  },
};

/** Pyodide's files as they are, as Galaxy serves them: the dev server would transform its scripts. */
const servePyodide = {
  name: "olit-pyodide",
  configureServer(server) {
    const root = path.resolve(HERE, "static/pyodide");
    server.middlewares.use("/static/pyodide", (req, res, next) => {
      const file = path.join(root, decodeURIComponent((req.url || "").split("?")[0]));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return next();
      }
      const types = {
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".json": "application/json",
      };
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      fs.createReadStream(file).pipe(res);
    });
  },
};

export default defineConfig(({ command }) => ({
  ...viteConfigCharts,
  define: command === "build" ? defines() : viteConfigCharts.define,
  plugins: command === "build" ? [copyPyodide] : [servePyodide],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.{js,ts}"],
  },
  worker: {
    format: "es",
    // One file: WebKit runs a worker's entry module again when a chunk imports from it, and
    // the second copy takes over the worker's messages without its state.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  // The optimizer moves SQLite's module away from the .wasm it loads beside itself.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
}));
