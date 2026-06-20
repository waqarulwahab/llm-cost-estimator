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
  /** Context window in tokens, if known (used for over-limit warnings). */
  contextWindow?: number;
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
  contextWindow?: number;
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
      contextWindow: m.contextWindow,
    };
  }
  return table;
}

const defaultTable = buildTable((pricingData as { models: Record<string, RawModel> }).models);

// User-supplied models from `llmCostEstimator.customModels`, applied at runtime.
// Kept here (not in the JSON) so users can add/override without rebuilding.
let customTable: Record<string, ModelPricing> = {};

function mergedTable(): Record<string, ModelPricing> {
  return { ...defaultTable, ...customTable };
}

/**
 * Validates and coerces a raw user-supplied model entry into a ModelPricing.
 * Returns undefined when the entry is malformed (missing provider/prices, etc.).
 */
export function coerceModelPricing(key: string, value: unknown): ModelPricing | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const r = value as Record<string, unknown>;
  const provider = typeof r.provider === "string" ? (r.provider as Provider) : undefined;
  const inputPer1M = Number(r.inputPer1M);
  const outputPer1M = Number(r.outputPer1M);
  if (!provider || !Number.isFinite(inputPer1M) || !Number.isFinite(outputPer1M)) {
    return undefined;
  }
  if (inputPer1M < 0 || outputPer1M < 0) {
    return undefined;
  }
  const encoding: EncodingName =
    r.encoding === "o200k_base" || r.encoding === "cl100k_base"
      ? r.encoding
      : provider === "openai"
        ? "o200k_base"
        : "cl100k_base";
  const label = typeof r.label === "string" && r.label.length > 0 ? r.label : key;
  const ctx = Number(r.contextWindow);
  return {
    key,
    label,
    provider,
    encoding,
    inputPer1M,
    outputPer1M,
    contextWindow: Number.isFinite(ctx) && ctx > 0 ? ctx : undefined,
  };
}

/**
 * Replaces the custom-model overrides. Returns which keys were added and which
 * were rejected as malformed, so the caller can warn the user.
 */
export function setCustomModels(raw: unknown): { added: string[]; errors: string[] } {
  const next: Record<string, ModelPricing> = {};
  const errors: string[] = [];
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const pricing = coerceModelPricing(key, value);
      if (pricing) {
        next[key] = pricing;
      } else {
        errors.push(key);
      }
    }
  }
  customTable = next;
  return { added: Object.keys(next), errors };
}

/** Returns the full pricing table (built-in + custom). */
export function loadPricing(): Record<string, ModelPricing> {
  return mergedTable();
}

/** Looks up a single model's pricing by alias. Returns undefined if unknown. */
export function getModelPricing(
  model: string,
  table: Record<string, ModelPricing> = mergedTable(),
): ModelPricing | undefined {
  return table[model];
}

/** All known model aliases (built-in + custom). */
export function listModels(table: Record<string, ModelPricing> = mergedTable()): string[] {
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
