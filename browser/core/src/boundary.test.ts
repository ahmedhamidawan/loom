/**
 * The core names no flavor: not Olit, and none of what makes Olit a Galaxy visualization
 * plugin. A kind, tool or renderer that needs one of these belongs in the flavor that adds it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

const specifiers = (text: string) =>
  [
    ...text.matchAll(
      /(?:\bfrom\s+|\bimport\s+|\bimport\(\s*|\bvi\.mock\(\s*|\bdeclare module\s+)["']([^"']+)["']/g,
    ),
  ].map((m) => m[1]);

function flavored(file: string, spec: string): string | undefined {
  if (spec.startsWith(".")) {
    const target = relative(join(CORE, ".."), resolve(dirname(file), spec));
    return target === "olit" || target.startsWith("olit/") ? "a path into olit/" : undefined;
  }
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  if (name === "@galaxyproject/olit") return "the Olit package";
  return FLAVOR_ONLY.includes(name) ? `${name}, which only a visualization flavor uses` : undefined;
}

describe("the core", () => {
  it("imports no flavor and nothing only a flavor needs", () => {
    const found = sources(CORE).flatMap((file) =>
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
  });
});
