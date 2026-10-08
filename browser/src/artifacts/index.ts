import type { Galaxy } from "../agent/galaxy";
import { renderMermaid } from "./mermaid";
import type { Artifact, ArtifactOf, Kind } from "./kinds";

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

export function registerArtifactRenderers(renderers: ArtifactRenderers): void {
  for (const [kind, render] of Object.entries(renderers)) {
    if (render) PANE.set(kind, render);
  }
}

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

  await PANE.get(artifact.kind)?.(body, artifact, root, galaxy);
}
