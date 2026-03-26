import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cleaned template omits old internal divider layer and fixed text paths", async () => {
  const template = await readFile(new URL("../site/assets/spot-fiducial-template.svg", import.meta.url), "utf8");

  assert.equal(template.includes("visible-layout-layer"), false);
  assert.equal(template.includes("fixed-title-path"), false);
  assert.equal(template.includes("fixed-warning-path"), false);
  assert.equal(template.includes('id="apriltag-black"'), true);
});

test("cleaned template metadata exposes the refined title and display-id slot heights", async () => {
  const template = await readFile(new URL("../site/assets/spot-fiducial-template.svg", import.meta.url), "utf8");
  const metadataMatch = template.match(/<metadata id="template-spec">(.+)<\/metadata>/);

  assert.ok(metadataMatch);

  const metadata = JSON.parse(metadataMatch[1]);
  assert.equal(metadata.slots.fixedTitle.y, 0);
  assert.equal(metadata.slots.fixedTitle.height, 6.25);
  assert.equal(metadata.slots.displayId.y, 6.25);
  assert.equal(metadata.slots.displayId.height, 12.0);
});

test("dock template metadata exposes DXF-derived plate and slot dimensions", async () => {
  const template = await readFile(new URL("../site/assets/spot-dock-fiducial-template.svg", import.meta.url), "utf8");
  const metadataMatch = template.match(/<metadata id="template-spec">(.+)<\/metadata>/);

  assert.ok(metadataMatch);

  const metadata = JSON.parse(metadataMatch[1]);
  assert.equal(metadata.contentProfile, "dock");
  assert.equal(metadata.plate.width, 200.75);
  assert.equal(metadata.plate.height, 215.522);
  assert.equal(metadata.apriltag.tagBox.x, 27.375);
  assert.equal(metadata.slots.dockDisplayId.width, 20);
  assert.equal(metadata.slots.dockLocation.alignX, "right");
});
