import { describe, expect, it } from "vitest";
import { classifyGalaxyFailure } from "../extensions/loom/galaxy-failure.js";
import { GALAXY } from "./galaxy-family-fixture";

describe("classifyGalaxyFailure", () => {
  it("calls a timed-out request a timeout, not a dropped connection", () => {
    // The exact text a slow usegalaxy.org call produces.
    expect(
      classifyGalaxyFailure(
        "get_dataset_details",
        "Failed to call tool: Request timed out",
        GALAXY,
      ),
    ).toBe("timeout");
    expect(classifyGalaxyFailure("run_tool", "MCP error -32001", GALAXY)).toBe("timeout");
  });

  it("still calls a closed connection dropped", () => {
    expect(classifyGalaxyFailure("get_histories", "Connection closed (-32000)", GALAXY)).toBe(
      "dropped",
    );
    expect(
      classifyGalaxyFailure("get_histories", "Failed to call tool: Not connected", GALAXY),
    ).toBe("dropped");
  });

  it("reads a body mentioning both as a timeout -- the actionable one", () => {
    expect(
      classifyGalaxyFailure("run_tool", "Request timed out; client not connected", GALAXY),
    ).toBe("timeout");
  });

  it("leaves a not-connected auth error alone", () => {
    expect(
      classifyGalaxyFailure(
        "get_histories",
        "Not connected to Galaxy. Authenticate via OAuth or run connect()...",
        GALAXY,
      ),
    ).toBeNull();
  });

  it("ignores non-galaxy tools and empty input", () => {
    expect(classifyGalaxyFailure("bash", "Request timed out", GALAXY)).toBeNull();
    expect(classifyGalaxyFailure("run_tool", undefined, GALAXY)).toBeNull();
    expect(classifyGalaxyFailure(undefined, "Request timed out", GALAXY)).toBeNull();
  });
});
