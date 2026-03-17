import { DEFAULT_STATE, DRILL_PRESETS, FALLBACK_FONT_OPTION, FONT_OPTIONS, TAG_RANGE } from "./js/config.js";
import { composeSvg } from "./js/compose.js";
import { formatTagId, getFontOption } from "./js/core.js";
import { sanitizeUploadedLogo } from "./js/logo.js";
import { ensureFont } from "./js/text.js";

const dom = {
  form: document.querySelector("#generator-form"),
  previewRoot: document.querySelector("#preview-root"),
  printExportButton: document.querySelector("#export-print-button"),
  cadExportButton: document.querySelector("#export-cad-button"),
  clearLogoButton: document.querySelector("#clear-logo-upload"),
  logoUploadField: document.querySelector("#logo-upload-field"),
  logoModeField: document.querySelector("#logo-mode-field"),
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

dom.logoModeInputs = Array.from(dom.form.querySelectorAll('input[name="logoMode"]'));
const exportButtons = [dom.printExportButton, dom.cadExportButton];

const validationTargets = {
  companyName: [dom.companyName],
  robotName: [dom.robotName],
  tagId: [dom.tagId],
  fontFamily: [dom.fontFamily],
  drillPreset: [dom.drillPreset],
  logoUpload: [dom.logoUpload, ...dom.logoModeInputs]
};

const validationContainers = {
  companyName: [dom.companyName.closest(".field")],
  robotName: [dom.robotName.closest(".field")],
  tagId: [dom.tagId.closest(".field")],
  fontFamily: [dom.fontFamily.closest(".field")],
  drillPreset: [dom.drillPreset.closest(".field")],
  logoUpload: [dom.logoModeField, dom.logoUploadField]
};

const fieldKeyByTarget = new Map([
  [dom.companyName, "companyName"],
  [dom.robotName, "robotName"],
  [dom.tagId, "tagId"],
  [dom.fontFamily, "fontFamily"],
  [dom.drillPreset, "drillPreset"],
  [dom.logoUpload, "logoUpload"]
]);

for (const radio of dom.logoModeInputs) {
  fieldKeyByTarget.set(radio, "logoUpload");
}

const state = {
  ...DEFAULT_STATE,
  uploadLogoRecord: null
};

const runtime = {
  templateText: "",
  activeFont: null,
  fontError: "",
  logoError: "",
  fontLoading: false,
  attemptedExport: false,
  touched: new Set(),
  lastBlockingKeys: []
};

function syncLogoUi() {
  const isCustom = state.logoMode === "custom";
  const hasUpload = Boolean(dom.logoUpload.files.length);
  dom.logoUploadField.hidden = !isCustom;
  dom.logoUpload.disabled = !isCustom;
  dom.clearLogoButton.hidden = !isCustom || !hasUpload;
}

function setStatus(text, tone) {
  dom.statusChip.textContent = text;
  if (tone) {
    dom.statusChip.dataset.tone = tone;
  } else {
    delete dom.statusChip.dataset.tone;
  }
}

function setGlobalMessage(text, tone) {
  dom.globalMessage.textContent = text;
  if (tone) {
    dom.globalMessage.dataset.tone = tone;
  } else {
    delete dom.globalMessage.dataset.tone;
  }
}

function setFieldValidity(key, isInvalid) {
  for (const target of validationTargets[key] ?? []) {
    if (!target) {
      continue;
    }

    if (isInvalid) {
      target.setAttribute("aria-invalid", "true");
    } else {
      target.removeAttribute("aria-invalid");
    }
  }

  for (const container of validationContainers[key] ?? []) {
    if (!container) {
      continue;
    }

    if (isInvalid) {
      container.dataset.invalid = "true";
    } else {
      delete container.dataset.invalid;
    }
  }
}

function markFieldTouched(target) {
  const key = fieldKeyByTarget.get(target);
  if (key) {
    runtime.touched.add(key);
  }
}

function resetFieldMessages() {
  for (const [key, message] of Object.entries(dom.messages)) {
    message.textContent = "";
    message.dataset.tone = "";
    setFieldValidity(key, false);
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

function buildBlockingErrors(previewErrors) {
  const mergedErrors = { ...previewErrors };

  if (state.logoMode === "custom" && runtime.logoError) {
    mergedErrors.logoUpload = runtime.logoError;
  }

  if (state.logoMode === "custom" && !state.uploadLogoRecord) {
    mergedErrors.logoUpload = mergedErrors.logoUpload ?? "Upload a custom SVG or choose Default or Empty.";
  }

  return mergedErrors;
}

function shouldDisplayValidation(key) {
  return runtime.attemptedExport || runtime.touched.has(key);
}

function focusFirstBlockingField() {
  const [firstKey] = runtime.lastBlockingKeys;
  if (!firstKey) {
    return;
  }

  if (firstKey === "logoUpload") {
    const target = state.logoMode === "custom" ? dom.logoUpload : dom.logoModeInputs[0];
    target?.focus();
    return;
  }

  validationTargets[firstKey]?.[0]?.focus();
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
    includeGuides: true,
    exportTarget: "print"
  });

  dom.previewRoot.innerHTML = previewResult.svgText;

  const mergedErrors = buildBlockingErrors(previewResult.errors);
  const blockingEntries = Object.entries(mergedErrors).filter(([, message]) => Boolean(message));
  runtime.lastBlockingKeys = blockingEntries.map(([key]) => key);

  for (const [key, message] of blockingEntries) {
    if (!shouldDisplayValidation(key)) {
      continue;
    }

    dom.messages[key].textContent = message;
    dom.messages[key].dataset.tone = "error";
    setFieldValidity(key, true);
  }

  if (runtime.fontError) {
    dom.messages.fontFamily.textContent = runtime.fontError;
    dom.messages.fontFamily.dataset.tone = "info";
  }

  const blockingErrors = blockingEntries.map(([, message]) => message);
  const hasInteracted = runtime.attemptedExport || runtime.touched.size > 0;
  const exportBlocked = runtime.fontLoading || blockingErrors.length > 0;

  for (const button of exportButtons) {
    button.disabled = exportBlocked;
  }

  if (blockingErrors.length > 0) {
    if (hasInteracted) {
      const primaryBlockingMessage = blockingEntries.find(([key]) => shouldDisplayValidation(key))?.[1] ?? blockingErrors[0];
      setStatus("Export blocked", "blocked");
      setGlobalMessage(primaryBlockingMessage, "error");
    } else {
      setStatus("Complete plate details");
      setGlobalMessage("Enter company and robot names to enable export.", "");
    }
  } else if (runtime.fontError) {
    setStatus("Export ready", "ready");
    setGlobalMessage(`${runtime.fontError} Use Print SVG for PDF conversion and CAD SVG for CAD imports.`, "ready");
  } else {
    setStatus("Export ready", "ready");
    setGlobalMessage("Ready to download Print SVG for PDF conversion or CAD SVG for CAD import. Preview guides stay on-screen only.", "ready");
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
    syncLogoUi();
    render();
    return;
  }

  state.logoMode = "custom";
  dom.form.elements.logoMode.value = "custom";
  runtime.touched.add("logoUpload");

  if (!file.name.toLowerCase().endsWith(".svg")) {
    state.uploadLogoRecord = null;
    runtime.logoError = "Uploaded logo is not a valid SVG file.";
    syncLogoUi();
    render();
    return;
  }

  try {
    state.uploadLogoRecord = sanitizeUploadedLogo(await file.text());
  } catch (error) {
    state.uploadLogoRecord = null;
    runtime.logoError = "Uploaded logo is not a valid SVG file.";
  }

  syncLogoUi();
  render();
}

async function handleExport(exportTarget) {
  readStateFromForm();
  runtime.attemptedExport = true;
  render();

  if (exportButtons.some((button) => button.disabled)) {
    focusFirstBlockingField();
    return;
  }

  const exportResult = composeSvg({
    templateText: runtime.templateText,
    state,
    fontRecord: runtime.activeFont,
    uploadLogoRecord: state.uploadLogoRecord,
    includeGuides: false,
    exportTarget
  });

  if (Object.keys(buildBlockingErrors(exportResult.errors)).length > 0) {
    render();
    focusFirstBlockingField();
    return;
  }

  downloadSvg(exportResult.filename, exportResult.svgText);
}

async function init() {
  populateTagOptions();
  populateFontOptions();
  populateDrillOptions();
  syncFormFromState();
  syncLogoUi();

  runtime.templateText = await fetch("./assets/spot-fiducial-template.svg").then((response) => response.text());
  await loadFont(state.fontFamily);
  render();

  dom.form.addEventListener("input", (event) => {
    markFieldTouched(event.target);
    readStateFromForm();
    syncLogoUi();
    if (event.target === dom.fontFamily) {
      return;
    }

    render();
  });

  dom.form.addEventListener("change", async (event) => {
    markFieldTouched(event.target);
    if (event.target === dom.fontFamily) {
      await handleFontSelection();
      return;
    }

    if (event.target === dom.logoUpload) {
      await handleLogoUpload();
      return;
    }

    readStateFromForm();
    syncLogoUi();
    render();
  });

  dom.clearLogoButton.addEventListener("click", () => {
    state.uploadLogoRecord = null;
    state.logoMode = "default";
    runtime.logoError = "";
    dom.logoUpload.value = "";
    dom.form.elements.logoMode.value = "default";
    syncLogoUi();
    render();
  });

  dom.printExportButton.addEventListener("click", () => handleExport("print"));
  dom.cadExportButton.addEventListener("click", () => handleExport("cad"));
}

init().catch((error) => {
  setStatus("App failed to load", "blocked");
  setGlobalMessage(error.message, "error");
});
