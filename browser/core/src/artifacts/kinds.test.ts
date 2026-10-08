import type { EntryRecord } from "@earendil-works/pi-durable";
import { describe, expect, it } from "vitest";

import { artifactsOf, isKind, pageWriter, registerArtifactKinds, toPage } from "./kinds";

const result = (artifacts: unknown[]) =>
  ({
    id: 1,
    kind: "pi.tool-result",
    model: [{ role: "toolResult", details: { artifacts } }],
  }) as unknown as EntryRecord;

describe("the core's own kinds", () => {
  it("gives a diagram no page form, since Galaxy renders no mermaid cell", () => {
    expect(pageWriter("mermaid")).toBeNull();
    expect(toPage({ kind: "mermaid", title: "Lineage", diagram: "graph TD;" })).toBeUndefined();
  });

  it("reads them off the results in order", () => {
    const chart = { kind: "mermaid", title: "a", diagram: "graph TD;" };
    expect(
      artifactsOf([result([chart]), result([{ ...chart, title: "b" }])]).map((a) => a.title),
    ).toEqual(["a", "b"]);
  });

  it("drops a kind no flavor registered, as a saved document from another flavor may carry", () => {
    expect(isKind("vega-lite")).toBe(false);
    expect(artifactsOf([result([{ kind: "vega-lite", title: "x", spec: {} }])])).toEqual([]);
  });
});

describe("a flavor's kinds", () => {
  const writer = () => "```note\n```";
  const note = { kind: "note", toPage: writer } as never;

  it("are kept once registered, and registering one again is harmless", () => {
    registerArtifactKinds([note]);
    registerArtifactKinds([note]);
    expect(isKind("note")).toBe(true);
    expect(artifactsOf([result([{ kind: "note", title: "n" }])])).toHaveLength(1);
  });

  it("cannot give a kind already known another page form", () => {
    expect(() => registerArtifactKinds([{ kind: "note", toPage: () => "" } as never])).toThrow(
      /already registered/,
    );
    expect(() => registerArtifactKinds([{ kind: "mermaid", toPage: writer } as never])).toThrow();
  });
});
