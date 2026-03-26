import {
  DOCK_LAYOUT_MIN_TAG_ID,
  DRILL_PRESETS,
  FONT_OPTIONS,
  LAYOUT_OPTIONS,
  TAG_RANGE,
  TAG_RANGE_PRESETS
} from "./config.js";

export function formatTagId(tagId) {
  return String(Number(tagId)).padStart(3, "0");
}

export function isValidTagId(tagId) {
  const value = Number(tagId);
  return Number.isInteger(value) && value >= TAG_RANGE.min && value <= TAG_RANGE.max;
}

export function isDockTagId(tagId) {
  const value = Number(tagId);
  return Number.isInteger(value) && value >= DOCK_LAYOUT_MIN_TAG_ID && value <= TAG_RANGE.max;
}

export function getTagRangePreset(presetId) {
  return TAG_RANGE_PRESETS.find((preset) => preset.id === presetId) ?? TAG_RANGE_PRESETS[0];
}

export function getTagRangePresetForTagId(tagId) {
  const value = Number(tagId);

  if (!Number.isInteger(value)) {
    return TAG_RANGE_PRESETS[0];
  }

  return TAG_RANGE_PRESETS.find((preset) => value >= preset.min && value <= preset.max) ?? TAG_RANGE_PRESETS[0];
}

export function tagIdBelongsToPreset(tagId, presetId) {
  const value = Number(tagId);
  const preset = getTagRangePreset(presetId);
  return Number.isInteger(value) && value >= preset.min && value <= preset.max;
}

export function coerceTagIdToPreset(tagId, presetId) {
  const preset = getTagRangePreset(presetId);
  return tagIdBelongsToPreset(tagId, preset.id) ? formatTagId(tagId) : formatTagId(preset.min);
}

export function listTagIdsForPreset(presetId) {
  const preset = getTagRangePreset(presetId);
  const tagIds = [];

  for (let id = preset.min; id <= preset.max; id += 1) {
    tagIds.push(formatTagId(id));
  }

  return tagIds;
}

export function normalizeLayoutMode(tagId, layoutMode) {
  return isDockTagId(tagId) && layoutMode === "dock" ? "dock" : "standard";
}

export function getLayoutOption(tagId, layoutMode) {
  return LAYOUT_OPTIONS[normalizeLayoutMode(tagId, layoutMode)] ?? LAYOUT_OPTIONS.standard;
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

export function buildFilename({
  companyName,
  robotName,
  dockLocation = "",
  tagId,
  exportTarget = null,
  layoutMode = "standard"
}) {
  const displayId = formatTagId(tagId);
  const normalizedLayoutMode = normalizeLayoutMode(tagId, layoutMode);
  const subjectPart = normalizedLayoutMode === "dock"
    ? slugifyPart(dockLocation, "dock-location")
    : `${slugifyPart(companyName, "company")}-${slugifyPart(robotName, "robot")}`;
  const layoutSuffix = normalizedLayoutMode === "dock" ? "-dock" : "";
  const exportSuffix = exportTarget ? `-${exportTarget}` : "";
  return `${subjectPart}-tag${displayId}${layoutSuffix}${exportSuffix}.svg`;
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
