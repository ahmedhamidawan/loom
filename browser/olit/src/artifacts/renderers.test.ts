/** Olit's kinds in the pane: each draws through its own renderer. */

import { describe, expect, it, vi, beforeEach } from "vitest";

const renderVega = vi.fn();

vi.mock("./vega", () => ({ renderVega: (...a: unknown[]) => renderVega(...a) }));

const { OLIT_RENDERERS } = await import("./renderers");

const galaxy = {
  root: "http://galaxy.test/",
  get: async (): Promise<any> => ({
    href: "/static/ngl",
    entry_point: { attr: { src: "main.js" } },
  }),
};

describe("OLIT_RENDERERS", () => {
  let body: HTMLElement;

  beforeEach(() => {
    renderVega.mockClear();
    body = document.body.appendChild(document.createElement("div"));
    (window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
  });

  it("routes a vega-lite artifact to the vega renderer with its spec", async () => {
    const spec = { mark: "point" };
    await OLIT_RENDERERS["vega-lite"]!(
      body,
      { kind: "vega-lite", title: "Chart", spec },
      "/",
      galaxy,
    );
    expect(renderVega).toHaveBeenCalledTimes(1);
    expect(renderVega.mock.calls[0][1]).toBe(spec);
  });

  it("hands the chart renderer Galaxy's root path", async () => {
    await OLIT_RENDERERS["vega-lite"]!(
      body,
      { kind: "vega-lite", title: "Chart", spec: {} },
      "/galaxy/",
      galaxy,
    );
    expect(renderVega.mock.calls[0][2]).toBe("/galaxy/");
  });

  it("mounts a Galaxy visualization from the config it carries", async () => {
    const tracks = [{ y: "1" }];
    await OLIT_RENDERERS.visualization!(
      body,
      { kind: "visualization", title: "Structure", visualization: "ngl", dataset_id: "d1", tracks },
      "/",
      galaxy,
    );
    expect(renderVega).not.toHaveBeenCalled();
    const doc = body.querySelector("iframe")!.contentDocument!;
    const handed = JSON.parse(doc.getElementById("app")!.getAttribute("data-incoming")!);
    expect(handed.visualization_config).toEqual({ dataset_id: "d1", tracks });
    expect(doc.querySelector("script")!.getAttribute("src")).toBe(
      "http://galaxy.test/static/ngl/main.js",
    );
  });
});
