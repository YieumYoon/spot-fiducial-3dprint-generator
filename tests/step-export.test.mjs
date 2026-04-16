import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const helper = path.join(root, "scripts", "fusion360", "svg_step_model.py");
const fixture = path.join(__dirname, "fixtures", "step-export-sample.svg");

function runHelper(args) {
  return execFileSync("python3", [helper, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function describeFixture() {
  return JSON.parse(runHelper(["describe", fixture]));
}

function classifyPoint(xMm, yMm) {
  return JSON.parse(runHelper(["point", fixture, String(xMm), String(yMm)]));
}

test("step export helper summarizes a CAD-style SVG fixture", () => {
  assert.deepEqual(describeFixture(), {
    apriltagBlackShapeCount: 1,
    apriltagBox: null,
    apriltagGridSize: null,
    baseGroupCount: 2,
    blackShapeCount: 3,
    decorativeBlackShapeCount: 2,
    heightMm: 60,
    holeShapeCount: 1,
    overlayGroupCount: 5,
    plateShapeCount: 1,
    widthMm: 100
  });
});

test("step export helper classifies white, black, and hole regions", () => {
  assert.equal(classifyPoint(50, 40).visibleLayer, "white");
  assert.equal(classifyPoint(8, 8).visibleLayer, "hole");
  assert.equal(classifyPoint(22, 12).visibleLayer, "black");
  assert.equal(classifyPoint(30, 20).visibleLayer, "white");
  assert.equal(classifyPoint(57, 12).visibleLayer, "black");
  assert.equal(classifyPoint(62, 20).visibleLayer, "white");
  assert.equal(classifyPoint(76, 11).visibleLayer, "black");
  assert.equal(classifyPoint(80, 15).visibleLayer, "white");
});

test("step export helper emits normalized layer SVGs", () => {
  const baseSvg = runHelper(["emit-layer", fixture, "base"]);
  const overlaySvg = runHelper(["emit-layer", fixture, "overlay"]);

  assert.match(baseSvg, /viewBox="0 0 100 60"/);
  assert.match(baseSvg, /id="background"/);
  assert.match(baseSvg, /id="holes"/);
  assert.doesNotMatch(baseSvg, /id="company-name"/);
  assert.doesNotMatch(baseSvg, /export-geometry-root/);

  assert.match(overlaySvg, /id="apriltag-black"/);
  assert.match(overlaySvg, /id="company-name"/);
  assert.match(overlaySvg, /id="logo"/);
  assert.match(overlaySvg, /clip-company-box/);
  assert.doesNotMatch(overlaySvg, /export-geometry-root/);
});
