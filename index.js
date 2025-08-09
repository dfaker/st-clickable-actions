import { Generate, extension_prompt_types, sendMessageAsUser, setExtensionPrompt, saveSettingsDebounced } from "../../../../script.js";
import { renderExtensionTemplateAsync, extension_settings } from '../../../extensions.js';

// Extensible presets object - add new presets here
const INSTRUCTION_PRESETS = {
    immersive: {
        name: "Immersive Actions",
        description: "Natural narrative flow with hidden interactive elements throughout the story. Objects, emotions, and environmental details become clickable discoveries.",
        instructions: `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.

**Core Principles:**
- Embed at least **three** distinct clickable actions throughout each response
- Make ordinary objects, descriptive phrases, and narrative elements interactive
- Use \`data-value\` to hide the actual action - the visible text should flow naturally in the prose while the hidden action describes what happens when clicked
- Distribute actions organically throughout your response, not clustered at the end

**Creating Immersive Interactions:**
- Transform scene elements into hidden interactions: An <span class="act" data-value="I pick up the apple and take a bite. It's surprisingly tart.">apple on the table</span> becomes clickable
- Make environmental details actionable: The <span class="act" data-value="I run my fingers along the dusty bookshelf, feeling for hidden switches.">dusty bookshelf</span> or a <span class="act" data-value="I lean closer to listen through the door.">muffled conversation</span>
- Hide investigative actions in descriptive text: Something <span class="act" data-value="I examine the strange symbol more closely.">strange carved into the wood</span>
- Let emotional responses be clickable: You feel <span class="act" data-value="'This is making me nervous. What aren't you telling me?'">a creeping unease</span>

**Implementation Guidelines:**
- The visible text should read naturally as part of the narrative
- The data-value should describe the action taken or words spoken when clicked
- Include both obvious action choices AND subtle environmental interactions
- Surprise the user - everyday objects can trigger unexpected responses
- Mix explicit choices with hidden discoveries

**Examples:**
\`\`\`
The <span class="act" data-value="I pick up the ledger and flip through its pages quickly.">ledger lies open</span> on the desk, its ink still fresh. You notice <span class="act" data-value="I examine the strange marks in the margin more closely.">strange marks in the margins</span> and hear <span class="act" data-value="'Who's there? Show yourself!'">footsteps approaching</span>.
\`\`\`
</instructions>`
    },
    
    dialogue: {
        name: "Dialogue Focused",
        description: "Emphasizes conversational choices and emotional responses. Perfect for character-driven narratives with branching dialogue trees.",
        instructions: `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.

**Core Principles:**
- Focus on dialogue options and emotional responses
- Provide at least **four** distinct conversational choices per response
- Include both what to say AND how to say it (tone, emotion, body language)

**Creating Dialogue Interactions:**
- Offer varied emotional tones: <span class="act" data-value="'I understand completely,' I say with genuine sympathy.">"I understand..."</span> vs <span class="act" data-value="'I understand,' I say coldly, not believing a word.">"I understand..."</span>
- Include non-verbal responses: <span class="act" data-value="I remain silent, letting the weight of their words hang in the air.">Say nothing</span>
- Mix questions with statements: <span class="act" data-value="'What aren't you telling me?'">Press for more</span> or <span class="act" data-value="'I think I've heard enough.'">End the conversation</span>
- Add physical reactions: <span class="act" data-value="I slam my fist on the table. 'That's enough!'">Show anger</span>

**Examples:**
\`\`\`
They lean forward, eyes searching yours. "Will you help me?" You could <span class="act" data-value="'Of course I'll help you. We're in this together.'">agree wholeheartedly</span>, <span class="act" data-value="'I'll help, but I need something in return.'">negotiate terms</span>, <span class="act" data-value="'I need time to think about this.'">ask for time</span>, or <span class="act" data-value="'No. Find someone else.'">refuse outright</span>.
\`\`\`
</instructions>`
    },
    
    exploration: {
        name: "Exploration & Investigation",
        description: "Designed for mystery, adventure, and investigation scenarios. Emphasizes searching, examining, and discovering clues.",
        instructions: `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.

**Core Principles:**
- Focus on investigation, exploration, and discovery actions
- Provide at least **five** interactive elements per response
- Layer obvious investigations with subtle environmental clues

**Creating Exploration Interactions:**
- Detailed examinations: <span class="act" data-value="I kneel down and examine the footprints more closely, looking for distinguishing marks.">Fresh footprints</span> lead away
- Search actions: <span class="act" data-value="I search through the desk drawers methodically.">The desk</span> might hold clues
- Environmental investigation: Check <span class="act" data-value="I look behind the painting for a safe or hidden compartment.">behind the painting</span>
- Tool usage: Use your <span class="act" data-value="I use my flashlight to examine the dark corner.">flashlight</span> to see better
- Document/clue examination: The <span class="act" data-value="I read the entire letter carefully, looking for hidden meanings.">crumpled letter</span> might be important

**Examples:**
\`\`\`
The room shows signs of struggle. <span class="act" data-value="I examine the overturned chair for fingerprints or blood.">An overturned chair</span>, <span class="act" data-value="I check if the window is locked from inside or outside.">an open window</span>, and <span class="act" data-value="I photograph the scene before touching anything.">scattered papers</span>. You might <span class="act" data-value="I dust for fingerprints on the doorknob.">dust for prints</span> or <span class="act" data-value="I look for hidden compartments in the floorboards.">check the floorboards</span>.
\`\`\`
</instructions>`
    },
    
    action: {
        name: "Action & Combat",
        description: "High-energy preset for action sequences, combat scenarios, and quick-decision moments requiring swift responses.",
        instructions: `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.

**Core Principles:**
- Focus on immediate, high-stakes actions and combat choices
- Provide at least **four** tactical options per response
- Balance offensive, defensive, and creative solutions

**Creating Action Interactions:**
- Combat moves: <span class="act" data-value="I dodge left and counterattack with a swift uppercut.">Dodge and counter</span>
- Environmental tactics: <span class="act" data-value="I kick the table over for cover and draw my weapon.">Use the environment</span>
- Quick decisions: <span class="act" data-value="I dive through the closing door at the last second.">Take the risk</span>
- Escape routes: <span class="act" data-value="I sprint for the fire escape.">Run for it</span>
- Weapon choices: Grab the <span class="act" data-value="I grab the pipe and swing it at the attacker.">metal pipe</span>

**Examples:**
\`\`\`
The enemy charges! You could <span class="act" data-value="I sidestep and use their momentum against them.">sidestep</span>, <span class="act" data-value="I meet their charge head-on with a battle cry.">meet them head-on</span>, <span class="act" data-value="I throw sand in their eyes and strike.">fight dirty</span>, or <span class="act" data-value="I roll backward and draw my concealed knife.">create distance</span>. The <span class="act" data-value="I grab the chandelier chain and swing across.">chandelier above</span> might help.
\`\`\`
</instructions>`
    },
    
    minimal: {
        name: "Minimal Choices",
        description: "Simple, clear choices presented at the end of responses. Good for straightforward narratives or when learning the system.",
        instructions: `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.

**Core Principles:**
- Provide 2-3 clear, distinct choices at the end of each response
- Make options obvious and easy to understand
- Focus on major decision points rather than minor interactions

**Creating Minimal Interactions:**
- Present clear alternatives at key moments
- Use simple, direct language for choices
- Group choices together for easy scanning

**Examples:**
\`\`\`
The merchant finishes their offer and waits for your response. You can <span class="act" data-value="I accept the deal.">accept the deal</span>, <span class="act" data-value="I decline politely and leave.">decline and leave</span>, or <span class="act" data-value="I try to negotiate for better terms.">negotiate for better terms</span>.
\`\`\`
</instructions>`
    },
    
    emotional: {
        name: "Emotional Depth",
        description: "Focuses on internal thoughts, feelings, and psychological responses. Ideal for character development and introspective narratives.",
        instructions: `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.

**Core Principles:**
- Emphasize emotional responses and internal monologue
- Provide at least **four** psychological or emotional choices
- Include both thoughts and feelings as clickable options

**Creating Emotional Interactions:**
- Internal reactions: You feel <span class="act" data-value="I feel a surge of anger but keep it hidden behind a smile.">anger rising</span>
- Emotional responses: <span class="act" data-value="I let the tears fall freely, not caring who sees.">Let yourself cry</span>
- Thought processes: <span class="act" data-value="*They're lying. I can see it in their eyes.*">Recognize the deception</span>
- Memory triggers: This reminds you of <span class="act" data-value="I'm transported back to that summer when everything changed...">that summer</span>
- Psychological choices: <span class="act" data-value="I choose to forgive, but I won't forget.">Forgive but remember</span>

**Examples:**
\`\`\`
The news hits you like a wave. You <span class="act" data-value="I struggle to maintain composure, my hands trembling slightly.">struggle to stay composed</span>, feeling <span class="act" data-value="A cold numbness spreads through me, protecting me from the pain.">numbness creeping in</span>. Part of you wants to <span class="act" data-value="'How could you do this to me?' I whisper, voice breaking.">confront them</span>, while another part <span class="act" data-value="I turn away without a word, unable to face this right now.">needs to escape</span>.
\`\`\`
</instructions>`
    }
};

// Default preset if none selected
const DEFAULT_PRESET = 'immersive';

const ELEMENT_CLICKABLE_ATTRIBUTE = "data-made-clickable";
const STYLE_TAG_ID = "clickable-actions-style";
const ACT_SELECTOR = ".custom-act"; // DOM will prefix classes with 'custom-'

/**
 * Ensure the stylesheet for .custom-act exists
 */
function ensureStylesInjected() {
    if (document.getElementById(STYLE_TAG_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_TAG_ID;
    style.type = "text/css";
    style.textContent = `
.custom-act {
    cursor: pointer;
    background-color: rgba(63, 81, 181, 0.08);
    border: 2px solid #3F51B5;
    padding: 0px 4px;
    display: inline-block; /* needed for transforms */
    transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        box-shadow 0.25s ease;
}
.custom-act:hover {
    background-color: rgba(63, 81, 181, 0.18);
    border-color: #1E3A8A;
    animation: nudgeBounce 0.35s ease-out;
    box-shadow: 0 3px 8px rgba(63, 81, 181, 0.3);
}
@keyframes nudgeBounce {
    0%   { transform: translateY(0) scale(1); }
    40%  { transform: translateY(-3px) scale(1.08); }
    70%  { transform: translateY(1px) scale(0.97); }
    100% { transform: translateY(0) scale(1); }
}
.clickable-actions-preset-description {
    padding: 8px;
    margin: 8px 0;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    font-size: 0.9em;
    font-style: italic;
    min-height: 2em;
}`;
    document.head.appendChild(style);
}

/**
 * @param {PointerEvent} event
 */
async function clickEvent(event) {
    // Find nearest actionable span
    const element = event.target.closest(ACT_SELECTOR);
    if (!element) return;

    const output = (element.getAttribute("data-value") || element.textContent || "").trim();
    if (!output) return;

    await sendMessageAsUser(output, "");
    await Generate("normal");

    event.preventDefault();
}

/**
 * @param {HTMLElement} el
 */
function makeClickable(el) {
    if (!(el instanceof HTMLElement)) return;

    // Get the text that will be sent when clicked
    const textToSend = (el.getAttribute("data-value") || el.textContent || "").trim();
    
    // Set tooltip to show what will be sent
    if (textToSend) {
        el.setAttribute("title", `Click to send: "${textToSend}"`);
    }

    el.addEventListener("click", clickEvent);
    el.setAttribute(ELEMENT_CLICKABLE_ATTRIBUTE, "true");
}

/**
 * @param {number} _i
 * @param {HTMLElement} container
 */
function processMessageTextBlock(_i, container) {
    jQuery(container).find(ACT_SELECTOR).each((i, spanEl) => {
        if (!spanEl.getAttribute(ELEMENT_CLICKABLE_ATTRIBUTE)) {
            makeClickable(spanEl);
        }
    });
}

function updateActions() {
    if (!isEnabled()) return;

    ensureStylesInjected();

    // Make newly rendered messages interactive
    jQuery("#chat .mes_text:not(:has(.edit_textarea))").each(processMessageTextBlock);

    if (shouldAppendPrompt()) {
        setExtensionPrompt("CLICKABLE_ACTIONS", prompt(), extension_prompt_types.IN_PROMPT, 1);
    } else {
        setExtensionPrompt("CLICKABLE_ACTIONS", "");
    }
}

async function initSettings() {
    // Get current settings
    let _isEnabled = isEnabled();
    let _shouldAppendPrompt = shouldAppendPrompt();
    let _prompt = prompt();
    let _currentPreset = currentPreset();

    if (!("clickableActions" in extension_settings)) {
        extension_settings.clickableActions = {
            enabled: _isEnabled,
            appendPrompt: _shouldAppendPrompt,
            prompt: _prompt,
            currentPreset: _currentPreset,
        };
    }

    // Render settings UI
    const html = await renderExtensionTemplateAsync("third-party/st-clickable-actions", "settings");
    jQuery(document.getElementById("extensions_settings")).append(html);

    // Populate preset selector
    const presetSelector = jQuery("#clickable_actions_preset");
    Object.entries(INSTRUCTION_PRESETS).forEach(([key, preset]) => {
        presetSelector.append(`<option value="${key}">${preset.name}</option>`);
    });
    presetSelector.val(_currentPreset);

    // Show current preset description
    updatePresetDescription(_currentPreset);

    // Sync settings
    jQuery("#clickable_actions_enabled").prop("checked", _isEnabled);
    jQuery("#clickable_actions_prompt_enabled").prop("checked", _shouldAppendPrompt);
    jQuery("#clickable_actions_prompt").val(_prompt);

    // Disable elements if necessary
    jQuery("#clickable_actions_prompt_enabled").prop("disabled", !_isEnabled);
    jQuery("#clickable_actions_prompt").prop("disabled", !_isEnabled || !_shouldAppendPrompt);
    jQuery("#clickable_actions_preset").prop("disabled", !_isEnabled);
    jQuery("#clickable_actions_preset_load").prop("disabled", !_isEnabled);

    // Events
    jQuery("#clickable_actions_enabled").on("change", () => {
        const checked = jQuery("#clickable_actions_enabled").is(":checked");
        extension_settings.clickableActions.enabled = checked;
        jQuery("#clickable_actions_prompt_enabled").prop("disabled", !checked);
        jQuery("#clickable_actions_prompt").prop("disabled", !checked || !shouldAppendPrompt());
        jQuery("#clickable_actions_preset").prop("disabled", !checked);
        jQuery("#clickable_actions_preset_load").prop("disabled", !checked);
        updateActions();
        saveSettingsDebounced();
    });

    jQuery("#clickable_actions_prompt_enabled").on("change", () => {
        const checked = jQuery("#clickable_actions_prompt_enabled").is(":checked");
        extension_settings.clickableActions.appendPrompt = checked;
        jQuery("#clickable_actions_prompt").prop("disabled", !isEnabled() || !checked);
        updateActions();
        saveSettingsDebounced();
    });

    jQuery("#clickable_actions_prompt").on("input", () => {
        extension_settings.clickableActions.prompt = jQuery("#clickable_actions_prompt").val();
        updateActions();
        saveSettingsDebounced();
    });

    jQuery("#clickable_actions_preset").on("change", () => {
        const selectedPreset = jQuery("#clickable_actions_preset").val();
        extension_settings.clickableActions.currentPreset = selectedPreset;
        updatePresetDescription(selectedPreset);
        saveSettingsDebounced();
    });

    jQuery("#clickable_actions_preset_load").on("click", () => {
        const selectedPreset = jQuery("#clickable_actions_preset").val();
        if (INSTRUCTION_PRESETS[selectedPreset]) {
            extension_settings.clickableActions.prompt = INSTRUCTION_PRESETS[selectedPreset].instructions;
            extension_settings.clickableActions.currentPreset = selectedPreset;
            jQuery("#clickable_actions_prompt").val(INSTRUCTION_PRESETS[selectedPreset].instructions);
            updateActions();
            saveSettingsDebounced();
        }
    });
}

function updatePresetDescription(presetKey) {
    const descriptionElement = jQuery("#clickable_actions_preset_description");
    if (INSTRUCTION_PRESETS[presetKey]) {
        descriptionElement.text(INSTRUCTION_PRESETS[presetKey].description);
    } else {
        descriptionElement.text("Select a preset to see its description");
    }
}

// Getters
function isEnabled() {
    return extension_settings.clickableActions?.enabled ?? true;
}

function shouldAppendPrompt() {
    return extension_settings.clickableActions?.appendPrompt ?? true;
}

function prompt() {
    return extension_settings.clickableActions?.prompt ?? INSTRUCTION_PRESETS[DEFAULT_PRESET].instructions;
}

function currentPreset() {
    return extension_settings.clickableActions?.currentPreset ?? DEFAULT_PRESET;
}

// Main
jQuery(() => {
    initSettings();
    ensureStylesInjected();
    setInterval(updateActions, 1000);
    updateActions();
});