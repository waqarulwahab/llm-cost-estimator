import { describe, it, expect } from "vitest";
import { estimate } from "../src/core/estimator";
import { getModelPricing } from "../src/pricing/pricing";

const DEFAULT_MODELS = ["gpt-4o", "claude-sonnet", "claude-haiku"];

describe("estimate", () => {
  it("returns one estimate per known model, in order", () => {
    const result = estimate("Hello, world!", {
      models: DEFAULT_MODELS,
      outputTokenAssumption: 500,
    });
    expect(result.estimates.map((e) => e.model)).toEqual(DEFAULT_MODELS);
    expect(result.unknownModels).toEqual([]);
  });

  it("counts OpenAI tokens exactly with the real BPE encoder", () => {
    // "Hello, world!" is 4 tokens under o200k_base (verified against js-tiktoken).
    const result = estimate("Hello, world!", {
      models: ["gpt-4o"],
      outputTokenAssumption: 0,
    });
    expect(result.estimates[0].inputTokens).toBe(4);
    expect(result.estimates[0].isEstimate).toBe(false);
  });

  it("flags Anthropic and Google counts as estimates", () => {
    const result = estimate("The quick brown fox jumps over the lazy dog.", {
      models: ["claude-sonnet", "gemini-1.5-pro", "gpt-4o"],
      outputTokenAssumption: 0,
    });
    const byModel = Object.fromEntries(result.estimates.map((e) => [e.model, e]));
    expect(byModel["claude-sonnet"].isEstimate).toBe(true);
    expect(byModel["gemini-1.5-pro"].isEstimate).toBe(true);
    expect(byModel["gpt-4o"].isEstimate).toBe(false);
  });

  it("returns zero tokens and zero cost for empty text", () => {
    const result = estimate("", {
      models: DEFAULT_MODELS,
      outputTokenAssumption: 500,
    });
    for (const e of result.estimates) {
      expect(e.inputTokens).toBe(0);
      expect(e.inputCost).toBe(0);
      // Output cost is still based on the assumption, but input contributes nothing.
      expect(e.totalCost).toBeCloseTo(e.outputCost, 12);
    }
  });

  it("applies the documented cost formula", () => {
    const result = estimate("The quick brown fox jumps over the lazy dog.", {
      models: ["gpt-4o"],
      outputTokenAssumption: 500,
    });
    const e = result.estimates[0];
    const p = getModelPricing("gpt-4o")!;
    // 10 input tokens under o200k_base (verified).
    expect(e.inputTokens).toBe(10);
    expect(e.inputCost).toBeCloseTo((10 / 1_000_000) * p.inputPer1M, 12);
    expect(e.outputCost).toBeCloseTo((500 / 1_000_000) * p.outputPer1M, 12);
    expect(e.totalCost).toBeCloseTo(e.inputCost + e.outputCost, 12);
  });

  it("respects the output token assumption", () => {
    const low = estimate("Hello, world!", {
      models: ["gpt-4o"],
      outputTokenAssumption: 100,
    }).estimates[0];
    const high = estimate("Hello, world!", {
      models: ["gpt-4o"],
      outputTokenAssumption: 1000,
    }).estimates[0];
    // Same input cost, higher output cost as the assumption grows.
    expect(high.inputCost).toBeCloseTo(low.inputCost, 12);
    expect(high.outputCost).toBeGreaterThan(low.outputCost);
    expect(high.totalCost).toBeGreaterThan(low.totalCost);
  });

  it("collects unknown models instead of throwing", () => {
    const result = estimate("Hello", {
      models: ["gpt-4o", "totally-made-up", "claude-haiku"],
      outputTokenAssumption: 500,
    });
    expect(result.unknownModels).toEqual(["totally-made-up"]);
    expect(result.estimates.map((e) => e.model)).toEqual(["gpt-4o", "claude-haiku"]);
  });

  it("normalizes a negative output assumption to zero", () => {
    const result = estimate("Hello", {
      models: ["gpt-4o"],
      outputTokenAssumption: -50,
    });
    expect(result.outputTokenAssumption).toBe(0);
    expect(result.estimates[0].outputCost).toBe(0);
  });

  it("reports char count and currency", () => {
    const result = estimate("abcde", {
      models: ["gpt-4o"],
      outputTokenAssumption: 0,
      currency: "EUR",
    });
    expect(result.charCount).toBe(5);
    expect(result.currency).toBe("EUR");
  });

  it("flags over-context when input exceeds a small window", () => {
    // gpt-4 has an 8,192-token window; ~20k repeated words blow past it.
    const long = "word ".repeat(20000);
    const e = estimate(long, { models: ["gpt-4"], outputTokenAssumption: 0 }).estimates[0];
    expect(e.contextWindow).toBe(8192);
    expect(e.inputTokens).toBeGreaterThan(8192);
    expect(e.overContext).toBe(true);
  });

  it("does not flag over-context for small input", () => {
    const e = estimate("hello", { models: ["gpt-4o"], outputTokenAssumption: 500 }).estimates[0];
    expect(e.overContext).toBe(false);
  });
});
