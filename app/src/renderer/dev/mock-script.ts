/**
 * Mock scripts: a recorded conversation with the brain, replayable into the
 * renderer without a model or the Galaxy MCP.
 *
 * A script is JSON lines. Each line is one of:
 *
 *   {"mock": 1, "source": "recorded", ...}                         header, optional
 *   {"prompt": "Select 4 random lines from dataset 7"}            the user sent a message
 *   {"at": 1830, "channel": "agent:event", "data": {...}}          the brain sent something
 *
 * `data` is the message exactly as the renderer received it. `at` is
 * milliseconds since the segment began: since the prompt above it, or since
 * playback started for steps before the first prompt (session startup).
 *
 * Pure: no DOM, no timers, so it runs under node in tests.
 */

import type { Channel } from "../agent-transport.js";

export interface MockStep {
  at: number;
  channel: Channel;
  data: { type: string; [key: string]: unknown };
}

/** The steps that answer one prompt, or the startup steps when `prompt` is null. */
export interface MockSegment {
  prompt: string | null;
  steps: MockStep[];
}

export interface MockHeader {
  mock: 1;
  /** How the script was made: captured live, or rebuilt from a pi session file. */
  source: "recorded" | "pi-session";
  [key: string]: unknown;
}

export interface MockScript {
  header: MockHeader | null;
  /** Always starts with the startup segment (`prompt: null`), which may be empty. */
  segments: MockSegment[];
}

export function parseMockScript(text: string): MockScript {
  let header: MockHeader | null = null;
  const segments: MockSegment[] = [{ prompt: null, steps: [] }];
  text.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`Mock script line ${index + 1} is not JSON`);
    }
    if (!isRecord(value)) throw new Error(`Mock script line ${index + 1} is not an object`);
    if (value.mock === 1) {
      header = value as MockHeader;
    } else if (typeof value.prompt === "string") {
      segments.push({ prompt: value.prompt, steps: [] });
    } else if (isStep(value)) {
      segments[segments.length - 1].steps.push(value);
    } else {
      throw new Error(`Mock script line ${index + 1} is not a header, prompt or step`);
    }
  });
  return { header, segments };
}

export function serializeMockScript(script: MockScript): string {
  const lines: string[] = [];
  if (script.header) lines.push(JSON.stringify(script.header));
  for (const segment of script.segments) {
    if (segment.prompt !== null) lines.push(JSON.stringify({ prompt: segment.prompt }));
    for (const step of segment.steps) lines.push(JSON.stringify(step));
  }
  return lines.join("\n") + "\n";
}

export interface PlaybackTiming {
  /** 2 plays twice as fast. Defaults to 1, the recorded pace. */
  speed?: number;
  /** Longest pause between two steps, in recorded milliseconds. Defaults to no cap. */
  maxGap?: number;
}

/**
 * When each step should fire, in milliseconds from the start of its segment,
 * after speed and the gap cap are applied. Out-of-order `at`s are kept in
 * file order, never sent back in time.
 */
export function playbackOffsets(steps: readonly MockStep[], timing: PlaybackTiming = {}): number[] {
  const speed = timing.speed && timing.speed > 0 ? timing.speed : 1;
  const maxGap = timing.maxGap ?? Infinity;
  const offsets: number[] = [];
  let previousAt = 0;
  let elapsed = 0;
  for (const step of steps) {
    const gap = Math.min(Math.max(step.at - previousAt, 0), maxGap);
    elapsed += gap / speed;
    previousAt = Math.max(step.at, previousAt);
    offsets.push(Math.round(elapsed));
  }
  return offsets;
}

/** Builds a script from live traffic. The caller supplies the clock. */
export class MockRecorder {
  private readonly segments: MockSegment[] = [{ prompt: null, steps: [] }];
  private segmentStart: number;

  constructor(
    startedAt: number,
    private readonly note?: string,
  ) {
    this.segmentStart = startedAt;
  }

  prompt(message: string, at: number): void {
    this.segments.push({ prompt: message, steps: [] });
    this.segmentStart = at;
  }

  step(channel: Channel, data: MockStep["data"], at: number): void {
    // Through JSON so the step holds what a file round-trip would give back.
    const copy = JSON.parse(JSON.stringify(data)) as MockStep["data"];
    this.segments[this.segments.length - 1].steps.push({
      at: at - this.segmentStart,
      channel,
      data: copy,
    });
  }

  script(): MockScript {
    const header: MockHeader = { mock: 1, source: "recorded" };
    if (this.note) header.note = this.note;
    return { header, segments: this.segments.map((s) => ({ ...s, steps: s.steps.slice() })) };
  }
}

function isStep(value: Record<string, unknown>): value is MockStep & Record<string, unknown> {
  return (
    typeof value.at === "number" &&
    (value.channel === "agent:event" || value.channel === "agent:ui-request") &&
    isRecord(value.data) &&
    typeof value.data.type === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
