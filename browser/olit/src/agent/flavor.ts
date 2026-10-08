/** What makes the agent Olit: the Galaxy-visualization tools, their skill, notes and artifact kinds. */
import type { AgentFlavor } from "@galaxyproject/orbit-browser/agent";
import type { DescribeLayout } from "@galaxyproject/orbit-browser/node";

import { OLIT_KINDS } from "../artifacts/kinds";
import { catalogMissHint } from "./hints";
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
  artifactKinds: OLIT_KINDS,
};

// Not node:path: the worker imports this module too, and a browser bundle has no node:path.
const under = (root: string, path: string) => `${root.replace(/\/+$/, "")}/${path}`;

/** Where `--describe --root <workspace>` finds Olit's sources, manifest and vendored corpus. */
export const olitLayout = (root: string): DescribeLayout => ({
  sources: [under(root, "core"), under(root, "olit")],
  manifest: under(root, "olit/public/olit.xml"),
  lock: under(root, "skills.lock.json"),
  skills: under(root, "core/src/agent/skills/galaxy-skills"),
  prompt: under(root, "core/src/agent/prompt.ts"),
});
