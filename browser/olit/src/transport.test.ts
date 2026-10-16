/**
 * Galaxy is reached through the core's one transport, Olit's own tools included. A `fetch`
 * anywhere in Olit has to say what it reaches instead.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname);
const SKIPPED = ["agent/skills/"];

/** Every direct `fetch(` call that is not Galaxy, and what it reaches. */
const NOT_GALAXY: Record<string, string> = {};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : [path];
  });
}

describe("the Galaxy transport", () => {
  it("is the only way the page or the agent fetches from Galaxy", () => {
    const fetching = sources(ROOT)
      .map((path) => relative(ROOT, path))
      .filter((rel) => /\.(ts|js)$/.test(rel) && !rel.endsWith(".test.ts"))
      .filter((rel) => !SKIPPED.some((s) => rel.startsWith(s)))
      .filter((rel) => /(^|[^\w.])fetch\(/m.test(readFileSync(join(ROOT, rel), "utf8")))
      .sort();
    expect(fetching).toEqual(Object.keys(NOT_GALAXY).sort());
  });

  it("is never built here: Olit's tools reach Galaxy, and other hosts, through their context", () => {
    const building = sources(ROOT)
      .map((path) => relative(ROOT, path))
      .filter((rel) => /\.(ts|js)$/.test(rel) && !rel.endsWith(".test.ts"))
      .filter((rel) => !SKIPPED.some((s) => rel.startsWith(s)))
      .filter((rel) => /connectGalaxy\(/.test(readFileSync(join(ROOT, rel), "utf8")))
      .sort();
    expect(building).toEqual([]);
  });
});
