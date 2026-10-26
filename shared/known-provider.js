// pi drops providers between releases (1.1.0 removed ollama, #598), and a
// config saved under an older Loom still names them. pi rejects an unknown
// --provider with a plain exit 1, which a shell reads as a crash and retries --
// so the brain checks first and exits EX_CONFIG with a message instead.

import { existsSync, readFileSync } from "node:fs";

/**
 * Provider names declared in pi's models.json. pi resolves --provider against
 * these as well as its built-ins, so a legacy custom provider stays valid.
 * @param {string} modelsPath
 * @returns {string[]}
 */
export function modelsJsonProviders(modelsPath) {
  if (!existsSync(modelsPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(modelsPath, "utf-8"));
    const providers = parsed?.providers;
    return providers && typeof providers === "object" ? Object.keys(providers) : [];
  } catch {
    return [];
  }
}

/**
 * Would pi accept `provider` as --provider? Case-insensitive, as pi matches.
 * @param {string} provider
 * @param {Iterable<string>} builtIn pi-ai's getProviders()
 * @param {Iterable<string>} [extra] names from models.json
 */
export function isKnownProvider(provider, builtIn, extra = []) {
  const wanted = provider.toLowerCase();
  for (const name of [...builtIn, ...extra]) {
    if (name.toLowerCase() === wanted) return true;
  }
  return false;
}

/**
 * What the brain prints before exiting EX_CONFIG on an unknown provider.
 * Mentions the custom-endpoint route because the provider that triggered this
 * (ollama) is still reachable that way.
 * @param {string} provider
 */
export function unknownProviderMessage(provider) {
  return `loom: provider "${provider}" isn't supported by this version of Loom, so the
agent can't start with it.

Open Preferences and pick another provider. A local server such as Ollama or
llama.cpp still works as an "OpenAI-compatible endpoint" with its base URL
(e.g. http://127.0.0.1:11434/v1).
`;
}
