import { DRILL_PRESETS, FONT_OPTIONS, TAG_RANGE } from "./config.js";

export function formatTagId(tagId) {
  return String(Number(tagId)).padStart(3, "0");
}

export function isValidTagId(tagId) {
  const value = Number(tagId);
  return Number.isInteger(value) && value >= TAG_RANGE.min && value <= TAG_RANGE.max;
}

export function getDrillPreset(presetId) {
  return DRILL_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function getFontOption(fontId) {
  return FONT_OPTIONS.find((font) => font.id === fontId) ?? FONT_OPTIONS[0];
}

export function slugifyPart(value, fallback) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
}

export function buildFilename({ companyName, robotName, tagId }) {
  const displayId = formatTagId(tagId);
  return `${slugifyPart(companyName, "company")}-${slugifyPart(robotName, "robot")}-tag${displayId}.svg`;
}

export function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
