import { OpenAITokenizer } from "./openai";
import { AnthropicTokenizer } from "./anthropic";
import { GoogleTokenizer } from "./google";

/** Supported LLM providers. */
export type Provider = "openai" | "anthropic" | "google";

/** OpenAI BPE encodings we support locally. */
export type EncodingName = "o200k_base" | "cl100k_base";

/**
 * Pluggable tokenizer contract. Each provider supplies an implementation; the
 * factory below wires the right one based on a pricing entry's provider.
 */
export interface Tokenizer {
  readonly provider: Provider;
  /**
   * `true` when the count is an approximation rather than the provider's exact
   * tokenization (currently Anthropic and Google). The UI must label these.
   */
  readonly isEstimate: boolean;
  /** Count tokens for `text`. Returns 0 for empty input. */
  countTokens(text: string): number;
}

/**
 * Returns a tokenizer for the given provider. `encoding` is only meaningful for
 * OpenAI (real BPE); the estimate-based providers ignore it and use a fixed
 * proxy encoding internally.
 */
export function getTokenizer(
  provider: Provider,
  encoding: EncodingName = "o200k_base",
): Tokenizer {
  switch (provider) {
    case "openai":
      return new OpenAITokenizer(encoding);
    case "anthropic":
      return new AnthropicTokenizer();
    case "google":
      return new GoogleTokenizer();
    default: {
      // Exhaustiveness guard: adding a Provider without a case is a type error.
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${String(_exhaustive)}`);
    }
  }
}
