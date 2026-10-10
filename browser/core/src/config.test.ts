import { describe, expect, it } from "vitest";

import { buildConfig, type Launched } from "./config";

const incoming: Launched = { root: "/", datasetId: "d1", galaxyChatUrl: "/api/plugins/olit" };

describe("buildConfig", () => {
  it("never hands the agent the API key", () => {
    const config = buildConfig(incoming, { provider: "openrouter", apiKey: "sk-secret" });
    expect(JSON.stringify(config)).not.toContain("sk-secret");
    expect("ai_api_key" in config).toBe(false);
  });

  // Launched has no field for either, but a launch that carries the plugin's specs along
  // anyway still mustn't pass them through.
  it("carries no Galaxy key or capability grant from whatever launched it", () => {
    const launched = {
      ...incoming,
      galaxy_api_key: "fea4130124bb18ef",
      capabilities: "llm,local,read",
    } as Launched;
    const config = JSON.stringify(buildConfig(launched));
    expect(config).not.toContain("fea4130124bb18ef");
    expect(config).not.toContain("llm,local,read");
  });
});
