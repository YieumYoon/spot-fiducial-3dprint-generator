import { DEFAULT_STATE, DRILL_PRESETS, FALLBACK_FONT_OPTION, FIXED_STRINGS, FONT_OPTIONS, TAG_RANGE } from "./js/config.js";
import { composeSvg } from "./js/compose.js";
import { buildFilename, formatTagId, getFontOption } from "./js/core.js";
import { sanitizeUploadedLogo } from "./js/logo.js";
import { ensureFont } from "./js/text.js";

const dom = {
  form: document.querySelector("#generator-form"),
  previewRoot: document.querySelector("#preview-root"),
  exportButton: document.querySelector("#export-button"),
  clearLogoButton: document.querySelector("#clear-logo-upload"),
  statusChip: document.querySelector("#status-chip"),
  globalMessage: document.querySelector("#global-message"),
  companyName: document.querySelector("#company-name"),
  robotName: document.querySelector("#robot-name"),
  tagId: document.querySelector("#tag-id"),
  fontFamily: document.querySelector("#font-family"),
  drillPreset: document.querySelector("#drill-preset"),
  logoUpload: document.querySelector("#logo-upload"),
  messages: {
    companyName: document.querySelector("#company-name-message"),
    robotName: document.querySelector("#robot-name-message"),
    tagId: document.querySelector("#tag-id-message"),
    fontFamily: document.querySelector("#font-family-message"),
    drillPreset: document.querySelector("#drill-preset-message"),
    logoUpload: document.querySelector("#logo-upload-message")
  }
};

const state = {
  ...DEFAULT_STATE,
  uploadLogoRecord: null
};

const runtime = {
  templateText: "",
  activeFont: null,
  fontError: "",
  logoError: "",
  fontLoading: false
};

function setStatus(text, tone) {
  dom.statusChip.textContent = text;
  dom.statusChip.dataset.tone = tone;
}

function setGlobalMessage(text, tone) {
  dom.globalMessage.textContent = text;
  dom.globalMessage.dataset.tone = tone;
}

function resetFieldMessages() {
  for (const message of Object.values(dom.messages)) {
    message.textContent = "";
    message.dataset.tone = "";
  }
}

function populateTagOptions() {
  for (let id = TAG_RANGE.min; id <= TAG_RANGE.max; id += 1) {
    const option = document.createElement("option");
    option.value = formatTagId(id);
    option.textContent = formatTagId(id);
    dom.tagId.appendChild(option);
  }
}

function populateFontOptions() {
  for (const font of FONT_OPTIONS) {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.label;
    dom.fontFamily.appendChild(option);
  }
}

function populateDrillOptions() {
  for (const preset of DRILL_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    dom.drillPreset.appendChild(option);
  }
}

function syncFormFromState() {
  dom.companyName.value = state.companyName;
  dom.robotName.value = state.robotName;
  dom.tagId.value = formatTagId(state.tagId);
  dom.fontFamily.value = state.fontFamily;
  dom.drillPreset.value = state.drillPreset;
  dom.form.elements.logoMode.value = state.logoMode;
}

async function loadFont(fontId) {
  runtime.fontLoading = true;
  runtime.fontError = "";
  setStatus("Loading font", "blocked");

  try {
    runtime.activeFont = await ensureFont(getFontOption(fontId));
  } catch (error) {
    runtime.fontError = `The selected font could not be loaded. Using ${FALLBACK_FONT_OPTION.label} instead.`;
    runtime.activeFont = await ensureFont(FALLBACK_FONT_OPTION);
  } finally {
    runtime.fontLoading = false;
  }
}

function readStateFromForm() {
  state.companyName = dom.companyName.value;
  state.robotName = dom.robotName.value;
  state.tagId = dom.tagId.value;
  state.fontFamily = dom.fontFamily.value;
  state.drillPreset = dom.drillPreset.value;
  state.logoMode = dom.form.elements.logoMode.value;
}

function downloadSvg(filename, svgText) {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function render() {
  if (!runtime.templateText || !runtime.activeFont) {
    return;
  }

  resetFieldMessages();

  const previewResult = composeSvg({
    templateText: runtime.templateText,
    state,
    fontRecord: runtime.activeFont,
    uploadLogoRecord: state.uploadLogoRecord,
    includeGuides: true
  });

  dom.previewRoot.innerHTML = previewResult.svgText;

  const mergedErrors = { ...previewResult.errors };
  if (runtime.logoError) {
    mergedErrors.logoUpload = runtime.logoError;
  }

  for (const [key, message] of Object.entries(mergedErrors)) {
    const field = dom.messages[key];
    if (field) {
      field.textContent = message;
      field.dataset.tone = "error";
    }
  }

  if (runtime.fontError) {
    dom.messages.fontFamily.textContent = runtime.fontError;
    dom.messages.fontFamily.dataset.tone = "info";
  }

  const blockingErrors = Object.values(mergedErrors).filter(Boolean);
  dom.exportButton.disabled = runtime.fontLoading || blockingErrors.length > 0;

  if (blockingErrors.length > 0) {
    setStatus("Export blocked", "blocked");
    setGlobalMessage(blockingErrors[0], "error");
  } else if (runtime.fontError) {
    setStatus("Export ready", "ready");
    setGlobalMessage(runtime.fontError, "ready");
  } else {
    setStatus("Export ready", "ready");
    setGlobalMessage(`Ready to export ${previewResult.filename}`, "ready");
  }
}

async function handleFontSelection() {
  readStateFromForm();
  await loadFont(state.fontFamily);
  render();
}

async function handleLogoUpload() {
  runtime.logoError = "";

  const [file] = dom.logoUpload.files;
  if (!file) {
    state.uploadLogoRecord = null;
    render();
    return;
  }

  if (!file.name.toLowerCase().endsWith(".svg")) {
    state.uploadLogoRecord = null;
    runtime.logoError = "Uploaded logo is not a valid SVG file.";
    render();
    return;
  }

  try {
    state.uploadLogoRecord = sanitizeUploadedLogo(await file.text());
  } catch (error) {
    state.uploadLogoRecord = null;
    runtime.logoError = "Uploaded logo is not a valid SVG file.";
  }

  render();
}

async function handleExport() {
  const exportResult = composeSvg({
    templateText: runtime.templateText,
    state,
    fontRecord: runtime.activeFont,
    uploadLogoRecord: state.uploadLogoRecord,
    includeGuides: false
  });

  if (Object.keys(exportResult.errors).length > 0 || runtime.logoError) {
    render();
    return;
  }

  downloadSvg(exportResult.filename, exportResult.svgText);
}

async function init() {
  populateTagOptions();
  populateFontOptions();
  populateDrillOptions();
  syncFormFromState();

  runtime.templateText = await fetch("./assets/spot-fiducial-template.svg").then((response) => response.text());
  await loadFont(state.fontFamily);
  render();

  dom.form.addEventListener("input", (event) => {
    readStateFromForm();
    if (event.target === dom.fontFamily) {
      return;
    }

    render();
  });

  dom.form.addEventListener("change", async (event) => {
    if (event.target === dom.fontFamily) {
      await handleFontSelection();
      return;
    }

    if (event.target === dom.logoUpload) {
      await handleLogoUpload();
      return;
    }

    readStateFromForm();
    render();
  });

  dom.clearLogoButton.addEventListener("click", () => {
    state.uploadLogoRecord = null;
    runtime.logoError = "";
    dom.logoUpload.value = "";
    render();
  });

  dom.exportButton.addEventListener("click", handleExport);

  setGlobalMessage(`Ready to export ${buildFilename(state)}`, "ready");
}

init().catch((error) => {
  setStatus("App failed to load", "blocked");
  setGlobalMessage(error.message, "error");
});
