import { describe, it, expect } from "vitest";
import { resultToMarkdown } from "../src/core/export";
import { estimate } from "../src/core/estimator";

describe("resultToMarkdown", () => {
  it("renders a Markdown table with all models", () => {
    const result = estimate("Hello, world!", {
      models: ["gpt-4o", "claude-haiku"],
      outputTokenAssumption: 500,
    });
    const md = resultToMarkdown(result);
    expect(md).toContain("| Model | Tokens | Input | Output | Total |");
    expect(md).toContain("GPT-4o");
    expect(md).toContain("Claude Haiku");
    expect(md).toMatch(/estimate/i);
  });

  it("is a plain string (no VS Code types)", () => {
    const result = estimate("hi", { models: ["gpt-4o"], outputTokenAssumption: 0 });
    expect(typeof resultToMarkdown(result)).toBe("string");
  });
});
