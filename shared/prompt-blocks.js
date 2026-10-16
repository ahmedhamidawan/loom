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

/** @param {string} name */
const bare = (name) => name;

/**
 * Importing SRA/ENA runs: one importer job for the whole set, verified before use. `before` is a
 * paragraph a shell puts first (the browser says when the importer applies); `record` is what
 * the durable record is called; `recording` is how this shell records the job.
 * @param {{ before?: string, record?: string, recording?: string }} [options] @returns {string}
 */
export function sraImportGuidance({
  before = "",
  record = "notebook",
  recording = `Loom records the import job itself; bind it to its plan step with
galaxy_job_record and note the returned collection ID in the notebook.`,
} = {}) {
  return `### Importing SRA/ENA sequencing runs
${before ? `\n${before}\n` : ""}
Before submitting, gather the full set of run accessions requested for this
analysis and deduplicate it. Inspect the destination history and ${record}:
reuse verified inputs and wait for matching imports already running; retry
only missing or demonstrably failed runs. Do not expand to unrelated runs in
a study or replace verified data unless the user requested that scope.

For Galaxy fastq_dump/fasterq_dump, inspect the installed input template and
submit compatible accessions in ONE tool call. The IUC wrappers accept a
comma-separated string in input|accession with input|input_select=accession_number,
or one uploaded text dataset (one accession per line) in input|file_list with
input|input_select=file_list. A list file is a single HDA, not a mapped HDCA.
Do not loop over accessions or use Galaxy's batch/map mechanism: that creates
separate jobs and collections. Do not download FASTQs locally and re-upload.
For paired-end data use the wrapper's paired output (normally list_paired,
list:paired); keep singleton/other outputs available for verification. Do not
create per-run collections and merge them when the importer can build one.
Preserve requested extraction settings and compression; splitting into
separate jobs is justified only by different settings or a demonstrated
server/resource limit, not by the number of samples alone.

${recording} Before using the
collection, verify population state, expected accession count and identifiers,
forward/reverse members, dataset states and appropriate content checks. A job
reported ok can still have failed or missing outputs. For ENA URL imports,
prefer a single server-side fetch into a named list:paired collection with
checksums when supported, rather than one upload per mate. Never delete prior
outputs merely to hide clutter; reuse them and preserve provenance.`;
}

/**
 * Drafting a plan: Galaxy first, then what runs where. `tool` maps a galaxy-mcp tool name to
 * what the shell offers it as; `local` says whether the shell has a local step to route light
 * work to (without one, light work goes to run_python and plans are remote-only); `resume` is a
 * paragraph a shell adds about picking up earlier work.
 * @param {{ tool?: (name: string) => string, local?: boolean, resume?: string }} [options]
 * @returns {string}
 */
export function draftingAPlan({ tool = bare, local = true, resume = "" } = {}) {
  const light = local
    ? `   - Light/exploratory (parsing, summarization, awk/sed/jq one-offs,
     truly throwaway probes) -> mark step local. Reserve for work that
     doesn't belong in the durable record.`
    : `   - Light/exploratory (parsing, summarization, quick probes over a
     dataset you have already fetched) -> use \`${tool("run_python")}\` rather than
     a plan step. Reserve for work that doesn't belong in the durable
     record.`;
  const routing = local
    ? `   \`## Plan A: chrM Variant Calling [hybrid]\`
   \`Step 3: BWA alignment (Galaxy: bwa-mem2/2.2.1)\`
   \`Step 4: VCF filter (Galaxy UDT: vcf_min_depth)\`
   \`Step 5: quick stat probe (local awk)\``
    : `   \`## Plan A: chrM Variant Calling [remote]\`
   \`Step 3: BWA alignment (Galaxy: bwa-mem2/2.2.1)\`
   \`Step 4: VCF filter (Galaxy UDT: vcf_min_depth)\``;
  return `### Drafting a new plan

When drafting a plan, **first** consult Galaxy
resources before deciding what runs where:

1. Check the IWC registry as above. If a workflow (or a chain of them)
   covers the analysis, propose running it on Galaxy -- the steps are
   those invocations.
2. Otherwise, draft step-by-step. Per step:
   - Heavy compute (alignment, large variant calling, big assemblies,
     long-running BLAST, etc.) -> check Galaxy tool availability
     (\`${tool("search_tools_by_name")}\`); if installed, mark step Galaxy.
   - **Gap-filling glue** between Galaxy steps (a small filter,
     reformatter, joiner, column-trimmer, etc. that isn't in the
     public tool panel) -> **prefer a user-defined tool** over a ${local ? "local" : "inline"}
     script. Create it once with \`${tool("create_user_tool")}\` and run it
     with \`${tool("run_user_tool")}\`. Keeps the analysis on Galaxy,
     preserves provenance, stays reusable across histories. Default to
     this whenever the glue is something a future user might want to
     run again.
${light}
3. Document routing in the plan section header and inline per-step:
${routing}${resume ? `\n\n${resume}` : ""}`;
}

/**
 * Chat formatting: blank lines between updates, no narration. The reason is the renderer's
 * (both shells draw Orbit's ChatPanel), not streaming. `results` says where this shell's
 * results live instead.
 * @param {{ results?: string }} [options] @returns {string}
 */
export function chatFormatting({
  results = `The notebook is
  the durable progress record (checkboxes flip as steps complete) and
  Galaxy invocation status updates land in the YAML blocks.`,
} = {}) {
  return `## Chat formatting

Chat is rendered as markdown. Adjacent bold or italic markers with no whitespace
between them break parsing -- the user sees literal \`**asterisks**\` -- and a single
newline joins two lines into one paragraph. Two rules:

- **Always separate distinct progress updates with a blank line.** If
  you announce "Starting step 2", complete it, and then announce step
  3, those are three distinct messages -- put a blank line (\`\\n\\n\`)
  between each. Same for any sequence of messages emitted in one turn.
- **Don't narrate execution step-by-step in chat.** ${results} Keep chat
  for **dialogue + final status** -- open questions, requested
  decisions, and a single end-of-turn summary like
  *"All 8 steps verified. Variant call results in plan-a-step-7. Ready
  for interpretation?"*

When you do post a multi-line update, prefer a markdown list or a
fenced code block over inline-bold-heavy run-on prose. Lists naturally
get blank lines from the renderer; run-on prose does not.`;
}

/**
 * The Galaxy terms the agent should know. `more` are a shell's own bullets, placed after the
 * UDT one; `invocationNote` says how this shell tracks an invocation; `routing` adds the plan
 * routing tags, which only mean something where a step can run locally.
 * @param {{ tool?: (name: string) => string, more?: string[], invocationNote?: string, routing?: boolean }} [options]
 * @returns {string}
 */
export function galaxyTerminology({
  tool = bare,
  more = [],
  invocationNote = "Tracked in the notebook via `loom-invocation` blocks.",
  routing = true,
} = {}) {
  const invocation = invocationNote ? ` ${invocationNote}` : "";
  return `### Galaxy terminology

- **User-defined tool** ("UDT"): a server-side custom tool the user
  registers in their Galaxy account, runs unprivileged. The connected
  Galaxy MCP exposes the full lifecycle: \`${tool("create_user_tool")}\`,
  \`${tool("list_user_tools")}\`, \`${tool("run_user_tool")}\`,
  \`${tool("delete_user_tool")}\`. **Do not generate old-style XML tool
  wrappers locally when the user asks for a UDT** -- that's a different
  concept (legacy ToolShed tools). Reach for the MCP tools rather than
  inventing a local workaround. When authoring the UDT definition, fetch
  the \`udt-authoring\` skill first (see Skills repositories below) rather
  than writing the YAML from memory.
${more.map((term) => `${term}\n`).join("")}- **Workflow invocation**: a single run of a Galaxy workflow on a
  history.${invocation}
- **IWC**: Intergalactic Workflow Commission -- registry of curated
  workflows. See "Finding a community workflow" above.${
    routing
      ? `

The routing tag records where the plan's compute runs and its provenance
lives -- an *outcome* of the plan you draft, not a mode setting:
- **remote** -- all compute runs on Galaxy: tool jobs, UDT jobs, workflow
  invocations alike
- **hybrid** -- some steps run on Galaxy, some on this machine
- **local** -- everything runs on this machine`
      : ""
  }`;
}

/**
 * Every Galaxy artifact named in prose gets a link. `record` is what the durable record is
 * called, `blocks` names the machine-readable blocks whose ids stay as they are, and `root`,
 * when a shell serves one Galaxy, is that deployment's base.
 * @param {{ record?: string, blocks?: string, root?: string }} [options] @returns {string}
 */
export function artifactLinkGuidance({
  record = "notebook",
  blocks = "loom-galaxy-page, loom-invocation, and loom-job YAML blocks",
  root,
} = {}) {
  const base = root
    ? `\nThis deployment's server base is **${root.replace(/\/+$/, "")}**, which already carries its
path prefix.\n`
    : "";
  return `### Clickable Galaxy artifacts

Every Galaxy artifact you mention in chat, progress updates, or ${record} prose
must have a descriptive Markdown link: [evaluation summary](absolute URL),
not just a name or bare ID in backticks. This applies to histories, datasets,
collections, workflows, invocations, jobs, tools, pages/notebooks, and revisions.
Use the artifact's actual server and returned ID. Preserve deployment prefixes
(e.g. https://host/galaxy). Never guess an ID or use today's connected server
for an artifact recorded on a different server. If its server or identity is
unknown, resolve it from the ${record} or tool result before promising a link.
${base}
Prefer a returned browser URL. Otherwise use these read/view routes relative
to the artifact's server base, with URL-encoded IDs:
- history: /histories/view?id={history_id}
- dataset (HDA): /datasets/{dataset_id}
- history dataset collection (HDCA): /collection/{collection_id}/sheet
- stored workflow: /published/workflow?id={stored_workflow_id}
- workflow invocation: /workflows/invocations/{invocation_id}
- job: /jobs/{job_id}/view
- tool: /?tool_id={tool_id}
- page/notebook: /published/page?id={page_id} (works for authorized private pages)
- exact saved page revision: /api/pages/{page_id}/revisions/{revision_id}
  (label this as revision JSON; Galaxy has no revision UI deep link).
An invocation's internal workflow_id is not a stored_workflow_id; resolve the
stored workflow before linking it. Do not substitute dataset UUIDs, collection
element IDs, or numeric history item numbers for HDA/HDCA IDs.

Keep machine-readable IDs in ${blocks} unchanged. Add readable Markdown links in the surrounding ${record}
prose so the durable record is useful in other Markdown viewers too. Empty slugs,
timestamps, and non-artifact metadata are plain text, not invented links.`;
}

/**
 * What a build without a local shell can and cannot do. `tools` is what the shell calls its
 * Galaxy tools; `instead` says what this shell offers in place of a shell.
 * @param {{ tools?: string, instead?: string }} [options] @returns {string}
 */
export function noLocalShellBlock({
  tools = "the Galaxy MCP tools",
  instead = "You can still read and write files in the workspace (the notebook and its inputs/outputs).",
} = {}) {
  return `## Execution: remote-only (Galaxy)

This build has no local shell. All computation runs on Galaxy via ${tools} -- there is no
bash, conda, or local-pipeline path here. Tag every plan \`[remote]\`; do not propose local
shell or conda steps. ${instead}`;
}

/**
 * Galaxy is not there and nothing can run. `cause` says why in this shell, `remedy` what the
 * user can do about it.
 * @param {{ cause?: string, remedy?: string }} [options] @returns {string}
 */
export function galaxyUnavailableBlock({
  cause = "No Galaxy credentials configured (`GALAXY_URL` / `GALAXY_API_KEY`).",
  remedy = "ask the user to run `/connect`",
} = {}) {
  return `## Galaxy connection: NOT CONNECTED

${cause} Nothing can run until a Galaxy server is connected -- ${remedy} before proposing
analysis steps.`;
}

/**
 * Getting a file into a history: hand Galaxy the URL. `staging` says what this shell must not
 * route bytes through, `accessions` how it turns an accession into URLs (an accession is not a
 * URL in any shell), and `alternatives` the other routes this shell has.
 * @param {{ tool?: (name: string) => string, staging?: string, accessions?: string, alternatives?: string[] }} [options]
 * @returns {string}
 */
export function gettingDataIn({
  tool = bare,
  staging = `Do **not** download the file to this machine and then
re-upload it. A local download followed by a local->Galaxy upload doubles
the transfer, burns the user's upstream bandwidth, fills local disk, and
blocks the turn: a 2.3 GB local->Galaxy upload took 8+ minutes on a normal
connection, where a server-side fetch runs at datacenter bandwidth.`,
  accessions = "",
  alternatives = [
    `- **Scripting bioblend instead?** Use the URL-fetch path
  \`gi.tools.put_url(url, history_id)\` (one URL per line for several),
  which Galaxy fetches server-side. Never call \`gi.tools.upload_file()\`
  on a path you just downloaded from that same URL.`,
    `- **Local->upload is the exception.** Reach for it only when the source is
  genuinely local: a file the user created, or one that exists only on
  this machine with no URL Galaxy can reach itself.`,
  ],
} = {}) {
  return `### Getting data into a Galaxy history

When a history needs a file that lives at a **public URL** (reference
genomes, model weights, released datasets, anything addressable by
http/https/ftp), hand Galaxy the URL and let its server fetch it directly.
${staging}
${accessions ? `\n${accessions}\n` : ""}
- **Preferred:** the Galaxy fetch-by-URL tool
  \`${tool("upload_file_from_url")}({ url, history_id })\` (optional
  \`file_name\`, \`file_type\`, \`dbkey\`). One hop, no local copy.
${alternatives.join("\n")}`;
}

/**
 * How to write Galaxy Flavored Markdown for a page. Galaxy's client splits a page at every
 * \`\`\` line and renders galaxy, vega, visualization and vitessce cells; any other type shows
 * as an error, and current Galaxy refuses the page (validate_galaxy_markdown_fence_types).
 * `offenders` names the fences to warn against (a shell that forbids naming them passes "");
 * `heading` and `artifacts` are a shell's own framing.
 * @param {{ tool?: (name: string) => string, heading?: string, artifacts?: string, offenders?: string }} [options]
 * @returns {string}
 */
export function galaxyPageMarkdown({
  tool = bare,
  heading = "",
  artifacts = "",
  offenders = " (```txt, ```text, or a language name)",
} = {}) {
  return `${heading ? `${heading}\n\n` : ""}Galaxy pages render as Galaxy Flavored Markdown. Write plain Markdown -- headings,
lists, tables, links, emphasis, blockquotes -- and embed Galaxy results only with
\`\`\`galaxy directive blocks (e.g. \`history_dataset_display\`, \`history_dataset_as_image\`,
\`history_dataset_as_table\`, \`invocation_outputs\`, \`workflow_display\`). Directives take
**encoded** ids, never raw integers or HIDs; get them from \`${tool("get_history_contents")}\` or
\`${tool("get_dataset_details")}\`.

A \`\`\` fence on a Galaxy page opens a cell, and Galaxy renders only \`\`\`galaxy, \`\`\`vega,
\`\`\`visualization and \`\`\`vitessce cells; any other type${offenders} shows as an error and
Galaxy refuses the page. Present data as Markdown tables or prose; for code or plain text use
~~~ fences.${artifacts ? `\n\n${artifacts}` : ""}`;
}
