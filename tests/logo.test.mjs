import test from "node:test";
import assert from "node:assert/strict";

import { fitLogoIntoSlot } from "../site/js/logo.js";

test("fitLogoIntoSlot uses the full slot width for wide logos", () => {
  const slot = { x: 146, y: 0, width: 18.25, height: 18.25 };
  const transform = fitLogoIntoSlot({ minX: 0, minY: 0, width: 329, height: 178 }, slot);
  const match = /^translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)$/.exec(transform);

  assert.ok(match);
  assert.equal(Number(match[1]), slot.x);
  assert.equal(Number(match[3]), Number((slot.width / 329).toFixed(6)));
  assert.ok(Number(match[2]) > slot.y);
});
