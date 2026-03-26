import {
  DEFAULT_STATE,
  DRILL_PRESETS,
  FALLBACK_FONT_OPTION,
  FONT_OPTIONS,
  TAG_RANGE_PRESETS,
  TEMPLATE_ASSET_PATHS
} from "./js/config.js";
import { trackEvent } from "./js/analytics.js";
import { composeSvg } from "./js/compose.js";
import {
  clearChildren,
  coerceTagIdToPreset,
  getFontOption,
  getLayoutOption,
  getTagRangePreset,
  listTagIdsForPreset
} from "./js/core.js";
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
  logoSection: document.querySelector("#logo-section"),
  statusChip: document.querySelector("#status-chip"),
  globalMessage: document.querySelector("#global-message"),
  companyNameField: document.querySelector("#company-name-field"),
  companyName: document.querySelector("#company-name"),
  robotNameField: document.querySelector("#robot-name-field"),
  robotName: document.querySelector("#robot-name"),
  tagRangeField: document.querySelector("#tag-range-field"),
  tagRangeOptions: document.querySelector("#tag-range-options"),
  tagId: document.querySelector("#tag-id"),
  dockLocationField: document.querySelector("#dock-location-field"),
  dockLocation: document.querySelector("#dock-location"),
  fontFamily: document.querySelector("#font-family"),
  drillPresetField: document.querySelector("#drill-preset-field"),
  drillPreset: document.querySelector("#drill-preset"),
  logoUpload: document.querySelector("#logo-upload"),
  messages: {
    companyName: document.querySelector("#company-name-message"),
    robotName: document.querySelector("#robot-name-message"),
    tagId: document.querySelector("#tag-id-message"),
    dockLocation: document.querySelector("#dock-location-message"),
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
  dockLocation: [dom.dockLocation],
  fontFamily: [dom.fontFamily],
  drillPreset: [dom.drillPreset],
  logoUpload: [dom.logoUpload, ...dom.logoModeInputs]
};

const validationContainers = {
  companyName: [dom.companyNameField],
  robotName: [dom.robotNameField],
  tagId: [dom.tagId.closest(".field")],
  dockLocation: [dom.dockLocationField],
  fontFamily: [dom.fontFamily.closest(".field")],
  drillPreset: [dom.drillPresetField],
  logoUpload: [dom.logoModeField, dom.logoUploadField]
};

const fieldKeyByTarget = new Map([
  [dom.companyName, "companyName"],
  [dom.robotName, "robotName"],
  [dom.tagId, "tagId"],
  [dom.dockLocation, "dockLocation"],
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
  templateTexts: {
    standard: "",
    dock: ""
  },
  activeFont: null,
  fontError: "",
  logoError: "",
  fontLoading: false,
  hasTrackedGeneratorStart: false,
  attemptedExport: false,
  touched: new Set(),
  lastBlockingKeys: []
};

function getActiveLayoutOption() {
  return getLayoutOption(state.tagId, state.layoutMode);
}

function isDockLayoutActive() {
  return getActiveLayoutOption().id === "dock";
}

function isBrandingActive() {
  return getActiveLayoutOption().supportsBranding;
}

function isDrillPresetActive() {
  return getActiveLayoutOption().supportsDrillPreset;
}

function getActiveTemplateText() {
  return runtime.templateTexts[getActiveLayoutOption().templateKey] ?? "";
}

function buildAnalyticsPayload(extraParams = {}) {
  return {
    drill_preset: state.drillPreset,
    font_family: state.fontFamily,
    layout_mode: getActiveLayoutOption().id,
    logo_mode: state.logoMode,
    tag_range_preset: state.tagRangePreset,
    tag_id: state.tagId,
    ...extraParams
  };
}

function trackGeneratorStart() {
  if (runtime.hasTrackedGeneratorStart) {
    return;
  }

  runtime.hasTrackedGeneratorStart = true;
  trackEvent("generator_started", buildAnalyticsPayload());
}

function syncLogoUi() {
  const brandingEnabled = isBrandingActive();
  const isCustom = state.logoMode === "custom";
  const hasUpload = Boolean(dom.logoUpload.files.length);
  dom.logoSection.hidden = !brandingEnabled;
  dom.logoUploadField.hidden = !brandingEnabled || !isCustom;
  dom.logoUpload.disabled = !brandingEnabled || !isCustom;
  dom.clearLogoButton.hidden = !brandingEnabled || !isCustom || !hasUpload;
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

function populateTagRangeOptions() {
  clearChildren(dom.tagRangeOptions);

  for (const preset of TAG_RANGE_PRESETS) {
    const label = document.createElement("label");
    label.className = "radio-option tag-range-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "tagRangePreset";
    input.value = preset.id;

    const copy = document.createElement("span");
    copy.className = "tag-range-copy";

    const title = document.createElement("span");
    title.className = "tag-range-title";
    title.textContent = preset.label;

    copy.append(title);
    label.append(input, copy);
    dom.tagRangeOptions.appendChild(label);
  }

  dom.tagRangeInputs = Array.from(dom.form.querySelectorAll('input[name="tagRangePreset"]'));
}

function syncTagRangeInputsFromState() {
  for (const input of dom.tagRangeInputs ?? []) {
    input.checked = input.value === state.tagRangePreset;
  }
}

function populateTagOptionsForPreset(presetId) {
  const currentPresetId = dom.tagId.dataset.rangePreset;
  if (currentPresetId !== presetId) {
    clearChildren(dom.tagId);

    for (const tagId of listTagIdsForPreset(presetId)) {
      const option = document.createElement("option");
      option.value = tagId;
      option.textContent = tagId;
      dom.tagId.appendChild(option);
    }

    dom.tagId.dataset.rangePreset = presetId;
  }

  dom.tagId.value = state.tagId;
}

function syncRangeState() {
  const preset = getTagRangePreset(state.tagRangePreset);
  state.tagRangePreset = preset.id;
  state.tagId = coerceTagIdToPreset(state.tagId, preset.id);
  state.layoutMode = preset.layoutMode;
  syncTagRangeInputsFromState();
  populateTagOptionsForPreset(preset.id);
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
  dom.dockLocation.value = state.dockLocation;
  syncRangeState();
  dom.fontFamily.value = state.fontFamily;
  dom.drillPreset.value = state.drillPreset;
  dom.form.elements.logoMode.value = state.logoMode;
}

function syncLayoutUi() {
  const layout = getActiveLayoutOption();

  dom.companyNameField.hidden = layout.id !== "standard";
  dom.robotNameField.hidden = layout.id !== "standard";
  dom.dockLocationField.hidden = layout.id !== "dock";
  dom.drillPresetField.hidden = !layout.supportsDrillPreset;
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
  state.dockLocation = dom.dockLocation.value;
  state.tagRangePreset = dom.form.elements.tagRangePreset.value;
  state.tagId = dom.tagId.value;
  state.fontFamily = dom.fontFamily.value;
  state.drillPreset = dom.drillPreset.value;
  state.logoMode = dom.form.elements.logoMode.value;
}

function syncStateFromForm() {
  readStateFromForm();
  syncRangeState();
  syncLayoutUi();
  syncLogoUi();
}

function buildBlockingErrors(previewErrors) {
  const mergedErrors = { ...previewErrors };

  if (isBrandingActive() && state.logoMode === "custom" && runtime.logoError) {
    mergedErrors.logoUpload = runtime.logoError;
  }

  if (isBrandingActive() && state.logoMode === "custom" && !state.uploadLogoRecord) {
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
  const activeTemplateText = getActiveTemplateText();
  if (!activeTemplateText || !runtime.activeFont) {
    return;
  }

  resetFieldMessages();

  const previewResult = composeSvg({
    templateText: activeTemplateText,
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
      setGlobalMessage(
        isDockLayoutActive()
          ? "Enter a dock location label to enable export."
          : "Enter company and robot names to enable export.",
        ""
      );
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
  syncStateFromForm();
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
    trackEvent("logo_uploaded", buildAnalyticsPayload({ file_name: file.name }));
  } catch (error) {
    state.uploadLogoRecord = null;
    runtime.logoError = "Uploaded logo is not a valid SVG file.";
  }

  syncLogoUi();
  render();
}

async function handleExport(exportTarget) {
  syncStateFromForm();
  runtime.attemptedExport = true;
  trackGeneratorStart();
  render();

  if (exportButtons.some((button) => button.disabled)) {
    focusFirstBlockingField();
    return;
  }

  const exportResult = composeSvg({
    templateText: getActiveTemplateText(),
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
  trackEvent(exportTarget === "print" ? "export_print_svg" : "export_cad_svg", buildAnalyticsPayload({ export_type: exportTarget }));
}

async function init() {
  populateTagRangeOptions();
  populateFontOptions();
  populateDrillOptions();
  syncFormFromState();
  syncLayoutUi();
  syncLogoUi();

  runtime.templateTexts.standard = await fetch(TEMPLATE_ASSET_PATHS.standard).then((response) => response.text());
  runtime.templateTexts.dock = await fetch(TEMPLATE_ASSET_PATHS.dock).then((response) => response.text());
  await loadFont(state.fontFamily);
  render();

  dom.form.addEventListener("input", (event) => {
    markFieldTouched(event.target);
    syncStateFromForm();
    trackGeneratorStart();
    if (event.target === dom.fontFamily) {
      return;
    }

    render();
  });

  dom.form.addEventListener("change", async (event) => {
    markFieldTouched(event.target);
    syncStateFromForm();
    trackGeneratorStart();
    if (event.target === dom.fontFamily) {
      await handleFontSelection();
      return;
    }

    if (event.target === dom.logoUpload) {
      await handleLogoUpload();
      return;
    }

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
