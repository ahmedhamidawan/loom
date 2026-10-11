/**
 * The core imports no flavor: no other workspace package, by path or by name, and none of the packages
 * only a visualization flavor needs. A kind, tool or renderer that needs one of these belongs in
 * the flavor that adds it. Olit's name itself still appears in the core; LAYOUT.md's "Not split
 * yet" says where and why.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { specifiers } from "./flavor-boundary";

const CORE = join(__dirname, "..");
const FLAVOR_ONLY = [
  "galaxy-charts",
  "galaxy-charts-xml-parser",
  "vega",
  "vega-lite",
  "vega-embed",
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return ["node_modules", "skills"].includes(name) ? [] : sources(path);
    }
    return /\.(ts|js)$/.test(name) ? [path] : [];
  });
}

/** The workspace's other packages: every flavor, by folder and by package name. */
const FLAVORS = (
  JSON.parse(readFileSync(join(CORE, "..", "package.json"), "utf8")).workspaces as string[]
)
  .filter((folder) => folder !== "core")
  .map((folder) => ({
    folder,
    name: JSON.parse(readFileSync(join(CORE, "..", folder, "package.json"), "utf8")).name as string,
  }));

function flavored(file: string, spec: string): string | undefined {
  if (spec.startsWith(".")) {
    const target = relative(join(CORE, ".."), resolve(dirname(file), spec));
    const flavor = FLAVORS.find((f) => target === f.folder || target.startsWith(`${f.folder}/`));
    return flavor ? `a path into ${flavor.folder}/` : undefined;
  }
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  const flavor = FLAVORS.find((f) => f.name === name);
  if (flavor) return `the ${flavor.folder} package`;
  return FLAVOR_ONLY.includes(name) ? `${name}, which only a visualization flavor uses` : undefined;
}

describe("the core", () => {
  it("imports no flavor and nothing only a flavor needs", () => {
    // This file's own fixtures name the reaches on purpose.
    const found = sources(CORE)
      .filter((file) => file !== __filename)
      .flatMap((file) =>
        specifiers(readFileSync(file, "utf8")).flatMap((spec) => {
          const why = flavored(file, spec);
          return why ? [`${relative(CORE, file)}: ${spec} (${why})`] : [];
        }),
      );
    expect(found).toEqual([]);
  });

  it("catches each way of naming one", () => {
    const file = join(CORE, "src", "shell.ts");
    expect(flavored(file, "../../olit/src/agent/flavor")).toBeDefined();
    expect(flavored(file, "@galaxyproject/olit")).toBeDefined();
    expect(flavored(file, "vega-embed")).toBeDefined();
    expect(flavored(file, "galaxy-charts/runtime")).toBeDefined();
    expect(flavored(file, "vegafusion")).toBeUndefined();
    expect(flavored(file, "./artifacts/kinds")).toBeUndefined();
    expect(
      specifiers(
        [
          'new Worker(new URL("../../olit/src/worker.ts", import.meta.url));',
          'import.meta.glob("../../olit/src/agent/skills/**/*");',
          'import.meta.glob(["./skills/**/*", "../../olit/src/agent/skills/**/*"]);',
          'vi.importActual("../../olit/src/agent/flavor");',
          'vi.doMock("vega-embed");',
          "import(`../../olit/src/main`);",
          "import(`./${name}`);",
        ].join("\n"),
      ),
    ).toEqual([
      "../../olit/src/worker.ts",
      "../../olit/src/agent/flavor",
      "vega-embed",
      "../../olit/src/main",
      "../../olit/src/agent/skills/**/*",
      "./skills/**/*",
      "../../olit/src/agent/skills/**/*",
    ]);
  });
});
