import { OpenAITokenizer } from "./openai";
import { AnthropicTokenizer } from "./anthropic";
import { GoogleTokenizer } from "./google";
import { EstimateTokenizer } from "./estimate";

/**
 * Supported LLM providers. `openai` is tokenized exactly; every other provider
 * is approximated (see {@link EstimateTokenizer}). The `(string & {})` member
 * keeps the literal hints while allowing new providers in `pricing.json` without
 * a code change.
 */
export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "meta"
  | "deepseek"
  | "xai"
  | "cohere"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

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
   * tokenization (everything except OpenAI). The UI must label these.
   */
  readonly isEstimate: boolean;
  /** Count tokens for `text`. Returns 0 for empty input. */
  countTokens(text: string): number;
}

/**
 * Returns a tokenizer for the given provider. Only OpenAI gets exact BPE
 * tokenization; Anthropic and Google have dedicated (estimate) classes for
 * clarity, and any other provider falls back to a generic estimate.
 */
export function getTokenizer(provider: Provider, encoding: EncodingName = "o200k_base"): Tokenizer {
  switch (provider) {
    case "openai":
      return new OpenAITokenizer(encoding);
    case "anthropic":
      return new AnthropicTokenizer();
    case "google":
      return new GoogleTokenizer();
    default:
      return new EstimateTokenizer(provider, encoding);
  }
}
