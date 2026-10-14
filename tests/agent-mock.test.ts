// The dev-only stand-in for the brain: the script format, playback timing, the
// recorder, the transport it plugs into, and rebuilding a script from a pi
// session file.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockRecorder,
  parseMockScript,
  playbackOffsets,
  serializeMockScript,
  type MockStep,
} from "../app/src/renderer/dev/mock-script.js";
import { convertSession } from "../scripts/pi-session-to-mock.mjs";

const step = (at: number, type: string, extra: Record<string, unknown> = {}): MockStep => ({
  at,
  channel: "agent:event",
  data: { type, ...extra },
});

describe("mock scripts", () => {
  it("splits steps into the startup segment and one segment per prompt", () => {
    const script = parseMockScript(
      [
        '{"mock":1,"source":"recorded"}',
        '{"at":5,"channel":"agent:ui-request","data":{"type":"extension_ui_request","id":"1","method":"notify"}}',
        '{"prompt":"hi"}',
        '{"at":0,"channel":"agent:event","data":{"type":"agent_start"}}',
        "",
        '{"at":40,"channel":"agent:event","data":{"type":"agent_end"}}',
      ].join("\n"),
    );
    expect(script.header).toEqual({ mock: 1, source: "recorded" });
    expect(script.segments.map((s) => [s.prompt, s.steps.map((x) => x.data.type)])).toEqual([
      [null, ["extension_ui_request"]],
      ["hi", ["agent_start", "agent_end"]],
    ]);
  });

  it("round-trips through serialize", () => {
    const text =
      [
        '{"mock":1,"source":"recorded"}',
        '{"prompt":"hi"}',
        '{"at":0,"channel":"agent:event","data":{"type":"agent_start"}}',
      ].join("\n") + "\n";
    expect(serializeMockScript(parseMockScript(text))).toBe(text);
  });

  it("names the line that is not a step", () => {
    expect(() => parseMockScript('{"prompt":"hi"}\n{"at":"soon"}')).toThrow(/line 2/);
    expect(() => parseMockScript("not json")).toThrow(/line 1 is not JSON/);
  });

  it("times playback at the recorded pace, faster, or with long pauses cut", () => {
    const steps = [step(0, "a"), step(100, "b"), step(10_100, "c"), step(50, "d")];
    expect(playbackOffsets(steps)).toEqual([0, 100, 10_100, 10_100]);
    expect(playbackOffsets(steps, { speed: 2 })).toEqual([0, 50, 5050, 5050]);
    expect(playbackOffsets(steps, { maxGap: 1000 })).toEqual([0, 100, 1100, 1100]);
  });

  it("records prompts and steps with times relative to their prompt", () => {
    const recorder = new MockRecorder(1000, "a note");
    recorder.step("agent:event", { type: "agent_settled" }, 1200);
    recorder.prompt("hi", 2000);
    const event = { type: "agent_start", nested: { n: 1 } };
    recorder.step("agent:event", event, 2350);
    event.nested.n = 2; // a handler mutating its event later must not change the recording
    const script = recorder.script();
    expect(script.header).toEqual({ mock: 1, source: "recorded", note: "a note" });
    expect(script.segments).toEqual([
      { prompt: null, steps: [step(200, "agent_settled")] },
      { prompt: "hi", steps: [step(350, "agent_start", { nested: { n: 1 } })] },
    ]);
  });
});

describe("agent transport", () => {
  let fromBrain: { event?: (e: unknown) => void; ui?: (r: unknown) => void };
  let orbit: { prompt: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    fromBrain = {};
    orbit = { prompt: vi.fn(() => Promise.resolve()), abort: vi.fn() };
    vi.stubGlobal("window", {
      orbit: {
        ...orbit,
        onAgentEvent: (cb: (e: unknown) => void) => (fromBrain.event = cb),
        onUiRequest: (cb: (r: unknown) => void) => (fromBrain.ui = cb),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("passes everything straight through with no stand-in", async () => {
    const transport = await import("../app/src/renderer/agent-transport.js");
    const events: unknown[] = [];
    const requests: unknown[] = [];
    transport.onAgentEvent((e) => events.push(e));
    transport.onUiRequest((r) => requests.push(r));
    fromBrain.event?.({ type: "agent_start" });
    fromBrain.ui?.({ type: "extension_ui_request", id: "1", method: "notify" });
    await transport.sendPrompt("hi", { streamingBehavior: "followUp" });
    transport.abortAgent();
    expect(events).toEqual([{ type: "agent_start" }]);
    expect(requests).toHaveLength(1);
    expect(orbit.prompt).toHaveBeenCalledWith("hi", { streamingBehavior: "followUp" });
    expect(orbit.abort).toHaveBeenCalled();
  });

  it("lets a stand-in mute the brain, take prompts, and deliver its own events", async () => {
    const transport = await import("../app/src/renderer/agent-transport.js");
    const events: unknown[] = [];
    transport.onAgentEvent((e) => events.push(e));
    transport.setAgentStandIn({
      incoming: () => false,
      prompt: (message) => {
        transport.deliver("agent:event", { type: "agent_start", for: message });
        return true;
      },
      abort: () => true,
    });
    fromBrain.event?.({ type: "from-brain" });
    await transport.sendPrompt("hi");
    transport.abortAgent();
    expect(events).toEqual([{ type: "agent_start", for: "hi" }]);
    expect(orbit.prompt).not.toHaveBeenCalled();
    expect(orbit.abort).not.toHaveBeenCalled();
  });
});

describe("pi session to mock script", () => {
  const line = (message: Record<string, unknown>) =>
    JSON.stringify({ type: "message", timestamp: "", message });
  const session = [
    JSON.stringify({ type: "session", id: "s" }),
    line({
      role: "user",
      content: [{ type: "text", text: "Session started in this project directory." }],
      timestamp: 1000,
    }),
    line({
      role: "assistant",
      content: [{ type: "text", text: "Ready." }],
      stopReason: "stop",
      timestamp: 1100,
    }),
    line({
      role: "user",
      content: [{ type: "text", text: "How many datasets?" }],
      timestamp: 5000,
    }),
    line({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "look it up" },
        {
          type: "toolCall",
          id: "c1",
          name: "galaxy_get_history_contents",
          arguments: { history_id: "h" },
        },
      ],
      stopReason: "toolUse",
      timestamp: 5200,
    }),
    line({
      role: "toolResult",
      toolCallId: "c1",
      toolName: "galaxy_get_history_contents",
      content: [{ type: "text", text: '{"data":[],"success":true}' }],
      details: { tool: "get_history_contents" },
      isError: false,
      timestamp: 5900,
    }),
    line({
      role: "assistant",
      content: [{ type: "text", text: "None." }],
      stopReason: "stop",
      timestamp: 6400,
    }),
  ].join("\n");

  const script = parseMockScript(convertSession(session, "s.jsonl"));
  const types = (i: number) =>
    script.segments[i].steps.map((s) => {
      const ame = s.data.assistantMessageEvent as { type: string } | undefined;
      return ame ? `update:${ame.type}` : s.data.type;
    });

  it("plays Loom's own startup prompt without waiting for the user", () => {
    expect(script.header?.source).toBe("pi-session");
    expect(script.segments.map((s) => s.prompt)).toEqual([null, "How many datasets?"]);
    // The run ends right after its reply, not when the user next types (4s later).
    const startup = script.segments[0].steps;
    expect(startup[startup.length - 1].at).toBeLessThan(200);
    expect(types(0)).toEqual([
      "agent_start",
      "turn_start",
      "message_start",
      "message_end",
      "message_start",
      "update:start",
      "update:text_start",
      "update:text_delta",
      "update:text_end",
      "update:done",
      "message_end",
      "turn_end",
      "agent_end",
      "agent_settled",
    ]);
  });

  it("follows pi's event order around a tool call, with times from the prompt", () => {
    expect(types(1)).toEqual([
      "agent_start",
      "turn_start",
      "message_start",
      "message_end",
      "message_start",
      "update:start",
      "update:thinking_start",
      "update:thinking_delta",
      "update:thinking_end",
      "update:toolcall_start",
      "update:toolcall_delta",
      "update:toolcall_end",
      "update:done",
      "message_end",
      "tool_execution_start",
      "tool_execution_end",
      "message_start",
      "message_end",
      "turn_end",
      "turn_start",
      "message_start",
      "update:start",
      "update:text_start",
      "update:text_delta",
      "update:text_end",
      "update:done",
      "message_end",
      "turn_end",
      "agent_end",
      "agent_settled",
    ]);
    const steps = script.segments[1].steps;
    const start = steps.find((s) => s.data.type === "tool_execution_start")!;
    const end = steps.find((s) => s.data.type === "tool_execution_end")!;
    expect(start.data).toEqual({
      type: "tool_execution_start",
      toolCallId: "c1",
      toolName: "galaxy_get_history_contents",
      args: { history_id: "h" },
    });
    expect(end.data).toMatchObject({
      toolCallId: "c1",
      result: {
        content: [{ type: "text", text: '{"data":[],"success":true}' }],
        details: { tool: "get_history_contents" },
      },
      isError: false,
    });
    expect(steps[0].at).toBe(0);
    expect(start.at).toBeGreaterThanOrEqual(200);
    expect(end.at).toBe(900);
    const ats = steps.map((s) => s.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
  });
});
