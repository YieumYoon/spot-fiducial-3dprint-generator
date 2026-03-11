import test from "node:test";
import assert from "node:assert/strict";

import { TAG_DEFINITIONS, TAG_GRID_SIZE } from "../site/data/tag36h11.js";

test("generated tag data covers ids 001-586", () => {
  assert.equal(Object.keys(TAG_DEFINITIONS).length, 586);
  assert.ok(Array.isArray(TAG_DEFINITIONS["001"]));
  assert.ok(Array.isArray(TAG_DEFINITIONS["586"]));
});

test("generated black cells stay within the 8x8 tag grid", () => {
  for (const cells of [TAG_DEFINITIONS["001"], TAG_DEFINITIONS["319"], TAG_DEFINITIONS["586"]]) {
    for (const [x, y] of cells) {
      assert.ok(x >= 0 && x < TAG_GRID_SIZE);
      assert.ok(y >= 0 && y < TAG_GRID_SIZE);
    }
  }
});
