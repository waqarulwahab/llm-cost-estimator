import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Reuse the EXACT same vscode-free core that powers the VS Code extension.
import { estimate } from "../../src/core/estimator";
import { resultToMarkdown } from "../../src/core/export";
import { getModelPricing, listModels } from "../../src/pricing/pricing";

const DEFAULT_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-sonnet",
  "claude-haiku",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

const server = new McpServer({ name: "llm-cost-estimator", version: "0.3.0" });

server.registerTool(
  "estimate_cost",
  {
    title: "Estimate LLM cost",
    description:
      "Count tokens and estimate the cost of a prompt/text across multiple LLM models " +
      "(GPT-4o, Claude, Gemini, DeepSeek, Mistral, Llama, Grok, and more). OpenAI token " +
      "counts are exact (tiktoken); other providers are approximations and are flagged. " +
      "Returns a Markdown comparison table plus structured JSON.",
    inputSchema: {
      text: z.string().describe("The prompt or text to measure."),
      models: z
        .array(z.string())
        .optional()
        .describe(
          "Model keys to compare (e.g. gpt-4o, claude-sonnet, gemini-2.5-pro). " +
            "Omit for a sensible default set. Call list_models to see all keys.",
        ),
      outputTokens: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Assumed output/completion tokens used for the total cost (default 500)."),
      currency: z.string().optional().describe("Currency label (default USD; display only)."),
    },
  },
  async ({ text, models, outputTokens, currency }) => {
    const result = estimate(text, {
      models: models && models.length > 0 ? models : DEFAULT_MODELS,
      outputTokenAssumption: outputTokens ?? 500,
      currency: currency ?? "USD",
    });

    const json = {
      charCount: result.charCount,
      outputTokenAssumption: result.outputTokenAssumption,
      currency: result.currency,
      estimates: result.estimates.map((e) => ({
        model: e.model,
        label: e.label,
        provider: e.provider,
        isEstimate: e.isEstimate,
        inputTokens: e.inputTokens,
        inputCost: e.inputCost,
        outputCost: e.outputCost,
        totalCost: e.totalCost,
        overContext: e.overContext,
      })),
      unknownModels: result.unknownModels,
    };

    const body = `${resultToMarkdown(result)}\n\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``;
    return { content: [{ type: "text", text: body }] };
  },
);

server.registerTool(
  "count_tokens",
  {
    title: "Count tokens",
    description:
      "Count the tokens in a text for one model. OpenAI is exact (tiktoken); other " +
      "providers are approximated via an OpenAI encoding and flagged as estimates.",
    inputSchema: {
      text: z.string().describe("Text to tokenize."),
      model: z.string().optional().describe("Model key (default gpt-4o). See list_models."),
    },
  },
  async ({ text, model }) => {
    const key = model ?? "gpt-4o";
    const e = estimate(text, { models: [key], outputTokenAssumption: 0 }).estimates[0];
    if (!e) {
      return {
        content: [
          { type: "text", text: `Unknown model "${key}". Call list_models for valid keys.` },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              model: e.model,
              label: e.label,
              provider: e.provider,
              tokens: e.inputTokens,
              isEstimate: e.isEstimate,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "list_models",
  {
    title: "List models",
    description:
      "List every available model key with provider, prices (USD per 1M tokens), and " +
      "context window. Note: prices are representative placeholders — verify with each provider.",
    inputSchema: {},
  },
  async () => {
    const models = listModels().map((k) => {
      const p = getModelPricing(k)!;
      return {
        key: k,
        label: p.label,
        provider: p.provider,
        inputPer1M: p.inputPer1M,
        outputPer1M: p.outputPer1M,
        contextWindow: p.contextWindow ?? null,
        exactTokenization: p.provider === "openai",
      };
    });
    return { content: [{ type: "text", text: JSON.stringify(models, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
// IMPORTANT: stdout is the JSON-RPC channel — logs MUST go to stderr only.
console.error("llm-cost-estimator MCP server running on stdio");
