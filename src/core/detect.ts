// Pure, VS Code-free detection of string literals and "prompt-like" sites in
// source text. Powers the CodeLens provider and the multi-line hover. Kept here
// (no vscode import) so it can be unit-tested directly.

export type Quote = "'" | '"' | "`";

export interface StringSpan {
  /** Offset of the first content character (just after the opening quote). */
  contentStart: number;
  /** Offset just past the last content character (the closing quote). */
  contentEnd: number;
  quote: Quote;
  /** Raw inner text (no unescaping). */
  content: string;
  /** Nearest identifier/key before the string (e.g. `systemPrompt`, `content`). */
  precedingIdentifier?: string;
}

const IDENT_CHAR = /[\w$]/;
const WHITESPACE = /\s/;

// Identifiers that strongly suggest a prompt/message string.
const PROMPT_IDENTIFIER =
  /prompt|system|instruction|messages?|content|template|query|question|context|completion|persona|preamble|role|chat/i;

function endOfLine(text: string, i: number): number {
  const nl = text.indexOf("\n", i);
  return nl === -1 ? text.length : nl;
}

function precedingIdentifier(text: string, quoteIndex: number): string | undefined {
  let k = quoteIndex - 1;
  while (k >= 0 && WHITESPACE.test(text[k])) {
    k--;
  }
  // Step over a single connector (assignment, key colon, call/array open).
  if (k >= 0 && "=:(,[{".includes(text[k])) {
    k--;
    while (k >= 0 && WHITESPACE.test(text[k])) {
      k--;
    }
  }
  const end = k + 1;
  while (k >= 0 && IDENT_CHAR.test(text[k])) {
    k--;
  }
  const id = text.slice(k + 1, end);
  return id.length > 0 ? id : undefined;
}

/**
 * Scans source text and returns every string literal span. Handles `'`, `"`,
 * and backtick strings (the latter may span multiple lines), respects escapes,
 * and skips `//`, `#`, and block comments to reduce false positives.
 */
export function findStrings(text: string): StringSpan[] {
  const spans: StringSpan[] = [];
  const n = text.length;
  let i = 0;

  while (i < n) {
    const c = text[i];

    // Comments.
    if (c === "/" && text[i + 1] === "/") {
      i = endOfLine(text, i);
      continue;
    }
    if (c === "#") {
      i = endOfLine(text, i);
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }

    // Strings.
    if (c === "'" || c === '"' || c === "`") {
      const quote = c as Quote;
      const start = i + 1;
      let j = start;
      let terminated = false;
      while (j < n) {
        const cj = text[j];
        if (cj === "\\") {
          j += 2;
          continue;
        }
        if (cj === "\n" && quote !== "`") {
          break; // ' and " cannot span newlines — not a valid string
        }
        if (cj === quote) {
          terminated = true;
          break;
        }
        j++;
      }
      if (terminated) {
        spans.push({
          contentStart: start,
          contentEnd: j,
          quote,
          content: text.slice(start, j),
          precedingIdentifier: precedingIdentifier(text, i),
        });
        i = j + 1;
      } else {
        i += 1;
      }
      continue;
    }

    i += 1;
  }

  return spans;
}

/** Returns the string span containing `offset`, if any. */
export function findStringAt(text: string, offset: number): StringSpan | undefined {
  for (const span of findStrings(text)) {
    if (offset >= span.contentStart && offset <= span.contentEnd) {
      return span;
    }
    if (span.contentStart > offset) {
      break; // spans are in order; no need to look further
    }
  }
  return undefined;
}

function looksLikePathOrUrl(s: string): boolean {
  const t = s.trim();
  if (/\s/.test(t)) {
    return false; // has spaces -> prose, not a path
  }
  return /^(https?:\/\/|\.{0,2}\/|[\w.-]+\/)/.test(t) || /\.[a-z]{1,5}$/i.test(t);
}

/** Heuristic: does this string look like an LLM prompt rather than config noise? */
export function isPromptLike(span: StringSpan): boolean {
  const t = span.content.trim();
  if (t.length === 0) {
    return false;
  }
  if (span.precedingIdentifier && PROMPT_IDENTIFIER.test(span.precedingIdentifier)) {
    return true;
  }
  if (looksLikePathOrUrl(t) && t.length < 60) {
    return false;
  }
  // Long, multi-word strings are very likely prompts.
  return t.length >= 60 && /\s/.test(t);
}

/** All prompt-like string sites in the text, in document order. */
export function detectPromptSites(text: string): StringSpan[] {
  return findStrings(text).filter(isPromptLike);
}
