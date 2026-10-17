/**
 * Where the bare Galaxy tools come from when the brain runs in a shell with no
 * MCP server (the browser worker).
 *
 * Under an `mcp` profile pi's MCP layer names galaxy-mcp's tools
 * (`mcp__galaxy__run_tool`) and nothing here registers anything. Under `bare`
 * the shell hands the brain a list of pi tool definitions carrying galaxy-mcp's
 * bare names (`run_tool`, `get_dataset_details`, ...); the brain registers them
 * and hands their names to every guard as the tool family.
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { capabilityProfile } from "../../shared/capability-profile.js";
import { MCP_FAMILY, bareFamily, type GalaxyToolFamily } from "../../shared/galaxy-mcp-tools.js";

/** pi's own tool shape; the shim registers exactly this. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GalaxyTool = ToolDefinition<any, any, any>;

/**
 * The Galaxy tools a shell offers in-process under galaxy-mcp's bare names.
 *
 * Orbit cannot build the list itself: the descriptions and per-parameter text
 * the browser gives them (galaxy-ops' GALAXY_MCP_SURFACE) and the JSON-schema
 * rendering of an operation's zod input both come from galaxy-ops exports that
 * only the guerler fork and galaxy-mcp #155 carry, not npm 0.3.1/0.3.2 -- so
 * the shell that has them supplies the tools, and Orbit registers them. When
 * those exports are published, a default in-process source over GalaxyTransport
 * can land here without touching callers.
 */
export interface GalaxyToolSource {
  /** Registered once at extension load, in this order; their names are the bare family. */
  tools(): readonly GalaxyTool[];
}

let installed: GalaxyToolSource | null = null;
let registered: GalaxyToolFamily | null = null;

/** null uninstalls and forgets the registered family. */
export function setGalaxyToolSource(source: GalaxyToolSource | null): void {
  installed = source;
  registered = null;
}

export function installedGalaxyToolSource(): GalaxyToolSource | null {
  return installed;
}

/**
 * Register the source's tools and return the family over their names (empty
 * with no source, so the guards see no Galaxy tool at all). Called once, from
 * index.ts, under a `bare` profile.
 */
export function registerGalaxyTools(pi: ExtensionAPI): GalaxyToolFamily {
  // A shell that installs its source after the extension loaded gets inert
  // guards and a prompt naming tools pi does not have; say so instead of hiding it.
  if (!installed) {
    console.warn("[galaxy-tools] no Galaxy tool source installed; the guards see no Galaxy tool");
  }
  const tools = installed?.tools() ?? [];
  for (const tool of tools) pi.registerTool(tool);
  registered = bareFamily(tools.map((t) => t.name));
  return registered;
}

/**
 * How the brain names Galaxy tools to the model right now: MCP under an mcp
 * profile, else the registered source's names. For render-time readers
 * (context.ts, the greeting); registrars take the family as a parameter.
 */
export function galaxyToolFamily(): GalaxyToolFamily {
  if (capabilityProfile().galaxyTools === "mcp") return MCP_FAMILY;
  return registered ?? bareFamily([]);
}
