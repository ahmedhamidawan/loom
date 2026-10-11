/**
 * Who the agent is to the user and the model, and the prefix of everything it keeps. A flavor
 * names itself once, on its AgentFlavor for the worker and on mountOrbitBrowser for the page, and
 * both must be the same brand: the page reads what the worker wrote under it.
 */
export interface Brand {
  /**
   * Lowercase and stable: the browser database, its tab lock, the record pages' slugs, the
   * skills repo the core's own skills are offered under, and the tag on result notes all carry
   * it. Changing it orphans what was kept under the old one.
   */
  id: string;
  /** What the agent calls itself and the page calls it. */
  name: string;
}

export const DEFAULT_BRAND: Brand = { id: "orbit", name: "Orbit" };

/** The tag the core puts on the notes it adds to a tool result. */
export const noteTag = (brand: Brand) => `[${brand.id}]`;

/** Opens the message settled Galaxy work sends, so the page can tell it from the user's own. */
export const followUpMark = (brand: Brand) => `[${brand.name} automatic Galaxy follow-up]`;
