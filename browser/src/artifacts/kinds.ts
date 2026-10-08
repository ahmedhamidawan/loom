/**
 * The artifacts the agent makes, one entry per kind: what each carries, and how it is written into
 * a Galaxy page. How each draws in the pane is registered in ./index; both are keyed by kind.
 *
 * A flavor adds its own kinds by augmenting `ArtifactKinds` and registering an `ArtifactKind` for
 * each, in every realm that reads them: the worker that makes them and the page that shows them.
 */
import type { EntryRecord } from "@earendil-works/pi-durable";

export interface ArtifactKinds {
  mermaid: { diagram: string };
}

export type Kind = keyof ArtifactKinds & string;
export type ArtifactOf<K extends Kind> = { kind: K; title: string } & ArtifactKinds[K];
export type Artifact = { [K in Kind]: ArtifactOf<K> }[Kind];

/** A kind, and how it is written into a Galaxy page: null for one Galaxy pages cannot render. */
export interface ArtifactKind<K extends Kind = Kind> {
  kind: K;
  toPage: ((artifact: ArtifactOf<K>) => string) | null;
}

export const fenced = (label: string, body: string) => "```" + label + "\n" + body + "\n```";

const KINDS = new Map<string, ArtifactKind<any>>([
  // Galaxy renders no mermaid cell; it shows one as an error, and its server refuses the page.
  ["mermaid", { kind: "mermaid", toPage: null }],
]);

/**
 * Make these kinds known in this realm. Registering one again is harmless; giving a known kind
 * another page form is a conflict, since artifacts already made would change meaning.
 */
export function registerArtifactKinds(defs: readonly ArtifactKind<any>[]): void {
  for (const def of defs) {
    const known = KINDS.get(def.kind);
    if (known && known.toPage !== def.toPage) {
      throw new Error(`Artifact kind '${def.kind}' is already registered differently.`);
    }
    KINDS.set(def.kind, def);
  }
}

export const isKind = (kind: unknown): kind is Kind => typeof kind === "string" && KINDS.has(kind);

/** How a kind is written into a page: null when Galaxy cannot render it, undefined when unknown. */
export function pageWriter(kind: Kind): ArtifactKind["toPage"] | undefined {
  return KINDS.get(kind)?.toPage;
}

/** `artifact` as page markdown, or undefined when Galaxy pages cannot render its kind. */
export function toPage(artifact: Artifact): string | undefined {
  return (pageWriter(artifact.kind) as ((a: Artifact) => string) | null | undefined)?.(artifact);
}

/** The artifacts results carried in their details, newest last. */
export function artifactsOf(entries: readonly EntryRecord[]): Artifact[] {
  return entries.flatMap((entry) => {
    const message = entry.model?.[0] as
      { role?: string; details?: { artifacts?: Artifact[] } } | undefined;
    const carried = message?.role === "toolResult" ? (message.details?.artifacts ?? []) : [];
    return carried.filter((a) => isKind(a?.kind));
  });
}
