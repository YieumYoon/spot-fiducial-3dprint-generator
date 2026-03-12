import test from "node:test";
import assert from "node:assert/strict";

import { buildCadCompatibleRootAttributes, buildMergedCellPaths, mmToSvgPixels } from "../site/js/compose.js";

test("mmToSvgPixels converts millimeters into SVG 96 dpi user units", () => {
  assert.equal(Number(mmToSvgPixels(146).toFixed(4)), 551.811);
  assert.equal(Number((mmToSvgPixels(146) * 25.4 / 96).toFixed(4)), 146);
});

test("buildCadCompatibleRootAttributes preserves physical mm size with a pixel viewBox", () => {
  assert.deepEqual(
    buildCadCompatibleRootAttributes({ width: 182.5, height: 209.875 }),
    {
      width: "182.5mm",
      height: "209.875mm",
      viewBox: "0 0 689.7638 793.2283"
    }
  );
});

test("buildMergedCellPaths collapses connected cells into a shared outline", () => {
  assert.deepEqual(
    buildMergedCellPaths([[0, 0], [1, 0], [0, 1]]),
    ["M 0 0 L 2 0 L 2 1 L 1 1 L 1 2 L 0 2 Z"]
  );
});

test("buildMergedCellPaths keeps diagonally touching cells as separate paths", () => {
  assert.deepEqual(
    buildMergedCellPaths([[0, 0], [1, 1]]),
    [
      "M 0 0 L 1 0 L 1 1 L 0 1 Z",
      "M 1 1 L 2 1 L 2 2 L 1 2 Z"
    ]
  );
});

test("buildMergedCellPaths preserves holes inside a connected black region", () => {
  assert.deepEqual(
    buildMergedCellPaths([
      [0, 0], [1, 0], [2, 0],
      [0, 1],         [2, 1],
      [0, 2], [1, 2], [2, 2]
    ]),
    ["M 0 0 L 3 0 L 3 3 L 0 3 Z M 2 1 L 1 1 L 1 2 L 2 2 Z"]
  );
});

test("buildMergedCellPaths handles connected regions that touch at a shared corner", () => {
  assert.deepEqual(
    buildMergedCellPaths([
      [0, 0], [1, 0], [2, 0],
      [0, 1],         [2, 1],
      [0, 2], [1, 2]
    ]),
    ["M 0 0 L 3 0 L 3 2 L 2 2 L 2 1 L 1 1 L 1 2 L 2 2 L 2 3 L 0 3 Z"]
  );
});
