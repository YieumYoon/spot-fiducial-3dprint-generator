import test from "node:test";
import assert from "node:assert/strict";

import { buildFilename, formatTagId, isValidTagId } from "../site/js/core.js";

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
