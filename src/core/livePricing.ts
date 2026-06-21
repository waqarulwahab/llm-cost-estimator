import { loadPricing, type LivePriceOverride, type ModelPricing } from "../pricing/pricing";

/** Default public source: LiteLLM's community-maintained pricing table. */
export const DEFAULT_PRICING_SOURCE =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/** Shape of one entry in the LiteLLM pricing JSON (only the fields we use). */
export interface LiteLLMEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  max_input_tokens?: number;
  max_tokens?: number;
}

export interface LivePricingResult {
  overrides: Record<string, LivePriceOverride>;
  /** Model keys whose price was refreshed from the source. */
  updated: string[];
  /** Model keys that declare a `liveId` but had no valid source entry. */
  skipped: string[];
}

/**
 * Maps a LiteLLM-style pricing source to per-model overrides for our catalog.
 * Pure (no network). Only models that declare a `liveId` AND have a valid source
 * entry are updated; everything else keeps its bundled price. Per-token costs are
 * converted to per-1M.
 */
export function buildLiveOverrides(
  source: Record<string, LiteLLMEntry>,
  table: Record<string, ModelPricing> = loadPricing(),
): LivePricingResult {
  const overrides: Record<string, LivePriceOverride> = {};
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const model of Object.values(table)) {
    if (!model.liveId) {
      continue;
    }
    const entry = source[model.liveId];
    const inTok = entry ? Number(entry.input_cost_per_token) : NaN;
    const outTok = entry ? Number(entry.output_cost_per_token) : NaN;
    if (!Number.isFinite(inTok) || !Number.isFinite(outTok) || inTok < 0 || outTok < 0) {
      skipped.push(model.key);
      continue;
    }
    const ctx = Number(entry.max_input_tokens ?? entry.max_tokens);
    overrides[model.key] = {
      inputPer1M: inTok * 1_000_000,
      outputPer1M: outTok * 1_000_000,
      contextWindow: Number.isFinite(ctx) && ctx > 0 ? ctx : undefined,
    };
    updated.push(model.key);
  }

  return { overrides, updated, skipped };
}
