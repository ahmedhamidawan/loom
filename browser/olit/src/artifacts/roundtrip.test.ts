/**
 * Olit's kinds are registered twice, once in each realm: the worker that makes them registers
 * the flavor's (startAgentWorker), and the page that shows them registers what main.ts mounts
 * the shell with. Each realm has its own registry, so each has to keep all three kinds.
 */
import type { EntryRecord } from "@earendil-works/pi-durable";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ARTIFACTS = [
  { kind: "vega-lite", title: "chart", spec: { mark: "bar" } },
  { kind: "visualization", title: "reads", visualization: "igv", dataset_id: "d1" },
  { kind: "mermaid", title: "lineage", diagram: "graph TD;" },
];

const entries = [
  {
    id: 1,
    kind: "pi.tool-result",
    model: [{ role: "toolResult", details: { artifacts: ARTIFACTS } }],
  },
] as unknown as EntryRecord[];

beforeEach(() => {
  // A realm of its own: the core's registry starts with only its mermaid kind.
  vi.resetModules();
});

describe("an artifact carried across a realm", () => {
  it("survives in the worker, registered as startAgentWorker registers the flavor", async () => {
    const { artifactsOf } = await import("@galaxyproject/orbit-browser/artifacts");
    expect(artifactsOf(entries).map((a) => a.kind)).toEqual(["mermaid"]);
    const { olitFlavor } = await import("../agent/flavor");
    const { registerArtifactKinds } = await import("@galaxyproject/orbit-browser/artifacts");
    registerArtifactKinds(olitFlavor.artifactKinds ?? []);
    expect(artifactsOf(entries)).toEqual(ARTIFACTS);
  });

  it("survives on the page, registered as main.ts mounts the shell", async () => {
    const { artifactsOf, registerArtifactKinds } =
      await import("@galaxyproject/orbit-browser/artifacts");
    expect(artifactsOf(entries).map((a) => a.kind)).toEqual(["mermaid"]);
    const { OLIT_KINDS } = await import("./kinds");
    registerArtifactKinds(OLIT_KINDS);
    expect(artifactsOf(entries)).toEqual(ARTIFACTS);
  });
});
