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

export const TEXT_LAYOUT = {
  companyName: { paddingX: 0.7, paddingY: 0.9, minScale: 0.55 },
  robotName: { paddingX: 0.7, paddingY: 0.9, minScale: 0.55 },
  fixedTitle: { paddingX: 1.4, paddingY: 0.85, minScale: 0.55 },
  displayId: { paddingX: 2.2, paddingY: 1.1, minScale: 0.55 },
  warning: { paddingX: 1.8, paddingY: 0.9, minScale: 0.55 }
};

export const DEFAULT_STATE = {
  companyName: "",
  robotName: "",
  tagId: "001",
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
