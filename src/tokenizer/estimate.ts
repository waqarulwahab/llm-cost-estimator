import type { EncodingName, Provider, Tokenizer } from "./index";
import { countWithEncoding } from "./openai";

/**
 * Generic estimate tokenizer for providers without a reliable public local
 * tokenizer (Anthropic, Google, DeepSeek, Mistral, Meta, xAI, ...). It proxies
 * through an OpenAI encoding (default `cl100k_base`), which is close enough for
 * cost comparison but NOT exact — always flagged with `isEstimate = true`.
 */
export class EstimateTokenizer implements Tokenizer {
  readonly isEstimate = true;

  constructor(
    readonly provider: Provider,
    private readonly encoding: EncodingName = "cl100k_base",
  ) {}

  countTokens(text: string): number {
    return countWithEncoding(text, this.encoding);
  }
}
