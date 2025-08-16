import {
  Generate,
  extension_prompt_types,
  sendMessageAsUser,
  setExtensionPrompt,
  saveSettingsDebounced,
} from "../../../../script.js";
import { renderExtensionTemplateAsync, extension_settings } from "../../../extensions.js";
import { Popup, POPUP_TYPE, POPUP_RESULT } from "../../../popup.js";
import { INSTRUCTION_PRESETS } from "./presets.js";

// ===== Constants =====
const DEFAULT_PRESET = "immersive";
const ELEMENT_CLICKABLE_ATTRIBUTE = "data-made-clickable";
// Support both legacy ".custom-act" and docs ".act"
const ACT_SELECTOR = ".custom-act, .act";

// ===== Utils =====
const deepCopy = (o) => JSON.parse(JSON.stringify(o));
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// ===== Primary store lives in extension_settings =====
function store() {
  return extension_settings.clickableActions;
}
function presetsStore() {
  return store().presets;
}
function ensureInitialized() {
  if (!extension_settings.clickableActions) {
    extension_settings.clickableActions = {
      enabled: true,
      sendOnClick: true,           // NEW default
      currentPreset: DEFAULT_PRESET,
      presets: deepCopy(INSTRUCTION_PRESETS),
    };
    saveSettingsDebounced();
  }
  // migrate legacy fields if present
  if (extension_settings.clickableActions.allPrompts) {
    extension_settings.clickableActions.presets =
      extension_settings.clickableActions.allPrompts;
    delete extension_settings.clickableActions.allPrompts;
    saveSettingsDebounced();
  }
  // remove dead option (appendPrompt) if it exists
  if ("appendPrompt" in extension_settings.clickableActions) {
    delete extension_settings.clickableActions.appendPrompt;
    saveSettingsDebounced();
  }
  // seed if empty
  if (
    !extension_settings.clickableActions.presets ||
    typeof extension_settings.clickableActions.presets !== "object" ||
    Object.keys(extension_settings.clickableActions.presets).length === 0
  ) {
    extension_settings.clickableActions.presets = deepCopy(INSTRUCTION_PRESETS);
    if (!extension_settings.clickableActions.currentPreset) {
      extension_settings.clickableActions.currentPreset = DEFAULT_PRESET;
    }
    saveSettingsDebounced();
  }
}

// ===== Derivations =====
function isEnabled() {
  return !!store().enabled;
}
function sendOnClick() {
  return !!store().sendOnClick;
}
function currentPreset() {
  return store().currentPreset ?? DEFAULT_PRESET;
}
function setCurrentPreset(key) {
  store().currentPreset = key;
  saveSettingsDebounced();
}
function activeInstructions() {
  const ap = presetsStore();
  const k = currentPreset();
  return ap?.[k]?.instructions ?? ap?.[DEFAULT_PRESET]?.instructions ?? "";
}
function slugFromFilename(fileName) {
  // Expect: st-clickable-actions-<slug>.json
  const m = /^st-clickable-actions-([^.]+)\.json$/i.exec(fileName || "");
  return m ? m[1] : null;
}


// ===== Chat clickable actions =====
async function clickEvent(event) {
  const element = event.target.closest(ACT_SELECTOR);
  if (!element) return;

  const output = (element.getAttribute("data-value") || element.textContent || "").trim();
  if (!output) return;

  if (sendOnClick()) {
    await sendMessageAsUser(output, "");
    await Generate("normal");
  } else {
    // Overwrite the main chat textarea instead of sending
    const ta = document.querySelector("#send_textarea");
    if (ta) {
      ta.value = output;
      // focus and move caret to end
      ta.focus();
      try {
        ta.selectionStart = ta.selectionEnd = ta.value.length;
      } catch (_) {}
    } else {
      console.warn("send_textarea not found; cannot place clicked text.");
    }
  }

  event.preventDefault();
}

function makeClickable(el) {
  if (!(el instanceof HTMLElement)) return;
  const textToSend = (el.getAttribute("data-value") || el.textContent || "").trim();
  if (textToSend) el.setAttribute("title", `Click to use: "${textToSend}"`);
  el.addEventListener("click", clickEvent);
  el.setAttribute(ELEMENT_CLICKABLE_ATTRIBUTE, "true");
}

function processMessageTextBlock(_i, container) {
  jQuery(container)
    .find(ACT_SELECTOR)
    .each((_idx, spanEl) => {
      if (!spanEl.getAttribute(ELEMENT_CLICKABLE_ATTRIBUTE)) makeClickable(spanEl);
    });
}

// ===== UI sync =====
function updatePresetDescription(presetKey) {
  const el = jQuery("#clickable_actions_preset_description");
  const preset = presetsStore()?.[presetKey];
  el.text(preset?.description || "Select a preset to see its description");
}

function fillPresetSelector() {
  const sel = jQuery("#clickable_actions_preset");
  sel.empty();
  Object.entries(presetsStore()).forEach(([key, preset]) => {
    const name = preset?.name ?? key;
    sel.append(`<option value="${key}">${name}</option>`);
  });
  sel.val(currentPreset());
  updatePresetDescription(currentPreset());
}

function updateActions() {
  if (!isEnabled()) {
    setExtensionPrompt("CLICKABLE_ACTIONS", "");
    return;
  }

  // Attach click handlers in chat
  jQuery("#chat .mes_text:not(:has(.edit_textarea))").each(processMessageTextBlock);

  // Always inject instructions when enabled
  const instr = activeInstructions();
  setExtensionPrompt("CLICKABLE_ACTIONS", instr, extension_prompt_types.IN_PROMPT, 1);

  // Keep textarea in sync, but don't fight the user while editing
  const ta = document.getElementById("clickable_actions_prompt");
  if (ta && document.activeElement !== ta && ta.value !== instr) {
    ta.value = instr;
  }
}

// ===== Textarea editing -> persist to settings (debounced) =====
const persistTextareaEdits = debounce(() => {
  const ta = document.getElementById("clickable_actions_prompt");
  if (!ta) return;
  const key = currentPreset();
  const ps = presetsStore();
  if (!ps[key]) return;

  ps[key].instructions = ta.value;
  saveSettingsDebounced();

  // keep injected prompt current
  if (isEnabled()) {
    setExtensionPrompt("CLICKABLE_ACTIONS", ta.value, extension_prompt_types.IN_PROMPT, 1);
  }
}, 300);

// ===== Menu actions =====
function resetAllToDefaults() {
  // Only reset presets that have a default in INSTRUCTION_PRESETS.
  // Custom slugs (anything not in INSTRUCTION_PRESETS) are left untouched.
  ensureInitialized();

  const ps = presetsStore();
  Object.entries(INSTRUCTION_PRESETS).forEach(([key, def]) => {
    ps[key] = deepCopy(def); // overwrite/seed built-ins
  });

  // Do NOT touch enabled/sendOnClick/currentPreset here.
  // (If you want to force currentPreset to DEFAULT_PRESET when it's a built-in, uncomment below.)
  // if (INSTRUCTION_PRESETS[ currentPreset() ]) setCurrentPreset(DEFAULT_PRESET);

  saveSettingsDebounced();
  fillPresetSelector();
  updatePresetDescription(currentPreset());
  updateActions();
}


function exportPresetsToFile() {
  const key = currentPreset();
  const preset = presetsStore()[key];
  if (!preset) {
    alert("No preset selected to export.");
    return;
  }

  // Only export the current preset (content only)
  const payload = {
    name: preset.name ?? key,
    description: preset.description ?? "",
    instructions: preset.instructions ?? "",
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `st-clickable-actions-${key}.json`; // filename represents the slug
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function importPresetsFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    const slug = slugFromFilename(file.name);
    if (!slug) {
      alert('Invalid filename. Expected "st-clickable-actions-<slug>.json".');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
        if (typeof parsed.instructions !== "string") throw new Error("Missing 'instructions' string");

        // Replace or create ONLY the matching slug
        const existing = presetsStore()[slug] || {};
        presetsStore()[slug] = {
          name: typeof parsed.name === "string" ? parsed.name : (existing.name ?? slug),
          description: typeof parsed.description === "string" ? parsed.description : (existing.description ?? ""),
          instructions: parsed.instructions,
        };

        // 👉 switch to the imported preset
        setCurrentPreset(slug);

        // Persist + refresh UI
        saveSettingsDebounced();
        fillPresetSelector();            // dropdown will now select <slug>
        updatePresetDescription(slug);   // description panel

        // Sync textarea explicitly
        const ta = document.getElementById("clickable_actions_prompt");
        if (ta) ta.value = presetsStore()[slug].instructions;

        // Refresh injected prompt
        updateActions();
      } catch (e) {
        console.error("Import failed:", e);
        alert("Import failed: invalid preset file.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}


function mapToObject(m) {
  return Object.fromEntries(m instanceof Map ? m : new Map());
}

async function createNewPresetFlow() {
  // Popup: ONLY name + description
  const popup = new Popup(
    '<h3>New Preset</h3><p>Name and description. Edit the instructions in the form below afterwards.</p>',
    POPUP_TYPE.TEXT,
    "",
    {
      customInputs: [
        { id: "name", label: "Name", type: "text", defaultState: "", tooltip: "Enter a short name" },
        { id: "description", label: "Description", type: "text", defaultState: "", tooltip: "Enter a medium-length description" },
      ],
      wider: true,
      okButton: "Create",
      cancelButton: "Cancel",
    }
  );

  const result = await popup.show();
  if (result !== POPUP_RESULT.AFFIRMATIVE) return;

  const inputs = mapToObject(popup.inputResults);
  const name = (inputs.name ?? "").toString().trim();
  const description = (inputs.description ?? "").toString().trim();

  if (!name) {
    alert("Name is required.");
    return;
  }

  // Generate unique key from name
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "preset";
  let key = base;
  let i = 2;
  while (presetsStore()[key]) key = `${base}_${i++}`;

  const defaultInstructions= "<instructions>\nWrap user-selectable actions inline using `<span class=\"act\" data-value=\"text to send\">text to display</span>`.\n<instructions>"

  // Create with default instructions (user edits in the unlocked textarea)
  presetsStore()[key] = { name, description, defaultInstructions};
  setCurrentPreset(key);
  saveSettingsDebounced();

  fillPresetSelector();
  updateActions();

  // Focus the textarea for immediate editing
  const ta = document.getElementById("clickable_actions_prompt");
  if (ta) {
    ta.value = "";
    ta.focus();
  }
}

async function editExistingPresetFlow() {
  const key = currentPreset();
  const existing = presetsStore()[key];
  if (!existing) return;

  // Popup: ONLY name + description
  const popup = new Popup(
    '<h3>Edit Preset</h3><p>Update the name and description. Edit the instructions in the form below.</p>',
    POPUP_TYPE.TEXT,
    "",
    {
      customInputs: [
        { id: "name", label: "Name", type: "text", defaultState: existing.name ?? key, tooltip: "Enter a short name" },
        { id: "description", label: "Description", type: "text", defaultState: existing.description ?? "", tooltip: "Enter a medium-length description" },
      ],
      wider: true,
      okButton: "Save",
      cancelButton: "Cancel",
    }
  );

  const result = await popup.show();
  if (result !== POPUP_RESULT.AFFIRMATIVE) return;

  const inputs = mapToObject(popup.inputResults);
  const newName = (inputs.name ?? existing.name ?? key).toString().trim();
  const newDesc = (inputs.description ?? existing.description ?? "").toString().trim();

  presetsStore()[key].name = newName;
  presetsStore()[key].description = newDesc;

  saveSettingsDebounced();
  fillPresetSelector();
  updateActions();
}

function deleteCurrentPreset() {
  const ap = presetsStore();
  const key = currentPreset();
  if (!ap[key]) return;

  if (!confirm(`Delete preset "${ap[key].name ?? key}"?`)) return;

  if (Object.keys(ap).length <= 1) {
    alert("At least one preset must exist.");
    return;
  }

  delete ap[key];

  const first = Object.keys(ap)[0] || DEFAULT_PRESET;
  setCurrentPreset(first);
  saveSettingsDebounced();
  fillPresetSelector();
  updateActions();
}

// ===== Settings init =====
async function initSettings() {
  ensureInitialized();

  const html = await renderExtensionTemplateAsync("third-party/st-clickable-actions", "settings");
  jQuery(document.getElementById("extensions_settings")).append(html);

  // Populate selector & initial state
  fillPresetSelector();
  jQuery("#clickable_actions_enabled").prop("checked", isEnabled());
  jQuery("#clickable_actions_send_on_click").prop("checked", sendOnClick());
  jQuery("#clickable_actions_prompt").val(activeInstructions()); // textarea is unlocked

  const syncDisabledState = () => {
    const en = isEnabled();
    jQuery("#clickable_actions_preset").prop("disabled", !en);
    jQuery("#clickable_actions_send_on_click").prop("disabled", !en);
  };

  // Wire toggles
  jQuery("#clickable_actions_enabled").on("change", () => {
    store().enabled = jQuery("#clickable_actions_enabled").is(":checked");
    syncDisabledState();
    updateActions();
    saveSettingsDebounced();
  });

  jQuery("#clickable_actions_send_on_click").on("change", () => {
    store().sendOnClick = jQuery("#clickable_actions_send_on_click").is(":checked");
    saveSettingsDebounced();
  });

  jQuery("#clickable_actions_preset").on("change", () => {
    const selectedPreset = jQuery("#clickable_actions_preset").val();
    setCurrentPreset(String(selectedPreset));
    updatePresetDescription(String(selectedPreset));
    updateActions();
  });

  // Textarea edit -> persist
  jQuery("#clickable_actions_prompt").on("input", persistTextareaEdits);

  // Menu buttons
  jQuery("#btn_reset_all").on("click", resetAllToDefaults);
  jQuery("#btn_export").on("click", exportPresetsToFile);
  jQuery("#btn_import").on("click", importPresetsFromFile);
  jQuery("#btn_create_preset").on("click", createNewPresetFlow);
  jQuery("#btn_edit_preset").on("click", editExistingPresetFlow);
  jQuery("#btn_delete_preset").on("click", deleteCurrentPreset);

  syncDisabledState();
  updateActions();

  // keep actions fresh
  setInterval(updateActions, 1000);
  updateActions();
}

// ===== Main =====
jQuery(() => {
  initSettings();
});
