import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "site/index.html",
  "site/about.html",
  "site/privacy.html",
  "site/styles.css",
  "site/app.js",
  "site/js/analytics.js",
  "site/js/public-site.js",
  "site/js/site-config.js",
  "site/manifest.webmanifest",
  "site/robots.txt",
  "site/sitemap.xml",
  "site/assets/spot-fiducial-template.svg",
  "site/assets/social-preview.svg",
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

const homePage = await readFile(path.join(root, "site/index.html"), "utf8");
const aboutPage = await readFile(path.join(root, "site/about.html"), "utf8");
const privacyPage = await readFile(path.join(root, "site/privacy.html"), "utf8");

for (const [filename, html] of [
  ["site/index.html", homePage],
  ["site/about.html", aboutPage],
  ["site/privacy.html", privacyPage]
]) {
  for (const requiredSnippet of [
    'name="description"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'name="twitter:card"',
    'name="twitter:title"',
    'name="twitter:description"',
    'name="twitter:image"',
    'rel="canonical"',
    'rel="manifest"'
  ]) {
    if (!html.includes(requiredSnippet)) {
      throw new Error(`${filename} is missing required metadata: ${requiredSnippet}`);
    }
  }
}

if (!homePage.includes('name="google-site-verification"')) {
  throw new Error("site/index.html is missing the Search Console verification tag placeholder.");
}

if (!homePage.includes('"@type": "SoftwareApplication"')) {
  throw new Error("site/index.html is missing SoftwareApplication structured data.");
}

const robotsTxt = await readFile(path.join(root, "site/robots.txt"), "utf8");
if (!robotsTxt.includes("Sitemap: https://yieumyoon.github.io/spot-fiducial-3dprint-generator/sitemap.xml")) {
  throw new Error("robots.txt is missing the sitemap reference.");
}

const sitemapXml = await readFile(path.join(root, "site/sitemap.xml"), "utf8");
for (const expectedUrl of [
  "https://yieumyoon.github.io/spot-fiducial-3dprint-generator/",
  "https://yieumyoon.github.io/spot-fiducial-3dprint-generator/about.html",
  "https://yieumyoon.github.io/spot-fiducial-3dprint-generator/privacy.html"
]) {
  if (!sitemapXml.includes(expectedUrl)) {
    throw new Error(`sitemap.xml is missing ${expectedUrl}`);
  }
}

const manifest = await readFile(path.join(root, "site/manifest.webmanifest"), "utf8");
if (!manifest.includes('"short_name": "Spot Fiducial"') || !manifest.includes('"src": "./assets/favicon.svg"')) {
  throw new Error("manifest.webmanifest is missing required app metadata.");
}

const socialPreviewSvg = await readFile(path.join(root, "site/assets/social-preview.svg"), "utf8");
if (!socialPreviewSvg.includes('width="1200"') || !socialPreviewSvg.includes('height="630"')) {
  throw new Error("Social preview asset must be sized for sharing.");
}

const tagDataModule = await import(path.join(root, "site/data/tag36h11.js"));
if (Object.keys(tagDataModule.TAG_DEFINITIONS).length !== 586) {
  throw new Error("Generated AprilTag data is incomplete.");
}

console.log("Static site build checks passed.");
