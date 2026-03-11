import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "site/index.html",
  "site/styles.css",
  "site/app.js",
  "site/assets/spot-fiducial-template.svg",
  "site/assets/fonts/RobotoCondensed-Regular.ttf",
  "site/data/tag36h11.js",
  "site/vendor/opentype.js"
];

for (const relativePath of requiredFiles) {
  await access(path.join(root, relativePath));
}

const templateSvg = await readFile(path.join(root, "site/assets/spot-fiducial-template.svg"), "utf8");
if (!templateSvg.includes('id="background"') || !templateSvg.includes('id="apriltag-black"')) {
  throw new Error("Template SVG is missing required structural groups.");
}

const tagDataModule = await import(path.join(root, "site/data/tag36h11.js"));
if (Object.keys(tagDataModule.TAG_DEFINITIONS).length !== 586) {
  throw new Error("Generated AprilTag data is incomplete.");
}

console.log("Static site build checks passed.");
