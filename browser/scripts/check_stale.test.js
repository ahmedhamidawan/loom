import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PINS, pinFor } from "./check_stale.js";

// Through the script's own mapping, so pointing a pin back at the workspace root (which pins
// neither) fails here rather than as a "could not check" line in `npm run stale`.
test("npm run stale finds every pin it reports on, in the package that declares it", () => {
  for (const name of Object.keys(PINS)) assert.ok(pinFor(name), name);
});
