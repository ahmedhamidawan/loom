import { describe, expect, it } from "vitest";

import { inventedEmbed } from "./artifacts";

describe("an invented visualization embed", () => {
  it("is refused in prose, as a page would show it as text", () => {
    for (const text of [
      "{{visualization|visualization_id=879ba288280d20df}}",
      "See {{ visualization: 1A2C }} below.",
      "{{visualization}}",
    ]) {
      expect(inventedEmbed(text), text).toContain("write {{artifact}}");
    }
  });

  it("leaves template syntax that is not one, or that is written as code", () => {
    for (const text of [
      "{{artifact}}",
      "{{artifact: Reads}}",
      "Fill in {{name}} and {{visualizations}} in the template.",
      "Use `{{visualization|id}}` in the template.",
      "~~~\n{{visualization|visualization_id=x}}\n~~~",
      "```\n{{visualization}}\n```",
    ]) {
      expect(inventedEmbed(text), text).toBeNull();
    }
  });
});
