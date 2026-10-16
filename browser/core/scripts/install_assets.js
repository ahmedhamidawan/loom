#!/usr/bin/env node
/**
 * What the core needs on disk before a flavor builds against it: the Pyodide wheels the agent
 * loads and the galaxy-skills corpus it ships. A flavor's build runs this first, so a fresh
 * checkout of the flavor builds without a step only the workspace root knows about.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// One after the other and stopping at the first failure, as `build:pyodide && build:skills`
// did; importing both would run their top-level mains concurrently.
for (const script of ["install_pyodide.js", "install_skills.js"]) {
  const { status } = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
    stdio: "inherit",
  });
  if (status !== 0) process.exit(status ?? 1);
}
