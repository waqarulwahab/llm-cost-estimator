import { describe, it, expect } from "vitest";
import { detectPromptSites, findStringAt, findStrings, isPromptLike } from "../src/core/detect";

describe("findStrings", () => {
  it("finds single, double, and backtick strings", () => {
    const text = `const a = 'one'; let b = "two"; const c = \`three\`;`;
    const spans = findStrings(text);
    expect(spans.map((s) => s.content)).toEqual(["one", "two", "three"]);
    expect(spans.map((s) => s.quote)).toEqual(["'", '"', "`"]);
  });

  it("handles escaped quotes inside strings", () => {
    const text = `const a = "she said \\"hi\\" loudly";`;
    const spans = findStrings(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].content).toBe('she said \\"hi\\" loudly');
  });

  it("supports multi-line template literals", () => {
    const text = ["const p = `line one", "line two", "line three`;"].join("\n");
    const spans = findStrings(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].content).toContain("line one");
    expect(spans[0].content).toContain("line three");
  });

  it("does not treat newlines inside single/double quotes as strings", () => {
    const text = `const a = "unterminated\nconst b = 'ok';`;
    const spans = findStrings(text);
    // The broken double-quoted string is rejected; only 'ok' is found.
    expect(spans.map((s) => s.content)).toEqual(["ok"]);
  });

  it("skips line and block comments", () => {
    const text = [
      `// const fake = "comment string";`,
      `# python_fake = "another"`,
      `/* const block = "blocked"; */`,
      `const real = "kept";`,
    ].join("\n");
    const spans = findStrings(text);
    expect(spans.map((s) => s.content)).toEqual(["kept"]);
  });

  it("captures the preceding identifier", () => {
    const text = `const systemPrompt = "hi"; foo({ content: "yo" }); create("zap");`;
    const spans = findStrings(text);
    const byContent = Object.fromEntries(spans.map((s) => [s.content, s.precedingIdentifier]));
    expect(byContent["hi"]).toBe("systemPrompt");
    expect(byContent["yo"]).toBe("content");
    expect(byContent["zap"]).toBe("create");
  });
});

describe("findStringAt", () => {
  it("returns the string under an offset", () => {
    const text = `const a = "hello world";`;
    const offset = text.indexOf("world");
    const span = findStringAt(text, offset);
    expect(span?.content).toBe("hello world");
  });

  it("returns undefined outside any string", () => {
    const text = `const a = 42;`;
    expect(findStringAt(text, 3)).toBeUndefined();
  });
});

describe("isPromptLike / detectPromptSites", () => {
  it("treats prompt-named identifiers as prompts", () => {
    const spans = findStrings(`const systemPrompt = "Be brief.";`);
    expect(isPromptLike(spans[0])).toBe(true);
  });

  it("treats long multi-word strings as prompts", () => {
    const long = "You are a helpful assistant that summarizes text into three bullet points.";
    const spans = findStrings(`const x = "${long}";`);
    expect(isPromptLike(spans[0])).toBe(true);
  });

  it("ignores short config strings and paths", () => {
    const spans = findStrings(`const enc = "utf-8"; const p = "./src/index.ts";`);
    expect(spans.every((s) => !isPromptLike(s))).toBe(true);
  });

  it("detects multiple prompt sites in a snippet", () => {
    const code = [
      `const systemPrompt = "You are concise.";`,
      `const greeting = "hi";`,
      `const userMessage = "Explain transformers like I am five years old, with an analogy.";`,
    ].join("\n");
    const sites = detectPromptSites(code);
    expect(sites.map((s) => s.precedingIdentifier)).toEqual(["systemPrompt", "userMessage"]);
  });
});
