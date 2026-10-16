export function activeModelBlock(options?: { model?: string; provider?: string }): string;
export function currentDateBlock(now?: Date, options?: { record?: string }): string;
export function parameterReviewBlock(options?: { approved?: string }): string;
export function sraImportGuidance(options?: {
  before?: string;
  record?: string;
  recording?: string;
}): string;
export function draftingAPlan(options?: {
  tool?: (name: string) => string;
  local?: boolean;
  resume?: string;
}): string;
export function chatFormatting(options?: { results?: string }): string;
export function galaxyTerminology(options?: {
  tool?: (name: string) => string;
  more?: string[];
  invocationNote?: string;
  routing?: boolean;
}): string;
export function artifactLinkGuidance(options?: {
  record?: string;
  blocks?: string;
  root?: string;
}): string;
