import type { Provider, Tokenizer } from "./index";
import { countWithEncoding } from "./openai";

/**
 * Anthropic does not ship a reliable, public local tokenizer for Claude. We
 * approximate Claude's token count using OpenAI's `cl100k_base` BPE, which is
 * close enough for *cost estimation* but is NOT exact. The result is always
 * flagged with `isEstimate = true` so the UI can label it clearly.
 *
 * An optional API-based accurate mode (Anthropic's token-counting endpoint) is
 * a future enhancement, not part of the local-first MVP.
 */
export class AnthropicTokenizer implements Tokenizer {
  readonly provider: Provider = "anthropic";
  readonly isEstimate = true;

  countTokens(text: string): number {
    return countWithEncoding(text, "cl100k_base");
  }
}
