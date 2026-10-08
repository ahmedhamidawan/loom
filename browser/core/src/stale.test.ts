import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error a plain node script, without types
import { pinned } from "../../scripts/check_stale.js";

// The workspace's script reads each pin from the package that declares it.
const read = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", "..", name, "package.json"), "utf8"));

describe("npm run stale", () => {
  it("finds every pin it reports on, in the package that declares it", () => {
    expect(pinned(read("core"), "@galaxyproject/galaxy-ops")).toBeTruthy();
    expect(pinned(read("olit"), "galaxy-charts")).toBeTruthy();
  });
});
