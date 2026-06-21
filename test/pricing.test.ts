import { describe, it, expect, afterEach } from "vitest";
import {
  coerceModelPricing,
  computeCost,
  getModelPricing,
  listModels,
  loadPricing,
  setCustomModels,
  setLivePricing,
  type ModelPricing,
} from "../src/pricing/pricing";

const fakePricing: ModelPricing = {
  key: "fake",
  label: "Fake",
  provider: "openai",
  encoding: "o200k_base",
  inputPer1M: 2.0, // $2.00 per 1M input tokens
  outputPer1M: 8.0, // $8.00 per 1M output tokens
};

describe("computeCost", () => {
  it("computes input cost as tokens / 1e6 * inputPer1M", () => {
    const { inputCost } = computeCost(1_000_000, 0, fakePricing);
    expect(inputCost).toBeCloseTo(2.0, 10);
  });

  it("computes output cost as tokens / 1e6 * outputPer1M", () => {
    const { outputCost } = computeCost(0, 1_000_000, fakePricing);
    expect(outputCost).toBeCloseTo(8.0, 10);
  });

  it("total is input + output", () => {
    const { inputCost, outputCost, totalCost } = computeCost(500_000, 250_000, fakePricing);
    expect(inputCost).toBeCloseTo(1.0, 10);
    expect(outputCost).toBeCloseTo(2.0, 10);
    expect(totalCost).toBeCloseTo(3.0, 10);
  });

  it("is zero for zero tokens", () => {
    expect(computeCost(0, 0, fakePricing)).toEqual({
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
    });
  });

  it("scales linearly with token count", () => {
    const a = computeCost(1000, 1000, fakePricing).totalCost;
    const b = computeCost(2000, 2000, fakePricing).totalCost;
    expect(b).toBeCloseTo(a * 2, 10);
  });
});

describe("pricing table", () => {
  it("loads the bundled models", () => {
    const table = loadPricing();
    expect(Object.keys(table).length).toBeGreaterThan(0);
    expect(table["gpt-4o"]).toBeDefined();
  });

  it("exposes the default MVP models", () => {
    for (const key of ["gpt-4o", "claude-sonnet", "claude-haiku"]) {
      const p = getModelPricing(key);
      expect(p, `expected pricing for ${key}`).toBeDefined();
    }
  });

  it("returns undefined for unknown models", () => {
    expect(getModelPricing("not-a-real-model")).toBeUndefined();
  });

  it("every entry has positive, well-formed numbers and a valid provider", () => {
    const validProviders = new Set([
      "openai",
      "anthropic",
      "google",
      "deepseek",
      "mistral",
      "meta",
      "xai",
      "cohere",
    ]);
    const validEncodings = new Set(["o200k_base", "cl100k_base"]);
    for (const key of listModels()) {
      const p = getModelPricing(key)!;
      expect(p.key).toBe(key);
      expect(p.label.length).toBeGreaterThan(0);
      expect(validProviders.has(p.provider)).toBe(true);
      expect(validEncodings.has(p.encoding)).toBe(true);
      expect(p.inputPer1M).toBeGreaterThan(0);
      expect(p.outputPer1M).toBeGreaterThan(0);
    }
  });

  it("maps Anthropic/Google entries to a proxy encoding (estimates)", () => {
    expect(getModelPricing("claude-sonnet")!.provider).toBe("anthropic");
    expect(getModelPricing("gemini-1.5-pro")!.provider).toBe("google");
  });

  it("includes a broad, multi-provider catalog", () => {
    const providers = new Set(listModels().map((k) => getModelPricing(k)!.provider));
    expect(providers.has("openai")).toBe(true);
    expect(providers.has("anthropic")).toBe(true);
    expect(providers.has("google")).toBe(true);
    expect(providers.has("deepseek")).toBe(true);
    expect(listModels().length).toBeGreaterThanOrEqual(20);
  });

  it("exposes a context window for built-in models", () => {
    expect(getModelPricing("gpt-4")!.contextWindow).toBe(8192);
    expect(getModelPricing("claude-sonnet")!.contextWindow).toBeGreaterThan(0);
  });
});

describe("custom models", () => {
  afterEach(() => setCustomModels({})); // reset overrides between tests

  it("adds a valid custom model that estimate can use", () => {
    const { added, errors } = setCustomModels({
      "my-model": { label: "My Model", provider: "openai", inputPer1M: 1, outputPer1M: 2 },
    });
    expect(added).toEqual(["my-model"]);
    expect(errors).toEqual([]);
    expect(getModelPricing("my-model")?.label).toBe("My Model");
    expect(listModels()).toContain("my-model");
  });

  it("rejects malformed entries and reports them", () => {
    const { added, errors } = setCustomModels({
      good: { label: "Good", provider: "openai", inputPer1M: 1, outputPer1M: 2 },
      missingPrices: { provider: "openai" },
      negative: { provider: "openai", inputPer1M: -1, outputPer1M: 2 },
    });
    expect(added).toEqual(["good"]);
    expect(errors.sort()).toEqual(["missingPrices", "negative"]);
  });

  it("lets a custom entry override a built-in model", () => {
    setCustomModels({
      "gpt-4o": {
        label: "GPT-4o (corp rate)",
        provider: "openai",
        inputPer1M: 99,
        outputPer1M: 99,
      },
    });
    expect(getModelPricing("gpt-4o")?.inputPer1M).toBe(99);
  });

  it("coerce picks an encoding by provider when omitted", () => {
    expect(
      coerceModelPricing("a", { provider: "openai", inputPer1M: 1, outputPer1M: 1 })?.encoding,
    ).toBe("o200k_base");
    expect(
      coerceModelPricing("b", { provider: "anthropic", inputPer1M: 1, outputPer1M: 1 })?.encoding,
    ).toBe("cl100k_base");
    expect(coerceModelPricing("c", { provider: "openai" })).toBeUndefined();
  });
});

describe("live pricing overrides", () => {
  afterEach(() => {
    setLivePricing({});
    setCustomModels({});
  });

  it("applies live price/context overrides while preserving label/provider", () => {
    setLivePricing({ "gpt-4o": { inputPer1M: 99, outputPer1M: 199, contextWindow: 111 } });
    const p = getModelPricing("gpt-4o")!;
    expect(p.inputPer1M).toBe(99);
    expect(p.outputPer1M).toBe(199);
    expect(p.contextWindow).toBe(111);
    expect(p.label).toBe("GPT-4o");
    expect(p.provider).toBe("openai");
  });

  it("lets a user custom model win over live overrides", () => {
    setLivePricing({ "gpt-4o": { inputPer1M: 99, outputPer1M: 199 } });
    setCustomModels({
      "gpt-4o": { label: "GPT-4o (mine)", provider: "openai", inputPer1M: 1, outputPer1M: 2 },
    });
    expect(getModelPricing("gpt-4o")!.inputPer1M).toBe(1);
  });

  it("exposes liveId for mapped models", () => {
    expect(getModelPricing("gpt-4o")!.liveId).toBe("gpt-4o");
    expect(getModelPricing("claude-haiku")!.liveId).toBeUndefined();
  });
});
