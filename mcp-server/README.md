# llm-cost-estimator-mcp

An **MCP (Model Context Protocol) server** that gives Claude, Cursor, or any MCP
client the ability to **count tokens and estimate LLM costs** across GPT-4o,
Claude, Gemini, DeepSeek, Mistral, Llama, Grok, and 25+ models — locally, with no
API key.

It reuses the exact same tokenizer + pricing + estimator core as the
[LLM Cost & Token Estimator VS Code extension](../README.md) in this repo.

## Tools

| Tool | Description |
| --- | --- |
| `estimate_cost` | Token count + cost across multiple models for a piece of text. Returns a Markdown table **and** structured JSON. Args: `text`, `models?`, `outputTokens?`, `currency?`. |
| `count_tokens` | Token count for one model. Args: `text`, `model?`. OpenAI is exact (tiktoken); others are flagged estimates. |
| `list_models` | All model keys with provider, prices (USD/1M), and context window. |

> ⚠️ Prices are representative placeholders — verify against each provider's
> official pricing page. OpenAI counts are exact; all other providers are
> approximated via an OpenAI encoding and flagged as estimates.

## Build

```bash
cd mcp-server
npm install
npm run build      # -> dist/index.js
npm test           # spins up the server and runs a real stdio handshake
```

## Connect it

The server speaks MCP over **stdio**, so any client launches it as a subprocess.
Use the absolute path to `mcp-server/dist/index.js`.

### Claude Desktop

Edit `claude_desktop_config.json`
(Windows: `%APPDATA%\Claude\claude_desktop_config.json`,
macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "llm-cost-estimator": {
      "command": "node",
      "args": ["C:/path/to/llm-cost-estimator/mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop, then ask: _"Estimate the cost of this prompt on GPT-4o vs
Claude Sonnet vs Gemini."_

### Claude Code (CLI)

```bash
claude mcp add llm-cost-estimator -- node /abs/path/to/mcp-server/dist/index.js
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```jsonc
{
  "mcpServers": {
    "llm-cost-estimator": {
      "command": "node",
      "args": ["/abs/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### After publishing to npm (optional)

Once this package is published, clients can launch it without a local build:

```jsonc
{
  "mcpServers": {
    "llm-cost-estimator": { "command": "npx", "args": ["-y", "llm-cost-estimator-mcp"] }
  }
}
```

## License

MIT — see [../LICENSE](../LICENSE).
