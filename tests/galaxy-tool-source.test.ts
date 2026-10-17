import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  galaxyToolFamily,
  installedGalaxyToolSource,
  registerGalaxyTools,
  setGalaxyToolSource,
  type GalaxyTool,
} from "../extensions/loom/galaxy-tool-source";
import { MCP_FAMILY } from "../shared/galaxy-mcp-tools.js";
import { profileFromEnv, setCapabilityProfile } from "../shared/capability-profile.js";

const stub = (name: string): GalaxyTool => ({
  name,
  label: name,
  description: `stub ${name}`,
  parameters: Type.Object({}),
  execute: async () => ({ content: [{ type: "text", text: "{}" }], details: {} }),
});

function fakePi() {
  const registerTool = vi.fn();
  return { pi: { registerTool } as unknown as ExtensionAPI, registerTool };
}

afterEach(() => {
  setCapabilityProfile(null);
  setGalaxyToolSource(null);
});

describe("galaxy tool source", () => {
  it("with no profile installed the family is MCP, whatever source is installed", () => {
    setGalaxyToolSource({ tools: () => [stub("run_tool")] });
    expect(galaxyToolFamily()).toBe(MCP_FAMILY);
    expect(installedGalaxyToolSource()).not.toBeNull();
  });

  it("under a bare profile registers the source's tools in order and names them as the family", () => {
    setCapabilityProfile({ ...profileFromEnv({}), galaxyTools: "bare" });
    setGalaxyToolSource({ tools: () => [stub("run_tool"), stub("get_dataset_details")] });
    const { pi, registerTool } = fakePi();
    const family = registerGalaxyTools(pi);
    expect(registerTool.mock.calls.map(([t]) => t.name)).toEqual([
      "run_tool",
      "get_dataset_details",
    ]);
    expect(family.toolName("run_tool")).toBe("run_tool");
    expect(family.toolName("get_dataset_details")).toBe("get_dataset_details");
    expect(family.toolName("bash")).toBeUndefined();
    expect(family.tool("run_tool")).toBe("run_tool");
    expect(galaxyToolFamily()).toBe(family);
  });

  it("under a bare profile with no source registers nothing, knows no Galaxy tool and says so", () => {
    setCapabilityProfile({ ...profileFromEnv({}), galaxyTools: "bare" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pi, registerTool } = fakePi();
    registerGalaxyTools(pi);
    expect(registerTool).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no Galaxy tool source installed"));
    warn.mockRestore();
    expect(galaxyToolFamily().toolName("run_tool")).toBeUndefined();
    // The identity: the prompt still spells bare names under a bare profile.
    expect(galaxyToolFamily().tool("run_tool")).toBe("run_tool");
  });

  it("uninstalling the source forgets the registered family", () => {
    setCapabilityProfile({ ...profileFromEnv({}), galaxyTools: "bare" });
    setGalaxyToolSource({ tools: () => [stub("run_tool")] });
    registerGalaxyTools(fakePi().pi);
    expect(galaxyToolFamily().toolName("run_tool")).toBe("run_tool");
    setGalaxyToolSource(null);
    expect(galaxyToolFamily().toolName("run_tool")).toBeUndefined();
  });
});
