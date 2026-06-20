import { describe, it, expect } from "vitest";
import { estimate } from "../src/core/estimator";
import { detectPromptSites, findStrings } from "../src/core/detect";
import { scanTexts } from "../src/core/scan";
import { listModels } from "../src/pricing/pricing";

// Generous thresholds: they catch quadratic/regression blow-ups without being
// flaky on slower machines. Numbers below are comfortably met locally.
describe("load / performance", () => {
  it("tokenizes a large (~1 MB) input within budget", () => {
    const big = "The quick brown fox jumps over the lazy dog. ".repeat(22000);
    expect(big.length).toBeGreaterThan(900_000);
    const t0 = performance.now();
    const result = estimate(big, {
      models: ["gpt-4o", "claude-sonnet", "gemini-2.5-pro"],
      outputTokenAssumption: 500,
    });
    const ms = performance.now() - t0;
    expect(result.estimates[0].inputTokens).toBeGreaterThan(100_000);
    expect(ms).toBeLessThan(8000);
  });

  it("estimates the entire catalog quickly via encoding cache", () => {
    const text = "You are a helpful assistant. ".repeat(2000);
    const all = listModels();
    expect(all.length).toBeGreaterThanOrEqual(25);
    const t0 = performance.now();
    const result = estimate(text, { models: all, outputTokenAssumption: 500 });
    const ms = performance.now() - t0;
    expect(result.estimates).toHaveLength(all.length);
    // Only 2 encodings are used, so this should be far faster than N tokenizations.
    expect(ms).toBeLessThan(4000);
  });

  it("detects strings in a 5,000-string file without pathological slowdown", () => {
    const file = Array.from(
      { length: 5000 },
      (_, i) => `const p${i} = "You are assistant ${i}, who writes concise and helpful answers.";`,
    ).join("\n");
    const t0 = performance.now();
    const spans = findStrings(file);
    const ms = performance.now() - t0;
    expect(spans).toHaveLength(5000);
    expect(detectPromptSites(file).length).toBe(5000);
    expect(ms).toBeLessThan(2000);
  });

  it("handles pathological input safely (unterminated quotes, huge token)", () => {
    const nasty =
      '"' + "a".repeat(500_000) + "\n" + "'".repeat(20_000) + "\n`" + "x".repeat(50_000);
    const t0 = performance.now();
    expect(() => findStrings(nasty)).not.toThrow();
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it("scans 500 files quickly", () => {
    const files = Array.from({ length: 500 }, (_, i) => ({
      path: `src/file-${i}.ts`,
      text:
        `const systemPrompt = "You are bot ${i}, a careful and concise assistant for end users.";\n` +
        `const greeting = "hi";\n` +
        `const userMessage = "Please summarize the following article in three short bullet points (${i}).";`,
    }));
    const t0 = performance.now();
    const report = scanTexts(files, { models: ["gpt-4o"], outputTokenAssumption: 200 });
    const ms = performance.now() - t0;
    expect(report.filesScanned).toBe(500);
    expect(report.totalPrompts).toBe(1000); // 2 prompt-like strings per file
    expect(report.totalCost).toBeGreaterThan(0);
    expect(ms).toBeLessThan(6000);
  });

  it("sustains throughput over 2,000 small estimates", () => {
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) {
      estimate("Summarize this text in exactly one short sentence.", {
        models: ["gpt-4o", "claude-haiku"],
        outputTokenAssumption: 100,
      });
    }
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(6000);
  });
});
