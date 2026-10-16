/** How Olit's own kinds draw in the artifact pane. */
import type { ArtifactRenderers, OrbitBrowserOptions } from "@galaxyproject/orbit-browser";
import { OLIT_KINDS } from "./kinds";
import { renderVega } from "./vega";
import { renderVisualization } from "./visualization";

export const OLIT_RENDERERS: ArtifactRenderers = {
  "vega-lite": (body, a, root) => renderVega(body, a.spec, root),
  visualization: (body, a, _root, galaxy) => renderVisualization(body, a, galaxy),
};

/** What the page registers: main.ts mounts the shell with these, and the round-trip test too. */
export const OLIT_ARTIFACTS = {
  artifactKinds: OLIT_KINDS,
  renderers: OLIT_RENDERERS,
} satisfies Pick<OrbitBrowserOptions, "artifactKinds" | "renderers">;
