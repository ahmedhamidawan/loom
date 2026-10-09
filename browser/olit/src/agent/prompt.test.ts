import { describe, expect, it } from "vitest";

import { olitFlavor } from "./flavor";
import { seedDatasetBlock } from "./prompt";

describe("seed dataset", () => {
  it("names the dataset so a bare reference resolves", () => {
    const text = seedDatasetBlock("f2db41e1fa331b3e");
    expect(text).toContain("f2db41e1fa331b3e");
    expect(text).toContain("get_dataset_details");
  });

  it("adds no block without a dataset", () => {
    expect(seedDatasetBlock(undefined)).toBe("");
    expect(seedDatasetBlock("")).toBe("");
  });

  it("comes right after the identity line", () => {
    const sections = olitFlavor.promptSections!({ datasetId: "abc123" });
    expect(sections.afterIdentity).toEqual([seedDatasetBlock("abc123")]);
    expect(sections.afterRouter).toBeUndefined();
  });
});
