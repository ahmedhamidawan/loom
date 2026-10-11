/**
 * Olit's kinds are registered twice, once in each realm: the worker that makes them registers
 * the flavor's (startAgentWorker), and the page that shows them registers what main.ts mounts
 * the shell with. Each realm has its own registry, so each has to keep all three kinds. Both
 * tests go through the core's own entry points, so a kind or renderer missing from olitFlavor or
 * OLIT_ARTIFACTS fails here; main.ts forgetting to spread OLIT_ARTIFACTS does not.
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
  it("survives in the worker that startAgentWorker starts with Olit's flavor", async () => {
    const { artifactsOf } = await import("@galaxyproject/orbit-browser/artifacts");
    expect(artifactsOf(entries).map((a) => a.kind)).toEqual(["mermaid"]);
    const { olitFlavor } = await import("../agent/flavor");
    const { startAgentWorker } = await import("@galaxyproject/orbit-browser/worker");
    const listening = self.onmessage;
    startAgentWorker(olitFlavor);
    self.onmessage = listening;
    expect(artifactsOf(entries)).toEqual(ARTIFACTS);
  });

  it("survives on the page that main.ts mounts", async () => {
    const { artifactsOf } = await import("@galaxyproject/orbit-browser/artifacts");
    expect(artifactsOf(entries).map((a) => a.kind)).toEqual(["mermaid"]);
    const { OLIT_ARTIFACTS } = await import("./renderers");
    const { OLIT_BRAND } = await import("../brand");
    const { mountOrbitBrowser } = await import("@galaxyproject/orbit-browser");
    // A provider that needs no key keeps the picker shut, and a stopped launch starts no worker.
    sessionStorage.setItem("olit.credentials", JSON.stringify({ provider: "galaxy" }));
    const container = document.body.appendChild(document.createElement("div"));
    const handle = await mountOrbitBrowser(container, {
      galaxyRoot: "/",
      galaxyChatUrl: "/api/plugins/olit",
      pyodideURL: "/pyodide/",
      createWorker: vi.fn(),
      launch: async () => ({ stop: "stopped" }),
      ...OLIT_ARTIFACTS,
      brand: OLIT_BRAND,
    });
    handle.dispose();
    container.remove();
    sessionStorage.clear();
    expect(artifactsOf(entries)).toEqual(ARTIFACTS);
  });
});
