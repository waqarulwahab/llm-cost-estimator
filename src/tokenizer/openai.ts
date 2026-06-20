import { Tiktoken, type TiktokenBPE } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";
import type { EncodingName, Provider, Tokenizer } from "./index";

// Only the two encodings we actually need are imported, keeping the bundle small:
//   - o200k_base: GPT-4o / GPT-4o-mini family
//   - cl100k_base: GPT-4 / GPT-4-turbo / GPT-3.5 (and our Claude/Gemini proxy)
const RANKS: Record<EncodingName, TiktokenBPE> = {
  o200k_base: o200k_base as TiktokenBPE,
  cl100k_base: cl100k_base as TiktokenBPE,
};

// Building a Tiktoken instance parses a large BPE table, so we cache one per
// encoding and only construct it on first use. This keeps activation cheap.
const encoderCache = new Map<EncodingName, Tiktoken>();

function getEncoder(encoding: EncodingName): Tiktoken {
  let enc = encoderCache.get(encoding);
  if (!enc) {
    enc = new Tiktoken(RANKS[encoding]);
    encoderCache.set(encoding, enc);
  }
  return enc;
}

/**
 * Counts tokens with a real OpenAI BPE encoder. Exact for OpenAI models.
 * Reused as the approximation engine by the Anthropic/Google estimators.
 */
export function countWithEncoding(text: string, encoding: EncodingName): number {
  if (!text) {
    return 0;
  }
  return getEncoder(encoding).encode(text).length;
}

export class OpenAITokenizer implements Tokenizer {
  readonly provider: Provider = "openai";
  readonly isEstimate = false;

  constructor(private readonly encoding: EncodingName) {}

  countTokens(text: string): number {
    return countWithEncoding(text, this.encoding);
  }
}
