/** What makes the agent Olit: the Galaxy-visualization tools, their notes and artifact kinds. */
import { OLIT_KINDS } from "../artifacts/olit-kinds";
import type { DescribeLayout } from "./describe";
import { catalogMissHint } from "./hints";
import type { AgentFlavor } from "./tools";
import { visualizationTools } from "./visualizations";

export const olitFlavor: AgentFlavor = {
  tools: () => visualizationTools(),
  annotators: [(name, args, data, ctx) => catalogMissHint(ctx.galaxy, name, args, data)],
  artifactKinds: OLIT_KINDS,
};

// Not node:path: the worker imports this module too, and a browser bundle has no node:path.
const under = (root: string, path: string) => `${root.replace(/\/+$/, "")}/${path}`;

/** Where `--describe --root <root>` finds Olit's sources, manifest and vendored corpus. */
export const olitLayout = (root: string): DescribeLayout => ({
  sources: [root],
  manifest: under(root, "public/olit.xml"),
  lock: under(root, "skills.lock.json"),
  skills: under(root, "src/agent/skills/galaxy-skills"),
  prompt: under(root, "src/agent/prompt.ts"),
});
