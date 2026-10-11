/**
 * Olit is a flavor of @galaxyproject/orbit-browser and will move to galaxy-visualizations, where
 * the core is a published package. So it reaches the core only through the package's exports:
 * never a relative path out of olit/, never Orbit's renderer, never a path inside the package.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { olitFlavor } from "./agent/flavor";
import {
  CORE_PACKAGE,
  flavorTrespasses,
  specifiers,
  trespass as reach,
} from "@galaxyproject/orbit-browser/testing";

const OLIT = join(__dirname, "..");
// Found the way any consumer finds it, so this holds wherever the core is installed.
const CORE = dirname(createRequire(import.meta.url).resolve(`${CORE_PACKAGE}/package.json`));
const trespass = (file: string, spec: string) => reach(OLIT, file, spec);

describe("olit's way into the core", () => {
  it("is the core package's exports and nothing else", () => {
    // This file's own fixtures name the reaches on purpose.
    expect(flavorTrespasses(OLIT, [__filename])).toEqual([]);
  });

  it("catches each way of reaching past it", () => {
    const file = join(OLIT, "src", "main.ts");
    expect(trespass(file, "../../core/src/agent/tool")).toBeDefined();
    expect(trespass(file, "../core/src/agent/tool")).toBeDefined();
    expect(trespass(file, "../../app/src/renderer/theme")).toBeDefined();
    expect(trespass(file, `${CORE_PACKAGE}/src/agent/tool`)).toBeDefined();
    expect(trespass(file, `${CORE_PACKAGE}/agent`)).toBeUndefined();
    expect(trespass(file, "./artifacts/kinds")).toBeUndefined();
    expect(specifiers('declare module "a";\nimport("b");\nexport { c } from "c";')).toEqual([
      "a",
      "b",
      "c",
    ]);
    const reaches = [
      'new Worker(new URL("../../core/src/agent/worker.ts", import.meta.url));',
      'import.meta.glob("../../core/src/agent/skills/**/*");',
      'import.meta.glob(["./skills/**/*", "../../core/src/agent/skills/**/*"]);',
      'vi.importActual("../../core/src/agent/tool");',
      'vi.doMock("../../core/src/agent/tool");',
      "import(`../../core/src/agent/tool`);",
    ];
    for (const line of reaches) {
      expect(
        specifiers(line).some((spec) => trespass(file, spec)),
        line,
      ).toBe(true);
    }
    expect(specifiers("import(`./${name}`);")).toEqual([]);
  });
});

/** The core's own prompt, skills and code: not its tests, and not the vendored galaxy-skills. */
function coreProse(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return ["node_modules", "galaxy-skills", "__surface__"].includes(name) ? [] : coreProse(path);
    }
    return /\.(ts|js|md)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("the core's prose", () => {
  // A tool only Olit has, named by the core, is a reference every other flavor ships without
  // the tool behind it. A term that needs one goes in through promptSections instead.
  it("names none of Olit's tools", () => {
    const tools = olitFlavor.tools!().map((t) => t.name);
    const found: Record<string, string[]> = {};
    for (const file of coreProse(join(CORE, "src"))) {
      const text = readFileSync(file, "utf8");
      const named = tools.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
      if (named.length) found[relative(CORE, file)] = named.sort();
    }
    expect(found).toEqual({});
  });
});
