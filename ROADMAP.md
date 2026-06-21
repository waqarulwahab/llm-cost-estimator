# Roadmap

Where this project is headed. Items aren't promises — they're an invitation.
Anything here is fair game for a PR; the ones tagged **[good first issue]** are
scoped to be approachable. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## 🎯 Near-term

- [ ] **Live / always-accurate pricing** — fetch current prices from a maintained
      source (e.g. [models.dev](https://models.dev) or the LiteLLM pricing data)
      instead of bundled placeholders, with a local fallback. _Biggest trust win._
- [ ] **Web extension build** — add a `browser` entry + browser bundle so it runs
      in vscode.dev / github.dev. The only blocker is one `Buffer` use in
      `scanWorkspace.ts` (swap to `TextDecoder`). **[good first issue]**
- [ ] **Inline token-count decoration** — show `~N tokens · $X` at the end of the
      selection/line without needing a hover.
- [ ] **Status bar: over-context warning color** — turn the badge a warning color
      when the selection exceeds a model's context window. **[good first issue]**

## 🚀 Mid-term

- [ ] **API-call auto-detection** — detect real SDK calls
      (`openai.chat.completions.create({...})`, `anthropic.messages.create({...})`,
      `model.generateContent(...)`) and estimate the cost of the actual message
      payload. _The killer differentiator the MVP deferred._
- [ ] **Accurate token counts via API (opt-in)** — use Anthropic's
      `count_tokens` and Gemini's `countTokens` endpoints for exact counts when
      an API key is provided (still local-first by default).
- [ ] **Budget / threshold alerts** — warn when a prompt (or a file's total)
      exceeds a configurable cost threshold.
- [ ] **Prompt-caching costs** — model OpenAI/Anthropic cached-input pricing.

## 🤖 MCP server

- [ ] **`scan_directory` tool** — let Claude/Cursor scan a folder for prompt costs.
- [ ] **`compare_prompts` tool** — diff the cost of two prompts.

## 🧰 Smaller / good first issues

- [ ] Add new models / update prices in `pricing.json` (link the source). **[good first issue]**
- [ ] Support `.prompt` and `.txt` files in the hover provider. **[good first issue]**
- [ ] Export the workspace-scan report as **CSV**. **[good first issue]**
- [ ] Add example prompts to [`mcp-server/README.md`](mcp-server/README.md) for each tool. **[good first issue]**
- [ ] More currency symbols + tests in `core/format.ts`. **[good first issue]**

Have an idea that's not here? **Open an issue** — let's talk about it.
