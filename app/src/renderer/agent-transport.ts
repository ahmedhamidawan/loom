/**
 * The renderer's one doorway to the agent: events and UI requests coming in,
 * prompts and aborts going out.
 *
 * Normally this is a straight pass-through to `window.orbit`. It exists so a
 * dev-only stand-in (`dev/agent-mock.ts`) can sit in front of the brain: watch
 * the real traffic to record it, or answer prompts from a recorded script so
 * every handler in the renderer runs exactly as it would against a live model
 * and Galaxy MCP, with neither in the loop.
 */

import type { AgentEvent, PromptOptions, UiRequest } from "../preload/preload.js";

export type Channel = "agent:event" | "agent:ui-request";

/**
 * Something that can take over the agent's side of the conversation. While one
 * is installed it decides what reaches the renderer and where prompts go.
 */
export interface AgentStandIn {
  /** A real message from the brain. Return true to let it through to the renderer. */
  incoming(channel: Channel, data: AgentEvent | UiRequest): boolean;
  /** Return true when the stand-in handled the prompt and the brain must not see it. */
  prompt(message: string, options?: PromptOptions): boolean;
  /** Return true when the stand-in handled the abort. */
  abort(): boolean;
}

const eventListeners = new Set<(event: AgentEvent) => void>();
const uiListeners = new Set<(request: UiRequest) => void>();
let standIn: AgentStandIn | null = null;
let subscribed = false;

function subscribe(): void {
  if (subscribed) return;
  subscribed = true;
  window.orbit.onAgentEvent((event) => {
    if (!standIn || standIn.incoming("agent:event", event)) deliver("agent:event", event);
  });
  window.orbit.onUiRequest((request) => {
    if (!standIn || standIn.incoming("agent:ui-request", request)) {
      deliver("agent:ui-request", request);
    }
  });
}

export function onAgentEvent(callback: (event: AgentEvent) => void): () => void {
  subscribe();
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

export function onUiRequest(callback: (request: UiRequest) => void): () => void {
  subscribe();
  uiListeners.add(callback);
  return () => uiListeners.delete(callback);
}

export function sendPrompt(message: string, options?: PromptOptions): Promise<void> {
  if (standIn?.prompt(message, options)) return Promise.resolve();
  return window.orbit.prompt(message, options);
}

export function abortAgent(): void {
  if (standIn?.abort()) return;
  window.orbit.abort();
}

/**
 * Hands a message to the renderer's handlers as if the brain had sent it.
 * The stand-in uses this to play its script.
 */
export function deliver(channel: Channel, data: AgentEvent | UiRequest): void {
  if (channel === "agent:event") {
    for (const listener of eventListeners) listener(data as AgentEvent);
  } else {
    for (const listener of uiListeners) listener(data as UiRequest);
  }
}

/** Installs a stand-in, or removes it with `null`. */
export function setAgentStandIn(next: AgentStandIn | null): void {
  standIn = next;
}
