/** What makes the agent Olit: the Galaxy-visualization tools, their skill, notes and artifact kinds. */
import type { AgentFlavor } from "@galaxyproject/orbit-browser/agent";

import { OLIT_KINDS } from "../artifacts/kinds";
import { catalogMissHint } from "./hints";
import { seedDatasetBlock } from "./prompt";
import { visualizationTools } from "./visualizations";

// Keyed as the core's packaged corpus is, so this lands in the same olit-skills repo.
const SKILLS = import.meta.glob("./skills/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const olitFlavor: AgentFlavor = {
  tools: () => visualizationTools(),
  skills: SKILLS,
  annotators: [(name, args, data, ctx) => catalogMissHint(ctx.galaxy, name, args, data)],
  promptSections: ({ datasetId }) => ({ afterIdentity: [seedDatasetBlock(datasetId)] }),
  artifactKinds: OLIT_KINDS,
};
