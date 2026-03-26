import { FIXED_STRINGS, GUIDE_STYLE, SVG_NS } from "./config.js";
import { buildFilename, clearChildren, formatTagId, getDrillPreset, isValidTagId } from "./core.js";
import { populateLogoGroup } from "./logo.js";
import { buildTextPath } from "./text.js";
import { TAG_DEFINITIONS, TAG_GRID_SIZE } from "../data/tag36h11.js";

const SVG_IMPORT_DPI = 96;
const MM_PER_INCH = 25.4;
const SVG_PX_PER_MM = SVG_IMPORT_DPI / MM_PER_INCH;
const STATIC_ROOT_TAGS = new Set(["title", "desc", "metadata", "defs"]);
const EXPORT_TARGET_PRINT = "print";
const EXPORT_TARGET_CAD = "cad";

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

function buildCellKey(x, y) {
  return `${x},${y}`;
}

function buildPointKey(point) {
  return `${point.x},${point.y}`;
}

function parsePointKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function buildEdgeKey(start, end) {
  return `${buildPointKey(start)}>${buildPointKey(end)}`;
}

function sortCells(cells) {
  return [...cells].sort(([ax, ay], [bx, by]) => {
    if (ay !== by) {
      return ay - by;
    }

    return ax - bx;
  });
}

function collectOrthogonalComponents(cells) {
  const remaining = new Set(cells.map(([x, y]) => buildCellKey(x, y)));
  const components = [];

  for (const [x, y] of sortCells(cells)) {
    const startKey = buildCellKey(x, y);
    if (!remaining.has(startKey)) {
      continue;
    }

    const component = [];
    const stack = [[x, y]];
    remaining.delete(startKey);

    while (stack.length > 0) {
      const [currentX, currentY] = stack.pop();
      component.push([currentX, currentY]);

      for (const [nextX, nextY] of [
        [currentX, currentY - 1],
        [currentX + 1, currentY],
        [currentX, currentY + 1],
        [currentX - 1, currentY]
      ]) {
        const nextKey = buildCellKey(nextX, nextY);
        if (!remaining.has(nextKey)) {
          continue;
        }

        remaining.delete(nextKey);
        stack.push([nextX, nextY]);
      }
    }

    components.push(sortCells(component));
  }

  return components;
}

function simplifyLoop(points) {
  const ring = points.slice(0, -1);

  if (ring.length <= 4) {
    return ring;
  }

  return ring.filter((point, index) => {
    const previous = ring[(index - 1 + ring.length) % ring.length];
    const next = ring[(index + 1) % ring.length];
    const vertical = previous.x === point.x && point.x === next.x;
    const horizontal = previous.y === point.y && point.y === next.y;
    return !(vertical || horizontal);
  });
}

function getEdgeDirection(start, end) {
  if (end.x > start.x) {
    return "E";
  }

  if (end.x < start.x) {
    return "W";
  }

  if (end.y > start.y) {
    return "S";
  }

  return "N";
}

function buildDirectionPreference(direction) {
  const directions = ["E", "S", "W", "N"];
  const index = directions.indexOf(direction);

  return [
    directions[(index + 1) % directions.length],
    direction,
    directions[(index + directions.length - 1) % directions.length],
    directions[(index + 2) % directions.length]
  ];
}

function buildComponentLoops(component) {
  const componentSet = new Set(component.map(([x, y]) => buildCellKey(x, y)));
  const edges = new Map();
  const addEdge = (start, end) => {
    const startKey = buildPointKey(start);
    const outgoing = edges.get(startKey) ?? [];
    outgoing.push(end);
    edges.set(startKey, outgoing);
  };

  for (const [x, y] of component) {
    if (!componentSet.has(buildCellKey(x, y - 1))) {
      addEdge({ x, y }, { x: x + 1, y });
    }

    if (!componentSet.has(buildCellKey(x + 1, y))) {
      addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
    }

    if (!componentSet.has(buildCellKey(x, y + 1))) {
      addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
    }

    if (!componentSet.has(buildCellKey(x - 1, y))) {
      addEdge({ x, y: y + 1 }, { x, y });
    }
  }

  const loops = [];
  const usedEdges = new Set();
  const findNextUnusedEdge = () => {
    for (const [startKey, outgoing] of edges.entries()) {
      const startPoint = parsePointKey(startKey);
      for (const endPoint of outgoing) {
        if (!usedEdges.has(buildEdgeKey(startPoint, endPoint))) {
          return [startPoint, endPoint];
        }
      }
    }

    return null;
  };

  while (true) {
    const startEdge = findNextUnusedEdge();
    if (!startEdge) {
      break;
    }

    const [startPoint, initialEndPoint] = startEdge;
    const loop = [startPoint];
    let currentStart = startPoint;
    let currentEnd = initialEndPoint;

    while (true) {
      usedEdges.add(buildEdgeKey(currentStart, currentEnd));
      loop.push(currentEnd);

      if (buildPointKey(currentEnd) === buildPointKey(startPoint)) {
        break;
      }

      const outgoing = edges.get(buildPointKey(currentEnd)) ?? [];
      const candidates = outgoing.filter((point) => !usedEdges.has(buildEdgeKey(currentEnd, point)));
      if (candidates.length === 0) {
        throw new Error("AprilTag outline generation produced an open boundary.");
      }

      const directionPreference = buildDirectionPreference(getEdgeDirection(currentStart, currentEnd));
      candidates.sort((left, right) => {
        const leftDirection = getEdgeDirection(currentEnd, left);
        const rightDirection = getEdgeDirection(currentEnd, right);
        return directionPreference.indexOf(leftDirection) - directionPreference.indexOf(rightDirection);
      });

      currentStart = currentEnd;
      [currentEnd] = candidates;
    }

    loops.push(simplifyLoop(loop));
  }

  return loops;
}

function buildPathDataFromLoops(loops, { originX = 0, originY = 0, cellSize = 1 } = {}) {
  return loops.map((loop) => {
    const commands = loop.map((point, index) => {
      const command = index === 0 ? "M" : "L";
      const x = formatSvgNumber(originX + point.x * cellSize);
      const y = formatSvgNumber(originY + point.y * cellSize);
      return `${command} ${x} ${y}`;
    });

    return `${commands.join(" ")} Z`;
  }).join(" ");
}

export function buildMergedCellPaths(cells, { originX = 0, originY = 0, cellSize = 1 } = {}) {
  return collectOrthogonalComponents(cells).map((component) => {
    const loops = buildComponentLoops(component);
    return buildPathDataFromLoops(loops, { originX, originY, cellSize });
  });
}

function populateApriltag(document, tagBox, tagId) {
  const tagGroup = document.querySelector("#apriltag-black");
  clearChildren(tagGroup);

  const blackCells = TAG_DEFINITIONS[tagId];
  if (!blackCells) {
    throw new Error("Selected AprilTag ID is not supported.");
  }

  const cellSize = tagBox.width / TAG_GRID_SIZE;
  const mergedPaths = buildMergedCellPaths(blackCells, {
    originX: tagBox.x,
    originY: tagBox.y,
    cellSize
  });

  for (const [index, pathData] of mergedPaths.entries()) {
    appendPath(tagGroup, `apriltag-black-${index + 1}`, pathData, {
      fill: "#111111",
      "fill-rule": "evenodd"
    });
  }
}

function updateHoleRadii(document, diameterMm) {
  for (const hole of document.querySelectorAll("#holes circle")) {
    hole.setAttribute("r", `${diameterMm / 2}`);
  }
}

function resolveTemplateProfile(metadata) {
  return metadata.contentProfile === "dock" ? "dock" : "standard";
}

function buildSlotMap(metadata) {
  const defaultLabels = {
    companyName: "Company name",
    robotName: "Robot name",
    fixedTitle: "Title",
    displayId: "Display ID",
    dockDisplayId: "Display ID",
    dockLocation: "Dock location",
    warning: "Warning text",
    logo: "Logo"
  };

  return Object.fromEntries(
    Object.entries(metadata.slots ?? {}).map(([slotKey, slot]) => [
      slotKey,
      {
        ...slot,
        label: slot.label ?? defaultLabels[slotKey] ?? slotKey
      }
    ])
  );
}

function buildTextDefinitions(profile, state, safeTagId) {
  if (profile === "dock") {
    return [
      {
        groupId: "display-id",
        slotKey: "dockDisplayId",
        text: safeTagId,
        errorKey: "tagId"
      },
      {
        groupId: "dock-location",
        slotKey: "dockLocation",
        text: state.dockLocation,
        errorKey: "dockLocation"
      }
    ];
  }

  return [
    {
      groupId: "company-name",
      slotKey: "companyName",
      text: state.companyName,
      errorKey: "companyName"
    },
    {
      groupId: "robot-name",
      slotKey: "robotName",
      text: state.robotName,
      errorKey: "robotName"
    },
    {
      groupId: "fixed-title",
      slotKey: "fixedTitle",
      text: FIXED_STRINGS.fixedTitle,
      errorKey: "fontFamily"
    },
    {
      groupId: "display-id",
      slotKey: "displayId",
      text: safeTagId,
      errorKey: "tagId"
    },
    {
      groupId: "bottom-warning",
      slotKey: "warning",
      text: FIXED_STRINGS.warning,
      errorKey: "fontFamily"
    }
  ];
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

export function mmToSvgPixels(lengthMm) {
  return lengthMm * SVG_PX_PER_MM;
}

export function formatSvgNumber(value, fractionDigits = 4) {
  return Number.parseFloat(value.toFixed(fractionDigits)).toString();
}

export function buildPrintRootAttributes({ width, height }) {
  return {
    width: `${formatSvgNumber(width)}mm`,
    height: `${formatSvgNumber(height)}mm`,
    viewBox: `0 0 ${formatSvgNumber(width)} ${formatSvgNumber(height)}`
  };
}

export function buildCadCompatibleRootAttributes({ width, height }) {
  return {
    width: `${formatSvgNumber(width)}mm`,
    height: `${formatSvgNumber(height)}mm`,
    viewBox: `0 0 ${formatSvgNumber(mmToSvgPixels(width))} ${formatSvgNumber(mmToSvgPixels(height))}`
  };
}

function normalizeExportTarget(exportTarget) {
  return exportTarget === EXPORT_TARGET_CAD ? EXPORT_TARGET_CAD : EXPORT_TARGET_PRINT;
}

function normalizeSvgForCadExport(document, metadata) {
  const root = document.documentElement;
  const geometryRoot = document.createElementNS(SVG_NS, "g");

  // Some CAD importers treat SVG user units as 96 dpi pixels instead of honoring `mm`.
  geometryRoot.setAttribute("id", "export-geometry-root");
  geometryRoot.setAttribute("transform", `scale(${formatSvgNumber(SVG_PX_PER_MM, 6)})`);

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== 1 || STATIC_ROOT_TAGS.has(child.nodeName)) {
      continue;
    }

    geometryRoot.appendChild(child);
  }

  root.appendChild(geometryRoot);

  const rootAttributes = buildCadCompatibleRootAttributes(metadata.plate);
  root.setAttribute("width", rootAttributes.width);
  root.setAttribute("height", rootAttributes.height);
  root.setAttribute("viewBox", rootAttributes.viewBox);
}

export function composeSvg({
  templateText,
  state,
  fontRecord,
  uploadLogoRecord = null,
  includeGuides = false,
  exportTarget = EXPORT_TARGET_PRINT
}) {
  const { document, metadata } = parseTemplate(templateText);
  const templateProfile = resolveTemplateProfile(metadata);
  const resolvedExportTarget = normalizeExportTarget(exportTarget);
  const errors = {};
  const safeTagId = isValidTagId(state.tagId) ? formatTagId(state.tagId) : "001";
  const safeDrillPreset = getDrillPreset(state.drillPreset) ?? getDrillPreset("m3");
  const slotMap = buildSlotMap(metadata);
  const textDefinitions = buildTextDefinitions(templateProfile, state, safeTagId);

  if (!isValidTagId(state.tagId)) {
    errors.tagId = "Selected AprilTag ID is not supported.";
  }

  if (metadata.holeModel?.globalPresetOnly && !getDrillPreset(state.drillPreset)) {
    errors.drillPreset = "The selected drill-hole preset is not supported.";
  }

  if (templateProfile === "standard" && !state.companyName.trim()) {
    errors.companyName = "Company name is required for export.";
  }

  if (templateProfile === "standard" && !state.robotName.trim()) {
    errors.robotName = "Robot name is required for export.";
  }

  if (templateProfile === "dock" && !state.dockLocation.trim()) {
    errors.dockLocation = "Dock location is required for export.";
  }

  populateApriltag(document, metadata.apriltag.tagBox, safeTagId);
  if (metadata.holeModel?.globalPresetOnly) {
    updateHoleRadii(document, safeDrillPreset.diameterMm);
  }

  for (const definition of textDefinitions) {
    const slot = slotMap[definition.slotKey];
    const group = document.querySelector(`#${definition.groupId}`);
    if (!group || !slot) {
      continue;
    }

    clearChildren(group);

    const textPath = buildTextPath({
      fontRecord,
      text: definition.text,
      slot,
      slotKey: definition.slotKey
    });

    if (textPath.error) {
      errors[definition.errorKey] = textPath.error;
    } else {
      appendPath(group, `${definition.groupId}-path`, textPath.pathData, textPath.attributes);
    }
  }

  const logoGroup = document.querySelector("#logo");
  let effectiveLogoMode = "Empty";
  if (logoGroup && slotMap.logo) {
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
  }

  if (includeGuides) {
    appendGuideLayer(document, metadata.slots ?? {});
  }

  if (resolvedExportTarget === EXPORT_TARGET_CAD) {
    normalizeSvgForCadExport(document, metadata);
  } else {
    const rootAttributes = buildPrintRootAttributes(metadata.plate);
    const root = document.documentElement;
    root.setAttribute("width", rootAttributes.width);
    root.setAttribute("height", rootAttributes.height);
    root.setAttribute("viewBox", rootAttributes.viewBox);
  }

  const serialized = new XMLSerializer().serializeToString(document.documentElement);

  return {
    svgText: serialized,
    metadata,
    errors,
    effectiveLogoMode,
    filename: buildFilename({ ...state, exportTarget: resolvedExportTarget })
  };
}
