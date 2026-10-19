import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  galaxyCall,
  galaxyRecoveryGuidance,
  galaxyRecoveryHint,
  registerGalaxyRecovery,
} from "../extensions/loom/galaxy-recovery";
import { GALAXY } from "./galaxy-family-fixture";

// The section 2e pinned in the connected system prompt, so "same bytes" means something.
const PINNED_GUIDANCE = `### Slow Galaxy requests

For installed-tool discovery, prefer search_tools_by_name: it matches
names, IDs and descriptions. Avoid search_tools_by_keywords: its implementation
fetches input schemas for potentially thousands of tools even for a narrow
keyword. Fetch schemas only for candidate tools.

A timeout is an unknown result, not proof that a job failed. Narrow/paginate
read-only requests before retrying.
For a timed-out mutation (run, invoke, create, upload, update, delete, etc.),
inspect the destination history, jobs/invocations or affected resource first.
Reuse an accepted operation; retry only when non-acceptance or safe retry is
established. Never blindly replay a mutation, invent its ID, or infer success.
Limit recovery to one narrowed retry per incident. If it fails, report the
concrete blocker and preserve work instead of looping.
`;

function harness() {
  const on = vi.fn();
  registerGalaxyRecovery({ on } as unknown as ExtensionAPI, GALAXY);
  const fire = (name: string, event: unknown) =>
    on.mock.calls.find(([key]) => key === name)![1](event);
  return {
    check: (toolName: string, input = {}) => fire("tool_call", { toolName, input }),
    result: (
      toolName: string,
      input = {},
      text = "Failed to call tool: Request timed out",
      isError = true,
      details = {},
    ) =>
      fire("tool_result", { toolName, input, content: [{ type: "text", text }], isError, details }),
    reset: () => fire("input", {}),
    followUp: () => fire("input", { source: "extension" }),
  };
}

describe("Galaxy recovery guidance", () => {
  it("is 2e's text byte for byte", () => {
    expect(galaxyRecoveryGuidance(GALAXY)).toBe(PINNED_GUIDANCE);
  });
});

describe("Galaxy recovery", () => {
  it("blocks catalog-wide schema fan-out before dispatch", () => {
    const h = harness();
    const decision = h.check("search_tools_by_keywords", { keywords: ["tissue"] });
    expect(decision.block).toBe(true);
    expect(decision.reason).toContain("Use search_tools_by_name");
    expect(decision.reason).toContain("input datatype");
    expect(decision.reason).toContain("one request per tool");
    expect(decision.reason).not.toContain("MCP budget");
    expect(decision.reason).not.toContain("mcp_read_output");
    expect(h.check("search_tools_by_name", { query: "tissue" })).toBeUndefined();
    expect(h.check("mcp__other__search_tools_by_keywords", {})).toBeUndefined();
  });

  it("adds actionable recovery for timeout failures, not a UI-only notice", () => {
    const result = harness().result("get_histories", { limit: 100 });
    const text = JSON.stringify(result.content);
    expect(text).toContain("[loom Galaxy recovery]");
    expect(text).toContain("Narrow or paginate");
    expect(text).toContain("This was a read-only lookup.");
    expect(text).not.toContain("connect()");
    expect(result.isError).toBeUndefined(); // never clear the original failure
  });

  it("tells the model to record an accepted submission that capture never saw", () => {
    // A timed-out submission is an error result, so the harness wrote no block
    // and nothing is polling it; recording it is the only way it gets watched.
    const text = JSON.stringify(harness().result("run_tool", { tool_id: "fastp" }).content);
    expect(text).toContain("may already have been accepted");
    expect(text).toContain("galaxy_job_record");
    expect(text).toContain("cannot capture");
  });

  it("prevents identical timed-out reads and allows a narrower request", () => {
    const h = harness();
    h.result("get_histories", { limit: 100, offset: 0 });
    expect(h.check("get_histories", { offset: 0, limit: 100 }).block).toBe(true);
    expect(h.check("get_histories", { limit: 5 })).toBeUndefined();
    h.reset();
    expect(h.check("get_histories", { limit: 100, offset: 0 })).toBeUndefined();
  });

  it("another Galaxy call succeeding earns a timed-out read one identical retry", () => {
    const h = harness();
    const args = { job_id: "j1" };
    h.result("get_job_details", args, "timed out", true, {
      galaxy: { tool: "get_job_details", kind: "timeout" },
    });
    expect(h.check("get_job_details", args)?.block).toBe(true);
    // The same call succeeding is not news; a different one is Galaxy answering again.
    h.result("get_history_details", { history_id: "h1" }, "{}", false);
    expect(h.check("get_job_details", args)).toBeUndefined();
    // One retry per incident: timing out again blocks it until the user's next message.
    h.result("get_job_details", args, "timed out", true, {
      galaxy: { tool: "get_job_details", kind: "timeout" },
    });
    h.result("get_history_details", { history_id: "h1" }, "{}", false);
    expect(h.check("get_job_details", args)?.block).toBe(true);
    h.reset();
    expect(h.check("get_job_details", args)).toBeUndefined();
  });

  it("allows later polling and a new recovery incident after a successful retry", () => {
    const h = harness();
    h.result("get_histories");
    expect(h.check("get_histories").block).toBe(true);
    h.result("get_history_details", { history_id: "h1" }, "{}", false);
    expect(h.check("get_histories")).toBeUndefined();
    h.result("get_histories", {}, '{"success":true}', false);
    expect(h.check("get_histories")).toBeUndefined();
    h.result("get_histories");
    expect(h.check("get_histories").block).toBe(true);
  });

  it("requires outcome inspection for timed-out mutations and never replays them itself", () => {
    const h = harness();
    for (const name of [
      "run_tool",
      "invoke_workflow",
      "upload_file_from_url",
      "create_history",
      "delete_user_tool",
    ]) {
      const text = JSON.stringify(h.result(name).content);
      expect(text).toContain("result is UNKNOWN");
      expect(text).toContain("Inspect the destination history");
      expect(text).toContain("Do not blindly repeat");
      expect(text).not.toContain("This was a read-only lookup");
    }
  });

  it("does not give read-only calls the mutation warning", () => {
    const download = JSON.stringify(
      harness().result("download_dataset", { dataset_id: "d" }).content,
    );
    expect(download).toContain("This was a read-only lookup");
    expect(download).not.toContain("result is UNKNOWN");
  });

  it("recognizes pi's timeout wording", () => {
    const text = JSON.stringify(
      harness().result("get_histories", {}, "MCP request timed out after 300000ms").content,
    );
    expect(text).toContain("Narrow or paginate");
  });

  it("does not treat response data, auth errors, or non-Galaxy failures as transport failures", () => {
    const h = harness();
    expect(h.result("get_histories", {}, "Request timed out", false)).toBeUndefined();
    expect(
      h.result("get_histories", {}, "Not connected to Galaxy. Authenticate via OAuth"),
    ).toBeUndefined();
    expect(h.result("bash")).toBeUndefined();
    expect(h.result("mcp__other__get_histories")).toBeUndefined();
    // Loom's own galaxy_* tools are not galaxy-ops calls.
    expect(h.result("galaxy_job_record")).toBeUndefined();
    expect(galaxyCall("galaxy_job_record", {}, GALAXY)).toBeUndefined();
    expect(galaxyCall("bash", {}, GALAXY)).toBeUndefined();
    expect(galaxyCall("run_tool", { a: 1 }, GALAXY)).toEqual({ name: "run_tool", args: { a: 1 } });
  });

  it("keeps a timed-out read blocked across an extension's follow-up, not a user's message", () => {
    // A poller auto-resume is sent as input from the extension; it is not the user moving on.
    const h = harness();
    h.result("get_histories", { limit: 100 });
    h.followUp();
    expect(h.check("get_histories", { limit: 100 }).block).toBe(true);
    h.reset();
    expect(h.check("get_histories", { limit: 100 })).toBeUndefined();
  });

  it("appends one dropped hint and does not block the retry", () => {
    const h = harness();
    const details = { galaxy: { tool: "get_history_details", kind: "dropped" } };
    const input = { history_id: "h1" };
    const result = h.result(
      "get_history_details",
      input,
      "Get history details failed: fetch failed",
      true,
      details,
    );
    expect(result?.content).toHaveLength(2);
    expect(result?.content.at(-1).text).toBe(
      galaxyRecoveryHint("get_history_details", "dropped", GALAXY),
    );
    expect(h.check("get_history_details", input)).toBeUndefined();
    expect(
      h.result("get_history_details", input, "x\n[loom Galaxy recovery]\ny", true, details),
    ).toBeUndefined();
  });
});

describe("galaxyRecoveryHint", () => {
  it("drops the saved-output reader from the discovery advice", () => {
    const hint = galaxyRecoveryHint("get_tool_panel", "timeout", GALAXY);
    expect(hint).not.toContain("connect()");
    expect(hint).not.toContain("mcp_read_output");
    expect(hint).toContain("fetch get_tool_panel once.");
    expect(hint).toContain("After one narrowed retry fails");
  });

  it("a dropped read gets retry-once advice, not the timeout's narrowing", () => {
    const hint = galaxyRecoveryHint("get_history_details", "dropped", GALAXY);
    expect(hint.startsWith("[loom Galaxy recovery]\n")).toBe(true);
    for (const absent of ["MCP", "Narrow or paginate", "saved response", "connect()"])
      expect(hint).not.toContain(absent);
    expect(hint).toContain("Retrying the identical call once is safe");
    // galaxy-ops reports a 400 as a connection failure, so the advice must send the model to the
    // message rather than straight to "unreachable".
    expect(hint).toContain("read the error -- a rejected argument needs different input");
    expect(hint).toContain("After one retry fails");
    expect(hint).not.toContain("narrowed retry");
  });

  it("a dropped mutation is checked with a cheap read before any retry", () => {
    for (const name of ["run_tool", "create_history"]) {
      const hint = galaxyRecoveryHint(name, "dropped", GALAXY);
      expect(hint).toContain("UNKNOWN");
      expect(hint).toContain("record it with galaxy_job_record or galaxy_invocation_record");
      expect(hint).toContain("check once with a cheap read");
      expect(hint).not.toContain("Narrow or paginate");
      expect(hint).not.toContain("Retrying the identical call once is safe");
    }
  });

  it("a timed-out read keeps narrowing without the saved-response advice", () => {
    const hint = galaxyRecoveryHint("get_history_details", "timeout", GALAXY);
    expect(hint.startsWith("[loom Galaxy recovery]\n")).toBe(true);
    expect(hint).toContain("Narrow or paginate");
    expect(hint).not.toContain("saved response");
  });

  it("discovery advice follows a timeout, not a dropped call", () => {
    expect(galaxyRecoveryHint("get_tool_panel", "timeout", GALAXY)).toContain(
      "fetch get_tool_panel once.",
    );
    const dropped = galaxyRecoveryHint("get_tool_panel", "dropped", GALAXY);
    expect(dropped).not.toContain("fetch get_tool_panel once");
    expect(dropped).not.toContain("search_tools_by_name");
  });

  it("an auth refusal carries the marker", () => {
    expect(
      galaxyRecoveryHint("get_history_details", "auth", GALAXY).startsWith(
        "[loom Galaxy recovery]\n",
      ),
    ).toBe(true);
  });
});
