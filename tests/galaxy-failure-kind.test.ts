import { describe, expect, it } from "vitest";
import { classifyGalaxyFailure } from "../extensions/loom/galaxy-failure.js";

describe("classifyGalaxyFailure", () => {
  it("calls a timed-out request a timeout, not a dropped connection", () => {
    // The exact text a slow usegalaxy.org call produces.
    expect(
      classifyGalaxyFailure(
        "mcp__galaxy__get_dataset_details",
        "Failed to call tool: Request timed out",
      ),
    ).toBe("timeout");
    expect(classifyGalaxyFailure("mcp__galaxy__run_tool", "MCP error -32001")).toBe("timeout");
  });

  it("still calls a closed connection dropped", () => {
    expect(classifyGalaxyFailure("mcp__galaxy__get_histories", "Connection closed (-32000)")).toBe(
      "dropped",
    );
    expect(
      classifyGalaxyFailure("mcp__galaxy__get_histories", "Failed to call tool: Not connected"),
    ).toBe("dropped");
  });

  it("reads a body mentioning both as a timeout -- the actionable one", () => {
    expect(
      classifyGalaxyFailure("mcp__galaxy__run_tool", "Request timed out; client not connected"),
    ).toBe("timeout");
  });

  it("leaves galaxy-mcp's own auth error alone", () => {
    expect(
      classifyGalaxyFailure(
        "mcp__galaxy__get_histories",
        "Not connected to Galaxy. Authenticate via OAuth or run connect()...",
      ),
    ).toBeNull();
  });

  it("ignores non-galaxy tools and empty input", () => {
    expect(classifyGalaxyFailure("bash", "Request timed out")).toBeNull();
    expect(classifyGalaxyFailure("mcp__galaxy__run_tool", undefined)).toBeNull();
    expect(classifyGalaxyFailure(undefined, "Request timed out")).toBeNull();
  });
});
