#!/usr/bin/env node
/**
 * What the core needs on disk before a flavor builds against it: the Pyodide wheels the agent
 * loads and the galaxy-skills corpus it ships. A flavor's build runs this first, so a fresh
 * checkout of the flavor builds without a step only the workspace root knows about.
 */
import "./install_pyodide.js";
import "./install_skills.js";
