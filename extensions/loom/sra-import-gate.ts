/**
 * Catch wasteful SRA fan-out before Galaxy receives any submissions.
 *
 * A completed assistant message contains all sibling calls before tool_call
 * runs. Group only known SRA download wrappers with identical destination and
 * settings. Return an actionable tool error, not a UI approval question.
 * Essential guidance also lives in the system prompt: opaque Python/bash and
 * accessions introduced one at a time cannot be inferred from sibling calls.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { appendActivityEvent } from "./activity";
import { getNotebookPath } from "./state";
import { parseObject, SraImportGate, type NormalizeName } from "../../shared/sra-import.js";

export const SRA_IMPORT_GUIDANCE = `### Importing SRA/ENA sequencing runs

Before submitting, gather the full set of run accessions requested for this
analysis and deduplicate it. Inspect the destination history and notebook:
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

Loom records the import job itself; bind it to its plan step with
galaxy_job_record and note the returned collection ID in the notebook. Before using the
collection, verify population state, expected accession count and identifiers,
forward/reverse members, dataset states and appropriate content checks. A job
reported ok can still have failed or missing outputs. For ENA URL imports,
prefer a single server-side fetch into a named list:paired collection with
checksums when supported, rather than one upload per mate. Never delete prior
outputs merely to hide clutter; reuse them and preserve provenance.
`;

const GALAXY_PREFIX = /^(?:galaxy_|mcp__galaxy__)/;

// Galaxy's run_tool as pi names it, or wrapped in a generic `mcp({tool, args})` proxy.
const normalizeName: NormalizeName = (name, args) => {
  if (name === "mcp") {
    if (args.server !== undefined && args.server !== "galaxy") return null;
    const inner = parseObject(args.args);
    return inner ? { name: String(args.tool ?? "").replace(GALAXY_PREFIX, ""), args: inner } : null;
  }
  return { name: name.replace(GALAXY_PREFIX, ""), args };
};

function remediation(runs: string[]): string {
  const unique = [...new Set(runs)];
  return (
    "[loom] Batch SRA imports before submission. No job was submitted by this blocked call. " +
    "Use one fastq_dump/fasterq_dump call for all requested, missing accessions with identical settings, " +
    "not one job per accession or a mapped collection. " +
    (unique.length
      ? `Candidate accessions from the blocked calls: ${JSON.stringify(unique.join(","))}. `
      : "") +
    "Exclude verified or running imports first. For the remaining accessions, use a comma-separated " +
    "input|accession string with input|input_select=accession_number, or " +
    'one text HDA (one accession per line) with input|input_select=file_list and input|file_list={src:"hda",id:<real dataset ID>}. ' +
    "Inspect the installed tool template; retain the extraction settings and use its list:paired output for paired reads. " +
    "Check the history/notebook first so verified or running imports are not repeated. " +
    "Correct the call yourself; do not ask the user to authorize batching or retry the same single-accession calls."
  );
}

export function registerSraImportGate(pi: ExtensionAPI): void {
  const gate = new SraImportGate({ remediation, normalizeName });
  const clear = () => gate.clear();
  pi.on("session_start", clear);
  pi.on("agent_end", clear);
  pi.on("input", clear);
  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    gate.observe(event.message.content.flatMap((part) => (part.type === "toolCall" ? [part] : [])));
  });
  pi.on("tool_call", (event) => {
    const blocked = gate.block(event.toolCallId, event.toolName, event.input);
    if (!blocked) return;
    const notebook = getNotebookPath();
    if (notebook) {
      appendActivityEvent(path.dirname(notebook), {
        timestamp: new Date().toISOString(),
        kind: "sra.import.blocked",
        source: "sra-import-gate",
        payload: {
          toolCallId: event.toolCallId,
          historyId: blocked.call.historyId,
          toolId: blocked.call.toolId,
          accessions: blocked.runs,
          cause: blocked.cause,
        },
      });
    }
    return { block: true, reason: blocked.reason };
  });
}
