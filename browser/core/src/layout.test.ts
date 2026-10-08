import { describe, expect, it } from "vitest";

import { mountLayout } from "./layout";

describe("the layout", () => {
  it("offers Save only when something stores the conversation", () => {
    const saving = document.createElement("div");
    expect(mountLayout(saving).save).toBe(saving.querySelector("#save-btn"));
    const notSaving = document.createElement("div");
    expect(mountLayout(notSaving, { save: false }).save).toBeUndefined();
    expect(notSaving.querySelector("#save-btn")).toBeNull();
  });
});
