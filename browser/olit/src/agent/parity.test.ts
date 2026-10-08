import { describe, expect, it } from "vitest";

import { flavoredSkills, olitTools } from "@galaxyproject/orbit-browser/agent";

import { olitFlavor } from "./flavor";
import { CATALOG_SEARCHES } from "./hints";

describe("Olit's rules against the tool surface", () => {
  it("keys the catalog-miss note on searches the composed tools still offer", () => {
    const offered = new Set(olitTools(flavoredSkills(olitFlavor), olitFlavor).map((t) => t.name));
    expect([...CATALOG_SEARCHES].filter((name) => !offered.has(name))).toEqual([]);
  });
});
