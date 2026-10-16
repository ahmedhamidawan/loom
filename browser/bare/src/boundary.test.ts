/** The bare flavor reaches the core the way any flavor must: through the package's exports. */
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { flavorTrespasses } from "@galaxyproject/orbit-browser/testing";

describe("the bare flavor's way into the core", () => {
  it("is the core package's exports and nothing else", () => {
    expect(flavorTrespasses(join(__dirname, ".."))).toEqual([]);
  });
});
