import type { Galaxy } from "../agent/galaxy";
import { renderMermaid } from "./mermaid";
import { isKind, registeredKinds, type Artifact, type ArtifactOf, type Kind } from "./kinds";

export type { Artifact } from "./kinds";

/** How one kind draws in the pane. */
export type ArtifactRenderer<K extends Kind = Kind> = (
  body: HTMLElement,
  artifact: ArtifactOf<K>,
  root: string,
  galaxy: Pick<Galaxy, "get" | "root">,
) => unknown;

export type ArtifactRenderers = { [K in Kind]?: ArtifactRenderer<K> };

/** How each kind draws in the pane: kinds the core makes itself, and those a flavor registers. */
const PANE = new Map<string, ArtifactRenderer<any>>([
  ["mermaid", (body, a: ArtifactOf<"mermaid">) => renderMermaid(body, a.diagram)],
]);

/**
 * Draw these kinds in this realm's pane. As with kinds, registering the same renderer again is
 * harmless, but a renderer for a kind nobody registered, or a second renderer for a kind, is a
 * flavor's mistake that would otherwise only show as a missing or wrong card.
 */
export function registerArtifactRenderers(renderers: ArtifactRenderers): void {
  for (const [kind, render] of Object.entries(renderers)) {
    if (!render) continue;
    if (!isKind(kind)) {
      throw new Error(`Artifact kind '${kind}' has a renderer but is not registered.`);
    }
    const known = PANE.get(kind);
    if (known && known !== render) {
      throw new Error(`Artifact kind '${kind}' already has a different renderer.`);
    }
    PANE.set(kind, render);
  }
}

/** Kinds this realm knows but cannot draw: each would fail only once an artifact of it arrives. */
export const kindsWithoutRenderer = (): Kind[] => registeredKinds().filter((k) => !PANE.has(k));

/** What the pane shows for a list: the newest, since a live turn clears the pane first. */
export function paneArtifacts(artifacts: Artifact[]): Artifact[] {
  return artifacts.length ? [artifacts[artifacts.length - 1]] : [];
}

/** Append an artifact card to the pane. */
export async function renderArtifact(
  content: HTMLElement,
  artifact: Artifact,
  root: string,
  galaxy: Pick<Galaxy, "get" | "root">,
): Promise<void> {
  const render = PANE.get(artifact.kind);
  if (!render) {
    // A flavor that registered the kind but not its renderer; an empty card would hide that.
    throw new Error(`No renderer is registered for artifact kind '${artifact.kind}'.`);
  }
  const card = document.createElement("div");
  card.className = "artifact-card";
  card.style.cssText =
    "display:flex;flex-direction:column;height:100%;padding:12px;box-sizing:border-box;";

  if (artifact.title) {
    const title = document.createElement("div");
    title.className = "artifact-card-title";
    title.style.cssText = "font-size:13px;font-weight:600;margin-bottom:8px;";
    title.textContent = artifact.title;
    card.appendChild(title);
  }

  const body = document.createElement("div");
  body.style.cssText = "flex:1;min-height:320px;";
  card.appendChild(body);
  content.appendChild(card);

  await render(body, artifact, root, galaxy);
}
