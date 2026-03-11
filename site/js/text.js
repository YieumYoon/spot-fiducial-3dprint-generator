import { TEXT_LAYOUT } from "./config.js";
import { findBestFitSize } from "./text-fit.js";

const fontCache = new Map();

function measurePath(font, text, fontSize) {
  if (!text.trim()) {
    return {
      path: null,
      bbox: { x1: 0, y1: 0, x2: 0, y2: 0 },
      width: 0,
      height: 0
    };
  }

  const path = font.getPath(text, 0, 0, fontSize, { kerning: true });
  const bbox = path.getBoundingBox();

  return {
    path,
    bbox,
    width: bbox.x2 - bbox.x1,
    height: bbox.y2 - bbox.y1
  };
}

export async function ensureFont(fontOption) {
  if (fontCache.has(fontOption.id)) {
    return fontCache.get(fontOption.id);
  }

  const fontPromise = fetch(fontOption.assetPath)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load font asset: ${fontOption.assetPath}`);
      }

      const buffer = await response.arrayBuffer();
      return {
        option: fontOption,
        font: window.opentype.parse(buffer)
      };
    });

  fontCache.set(fontOption.id, fontPromise);
  return fontPromise;
}

export function buildTextPath({ fontRecord, text, slot, slotKey, fill = "#111111" }) {
  const layout = TEXT_LAYOUT[slotKey];
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      pathData: "",
      error: null
    };
  }

  const boxWidth = slot.width - layout.paddingX * 2;
  const boxHeight = slot.height - layout.paddingY * 2;

  const fitResult = findBestFitSize({
    measure: (size) => measurePath(fontRecord.font, trimmed, size),
    boxWidth,
    boxHeight,
    minScale: layout.minScale
  });

  if (!fitResult.fits || fitResult.tooSmall) {
    return {
      pathData: "",
      error: `${slot.label} is too long for the current layout.`
    };
  }

  const measured = measurePath(fontRecord.font, trimmed, fitResult.fittedSize);
  const x = slot.x + (slot.width - measured.width) / 2 - measured.bbox.x1;
  const y = slot.y + (slot.height - measured.height) / 2 - measured.bbox.y1;
  const finalPath = fontRecord.font.getPath(trimmed, x, y, fitResult.fittedSize, { kerning: true });

  return {
    pathData: finalPath.toPathData(4),
    error: null,
    attributes: {
      fill,
      "fill-rule": "nonzero"
    }
  };
}
