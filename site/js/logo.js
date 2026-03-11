import { SVG_NS } from "./config.js";
import { clearChildren } from "./core.js";

const ALLOWED_ELEMENTS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const ALLOWED_ATTRIBUTES = new Set([
  "viewBox",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "transform",
  "d",
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "y1",
  "x2",
  "y2",
  "points"
]);

function parseNumericLength(value) {
  const match = /^-?\d+(\.\d+)?/.exec(String(value).trim());
  return match ? Number(match[0]) : null;
}

function cloneSafeNode(node, ownerDocument) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName;
  if (!ALLOWED_ELEMENTS.has(tagName)) {
    return null;
  }

  const clone = ownerDocument.createElementNS(SVG_NS, tagName);

  for (const attribute of node.attributes) {
    if (!ALLOWED_ATTRIBUTES.has(attribute.name)) {
      continue;
    }

    if (attribute.value.includes("url(") || attribute.value.includes("javascript:")) {
      continue;
    }

    clone.setAttribute(attribute.name, attribute.value);
  }

  for (const child of node.childNodes) {
    const safeChild = cloneSafeNode(child, ownerDocument);
    if (safeChild) {
      clone.appendChild(safeChild);
    }
  }

  return clone;
}

function readViewBox(root) {
  const viewBox = root.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox
      .split(/[ ,]+/)
      .map(Number)
      .filter((value) => Number.isFinite(value));

    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return {
        minX: parts[0],
        minY: parts[1],
        width: parts[2],
        height: parts[3]
      };
    }
  }

  const width = parseNumericLength(root.getAttribute("width"));
  const height = parseNumericLength(root.getAttribute("height"));

  if (width && height) {
    return {
      minX: 0,
      minY: 0,
      width,
      height
    };
  }

  return null;
}

export function sanitizeUploadedLogo(svgMarkup) {
  const document = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new Error("Uploaded logo is not a valid SVG file.");
  }

  const root = document.documentElement;
  if (root.tagName !== "svg") {
    throw new Error("Uploaded logo is not a valid SVG file.");
  }

  const viewBox = readViewBox(root);
  if (!viewBox) {
    throw new Error("Uploaded logo is not a valid SVG file.");
  }

  const safeRoot = document.implementation.createDocument(SVG_NS, "svg", null).documentElement;
  safeRoot.setAttribute("viewBox", `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);

  for (const child of root.childNodes) {
    const safeChild = cloneSafeNode(child, safeRoot.ownerDocument);
    if (safeChild) {
      safeRoot.appendChild(safeChild);
    }
  }

  return {
    markup: new XMLSerializer().serializeToString(safeRoot),
    viewBox
  };
}

function fitViewBoxIntoSlot(viewBox, slot, inset = 1.05) {
  const innerWidth = slot.width - inset * 2;
  const innerHeight = slot.height - inset * 2;
  const scale = Math.min(innerWidth / viewBox.width, innerHeight / viewBox.height);
  const scaledWidth = viewBox.width * scale;
  const scaledHeight = viewBox.height * scale;
  const x = slot.x + inset + (innerWidth - scaledWidth) / 2 - viewBox.minX * scale;
  const y = slot.y + inset + (innerHeight - scaledHeight) / 2 - viewBox.minY * scale;

  return `translate(${x.toFixed(4)} ${y.toFixed(4)}) scale(${scale.toFixed(6)})`;
}

function appendImportedMarkup(targetGroup, markup, transform) {
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  const sourceRoot = parsed.documentElement;
  const wrapper = targetGroup.ownerDocument.createElementNS(SVG_NS, "g");
  wrapper.setAttribute("transform", transform);

  for (const child of sourceRoot.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      wrapper.appendChild(targetGroup.ownerDocument.importNode(child, true));
    }
  }

  targetGroup.appendChild(wrapper);
}

export function populateLogoGroup({ targetGroup, templateDocument, slot, logoMode, uploadRecord }) {
  clearChildren(targetGroup);

  if (uploadRecord) {
    appendImportedMarkup(targetGroup, uploadRecord.markup, fitViewBoxIntoSlot(uploadRecord.viewBox, slot));
    return "Uploaded SVG";
  }

  if (logoMode !== "default") {
    return "Empty";
  }

  const symbol = templateDocument.querySelector("#default-logo-mark");
  const viewBox = readViewBox(symbol) ?? {
    minX: 0,
    minY: 0,
    width: 100,
    height: 100
  };
  const wrapper = targetGroup.ownerDocument.createElementNS(SVG_NS, "g");
  wrapper.setAttribute("transform", fitViewBoxIntoSlot(viewBox, slot, 0));

  for (const child of symbol.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      wrapper.appendChild(targetGroup.ownerDocument.importNode(child, true));
    }
  }

  targetGroup.appendChild(wrapper);
  return "Built-in default";
}
