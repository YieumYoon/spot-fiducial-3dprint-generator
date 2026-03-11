import test from "node:test";
import assert from "node:assert/strict";

import { buildCadCompatibleRootAttributes, mmToSvgPixels } from "../site/js/compose.js";

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
