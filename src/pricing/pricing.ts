import type { EncodingName, Provider } from "../tokenizer";
import pricingData from "./pricing.json";

/** A fully-resolved pricing entry for one model alias. */
export interface ModelPricing {
  /** The alias key used in settings and `pricing.json` (e.g. "gpt-4o"). */
  key: string;
  /** Human-friendly display name (e.g. "GPT-4o"). */
  label: string;
  provider: Provider;
  /** Encoding used to count tokens (exact for OpenAI, proxy for the rest). */
  encoding: EncodingName;
  /** USD price per 1,000,000 input tokens. */
  inputPer1M: number;
  /** USD price per 1,000,000 output tokens. */
  outputPer1M: number;
}

/** Cost split into input, assumed-output, and the combined total (all USD). */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

interface RawModel {
  label: string;
  provider: string;
  encoding: string;
  inputPer1M: number;
  outputPer1M: number;
}

function buildTable(raw: Record<string, RawModel>): Record<string, ModelPricing> {
  const table: Record<string, ModelPricing> = {};
  for (const [key, m] of Object.entries(raw)) {
    table[key] = {
      key,
      label: m.label,
      provider: m.provider as Provider,
      encoding: m.encoding as EncodingName,
      inputPer1M: m.inputPer1M,
      outputPer1M: m.outputPer1M,
    };
  }
  return table;
}

const defaultTable = buildTable((pricingData as { models: Record<string, RawModel> }).models);

/** Returns the full pricing table (model alias -> pricing). */
export function loadPricing(): Record<string, ModelPricing> {
  return defaultTable;
}

/** Looks up a single model's pricing by alias. Returns undefined if unknown. */
export function getModelPricing(
  model: string,
  table: Record<string, ModelPricing> = defaultTable,
): ModelPricing | undefined {
  return table[model];
}

/** All known model aliases. */
export function listModels(table: Record<string, ModelPricing> = defaultTable): string[] {
  return Object.keys(table);
}

/**
 * Cost formula (per the spec):
 *   inputCost  = (inputTokens  / 1e6) * inputPer1M
 *   outputCost = (outputTokens / 1e6) * outputPer1M
 *   totalCost  = inputCost + outputCost
 */
export function computeCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): CostBreakdown {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
