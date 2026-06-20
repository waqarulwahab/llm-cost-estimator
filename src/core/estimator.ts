import { getTokenizer, type Provider } from "../tokenizer";
import { computeCost, getModelPricing } from "../pricing/pricing";

/** Options controlling an estimate (mirrors the extension settings). */
export interface EstimateOptions {
  /** Model aliases to estimate, in display order. */
  models: string[];
  /** Assumed number of output tokens used for the total-cost calculation. */
  outputTokenAssumption: number;
  /** Display currency label (does not convert; pricing is USD). */
  currency?: string;
}

/** Per-model result of an estimate. */
export interface ModelEstimate {
  /** Alias key from settings/pricing (e.g. "gpt-4o"). */
  model: string;
  label: string;
  provider: Provider;
  /** True when token count is approximate (Anthropic/Google). */
  isEstimate: boolean;
  inputTokens: number;
  /** Assumed output tokens used for the total. */
  outputTokens: number;
  /** Cost of the input tokens only (USD). */
  inputCost: number;
  /** Cost of the assumed output tokens (USD). */
  outputCost: number;
  /** input + assumed output (USD). */
  totalCost: number;
}

/** Full result of estimating a piece of text across several models. */
export interface EstimateResult {
  text: string;
  charCount: number;
  outputTokenAssumption: number;
  currency: string;
  estimates: ModelEstimate[];
  /** Requested models that were not found in `pricing.json`. */
  unknownModels: string[];
}

/**
 * Estimates token usage and cost for `text` across the requested models.
 *
 * Pure and free of any VS Code dependency so it can be unit-tested directly.
 * Token counts are cached per provider+encoding so models sharing a tokenizer
 * are only tokenized once.
 */
export function estimate(text: string, options: EstimateOptions): EstimateResult {
  const outputTokens = Math.max(0, Math.round(options.outputTokenAssumption || 0));
  const estimates: ModelEstimate[] = [];
  const unknownModels: string[] = [];
  const tokenCache = new Map<string, number>();

  for (const model of options.models) {
    const pricing = getModelPricing(model);
    if (!pricing) {
      unknownModels.push(model);
      continue;
    }

    const tokenizer = getTokenizer(pricing.provider, pricing.encoding);
    const cacheKey = `${pricing.provider}:${pricing.encoding}`;
    let inputTokens = tokenCache.get(cacheKey);
    if (inputTokens === undefined) {
      inputTokens = tokenizer.countTokens(text);
      tokenCache.set(cacheKey, inputTokens);
    }

    const { inputCost, outputCost, totalCost } = computeCost(inputTokens, outputTokens, pricing);
    estimates.push({
      model,
      label: pricing.label,
      provider: pricing.provider,
      isEstimate: tokenizer.isEstimate,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost,
    });
  }

  return {
    text,
    charCount: text.length,
    outputTokenAssumption: outputTokens,
    currency: options.currency ?? "USD",
    estimates,
    unknownModels,
  };
}
