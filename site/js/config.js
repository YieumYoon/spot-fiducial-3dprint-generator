export const FONT_OPTIONS = [
  {
    id: "pretendard-bold",
    label: "Pretendard Bold",
    cssFamily: "Pretendard",
    assetPath: "./assets/fonts/Pretendard-Bold.otf"
  },
  {
    id: "pretendard-semibold",
    label: "Pretendard SemiBold",
    cssFamily: "Pretendard",
    assetPath: "./assets/fonts/Pretendard-SemiBold.otf"
  },
  {
    id: "pretendard-extrabold",
    label: "Pretendard ExtraBold",
    cssFamily: "Pretendard",
    assetPath: "./assets/fonts/Pretendard-ExtraBold.otf"
  }
];

export const FALLBACK_FONT_OPTION = {
  id: "pretendard-fallback",
  label: "Pretendard Bold",
  cssFamily: "Pretendard",
  assetPath: "./assets/fonts/Pretendard-Bold.otf"
};

export const DRILL_PRESETS = [
  { id: "m3", label: "M3 / 3.40 mm", diameterMm: 3.4 },
  { id: "m4", label: "M4 / 4.50 mm", diameterMm: 4.5 },
  { id: "m5", label: "M5 / 5.50 mm", diameterMm: 5.5 },
  { id: "m6", label: "M6 / 6.60 mm", diameterMm: 6.6 }
];

export const FIXED_STRINGS = {
  fixedTitle: "ROBOT LOCALIZATION FIDUCIAL",
  warning: "DO NOT BLOCK OR MOVE"
};

export const TAG_RANGE_PRESETS = [
  {
    id: "localization",
    label: "1-299 Localization",
    shortLabel: "Localization",
    description: "General Spot localization fiducials.",
    min: 1,
    max: 299,
    layoutMode: "standard"
  },
  {
    id: "not-specified",
    label: "300-499 Not Specified",
    shortLabel: "Not Specified",
    description: "Reserved range with no additional purpose label in this tool.",
    min: 300,
    max: 499,
    layoutMode: "standard"
  },
  {
    id: "dock",
    label: "500-586 Dock",
    shortLabel: "Dock",
    description: "Spot dock fiducials that use the DXF-matched dock plate layout.",
    min: 500,
    max: 586,
    layoutMode: "dock"
  }
];

export const DOCK_LAYOUT_MIN_TAG_ID = 500;

export const TEMPLATE_ASSET_PATHS = {
  standard: "./assets/spot-fiducial-template.svg",
  dock: "./assets/spot-dock-fiducial-template.svg"
};

export const LAYOUT_OPTIONS = {
  standard: {
    id: "standard",
    label: "Localization",
    templateKey: "standard",
    supportsBranding: true,
    supportsDrillPreset: true
  },
  dock: {
    id: "dock",
    label: "Dock",
    templateKey: "dock",
    supportsBranding: false,
    supportsDrillPreset: false
  }
};

export const TEXT_LAYOUT = {
  companyName: { paddingX: 0.7, paddingY: 0.9, minScale: 0.55 },
  robotName: { paddingX: 0.7, paddingY: 0.9, minScale: 0.55 },
  fixedTitle: { paddingX: 1.4, paddingY: 0.85, minScale: 0.55 },
  displayId: { paddingX: 2.2, paddingY: 1.1, minScale: 0.55 },
  warning: { paddingX: 1.8, paddingY: 0.9, minScale: 0.55 },
  dockDisplayId: { paddingX: 1.0, paddingY: 0.85, minScale: 0.4 },
  dockLocation: { paddingX: 1.0, paddingY: 0.85, minScale: 0.35 }
};

export const DEFAULT_STATE = {
  companyName: "",
  robotName: "",
  dockLocation: "",
  tagRangePreset: TAG_RANGE_PRESETS[0].id,
  tagId: "001",
  layoutMode: "standard",
  fontFamily: FONT_OPTIONS[0].id,
  drillPreset: DRILL_PRESETS[0].id,
  logoMode: "default"
};

export const TAG_RANGE = {
  min: 1,
  max: 586
};

export const SVG_NS = "http://www.w3.org/2000/svg";

export const GUIDE_STYLE = {
  stroke: "#7d705d",
  "stroke-width": "0.14",
  "stroke-dasharray": "0.8 1.2",
  fill: "none",
  opacity: "0.35",
  "vector-effect": "non-scaling-stroke"
};
