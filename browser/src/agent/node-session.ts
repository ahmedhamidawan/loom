import { createInterface } from "node:readline";

import { describe, type DescribeLayout } from "./describe";
import { Headless } from "./headless";
import { nodePython } from "./python-node";
import type { AgentFlavor } from "./tools";

const write = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`);

/**
 * One conversation over JSON lines: `create`, `turn`, `settle`, `restart` (answered with the
 * history's records to continue), `recover`, `export`, `close`.
 * Results carry pi-durable's entries as they were appended. `--describe --root <dir>` prints
 * what the agent publishes about itself instead, read from `layoutFor(<dir>)`.
 */
export function runNodeSession(
  flavor: AgentFlavor,
  layoutFor: (root: string) => DescribeLayout,
): Promise<void> {
  // stdout carries the protocol and nothing else.
  console.log = console.info = (...parts: unknown[]) => console.error(...parts);

  let session: Headless | undefined;

  /** Not top-level await: a lazily imported provider is declared after this module's body, so
   * the module has to finish evaluating before the first request reaches it. */
  async function main() {
    if (process.argv.includes("--describe")) {
      const root = process.argv[process.argv.indexOf("--root") + 1] ?? process.cwd();
      process.stdout.write(`${JSON.stringify(await describe(layoutFor(root), flavor), null, 2)}\n`);
      return;
    }
    for await (const line of createInterface({ input: process.stdin })) {
      if (!line.trim()) {
        continue;
      }
      const request = JSON.parse(line);
      try {
        if (request.op === "create") {
          session = await Headless.open(request.config, {
            python: nodePython(),
            env: process.env,
            flavor,
          });
          write({ result: {} });
        } else if (request.op === "turn") {
          write({ result: await session!.turn(request.text) });
        } else if (request.op === "settle") {
          write({ result: await session!.settle(Number(request.timeout) || 600) });
        } else if (request.op === "restart") {
          write({ result: { records: await session!.restart() } });
        } else if (request.op === "recover") {
          await session!.recover(request.page_id ?? undefined);
          write({ result: {} });
        } else if (request.op === "export") {
          write({ result: await session!.export(request.title ?? "") });
        } else if (request.op === "close") {
          break;
        }
      } catch (err) {
        write({ error: String((err as Error)?.message ?? err) });
      }
    }
    await session?.close();
  }

  // Exit once stdout drains: a pipe write is asynchronous on macOS, and exiting first truncates it.
  return main().then(() => {
    process.stdout.write("", () => process.exit(0));
  });
}
