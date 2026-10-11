import { createGalaxyContext } from "@galaxyproject/galaxy-ops/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Context } from "@galaxyproject/orbit-browser/agent";
import { connectGalaxy, agentTools } from "@galaxyproject/orbit-browser/testing";
import { connectWeb, Outcome } from "@galaxyproject/orbit-browser/testing";
import { registerArtifactKinds, type Artifact } from "@galaxyproject/orbit-browser/artifacts";
import { OLIT_KINDS } from "../artifacts/kinds";

registerArtifactKinds(OLIT_KINDS);

const ROOT = "http://galaxy.test/";
const RECORD =
  "## Record\n\nThis page is the running record for this analysis, maintained by Olit.\n";

/** One Galaxy page, as Galaxy's pages API serves and stores it. */
function galaxyPage(content: string) {
  const page = { id: "p1", content_format: "markdown", content_editor: content, content };
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    if (request.method === "PUT") {
      const body = JSON.parse(await request.text());
      if (body.content != null) page.content = page.content_editor = body.content;
    }
    return new Response(JSON.stringify(page), { headers: { "content-type": "application/json" } });
  });
  return page;
}

/** A tool call's context, as the session hosting the conversation hands it over. */
/** The chart the session showed the user: a saved ngl view of a structure. */
const SURFACE: Artifact = {
  kind: "visualization",
  title: "1A2C surface",
  visualization: "ngl",
  dataset_id: "ddfea06f9d1e8b57",
  settings: { mode: "surface", radius: 0.3 },
  visualization_id: "879ba288280d20df",
};

const context = (sessionId: string): Context => ({
  galaxy: connectGalaxy({ root: ROOT }),
  web: connectWeb(),
  ops: createGalaxyContext({ baseUrl: ROOT, apiKey: "" }),
  python: { run: async () => "", write: async () => {}, read: async () => undefined },
  binding: { sessionId, pageId: "p1" },
  artifacts: { prior: [SURFACE], produced: [] },
});

const call = (name: string, args: Record<string, unknown>, sessionId = "s1") =>
  agentTools()
    .find((t) => t.name === name)!
    .run(args, context(sessionId)) as Promise<Outcome>;

afterEach(() => vi.unstubAllGlobals());

describe("a visualization placed in the record", () => {
  it("lands on the page as the visualization cell the user saw", async () => {
    const page = galaxyPage(RECORD);
    const out = await call("update_page", {
      page_id: "p1",
      section_heading: "## Structure",
      section_content: "## Structure\n\nThe surface of 1A2C.\n\n{{artifact}}\n",
    });
    expect(out.isError).toBe(false);
    const cell = page.content_editor.match(/```visualization\n([\s\S]*?)\n```/);
    expect(cell).not.toBeNull();
    expect(JSON.parse(cell![1])).toEqual({
      visualization_name: "ngl",
      visualization_title: "1A2C surface",
      dataset_id: "ddfea06f9d1e8b57",
      settings: { mode: "surface", radius: 0.3 },
    });
    expect(page.content_editor).not.toContain("{{");
  });

  it("refuses an embed of its own invention and leaves the page as it was", async () => {
    const page = galaxyPage(RECORD);
    const out = await call("update_page", {
      page_id: "p1",
      section_heading: "## Structure",
      section_content: "## Structure\n\n{{visualization|visualization_id=879ba288280d20df}}\n",
    });
    expect(out.isError).toBe(true);
    expect(out.text).toContain("write {{artifact}}");
    expect(page.content_editor).toBe(RECORD);
  });
});
