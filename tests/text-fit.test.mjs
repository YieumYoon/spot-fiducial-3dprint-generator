import test from "node:test";
import assert from "node:assert/strict";

import { findBestFitSize } from "../site/js/text-fit.js";

test("findBestFitSize returns a size that fits inside the box", () => {
  const result = findBestFitSize({
    measure: (size) => ({ width: size * 2, height: size }),
    boxWidth: 20,
    boxHeight: 12,
    minScale: 0.55,
    maxSize: 40
  });

  assert.equal(result.fits, true);
  assert.ok(result.fittedSize <= 10.01);
  assert.equal(result.tooSmall, false);
});

test("findBestFitSize flags layouts that require too much shrinking", () => {
  const result = findBestFitSize({
    measure: (size) => ({ width: size * 12, height: size }),
    boxWidth: 20,
    boxHeight: 12,
    minScale: 0.55,
    maxSize: 40
  });

  assert.equal(result.fits, true);
  assert.equal(result.tooSmall, true);
});
