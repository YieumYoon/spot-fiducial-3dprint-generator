import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFilename,
  coerceTagIdToPreset,
  formatTagId,
  getLayoutOption,
  getTagRangePreset,
  getTagRangePresetForTagId,
  isDockTagId,
  isValidTagId,
  listTagIdsForPreset,
  normalizeLayoutMode
} from "../site/js/core.js";

test("formatTagId zero-pads numeric input", () => {
  assert.equal(formatTagId(7), "007");
  assert.equal(formatTagId("42"), "042");
  assert.equal(formatTagId("586"), "586");
});

test("isValidTagId enforces the 001-586 range", () => {
  assert.equal(isValidTagId("001"), true);
  assert.equal(isValidTagId("586"), true);
  assert.equal(isValidTagId("000"), false);
  assert.equal(isValidTagId("587"), false);
});

test("dock layout is limited to the 500-series range", () => {
  assert.equal(isDockTagId("499"), false);
  assert.equal(isDockTagId("500"), true);
  assert.equal(normalizeLayoutMode("499", "dock"), "standard");
  assert.equal(normalizeLayoutMode("500", "dock"), "dock");
  assert.equal(getLayoutOption("500", "dock").id, "dock");
});

test("tag range presets resolve the expected boundaries", () => {
  assert.equal(getTagRangePreset("localization").min, 1);
  assert.equal(getTagRangePreset("not-specified").min, 300);
  assert.equal(getTagRangePreset("dock").min, 500);
  assert.equal(getTagRangePresetForTagId("001").id, "localization");
  assert.equal(getTagRangePresetForTagId("299").id, "localization");
  assert.equal(getTagRangePresetForTagId("300").id, "not-specified");
  assert.equal(getTagRangePresetForTagId("499").id, "not-specified");
  assert.equal(getTagRangePresetForTagId("500").id, "dock");
  assert.equal(getTagRangePresetForTagId("586").id, "dock");
});

test("tag IDs are coerced into the selected range preset", () => {
  assert.equal(coerceTagIdToPreset("042", "localization"), "042");
  assert.equal(coerceTagIdToPreset("042", "not-specified"), "300");
  assert.equal(coerceTagIdToPreset("499", "dock"), "500");
});

test("listTagIdsForPreset constrains the visible tag options", () => {
  const localizationIds = listTagIdsForPreset("localization");
  const unspecifiedIds = listTagIdsForPreset("not-specified");
  const dockIds = listTagIdsForPreset("dock");

  assert.equal(localizationIds[0], "001");
  assert.equal(localizationIds.at(-1), "299");
  assert.equal(unspecifiedIds[0], "300");
  assert.equal(unspecifiedIds.at(-1), "499");
  assert.equal(dockIds[0], "500");
  assert.equal(dockIds.at(-1), "586");
});

test("buildFilename sanitizes inputs for export", () => {
  assert.equal(
    buildFilename({ companyName: "Acme Robotics", robotName: "Spot / 17", tagId: "004" }),
    "acme-robotics-spot-17-tag004.svg"
  );
});

test("buildFilename appends export target suffixes when requested", () => {
  assert.equal(
    buildFilename({ companyName: "Acme Robotics", robotName: "Spot / 17", tagId: "004", exportTarget: "print" }),
    "acme-robotics-spot-17-tag004-print.svg"
  );
  assert.equal(
    buildFilename({ companyName: "Acme Robotics", robotName: "Spot / 17", tagId: "004", exportTarget: "cad" }),
    "acme-robotics-spot-17-tag004-cad.svg"
  );
});

test("buildFilename uses the dock location for dock templates", () => {
  assert.equal(
    buildFilename({ dockLocation: "Dock A1", tagId: "500", layoutMode: "dock" }),
    "dock-a1-tag500-dock.svg"
  );
});
