# Promotion & Launch Kit

Ready-to-paste copy and a checklist for getting users. Do **step 1 (ship)** first
— nothing here matters until the artifacts are installable.

## 0. One-line pitch

> **Stop guessing what your prompts cost.** See token counts and price across
> GPT-4o vs Claude vs Gemini (25+ models) — right in your editor _and_ inside
> Claude/Cursor via MCP. Local-first, no API key.

---

## 1. Where to list it (discovery checklist)

### The extension

- [ ] **VS Code Marketplace** — `vsce publish` (see [PUBLISHING.md](../PUBLISHING.md))
- [ ] **Open VSX** — `ovsx publish` (this is what Cursor / Windsurf / VSCodium use)

### The MCP server (the "Claude era" channel)

- [ ] **npm** — `npm publish` so `npx -y llm-cost-estimator-mcp` works
- [ ] **Official MCP Registry** — publish [`mcp-server/server.json`](../mcp-server/server.json)
      with the [`mcp-publisher`](https://github.com/modelcontextprotocol/registry) CLI
- [ ] **Smithery** — connect the repo; [`mcp-server/smithery.yaml`](../mcp-server/smithery.yaml) is ready
- [ ] **mcp.so**, **Glama**, **PulseMCP** — submit the GitHub repo (they index automatically too)
- [ ] **`awesome-mcp-servers`** — open a PR with the entry below

**awesome-mcp-servers entry** (add under the relevant category; legend: 📇 TypeScript, 🏠 local):

```markdown
- [waqarulwahab/llm-cost-estimator](https://github.com/waqarulwahab/llm-cost-estimator) 📇 🏠 - Count tokens and estimate LLM cost across GPT-4o, Claude, Gemini, and 25+ models. Local-first, no API key.
```

---

## 2. Launch posts

### Show HN

**Title:** `Show HN: Token + cost estimator for LLM prompts, in your editor and in Claude`

**Text:**

> I build a lot of LLM features and kept guessing what a prompt would cost — or
> tabbing out to a billing dashboard after the fact. So I built a local-first
> token + cost estimator.
>
> It does two things from one shared core:
>
> - **VS Code extension** — hover a prompt (or select text) to see token count and
>   cost across GPT-4o, Claude, Gemini, DeepSeek, and 25+ models, side by side.
>   Plus a CodeLens above prompts, a live status-bar figure, a comparison panel
>   with an output-token slider, and a "scan the whole workspace" cost report.
> - **MCP server** — the same engine as a tool for Claude/Cursor, so you can ask
>   "what does this prompt cost on GPT-4o vs Claude vs Gemini?" right in chat.
>
> OpenAI counts are exact (tiktoken); other providers are approximated and clearly
> labeled. No API key, fully offline. MIT.
>
> Repo: https://github.com/waqarulwahab/llm-cost-estimator
>
> Prices ship as editable placeholders (with a "verify these" note) — feedback and
> pricing PRs very welcome.

### Reddit — r/LocalLLaMA, r/ChatGPTCoding, r/vscode

**Title:** `I built a token + cost estimator that lives in your editor AND in Claude/Cursor (MCP)`

**Body:**

> Tired of guessing prompt costs, I made an open-source, local-first estimator.
>
> - **In the editor (VS Code/Cursor):** hover a prompt → token count + cost across
>   **GPT-4o, Claude, Gemini, DeepSeek, Mistral, Llama, Grok** (25+ models), cheapest
>   first. CodeLens on prompts, live status bar, a comparison panel with an
>   output-token slider, and a workspace-wide "what do all my prompts cost" scan.
> - **In Claude/Cursor:** it's also an **MCP server** (`npx -y llm-cost-estimator-mcp`)
>   with `estimate_cost`, `count_tokens`, `list_models` tools.
>
> OpenAI tokenization is exact; others are approximations (clearly flagged). No API
> key, runs offline. MIT-licensed.
>
> GitHub: https://github.com/waqarulwahab/llm-cost-estimator
>
> Would love feedback — especially on which models/providers to add next.

### X / Twitter thread

1/ I kept guessing what my LLM prompts cost. So I built a local-first token + cost
estimator that works in two places devs already are: your editor and your AI chat. 🧵

2/ In VS Code / Cursor: hover any prompt → token count + cost across GPT-4o, Claude,
Gemini, DeepSeek + 25 more, side by side. CodeLens on prompts, a live status-bar
figure, and a comparison panel with an output-token slider.

3/ The "Claude era" part: it's also an MCP server. Drop it into Claude Desktop or
Cursor and just ask: "what does this prompt cost on GPT-4o vs Claude vs Gemini?"
`npx -y llm-cost-estimator-mcp`

4/ OpenAI counts are exact (tiktoken); other providers are approximated and clearly
labeled. No API key. Fully offline. MIT.

5/ Open source — stars, issues, and pricing PRs welcome 🙏
https://github.com/waqarulwahab/llm-cost-estimator

---

## 3. Tips

- Post the **demo** ([images/demo.svg](../images/demo.svg)) — visuals convert.
- Lead with the pain ("I kept guessing…"), not the feature list.
- Reply fast to the first comments; early engagement drives ranking.
- Pin a "verify the prices" note — honesty builds trust for a cost tool.
