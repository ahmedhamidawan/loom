#!/usr/bin/env node
/**
 * Rebuilds a mock script (app/src/renderer/dev/mock-script.ts) from a pi
 * session file, so a past Orbit conversation can be replayed in the renderer
 * with no model and no Galaxy MCP.
 *
 *   node scripts/pi-session-to-mock.mjs <session.jsonl> [name]
 *
 * Writes app/src/renderer/dev/mock-scripts/<name>.jsonl (gitignored: real
 * sessions hold real Galaxy data). Play it with orbitMock.use("<name>").
 *
 * A session file keeps messages, not the event stream, so this is a close
 * reconstruction rather than a recording. The events follow pi's agent loop
 * (agent_start, turn_start, message_start/update/end, tool_execution_start/end,
 * turn_end, agent_end, agent_settled) and carry the real arguments, results
 * and messages. What it can't know: how text was chunked while streaming (one
 * delta per block), when each tool call actually started (all of a message's
 * calls start together, as in pi's parallel mode, and each ends at its result's
 * time), how long each model response streamed, and pi's entry_appended /
 * queue_update bookkeeping. For an exact capture, record a live run with
 * orbitMock.record() instead.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../app/src/renderer/dev/mock-scripts",
);

/** Prompts Loom sends on its own, which play without waiting for the user. */
const AUTOMATIC_PROMPTS = [/^Session started in this project directory/, /^\[Loom automatic/];

export function convertSession(text, source = "session") {
  const entries = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));

  const out = [
    JSON.stringify({
      mock: 1,
      source: "pi-session",
      session: source,
      note: "Rebuilt from a pi session file; see scripts/pi-session-to-mock.mjs for what is approximate.",
    }),
  ];
  let segmentStart = null;
  let lastAt = -1;
  /** Messages in the open agent run, for agent_end. Null when no run is open. */
  let run = null;
  /** The assistant message whose tool calls are still waiting for results. */
  let turn = null;

  const emit = (time, data) => {
    if (segmentStart === null) segmentStart = time;
    // Events that share a timestamp keep their order one millisecond apart.
    const at = Math.max(time - segmentStart, lastAt + 1);
    lastAt = at;
    out.push(JSON.stringify({ at, channel: "agent:event", data }));
  };

  const endTurn = (time) => {
    if (!turn) return;
    emit(time, { type: "turn_end", message: turn.message, toolResults: turn.results });
    turn = null;
  };

  // A run ends right after its last message, not when the next prompt arrives.
  const endRun = () => {
    if (!run) return;
    const time = segmentStart + lastAt;
    endTurn(time);
    emit(time, { type: "agent_end", messages: run, willRetry: false });
    emit(time, { type: "agent_settled" });
    run = null;
  };

  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    const time =
      typeof message.timestamp === "number" ? message.timestamp : Date.parse(entry.timestamp);

    if (message.role === "user") {
      endRun();
      const prompt = textOf(message.content);
      if (!AUTOMATIC_PROMPTS.some((pattern) => pattern.test(prompt))) {
        out.push(JSON.stringify({ prompt }));
        segmentStart = time;
        lastAt = -1;
      }
      run = [message];
      emit(time, { type: "agent_start" });
      emit(time, { type: "turn_start" });
      emit(time, { type: "message_start", message });
      emit(time, { type: "message_end", message });
    } else if (message.role === "assistant") {
      if (!run) run = [];
      if (turn) {
        endTurn(time);
        emit(time, { type: "turn_start" });
      }
      run.push(message);
      streamAssistant(emit, time, message);
      const toolCalls = message.content.filter((block) => block.type === "toolCall");
      turn = { message, results: [], pending: toolCalls };
      for (const call of toolCalls) {
        emit(time, {
          type: "tool_execution_start",
          toolCallId: call.id,
          toolName: call.name,
          args: call.arguments,
        });
      }
      if (toolCalls.length === 0) endTurn(time);
    } else if (message.role === "toolResult") {
      if (run) run.push(message);
      emit(time, {
        type: "tool_execution_end",
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        result: { content: message.content, details: message.details },
        isError: message.isError === true,
      });
      emit(time, { type: "message_start", message });
      emit(time, { type: "message_end", message });
      if (turn) turn.results.push(message);
    }
  }
  endRun();
  return out.join("\n") + "\n";
}

/** One assistant message as pi streams it: a start, one delta per block, an end. */
function streamAssistant(emit, time, message) {
  const partial = { ...message, content: [] };
  emit(time, { type: "message_start", message: clone(partial) });
  emit(time, {
    type: "message_update",
    message: clone(partial),
    assistantMessageEvent: { type: "start", partial: clone(partial) },
  });
  message.content.forEach((block, contentIndex) => {
    const kind = { text: "text", thinking: "thinking", toolCall: "toolcall" }[block.type];
    if (!kind) return;
    const delta =
      block.type === "text"
        ? block.text
        : block.type === "thinking"
          ? block.thinking
          : JSON.stringify(block.arguments);
    const empty =
      block.type === "toolCall" ? { ...block, arguments: {} } : { ...block, [block.type]: "" };
    partial.content.push(empty);
    const update = (assistantMessageEvent) =>
      emit(time, { type: "message_update", message: clone(partial), assistantMessageEvent });
    update({ type: `${kind}_start`, contentIndex, partial: clone(partial) });
    partial.content[contentIndex] = block;
    update({ type: `${kind}_delta`, contentIndex, delta, partial: clone(partial) });
    if (block.type === "toolCall") {
      update({ type: "toolcall_end", contentIndex, toolCall: block, partial: clone(partial) });
    } else {
      update({ type: `${kind}_end`, contentIndex, content: delta, partial: clone(partial) });
    }
  });
  const reason =
    message.stopReason === "error" || message.stopReason === "aborted" ? "error" : "done";
  emit(time, {
    type: "message_update",
    message: clone(message),
    assistantMessageEvent:
      reason === "done"
        ? { type: "done", reason: message.stopReason, message: clone(message) }
        : { type: "error", reason: message.stopReason, error: clone(message) },
  });
  emit(time, { type: "message_end", message });
}

function textOf(content) {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, name] = process.argv.slice(2);
  if (!input) {
    console.error("usage: node scripts/pi-session-to-mock.mjs <session.jsonl> [name]");
    process.exit(1);
  }
  const outName = name ?? basename(input, ".jsonl");
  const script = convertSession(readFileSync(input, "utf8"), basename(input));
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `${outName}.jsonl`);
  writeFileSync(outPath, script);
  const prompts = script
    .split("\n")
    .filter((line) => line.startsWith('{"prompt"'))
    .map((line) => JSON.parse(line).prompt.slice(0, 80));
  console.log(`wrote ${outPath}`);
  console.log(`play with orbitMock.use(${JSON.stringify(outName)}), then send, in order:`);
  for (const prompt of prompts) console.log(`  - ${prompt}`);
}
