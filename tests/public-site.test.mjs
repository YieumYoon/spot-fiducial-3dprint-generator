import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const siteRoot = new URL("../site/", import.meta.url);

async function readSiteFile(relativePath) {
  return readFile(new URL(relativePath, siteRoot), "utf8");
}

test("public pages include lean SEO metadata", async () => {
  for (const relativePath of ["index.html", "about.html", "svg-to-step.html", "privacy.html", "license.html"]) {
    const html = await readSiteFile(relativePath);

    for (const snippet of [
      'name="description"',
      'name="author"',
      'property="og:title"',
      'property="og:description"',
      'property="og:image"',
      'name="twitter:card"',
      'rel="canonical"',
      'rel="manifest"'
    ]) {
      assert.match(html, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("homepage includes structured data and verification placeholder", async () => {
  const html = await readSiteFile("index.html");
  assert.match(html, /"@type": "SoftwareApplication"/);
  assert.match(html, /name="google-site-verification"/);
});

test("homepage exposes the purpose-first range selector and guide", async () => {
  const html = await readSiteFile("index.html");

  assert.match(html, /id="tag-range-field"/);
  assert.match(html, /id="tag-range-options"/);
  assert.match(html, /id="dock-location-field"/);
  assert.match(html, /id="tag-range-guide"/);
  assert.match(html, /<strong>1-299<\/strong> Localization/);
  assert.match(html, /<strong>300-499<\/strong> Not Specified/);
  assert.match(html, /<strong>500-586<\/strong> Dock/);
  assert.match(html, /support\.bostondynamics\.com\/s\/article\/About-Fiducials-77114/);
  assert.equal(html.includes('id="layout-mode"'), false);
});

test("technical SEO files include expected URLs", async () => {
  const robots = await readSiteFile("robots.txt");
  const sitemap = await readSiteFile("sitemap.xml");

  assert.match(robots, /Sitemap: https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/about\.html/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/svg-to-step\.html/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/privacy\.html/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/license\.html/);
  assert.equal((sitemap.match(/<lastmod>2026-03-25<\/lastmod>/g) ?? []).length, 4);
});

test("SVG to STEP page explains usage and validation status", async () => {
  const html = await readSiteFile("svg-to-step.html");

  assert.match(html, /Use \$fusion360-svg-to-step to convert output\/example-cad\.svg to STEP\./);
  assert.match(html, /codex mcp add fusion --url http:\/\/127\.0\.0\.1:27182\/mcp/);
  assert.match(html, /has not yet been fully verified[\s\S]*another person's computer/);
  assert.match(html, /Create a 3D STEP file from an SVG/);
  assert.match(html, /href="\.\/svg-to-step\.html" aria-current="page"/);
});

test("privacy page keeps privacy navigation visible and marked current", async () => {
  const html = await readSiteFile("privacy.html");
  const privacyLinks = html.match(/href="\.\/privacy\.html"/g) ?? [];
  const currentPrivacyLinks = html.match(/href="\.\/privacy\.html" aria-current="page"/g) ?? [];

  assert.equal(privacyLinks.length, 2);
  assert.equal(currentPrivacyLinks.length, 2);
});

test("license page renders MIT text without the nested legal card", async () => {
  const html = await readSiteFile("license.html");

  assert.match(html, /MIT License/);
  assert.equal(html.includes('class="legal-card"'), false);
});
