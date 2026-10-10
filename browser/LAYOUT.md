# Layout

browser/ is an npm workspace of two packages. `@galaxyproject/orbit-browser` (core/) is Orbit's
shell for the browser: the agent in a worker, its providers, the chat and artifact panes, and the
Galaxy transport. `@galaxyproject/olit` (olit/) is the flavor that makes it a Galaxy
visualization plugin, and is what Galaxy installs. The workspace root holds the shared tooling and
runs lint, the vendored check, its own scripts' tests and the e2e drives itself. It forwards
`build`, `dev`, `preview`, `build:session`, `test:watch` and `test:ui` to olit,
`build:pyodide` and `build:skills` to core, and `test:unit` and `typecheck` to both; `test`
chains all of the checks.

```
package.json              private workspace root: shared dev tooling, scripts that forward
tsconfig.base.json        compiler options both packages extend
scripts/ e2e/             tooling and Playwright drives, for the workspace as a whole
dist/session.mjs          the Node build of the agent (npm run build:session)

core/                     @galaxyproject/orbit-browser, TypeScript source behind package exports
  vite.ts                   the Vite preset a flavor builds with: proxies, defines, worker, Pyodide
  scripts/install_assets.js the orbit-browser-assets bin a flavor's build runs first: fetches
                            Pyodide's wheels into temp/ and the galaxy-skills corpus into src/
  skills.lock.json          the galaxy-skills revision the core vendors
  pyodide.requirements.txt  the Python packages run_python loads
  src/index.ts              the page entry: mountOrbitBrowser and what a page needs
  src/shell.ts              mounts Orbit's ChatPanel, starts the flavor's worker, drives the chat
  src/layout.ts artifact-pane.ts usage-bar.ts retry-notice.ts   the pane's parts
  src/config.ts credentials*.ts   what the agent is handed, and by whom
  src/transcript.ts         the chat drawn from the conversation's events
  src/chat-markdown.ts      the chat's markdown: the model's raw HTML as text, images only from Galaxy
  src/artifacts/            artifact kinds (kinds.ts), the pane's renderers (index.ts), mermaid
  src/node.ts               the Node entry: Headless, describe, runNodeSession
  src/agent/                the agent: pi-durable's harness, in a worker in the browser
    index.ts                  the agent entry a flavor extends
    worker.ts client.ts       startAgentWorker, and the page's handle on it
    runtime.ts                the harness: conversations per history, model, Stop, save and open
    extension.ts              the agent as a pi-durable extension: tools, prompt, guards
    documents.ts              state beside the transcript: binding, follow-up policy, sessions
    storage.ts                SQLite in the browser's private file system, one tab at a time
    headless.ts node-session.ts   one conversation over JSON lines, for the eval harness
    saved.ts                  a conversation as a saved document
    tool.ts tools.ts          one tool as a durable tool; every tool, and the AgentFlavor seam
    watch.ts                  submitted Galaxy work, watched by a durable task
    record-write.ts record-jobs.ts   the agent's own edits to the record page
    model.ts providers.ts     the model endpoint, its registry, its rate limit
    galaxy.ts ops.ts galaxy-tools.ts hints.ts   Galaxy REST and other hosts as a call's `web`,
                              galaxy-ops, the tools kept, notes
    tables.ts                 Galaxy's tabular, csv and tsv: header, column names and types
    guards.ts destructive.ts sra-gate.ts   what can refuse a call
    prompt.ts skills.ts notebook.ts   the system prompt, SKILL.md routers, the record page
    python.ts python-realm.js python-node.ts   `run_python` and the realm Pyodide runs in
    processes/                deterministic procedures (lineage_report, organize_datasets)
    skills/                   olit-skills/notebook, and galaxy-skills fetched at build time
    describe.ts               what the agent publishes about itself, for an outside evaluator

olit/                     @galaxyproject/olit: files ["static"]
  public/olit.xml           plugin manifest: data sources, ai_prompt, capabilities
  vite.config.ts            the core's preset; builds static/ (olit.xml, index.js, index.css,
                            the worker chunk, pyodide/)
  vite.config.session.ts    the Node build, into dist/session.mjs (the root copies it to ../dist)
  src/main.ts               reads data-incoming and mounts the shell with Olit's options
  src/worker.ts             the worker entry: startAgentWorker(olitFlavor)
  src/incoming.ts seed-dataset.ts saved-session.ts   launching on a dataset, saving as a visualization
  src/artifacts/            vega-lite and visualization kinds (kinds.ts) and renderers
  src/agent/flavor.ts       olitFlavor
  src/agent/layout.ts       olitLayout: where --describe finds Olit, and olit.xml's ai_prompt
  src/agent/node.ts         the Node entry: runNodeSession(olitFlavor, olitLayout)
  src/agent/visualizations.ts visualization-inputs.ts vega.ts hints.ts   the visualization tools
  src/agent/prompt.ts       the starting-dataset section
  src/agent/skills/         olit-skills/visualization
```

## How a flavor extends the core

A flavor imports the core only through its package exports (`.`, `/agent`, `/artifacts`,
`/worker`, `/node`, `/vite`, and `/testing` for its tests), never a path inside it, so it can move
to another repository and consume the published package. `olit/src/boundary.test.ts` holds Olit
to that and checks that the core's own prompt and skills name none of Olit's tools, and
`core/src/boundary.test.ts` keeps the core from importing Olit or anything only a visualization
flavor needs.

- **Agent.** `AgentFlavor` (`/agent`) adds tools (placed after Galaxy's, so they take `{{artifact}}`
  tokens and count as the agent's own), skill files merged over the packaged corpus, notes on
  galaxy-ops results, prompt sections (right after the identity line, or after the skills router),
  and artifact kinds. The flavor's worker entry calls `startAgentWorker(flavor)`; the Node entry
  calls `runNodeSession(flavor, layout)`. This is the agent's own seam until it runs on Orbit's pi
  extensions, where each field has a counterpart.
- **Artifacts.** A kind augments `ArtifactKinds` (`/artifacts`) and is registered with how it is
  written into a page. Each realm keeps its own registry, so the worker registers the flavor's
  kinds and the page registers them again through `mountOrbitBrowser`'s `artifactKinds`; pass the
  same constant to both, since a kind the page doesn't know is dropped from what it shows. The
  page refuses to mount when a kind it knows has no renderer, or a renderer names a kind it
  doesn't know.
- **Page.** `mountOrbitBrowser(container, options)` takes the flavor's `createWorker`, its kinds and
  renderers, a `launch` callback (where the conversation starts and what to say about it; the
  default is Galaxy's current history), and an optional `sessions` store, without which there is
  no Save button.

The core ships as TypeScript source, so a flavor builds it with Vite: `?raw` and
`import.meta.glob` imports, the `process.env.*` defines and the `app/src/renderer` import all
assume that. Vite externalizes bare imports when it bundles a config file, which would hand the
linked `vite.ts` to Node as is, so olit's scripts load their config with `--configLoader runner`.

## Not split yet

What still ties the two packages to this workspace, and why each waits:

- **Publishing the core.** It imports Orbit's chat UI from `app/src/renderer` and ships TypeScript
  source, so it stays `private` for now. The plan is to publish it as a pre-built bundle that
  inlines the chat UI at build time, rather than publishing the renderer as a package of its own:
  the renderer is built for Orbit's shells, not as a reusable component, and a package would make
  its internals a public API. That means Vite library mode with one entry per export plus a
  `style.css`, and export conditions so this workspace keeps resolving TypeScript source while
  npm consumers get `dist/`. The handle `mountOrbitBrowser` returns is just `dispose()`, so no
  renderer type reaches the published declarations. Two things the bundle has to account for:
  - `--describe` reads the core's `src/agent/**` (exported symbols and `prompt.ts`) and
    `skills.lock.json` from the installed package, so the bundle either keeps shipping those (a
    `files` entry) or describe's data gets generated at the core's build time. A flavor still lays
    its own sources out as `src/agent/*.ts`.
  - The core reads build-time `process.env.*` defines (`credentials`, `olit_commit`/`olit_built`,
    the `llm_*` dev overrides) that the preset's `defines()` injects into the flavor's build. A
    pre-built bundle can't carry those: building them in would stamp the core's commit into every
    saved session and freeze the dev settings, and leaving them in throws on `process`. So they
    become `mountOrbitBrowser` options (a build stamp, the credentials mode, the dev model
    overrides), with the build stamp handed to the worker in its open request.
- **Olit's name inside the core.** It moves with a brand or id option (on `AgentFlavor` for the
  worker, on `mountOrbitBrowser` for the page), but not all of it can move the same way:
  - *Persisted*, so Olit's id must keep producing these names exactly, or saved state and records
    are orphaned: the `olit_session` key saved sessions live under; the durable watch task kind
    `olit.galaxy-watch`; the record page slug `olit-<session>` and the `^olit-` pattern that finds
    a history's earlier records again; the OPFS pool (`/olit`, `olit-opfs`) and the per-user
    database `olit-<user>`; the `olit:storage` tab lock; and the `olit.credentials` and
    `olit.artifactCollapsed` browser storage keys.
  - *Model-visible*, frozen by the surface snapshots and read by the agents repo until the split
    can change the agent: the prompt's identity line, `FOLLOW_UP_MARK`, the `[olit]` prefixes on
    result hints, misrouted()'s "is an Olit tool" refusal, run_python's description, the pi
    extension name, describe's `agent: "olit"` and `runner: "olit"`, and the `olit-skills` default
    skills repo a flavor's skills are keyed under.
  - *Plain text* a brand option replaces: the record page's "Olit Notebook" title and "maintained
    by Olit" starter, `cannotStart`, the worker-failure fallback, the transcript's failure lines,
    the composer placeholder, the shell's status messages, and the `[olit]` prefix on its console
    lines.
  - *Names in the API*: `OlitTool`, `olitTools`, and the `olit_commit`/`olit_built` defines.
  - *Internal names* that only a rename touches: the stylesheet `olit.css` and its `olit-` classes,
    `olitExtension`/`OlitHost` and `olitModels`.

  The persisted names are also why a second flavor can't share a Galaxy origin with Olit yet: it
  would open Olit's database, resume Olit's conversation on a history with its own tools, list
  Olit's records as its own, and fight Olit for the tab lock. Whether flavors get separate pools
  and locks or share a pool with separate databases is decided with the id option.
- **The default "galaxy" provider assumes a plugin-hosted flavor.** It talks to Galaxy's AI proxy,
  which Galaxy serves per visualization plugin at `api/plugins/<name>`, and it's the provider a
  first launch uses. A flavor that isn't a registered plugin has no `galaxyChatUrl` to give, so it
  would need that option made optional, "galaxy" dropped from the provider list, and another
  default in `buildConfig`.
- **One mount per document.** The shell puts its theme on the root element and the pane's state
  on body, sizes the pane from the window, injects fixed ids and configures the shared `marked`.
  Scoping all of that to the container is a follow-up; until then a host that needs the shell
  inside a larger page mounts it in an iframe.
- **Two mentions of Olit's tools in the core's prose:** the notebook skill's aside about
  `get_visualization_details`, and the system prompt's Galaxy terminology, which sends a request to
  view a dataset to `list_visualizations`. Their text is frozen for the same reason; olit's
  boundary test lists them as the known cases. The terminology line moves with a prompt section a
  flavor can add to that list.
- **End-to-end drives.** Every drive in `e2e/` mounts the Olit plugin, so they move to olit/ when
  it leaves. A drive of the core alone needs a minimal test flavor first.
- **Shared config.** Both packages extend `tsconfig.base.json` and use the root's Prettier config;
  a flavor that leaves takes a copy.

## Where tooling belongs

Tooling lives flat in `scripts/`, one file per job, named `<verb>_<subject>` so an `ls` groups the
verbs and the name says when it runs. The extension follows what the script has to load, not which
side of olit it serves: the core's `scripts/install_skills.js` is JavaScript because it fetches
through node. A script
a package's own build needs lives in that package instead, so the package builds wherever it goes:
the core's `scripts/` fetches what it ships, and a flavor's `build` runs `orbit-browser-assets`
before Vite.

If another repo names a path, it is not tooling but an interface. The `agents` repo builds
`dist/session.mjs` (`npm run build:session`) and drives it, asks it to `--describe --root .`
itself from browser/, and asks it to `settle`, waiting for submitted work and the runs its
follow-ups start; it reads the entries pi-durable appended. `olit/src/agent/describe.test.ts` pins
what `--describe` returns, and `olit/src/agent/surface.test.ts` pins what the agent sends a model.

## Vendored integrity

The galaxy-skills corpus under `core/src/agent/skills/` is a copy of files owned elsewhere. It is
synced by copy, which works only while the copy stays byte-identical, so its hashes are pinned.
Orbit's chat UI is not copied: it is imported from `app/src/renderer` in this repo.

```bash
npm run vendored                              # or: python3 scripts/check_vendored.py
```

The Orbit seam registry, which tracks what Olit's prompts and tools carry from Orbit, lives in the
`agents` repo and reads what the session's `--describe` publishes.

One gate. Every tool declares a capability (`llm`, `local`, `read`, `write`); a session advertises
only the tools its grant covers, and a process is gated on the strongest capability it declares.
The browser grants all four; the eval harness narrows the grant per scenario.
