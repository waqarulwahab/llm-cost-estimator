import { describe, it, expect } from "vitest";
import { buildLiveOverrides } from "../src/core/livePricing";
import { loadPricing } from "../src/pricing/pricing";

describe("buildLiveOverrides", () => {
  it("maps per-token source costs to per-1M overrides for models with a liveId", () => {
    const source = {
      "gpt-4o": {
        input_cost_per_token: 0.0000025,
        output_cost_per_token: 0.00001,
        max_input_tokens: 128000,
      },
      "claude-sonnet-4-20250514": {
        input_cost_per_token: 0.000003,
        output_cost_per_token: 0.000015,
        max_input_tokens: 200000,
      },
    };
    const { overrides, updated } = buildLiveOverrides(source, loadPricing());

    expect(overrides["gpt-4o"].inputPer1M).toBeCloseTo(2.5, 6);
    expect(overrides["gpt-4o"].outputPer1M).toBeCloseTo(10, 6);
    expect(overrides["gpt-4o"].contextWindow).toBe(128000);
    expect(overrides["claude-sonnet"].inputPer1M).toBeCloseTo(3, 6);
    expect(overrides["claude-sonnet"].outputPer1M).toBeCloseTo(15, 6);
    expect(updated).toEqual(expect.arrayContaining(["gpt-4o", "claude-sonnet"]));
  });

  it("skips models whose liveId is absent from the source", () => {
    const { overrides, skipped } = buildLiveOverrides({}, loadPricing());
    expect(Object.keys(overrides)).toHaveLength(0);
    expect(skipped).toContain("gpt-4o"); // has a liveId but no source entry
  });

  it("ignores models without a liveId (they keep bundled prices)", () => {
    // claude-haiku has no liveId in pricing.json
    const { overrides } = buildLiveOverrides(
      { "claude-3-5-haiku": { input_cost_per_token: 1, output_cost_per_token: 1 } },
      loadPricing(),
    );
    expect(overrides["claude-haiku"]).toBeUndefined();
  });

  it("rejects invalid or negative costs", () => {
    const { overrides, skipped } = buildLiveOverrides(
      { "gpt-4o": { input_cost_per_token: -1, output_cost_per_token: 0.00001 } },
      loadPricing(),
    );
    expect(overrides["gpt-4o"]).toBeUndefined();
    expect(skipped).toContain("gpt-4o");
  });

  it("falls back to max_tokens when max_input_tokens is missing", () => {
    const { overrides } = buildLiveOverrides(
      {
        "gpt-4o": {
          input_cost_per_token: 0.000001,
          output_cost_per_token: 0.000002,
          max_tokens: 64000,
        },
      },
      loadPricing(),
    );
    expect(overrides["gpt-4o"].contextWindow).toBe(64000);
  });
});
