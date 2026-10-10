/**
 * Olit is a flavor of @galaxyproject/orbit-browser and will move to galaxy-visualizations, where
 * the core is a published package. So it reaches the core only through the package's exports:
 * never a relative path out of olit/, never Orbit's renderer, never a path inside the package.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { olitFlavor } from "./agent/flavor";

const OLIT = join(__dirname, "..");
const CORE_PACKAGE = "@galaxyproject/orbit-browser";
// Found the way any consumer finds it, so this holds wherever the core is installed.
const CORE_MANIFEST = createRequire(import.meta.url).resolve(`${CORE_PACKAGE}/package.json`);
const CORE = dirname(CORE_MANIFEST);
const EXPORTS = Object.keys(JSON.parse(readFileSync(CORE_MANIFEST, "utf8")).exports);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return ["node_modules", "static", "skills", "__surface__"].includes(name)
        ? []
        : sources(path);
    }
    return /\.(ts|js)$/.test(name) ? [path] : [];
  });
}

/** import.meta.glob takes one pattern or an array of them, and any of them can reach out. */
const GLOB = /\bimport\.meta\.glob\(\s*(\[[^\]]*\]|(["'`])[^"'`]*\2)/g;
const QUOTED = /(["'`])([^"'`$]+)\1/g;

/**
 * Every module a file names: imports, re-exports, dynamic imports, mocks, augmentations, worker
 * URLs and globs. A template with `${...}` in it can't be resolved here, so it is skipped.
 */
export function specifiers(text: string): string[] {
  const found = text.matchAll(
    /(?:\bfrom\s+|\bimport\s+|\bimport\(\s*|\bnew\s+URL\(\s*|\bvi\.(?:mock|doMock|unmock|importActual|importMock)\(\s*|\bdeclare module\s+)(["'`])([^"'`$]+)\1/g,
  );
  const globbed = [...text.matchAll(GLOB)].flatMap((m) => [...m[1].matchAll(QUOTED)]);
  return [...found, ...globbed].map((m) => m[2]);
}

/** Why `spec`, named by `file`, reaches past the core's public surface, or undefined. */
export function trespass(file: string, spec: string, root = OLIT): string | undefined {
  if (spec.includes("app/src/renderer")) {
    return "Orbit's renderer belongs to the core";
  }
  if (spec.startsWith(".")) {
    // Named outright as well as resolved: a path that means the core is wrong from anywhere.
    if (/^(\.\.?\/)+core\//.test(spec)) {
      return "a relative path to the core";
    }
    const target = relative(root, resolve(dirname(file), spec));
    return target.startsWith("..") ? "a relative path out of olit/" : undefined;
  }
  if (spec === CORE_PACKAGE || spec.startsWith(`${CORE_PACKAGE}/`)) {
    const entry = `.${spec.slice(CORE_PACKAGE.length)}`;
    return EXPORTS.includes(entry) ? undefined : `${entry} is not one of the core's exports`;
  }
  return undefined;
}

describe("olit's way into the core", () => {
  it("is the core package's exports and nothing else", () => {
    // This file's own fixtures name the reaches on purpose.
    const found = sources(OLIT)
      .filter((file) => file !== __filename)
      .flatMap((file) =>
        specifiers(readFileSync(file, "utf8")).flatMap((spec) => {
          const why = trespass(file, spec);
          return why ? [`${relative(OLIT, file)}: ${spec} (${why})`] : [];
        }),
      );
    expect(found).toEqual([]);
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
  // the tool behind it. The ones below predate the split: the notebook skill's aside, and the
  // system prompt's Galaxy terminology, which sends a request to view a dataset to
  // list_visualizations. Their text is pinned until the agent's prompts can change.
  const KNOWN = {
    "src/agent/prompt.ts": ["list_visualizations"],
    "src/agent/skills/olit-skills/notebook/SKILL.md": ["get_visualization_details"],
  };

  it("names none of Olit's tools beyond the known ones", () => {
    const tools = olitFlavor.tools!().map((t) => t.name);
    const found: Record<string, string[]> = {};
    for (const file of coreProse(join(CORE, "src"))) {
      const text = readFileSync(file, "utf8");
      const named = tools.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
      if (named.length) found[relative(CORE, file)] = named.sort();
    }
    expect(found).toEqual(KNOWN);
  });
});
