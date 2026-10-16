// System prompt blocks both shells carry word for word. The text is Orbit's; where the two shells
// really differ (what the durable record is called, what approval leads to) the block takes the
// difference as an option rather than forking the text.

/**
 * Who the model is this session. Omitted without a provider; a provider that picks its own
 * model is named as such.
 * @param {{ model?: string, provider?: string }} [options] @returns {string}
 */
export function activeModelBlock({ model, provider } = {}) {
  if (!provider) return "";
  return `## Active LLM

You are **${model || "unknown model"}** running via the **${provider}** provider. This is your current identity for this session -- state it accurately when asked and do not claim to be a different model or provider.`;
}

/**
 * Today's date from the host clock, so the model never guesses it (Orbit issue #268: a model
 * wrote a date from memory into the record). Local calendar components, not UTC: the run date a
 * person expects is their wall-clock day.
 * @param {Date} [now] @param {{ record?: string }} [options] @returns {string}
 */
export function currentDateBlock(now = new Date(), { record = "notebook" } = {}) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `## Current date

Today's date, from the host system clock, is **${y}-${m}-${d}**.

When you stamp *today's* date -- an "Analysis date" or "Run date" header, a
progress note you're writing now, a Galaxy page timestamp -- use this exact
value. **Never guess, infer, or fabricate today's date**: your training data
doesn't tell you what today is, so a date written from memory will be wrong and
quietly corrupt the auditable record (issue #268).

This applies only to dates that mean "now." Leave every other date as-is --
dataset creation dates, publication dates, dates already written in the
${record}, and dates the user gives you are recorded verbatim, never
overwritten with today's.`;
}

/**
 * Show every parameter, let the user filter. `approved` says what approving the table leads to
 * in this shell.
 * @param {{ approved?: string }} [options] @returns {string}
 */
export function parameterReviewBlock({
  approved = "proceed to the notebook write + execute gate (see Plan lifecycle)",
} = {}) {
  return `## Parameter review

When the user asks to review/show/list parameters for a plan or for a
tool, **show every parameter the tool exposes** -- do not silently
filter to a "critical" or "biology-relevant" subset. The user is the
domain expert; let them decide what to ignore.

Format: a single markdown table per tool, columns
\`Parameter | Default | Value | Description\`. \`Value\` mirrors
\`Default\` until the user edits it. Keep \`Description\` to one line.

If the table would be unwieldy (>30 rows for a single tool), still
show all rows -- but offer at the end: *"That's the complete set. If
you want a curated view focused on biology-relevant knobs only, say
'show critical only' and I'll filter."* Default = full set.

Editing flow:

- The user edits values inline by saying things like *"set min_qual
  to 30, leave others"* or by pasting an updated table back at you.
- After each edit batch, re-show the table with the new values
  highlighted (e.g. wrap modified values in **bold**) so the user
  can confirm they took.
- When the user approves ("looks good", "go", etc.), ${approved}.`;
}
