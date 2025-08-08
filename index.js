import { Generate, extension_prompt_types, sendMessageAsUser, setExtensionPrompt, saveSettingsDebounced } from "../../../../script.js";
import { renderExtensionTemplateAsync, extension_settings } from '../../../extensions.js';

const DEFAULT_INSTRUCTIONS = `
<instructions>
Wrap user-selectable actions inline using \`<span class="act" data-value="text to send">text to display</span>\`.
- Provide at least **three** distinct, concise action options each response.
- The click will send the user's next message.
- The \`data-value\` and the visible text may differ separating message and what gets sent.
- In each response, include multiple mid-response inline \`data-value\` actions liberally throughout your prose (not just at the end): objects, throwaway asides, and key phrases can all be actionable.
- For example feel free to surprise a user with the results of the action, you may add the tag around an apple present in there scene and when clicked it should send "You pick up the apple and take a bite."
- Do not cluster all of the actions at the end, pick out words throughout the response body.
- Use \`data-value\` when the visible text should differ from what gets sent.

Guidelines:
- Keep spans short and imperative when appropriate, but feel free to embed surprising interactions.
- Avoid nesting tags inside the span; plain text only.
- No <button> tags.

Examples:
\`\`\`
The ledger lies open—<span class="act">Take the ledger</span>—but the ink is fresh.
You could <span class="act">Check the margins</span> or <span class="act">Call the clerk</span>.
\`\`\`
\`\`\`
She says, "Fine, try it." <span class="act" data-value="Attempt a stealth roll.">try it</span> — then mutters about the gate.
Perhaps <span class="act" data-value="Inspect the gate mechanism looking for vulnerabilities.">inspect the mechanism</span> or just <span class="act" data-value="Walk away casually as if nothing happened.">walk away</span>.
\`\`\`

Semantics:
- If \`data-value\` exists, it will be sent; otherwise the inner text is sent verbatim.
</instructions>
`;

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
    border-bottom: 2px solid #3F51B5;
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

    if (!("clickableActions" in extension_settings)) {
        extension_settings.clickableActions = {
            enabled: _isEnabled,
            appendPrompt: _shouldAppendPrompt,
            prompt: _prompt,
        };
    }

    // Render settings UI
    const html = await renderExtensionTemplateAsync("third-party/st-clickable-actions", "settings");
    jQuery(document.getElementById("extensions_settings")).append(html);

    // Sync settings
    jQuery("#clickable_actions_enabled").prop("checked", _isEnabled);
    jQuery("#clickable_actions_prompt_enabled").prop("checked", _shouldAppendPrompt);
    jQuery("#clickable_actions_prompt").val(_prompt);

    // Disable elements if necessary
    jQuery("#clickable_actions_prompt_enabled").prop("disabled", !_isEnabled);
    jQuery("#clickable_actions_prompt").prop("disabled", !_isEnabled || !_shouldAppendPrompt);

    // Events
    jQuery("#clickable_actions_enabled").on("change", () => {
        const checked = jQuery("#clickable_actions_enabled").is(":checked");
        extension_settings.clickableActions.enabled = checked;
        jQuery("#clickable_actions_prompt_enabled").prop("disabled", !checked);
        jQuery("#clickable_actions_prompt").prop("disabled", !checked || !shouldAppendPrompt());
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

    jQuery("#clickable_actions_prompt_restore").on("click", () => {
        extension_settings.clickableActions.prompt = DEFAULT_INSTRUCTIONS;
        jQuery("#clickable_actions_prompt").val(DEFAULT_INSTRUCTIONS);
        updateActions();
        saveSettingsDebounced();
    });
}

// Getters
function isEnabled() {
    return extension_settings.clickableActions?.enabled ?? true;
}

function shouldAppendPrompt() {
    return extension_settings.clickableActions?.appendPrompt ?? true;
}

function prompt() {
    return extension_settings.clickableActions?.prompt ?? DEFAULT_INSTRUCTIONS;
}

// Main
jQuery(() => {
    initSettings();
    ensureStylesInjected();
    setInterval(updateActions, 1000);
    updateActions();
});
