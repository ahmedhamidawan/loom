/**
 * `window.orbitMock`: stand in for the brain so the renderer can be driven
 * without a model or the Galaxy MCP. Dev builds only (see `app.ts`).
 *
 * Two modes, never both at once:
 *
 * - **Play** a script. While a script is in use the real brain is muted, and
 *   each message you send in the chat is answered by the script's next turn,
 *   played into the same handlers, with the recorded timing. Startup steps (the
 *   ones before the first prompt) play as soon as the script is loaded.
 * - **Record** live traffic: everything the brain sends, plus each prompt,
 *   with timing, saved as a script you can play back later.
 *
 * From the devtools console:
 *
 *   orbitMock.list()                        scripts in dev/mock-scripts/
 *   orbitMock.use("select-random-lines")    play one (also: ?mock=<name> in the URL)
 *   orbitMock.use("…", { speed: 4, maxGap: 3000 })
 *   orbitMock.emit({ type: "agent_start" }) send one message by hand
 *   orbitMock.record()                      start recording (also: ?mock-record in the URL)
 *   orbitMock.save("my-run")                stop, download my-run.jsonl, return the text
 *   orbitMock.off()                         back to the real brain
 *
 * Electron's dev window has no address bar; `location.search = "?mock=<name>"`
 * from the console reloads it with the parameter.
 */

import { deliver, setAgentStandIn, type Channel } from "../agent-transport.js";
import {
  MockRecorder,
  parseMockScript,
  playbackOffsets,
  serializeMockScript,
  type MockScript,
  type MockSegment,
  type MockStep,
  type PlaybackTiming,
} from "./mock-script.js";

const SCRIPT_FILES = import.meta.glob("./mock-scripts/**/*.jsonl", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const LOG = "[orbit-mock]";

function scriptName(path: string): string {
  return path.replace(/^\.\/mock-scripts\//, "").replace(/\.jsonl$/, "");
}

class Player {
  private next = 1;
  private timers: number[] = [];
  /** When the segment now playing will have fired its last step. */
  private busyUntil = 0;

  constructor(
    readonly name: string,
    private readonly script: MockScript,
    private readonly timing: PlaybackTiming,
  ) {}

  start(): void {
    this.play(this.script.segments[0]);
  }

  /** Plays the next turn in answer to a prompt. */
  answer(message: string): void {
    const segment = this.script.segments[this.next];
    if (!segment) {
      console.warn(LOG, `"${this.name}" has no more turns; "${message}" goes unanswered`);
      deliver("agent:event", {
        type: "error",
        message: `Mock script "${this.name}" has no more turns. Load another with orbitMock.use().`,
      });
      return;
    }
    this.next += 1;
    if (segment.prompt !== message) {
      console.info(LOG, `playing the turn recorded for "${segment.prompt}"`);
    }
    this.play(segment);
  }

  /**
   * Stops playback. pi would finish the turn with its own aborted message;
   * the script can't know that shape, so a bare `agent_end` closes the turn.
   */
  abort(): void {
    this.stop();
    deliver("agent:event", { type: "agent_end", messages: [], willRetry: false });
  }

  stop(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
    this.busyUntil = 0;
  }

  remaining(): string[] {
    return this.script.segments.slice(this.next).map((s) => s.prompt ?? "");
  }

  private play(segment: MockSegment): void {
    // A turn sent while the last one is still playing (e.g. queued behind an
    // automatic follow-up) waits for it, as pi's follow-up queue would.
    const startAt = Math.max(Date.now(), this.busyUntil);
    const offsets = playbackOffsets(segment.steps, this.timing);
    segment.steps.forEach((step, i) => {
      const fireAt = startAt + offsets[i];
      this.timers.push(window.setTimeout(() => fire(step), Math.max(fireAt - Date.now(), 0)));
    });
    this.busyUntil = startAt + (offsets[offsets.length - 1] ?? 0);
  }
}

function fire(step: MockStep): void {
  // A fresh copy each time, so a handler that mutates its event can't change a replay.
  deliver(step.channel, JSON.parse(JSON.stringify(step.data)));
}

let player: Player | null = null;
let recorder: MockRecorder | null = null;

function stopAll(): void {
  player?.stop();
  player = null;
  recorder = null;
  setAgentStandIn(null);
}

async function loadScript(nameOrText: string): Promise<{ name: string; script: MockScript }> {
  if (nameOrText.includes("\n") || nameOrText.trimStart().startsWith("{")) {
    return { name: "inline", script: parseMockScript(nameOrText) };
  }
  const path = Object.keys(SCRIPT_FILES).find((p) => scriptName(p) === nameOrText);
  if (!path) {
    throw new Error(
      `No mock script "${nameOrText}". Have: ${Object.keys(SCRIPT_FILES).map(scriptName).join(", ") || "none"}`,
    );
  }
  return { name: nameOrText, script: parseMockScript(await SCRIPT_FILES[path]()) };
}

const orbitMock = {
  list(): string[] {
    return Object.keys(SCRIPT_FILES).map(scriptName);
  },

  /** Plays a script by name (from dev/mock-scripts/) or from its text. Returns the prompts it can answer. */
  async use(nameOrText: string, timing: PlaybackTiming = {}): Promise<string[]> {
    const { name, script } = await loadScript(nameOrText);
    stopAll();
    const active = new Player(name, script, timing);
    player = active;
    setAgentStandIn({
      incoming(channel, data) {
        console.debug(LOG, "muted real", channel, data.type);
        return false;
      },
      prompt(message) {
        active.answer(message);
        return true;
      },
      abort() {
        active.abort();
        return true;
      },
    });
    active.start();
    const prompts = active.remaining();
    console.info(
      LOG,
      `playing "${name}" (${script.header?.source ?? "unknown source"}); send these in order:`,
      prompts,
    );
    return prompts;
  },

  /** Sends one message to the renderer as if the brain had. */
  emit(data: MockStep["data"], channel: Channel = "agent:event"): void {
    deliver(channel, data);
  },

  /** Starts recording live traffic with the real brain. */
  record(note?: string): void {
    stopAll();
    const active = new MockRecorder(Date.now(), note);
    recorder = active;
    setAgentStandIn({
      incoming(channel, data) {
        active.step(channel, data, Date.now());
        return true;
      },
      prompt(message) {
        active.prompt(message, Date.now());
        return false;
      },
      abort: () => false,
    });
    console.info(LOG, "recording; orbitMock.save(name) when done");
  },

  /** Stops recording, downloads `<name>.jsonl`, and returns the script text. */
  save(name = `orbit-${new Date().toISOString().replace(/[:.]/g, "-")}`): string {
    if (!recorder) throw new Error("Not recording; start with orbitMock.record()");
    const text = serializeMockScript(recorder.script());
    stopAll();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/jsonl" }));
    link.download = `${name}.jsonl`;
    link.click();
    URL.revokeObjectURL(link.href);
    console.info(
      LOG,
      `saved ${name}.jsonl; put it in app/src/renderer/dev/mock-scripts/ to play it`,
    );
    return text;
  },

  off(): void {
    stopAll();
    console.info(LOG, "off; talking to the real brain again");
  },

  status(): string {
    if (player) return `playing "${player.name}"; next: ${JSON.stringify(player.remaining())}`;
    if (recorder) return "recording";
    return "off";
  },
};

export type OrbitMock = typeof orbitMock;

export function installAgentMock(): void {
  (window as unknown as { orbitMock: OrbitMock }).orbitMock = orbitMock;
  const params = new URLSearchParams(window.location.search);
  const name = params.get("mock");
  if (name) {
    orbitMock.use(name).catch((error: unknown) => console.error(LOG, error));
  } else if (params.has("mock-record")) {
    orbitMock.record();
  }
}
