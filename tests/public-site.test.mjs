import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const siteRoot = new URL("../site/", import.meta.url);

async function readSiteFile(relativePath) {
  return readFile(new URL(relativePath, siteRoot), "utf8");
}

test("public pages include lean SEO metadata", async () => {
  for (const relativePath of ["index.html", "about.html", "privacy.html", "license.html"]) {
    const html = await readSiteFile(relativePath);

    for (const snippet of [
      'name="description"',
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

test("technical SEO files include expected URLs", async () => {
  const robots = await readSiteFile("robots.txt");
  const sitemap = await readSiteFile("sitemap.xml");

  assert.match(robots, /Sitemap: https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/about\.html/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/privacy\.html/);
  assert.match(sitemap, /https:\/\/yieumyoon\.github\.io\/spot-fiducial-3dprint-generator\/license\.html/);
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
