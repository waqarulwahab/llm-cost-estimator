import type { Provider, Tokenizer } from "./index";
import { countWithEncoding } from "./openai";

/**
 * Google does not ship a reliable, public local tokenizer for Gemini. We
 * approximate Gemini's token count using OpenAI's `cl100k_base` BPE, which is
 * close enough for *cost estimation* but is NOT exact. The result is always
 * flagged with `isEstimate = true` so the UI can label it clearly.
 *
 * An optional API-based accurate mode (Gemini's countTokens endpoint) is a
 * future enhancement, not part of the local-first MVP.
 */
export class GoogleTokenizer implements Tokenizer {
  readonly provider: Provider = "google";
  readonly isEstimate = true;

  countTokens(text: string): number {
    return countWithEncoding(text, "cl100k_base");
  }
}
