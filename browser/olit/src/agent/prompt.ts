/** Olit's own system prompt sections, placed by olitFlavor.promptSections. */

/** Olit opened on a dataset names it, so a bare reference to "the dataset" resolves. */
export function seedDatasetBlock(datasetId?: string): string {
  if (!datasetId) {
    return "";
  }
  return (
    `## Starting dataset\n\n` +
    `The user opened Olit on dataset \`${datasetId}\`. Take it as the one they mean when ` +
    `they refer to a dataset without naming another, and call \`get_dataset_details\` for ` +
    `its columns and datatype before acting on it.`
  );
}
