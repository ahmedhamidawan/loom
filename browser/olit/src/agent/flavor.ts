/** What makes the agent Olit: the Galaxy-visualization tools, their skill, notes and artifact kinds. */
import type { AgentFlavor } from "@galaxyproject/orbit-browser/agent";

import { OLIT_KINDS } from "../artifacts/kinds";
import { OLIT_BRAND } from "../brand";
import { catalogMissHint } from "./hints";
import { seedDatasetBlock, VISUALIZATION_TERM } from "./prompt";
import { visualizationTools } from "./visualizations";

// Keyed as the core's packaged corpus is, so skills/own lands in the same repo as the core's own.
const SKILLS = import.meta.glob("./skills/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const olitFlavor: AgentFlavor = {
  brand: OLIT_BRAND,
  tools: () => visualizationTools(),
  skills: SKILLS,
  annotators: [(name, args, data, ctx) => catalogMissHint(ctx.galaxy, name, args, data)],
  promptSections: ({ datasetId }) => ({
    afterIdentity: [seedDatasetBlock(datasetId)],
    terminology: [VISUALIZATION_TERM],
  }),
  artifactKinds: OLIT_KINDS,
};
