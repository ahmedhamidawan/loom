/** The artifacts only a Galaxy visualization makes: a Vega-Lite chart, and a Galaxy visualization. */
import type { JsonObject } from "@earendil-works/pi-durable";

import { fenced, type ArtifactKind } from "./kinds";

declare module "./kinds" {
  interface ArtifactKinds {
    "vega-lite": { spec: JsonObject };
    visualization: {
      /** The plugin, and the dataset it shows. */
      visualization: string;
      dataset_id: string;
      settings?: JsonObject;
      tracks?: JsonObject[];
      /** A saved copy in Galaxy, when there is one; the config above stays canonical. */
      visualization_id?: string;
    };
  }
}

export const OLIT_KINDS: readonly [ArtifactKind<"vega-lite">, ArtifactKind<"visualization">] = [
  { kind: "vega-lite", toPage: (a) => fenced("vega", JSON.stringify(a.spec, null, 2)) },
  {
    kind: "visualization",
    // A page holds a visualization's config, not a reference to a saved one.
    toPage: (a) =>
      fenced(
        "visualization",
        JSON.stringify(
          {
            visualization_name: a.visualization,
            visualization_title: a.title,
            dataset_id: a.dataset_id,
            ...(a.settings ? { settings: a.settings } : {}),
            ...(a.tracks ? { tracks: a.tracks } : {}),
          },
          null,
          2,
        ),
      ),
  },
];
