import { describe, it, expect } from "vitest";
import { scanTexts } from "../src/core/scan";

describe("scanTexts", () => {
  it("aggregates prompt sites across files", () => {
    const files = [
      {
        path: "a.ts",
        text: `const systemPrompt = "You are a helpful and concise assistant.";\nconst x = "hi";`,
      },
      {
        path: "b.ts",
        text: `const userMessage = "Explain quantum computing simply, with a fun analogy.";`,
      },
    ];
    const report = scanTexts(files, { models: ["gpt-4o"], outputTokenAssumption: 100 });

    expect(report.filesScanned).toBe(2);
    expect(report.totalPrompts).toBe(2); // "hi" is too short to be a prompt
    expect(report.totalTokens).toBeGreaterThan(0);
    expect(report.totalCost).toBeGreaterThan(0);
    expect(report.modelKey).toBe("gpt-4o");

    const a = report.files.find((f) => f.path === "a.ts")!;
    expect(a.promptCount).toBe(1);
    expect(a.prompts[0].line).toBe(0);
    expect(a.prompts[0].preview).toContain("helpful");
  });

  it("computes correct line numbers for prompts", () => {
    const text = [
      "// header comment",
      "",
      'const p = "You are a careful assistant who writes detailed, structured answers.";',
    ].join("\n");
    const report = scanTexts([{ path: "x.ts", text }], {
      models: ["gpt-4o"],
      outputTokenAssumption: 0,
    });
    expect(report.files[0].prompts[0].line).toBe(2);
  });

  it("sorts files by cost descending", () => {
    const small = `const p = "You are a careful and concise assistant for short tasks here.";`;
    const big = Array.from(
      { length: 5 },
      (_, i) =>
        `const p${i} = "You are a careful, verbose assistant who writes long detailed answers ${i}.";`,
    ).join("\n");
    const report = scanTexts(
      [
        { path: "small.ts", text: small },
        { path: "big.ts", text: big },
      ],
      { models: ["gpt-4o"], outputTokenAssumption: 100 },
    );
    expect(report.files[0].path).toBe("big.ts");
  });

  it("falls back to gpt-4o when configured models are unknown", () => {
    const report = scanTexts(
      [{ path: "x.ts", text: `const systemPrompt = "You are a verbose, helpful assistant bot.";` }],
      { models: ["totally-unknown"], outputTokenAssumption: 0 },
    );
    expect(report.modelKey).toBe("gpt-4o");
    expect(report.totalTokens).toBeGreaterThan(0);
  });

  it("ignores files with no prompt sites", () => {
    const report = scanTexts([{ path: "x.ts", text: `const a = 1; const b = "ok";` }], {
      models: ["gpt-4o"],
      outputTokenAssumption: 0,
    });
    expect(report.totalPrompts).toBe(0);
    expect(report.files).toHaveLength(0);
    expect(report.filesScanned).toBe(1);
  });
});
