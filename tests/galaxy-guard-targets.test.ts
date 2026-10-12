import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { setGalaxyFetchOverride } from "../extensions/loom/galaxy-api";
import { fixtureFetch } from "../extensions/loom/galaxy-fixture";

// Two guards the browser has and loom doesn't yet (#567 "Guards"). These pin the
// target behavior with the browser's refusal text, verbatim from
// browser/core/src/agent/guards.ts (repeated failure) and galaxy-tools.ts
// (cross-history input). They are skipped until the port lands; the port
// un-skips them and swaps the lazy imports below for static ones.

vi.mock("../extensions/loom/state", () => ({ getNotebookPath: () => null }));

type Handler = (event: unknown, ctx?: unknown) => unknown;

/** A guard module by name, loaded only when a test runs, since it doesn't exist yet. */
async function register(module: string, fn: string): Promise<Map<string, Handler>> {
  const mod = (await import(/* @vite-ignore */ `../extensions/loom/${module}`)) as Record<
    string,
    (pi: ExtensionAPI) => void
  >;
  const handlers = new Map<string, Handler>();
  mod[fn]({ on: (event: string, h: Handler) => handlers.set(event, h) } as never);
  return handlers;
}

const RUN_TOOL = "mcp__galaxy__run_tool";
const ARGS = { history_id: "here", tool_id: "cat1", inputs: { input1: { src: "hda", id: "d1" } } };

beforeEach(() => {
  vi.stubEnv("GALAXY_URL", "https://galaxy.example.org");
  vi.stubEnv("GALAXY_API_KEY", "fixture-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  setGalaxyFetchOverride(null);
});

describe("loom's port of the browser's Galaxy guards", () => {
  it.skip("refuses the 4th identical call after three failures (until the repeat guard is ported)", async () => {
    const on = await register("galaxy-repeat-guard", "registerGalaxyRepeatGuard");
    for (let i = 1; i <= 3; i++) {
      expect(
        await on.get("tool_call")!({ toolName: RUN_TOOL, toolCallId: `c${i}`, input: ARGS }),
      ).toBeFalsy();
      await on.get("tool_result")!({
        toolName: RUN_TOOL,
        toolCallId: `c${i}`,
        input: ARGS,
        content: [{ type: "text", text: "HTTP 400: bad input" }],
        isError: true,
      });
    }
    expect(
      await on.get("tool_call")!({ toolName: RUN_TOOL, toolCallId: "c4", input: ARGS }),
    ).toEqual({
      block: true,
      reason:
        `Refused: '${RUN_TOOL}' was already called with these exact arguments 3 times and failed each time. ` +
        "Change the arguments or the approach; resending the same call cannot succeed.",
    });
  });

  it.skip("refuses a run whose input is in another history (until the history guard is ported)", async () => {
    setGalaxyFetchOverride(
      fixtureFetch([
        {
          path: "/api/datasets/d1",
          responses: [
            { status: 200, body: { id: "d1", name: "reads.fastq", history_id: "elsewhere" } },
          ],
        },
      ]),
    );
    const on = await register("galaxy-history-guard", "registerGalaxyHistoryGuard");
    const foreign = [
      { input: "input1", supplied_id: "d1", history_id: "elsewhere", name: "reads.fastq" },
    ];
    expect(
      await on.get("tool_call")!({ toolName: RUN_TOOL, toolCallId: "c1", input: ARGS }),
    ).toEqual({
      block: true,
      reason:
        "Refused: these inputs are in another history, not in history here " +
        `where this job runs: ${JSON.stringify(foreign)}. An id from another history is ` +
        "usually the wrong one: take the input's `id` from get_history_contents for this " +
        "history. If the user does mean that data, say which history it is in and ask them " +
        "to copy it into this one in Galaxy, then use the copy's id.",
    });
  });
});
