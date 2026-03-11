import { FIXED_STRINGS, GUIDE_STYLE, SVG_NS } from "./config.js";
import { buildFilename, clearChildren, formatTagId, getDrillPreset, isValidTagId } from "./core.js";
import { populateLogoGroup } from "./logo.js";
import { buildTextPath } from "./text.js";
import { TAG_DEFINITIONS, TAG_GRID_SIZE } from "../data/tag36h11.js";

function parseTemplate(templateText) {
  const document = new DOMParser().parseFromString(templateText, "image/svg+xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new Error("Template SVG could not be parsed.");
  }

  return {
    document,
    metadata: JSON.parse(document.querySelector("#template-spec").textContent)
  };
}

function appendPath(group, id, pathData, attributes) {
  if (!pathData) {
    return;
  }

  const path = group.ownerDocument.createElementNS(SVG_NS, "path");
  path.setAttribute("id", id);
  path.setAttribute("d", pathData);

  for (const [name, value] of Object.entries(attributes)) {
    path.setAttribute(name, value);
  }

  group.appendChild(path);
}

function populateApriltag(document, tagBox, tagId) {
  const tagGroup = document.querySelector("#apriltag-black");
  clearChildren(tagGroup);

  const blackCells = TAG_DEFINITIONS[tagId];
  if (!blackCells) {
    throw new Error("Selected AprilTag ID is not supported.");
  }

  const cellSize = tagBox.width / TAG_GRID_SIZE;
  for (const [x, y] of blackCells) {
    const cell = document.createElementNS(SVG_NS, "rect");
    cell.setAttribute("x", `${tagBox.x + x * cellSize}`);
    cell.setAttribute("y", `${tagBox.y + y * cellSize}`);
    cell.setAttribute("width", `${cellSize}`);
    cell.setAttribute("height", `${cellSize}`);
    cell.setAttribute("fill", "#111111");
    tagGroup.appendChild(cell);
  }
}

function updateHoleRadii(document, diameterMm) {
  for (const hole of document.querySelectorAll("#holes circle")) {
    hole.setAttribute("r", `${diameterMm / 2}`);
  }
}

function appendGuideLayer(document, slots) {
  const guideGroup = document.createElementNS(SVG_NS, "g");
  guideGroup.setAttribute("id", "preview-guides");
  guideGroup.setAttribute("data-preview-only", "true");

  for (const [slotKey, slot] of Object.entries(slots)) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("id", `guide-${slotKey}`);
    rect.setAttribute("x", `${slot.x}`);
    rect.setAttribute("y", `${slot.y}`);
    rect.setAttribute("width", `${slot.width}`);
    rect.setAttribute("height", `${slot.height}`);

    for (const [name, value] of Object.entries(GUIDE_STYLE)) {
      rect.setAttribute(name, value);
    }

    guideGroup.appendChild(rect);
  }

  document.documentElement.appendChild(guideGroup);
}

export function composeSvg({
  templateText,
  state,
  fontRecord,
  uploadLogoRecord = null,
  includeGuides = false
}) {
  const { document, metadata } = parseTemplate(templateText);
  const errors = {};
  const safeTagId = isValidTagId(state.tagId) ? formatTagId(state.tagId) : "001";
  const safeDrillPreset = getDrillPreset(state.drillPreset) ?? getDrillPreset("m3");

  if (!isValidTagId(state.tagId)) {
    errors.tagId = "Selected AprilTag ID is not supported.";
  }

  if (!getDrillPreset(state.drillPreset)) {
    errors.drillPreset = "The selected drill-hole preset is not supported.";
  }

  if (!state.companyName.trim()) {
    errors.companyName = "Company name is required for export.";
  }

  if (!state.robotName.trim()) {
    errors.robotName = "Robot name is required for export.";
  }

  populateApriltag(document, metadata.apriltag.tagBox, safeTagId);
  updateHoleRadii(document, safeDrillPreset.diameterMm);

  const slotMap = {
    companyName: { ...metadata.slots.companyName, label: "Company name" },
    robotName: { ...metadata.slots.robotName, label: "Robot name" },
    fixedTitle: { ...metadata.slots.fixedTitle, label: "Title" },
    displayId: { ...metadata.slots.displayId, label: "Display ID" },
    warning: { ...metadata.slots.warning, label: "Warning text" },
    logo: { ...metadata.slots.logo, label: "Logo" }
  };

  const textDefinitions = [
    { groupId: "company-name", slotKey: "companyName", text: state.companyName },
    { groupId: "robot-name", slotKey: "robotName", text: state.robotName },
    { groupId: "fixed-title", slotKey: "fixedTitle", text: FIXED_STRINGS.fixedTitle },
    { groupId: "display-id", slotKey: "displayId", text: safeTagId },
    { groupId: "bottom-warning", slotKey: "warning", text: FIXED_STRINGS.warning }
  ];

  for (const definition of textDefinitions) {
    const group = document.querySelector(`#${definition.groupId}`);
    clearChildren(group);

    const textPath = buildTextPath({
      fontRecord,
      text: definition.text,
      slot: slotMap[definition.slotKey],
      slotKey: definition.slotKey
    });

    if (textPath.error) {
      const errorKey = definition.slotKey === "warning" || definition.slotKey === "fixedTitle"
        ? "fontFamily"
        : definition.slotKey;
      errors[errorKey] = textPath.error;
    } else {
      appendPath(group, `${definition.groupId}-path`, textPath.pathData, textPath.attributes);
    }
  }

  const logoGroup = document.querySelector("#logo");
  let effectiveLogoMode = "Empty";
  try {
    effectiveLogoMode = populateLogoGroup({
      targetGroup: logoGroup,
      templateDocument: document,
      slot: slotMap.logo,
      logoMode: state.logoMode,
      uploadRecord: uploadLogoRecord
    });
  } catch (error) {
    errors.logoUpload = "Uploaded logo is not a valid SVG file.";
  }

  if (includeGuides) {
    appendGuideLayer(document, metadata.slots);
  }

  const serialized = new XMLSerializer().serializeToString(document.documentElement);

  return {
    svgText: serialized,
    metadata,
    errors,
    effectiveLogoMode,
    filename: buildFilename(state)
  };
}
