/**
 * The agent's internals a flavor's tests reach for: the runtime and its stored documents, the
 * guards and outcomes a tool result carries, the placement and page checks, and a scripted model.
 * None is an extension point, so a flavor's own source imports `/agent` instead.
 */
export { resolveArtifacts } from "./agent/artifacts";
export { Binding } from "./agent/documents";
export { hanging, json, stream, text, toolCall } from "./agent/fake-model";
export { connectWeb } from "./agent/galaxy";
export { annotating } from "./agent/galaxy-tools";
export { pageContentProblem } from "./agent/page-edit";
export {
  artifactsIn,
  context,
  Runtime,
  type RuntimeConfig,
  type RuntimeOptions,
} from "./agent/runtime";
export { usageTotals } from "./agent/saved";
export { claim, GUARDS, Outcome, rendered } from "./agent/tool";
