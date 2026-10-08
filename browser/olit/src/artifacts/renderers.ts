/** How Olit's own kinds draw in the artifact pane. */
import type { ArtifactRenderers } from "@galaxyproject/orbit-browser";
import { renderVega } from "./vega";
import { renderVisualization } from "./visualization";

export const OLIT_RENDERERS: ArtifactRenderers = {
  "vega-lite": (body, a, root) => renderVega(body, a.spec, root),
  visualization: (body, a, _root, galaxy) => renderVisualization(body, a, galaxy),
};
