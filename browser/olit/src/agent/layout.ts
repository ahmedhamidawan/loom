/** Where `--describe --root <workspace>` finds Olit; the core finds its own half. Node only. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DescribeLayout } from "@galaxyproject/orbit-browser/node";

/** The prompt olit.xml seeds a conversation with: the plugin's ai_prompt, as written. */
export function manifestPrompt(xml: string): string | undefined {
  return /<ai_prompt>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/ai_prompt>/.exec(xml)?.[1];
}

export const olitLayout = (root: string): DescribeLayout => {
  const flavor = join(root, "olit");
  return {
    flavor,
    identityPrompt: manifestPrompt(readFileSync(join(flavor, "public", "olit.xml"), "utf8")),
  };
};
