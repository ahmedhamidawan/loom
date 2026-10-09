/** Artifact dispatch: the kind selects the renderer. */

import { describe, expect, it, vi, beforeEach } from "vitest";

const renderMermaid = vi.fn();
const renderOther = vi.fn();

vi.mock("./mermaid", () => ({ renderMermaid: (...a: unknown[]) => renderMermaid(...a) }));

const { registerArtifactRenderers, renderArtifact, paneArtifacts } = await import("./index");
// A flavor's own kind; "other" stands in for one.
registerArtifactRenderers({ other: renderOther } as never);

const galaxy = {
  root: "http://galaxy.test/",
  get: async (): Promise<any> => ({
    href: "/static/ngl",
    entry_point: { attr: { src: "main.js" } },
  }),
};

describe("renderArtifact", () => {
  let content: HTMLElement;

  beforeEach(() => {
    renderOther.mockClear();
    renderMermaid.mockClear();
    content = document.body.appendChild(document.createElement("div"));
    (window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
  });

  it("routes a kind a flavor registered to that flavor's renderer", async () => {
    const other = { kind: "other", title: "Other", spec: {} } as never;
    await renderArtifact(content, other, "/galaxy/", galaxy);
    expect(renderOther).toHaveBeenCalledTimes(1);
    expect(renderOther.mock.calls[0].slice(1)).toEqual([other, "/galaxy/", galaxy]);
    expect(renderMermaid).not.toHaveBeenCalled();
  });

  it("routes a mermaid artifact to the mermaid renderer with its diagram", async () => {
    const diagram = "graph TD; A-->B";
    await renderArtifact(
      content,
      { kind: "mermaid", title: "Dataset lineage", diagram },
      "/",
      galaxy,
    );

    expect(renderMermaid).toHaveBeenCalledTimes(1);
    expect(renderMermaid.mock.calls[0][1]).toBe(diagram);
    expect(renderOther).not.toHaveBeenCalled();
  });

  it("renders the title as the card heading", async () => {
    await renderArtifact(
      content,
      { kind: "mermaid", title: "Dataset lineage", diagram: "graph TD;" },
      "/",
      galaxy,
    );
    expect(content.querySelector(".artifact-card-title")?.textContent).toBe("Dataset lineage");
  });
});

describe("an artifact kind with no renderer", () => {
  it("is refused instead of leaving an empty card", async () => {
    const content = document.createElement("div");
    const stray = { kind: "unrendered", title: "Stray" } as never;
    await expect(renderArtifact(content, stray, "/galaxy/", galaxy)).rejects.toThrow(
      "No renderer is registered for artifact kind 'unrendered'.",
    );
    expect(content.children).toHaveLength(0);
  });
});

describe("paneArtifacts", () => {
  const scatter = { kind: "mermaid", title: "Scatter Plot", diagram: "" } as any;
  const regression = { kind: "mermaid", title: "Linear Regression", diagram: "" } as any;

  it("shows the newest artifact, not the first one the session produced", () => {
    // A reopened session was showing the scatter it started with instead of the
    // regression it ended on, because every stored artifact was rendered in order.
    expect(paneArtifacts([scatter, regression])).toEqual([regression]);
  });

  it("shows the only artifact when a session produced one", () => {
    expect(paneArtifacts([scatter])).toEqual([scatter]);
  });

  it("shows nothing for a session that produced none", () => {
    expect(paneArtifacts([])).toEqual([]);
  });
});
