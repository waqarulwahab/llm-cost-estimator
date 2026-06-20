# LLM Cost & Token Estimator

> See how many tokens your prompt uses — and what it'll cost on **GPT-4o vs. Claude vs. Gemini** — right inside VS Code. No API key, no billing dashboard, no guessing.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Why this exists

When you're building an LLM-powered app, two questions come up constantly: _how
many tokens is this prompt?_ and _what will this call cost?_ Today you either
guess, paste into a web tokenizer, or check the provider's billing console after
the fact — all of which pull you out of your editor.

This extension answers both questions **inline**, and it answers them for
**several models at once**, so you can make a real price/quality trade-off
("~$X on GPT-4o, ~$Y on Claude Sonnet, ~$Z on Claude Haiku") without leaving the
file you're working in. It's local-first and works with zero configuration — no
API key required.

## Demo

<!-- TODO: add demo.gif -->

_A short GIF showing the hover tooltip and the status bar in action goes here._

## Features

- **🔀 Multi-model cost comparison** — token count + estimated cost across all
  your configured models, side by side. This is the whole point.
- **🛈 Hover tooltip** — hover over a selection or a string literal (in JS/TS/
  Python) to see the comparison inline. The primary, native-feeling interaction.
- **📊 Status bar running total** — a live, session-long estimated cost total.
  Click it to re-open the last breakdown.
- **⌨️ `Estimate Selection` command** — select text, run the command, get a
  per-model breakdown in a QuickPick. Select a row to copy a summary.
- **🔒 Local-first, zero config** — exact OpenAI tokenization runs entirely on
  your machine; pricing is bundled. No network calls, no API key.

### A note on accuracy

- **OpenAI** models use **real** BPE tokenization (`o200k_base` for the GPT-4o
  family, `cl100k_base` for GPT-4 / GPT-3.5) via
  [`js-tiktoken`](https://github.com/dqbd/tiktoken).
- **Anthropic** and **Google** do not publish reliable local tokenizers, so
  their counts are **approximated** using an OpenAI encoding and are clearly
  marked with a `~` and a disclaimer in the UI. They're great for ballpark cost
  comparison, not for exact billing. (An optional API-based accurate mode is a
  candidate for a future release.)

## Install

**From the Marketplace** (once published):

1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **"LLM Cost & Token Estimator"**.
3. Click **Install**.

**From a `.vsix`:**

```bash
code --install-extension llm-cost-estimator-0.1.0.vsix
```

**From source (for development):** see [Contributing](#contributing).

## Usage

- **Hover:** select some text, or simply hover over a string literal, in a JS/TS/
  Python file. A tooltip shows the per-model token count and cost.
- **Command:** select text → open the Command Palette (`Ctrl+Shift+P`) →
  **LLM Cost: Estimate Selection**. With nothing selected, it estimates the
  whole file. (Also available via the editor right-click menu.)
- **Status bar:** the running total updates each time you run an estimate. Click
  it to re-open the last breakdown, or run **LLM Cost: Reset Session Total**.

> **How "total" is calculated:** cost = input tokens + an _assumed_ number of
> output tokens (output pricing is usually higher than input, so it matters).
> The assumption is configurable and always shown in the tooltip.
>
> ```
> cost = (inputTokens  / 1e6) * inputPer1M
>      + (outputTokens / 1e6) * outputPer1M
> ```

## Settings

All settings live under `llmCostEstimator.*`:

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `llmCostEstimator.models` | `string[]` | `["gpt-4o", "claude-sonnet", "claude-haiku"]` | Models to compare. Each entry must be a key in [`pricing.json`](src/pricing/pricing.json). |
| `llmCostEstimator.outputTokenAssumption` | `number` | `500` | Assumed output (completion) tokens used for the total-cost calculation. |
| `llmCostEstimator.currency` | `string` | `"USD"` | Currency label shown next to costs. Display only — does **not** convert (pricing is in USD). |
| `llmCostEstimator.enableHover` | `boolean` | `true` | Show the hover tooltip. |

**Available model keys** (out of the box): `gpt-4o`, `gpt-4o-mini`,
`gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `claude-opus`, `claude-sonnet`,
`claude-haiku`, `gemini-1.5-pro`, `gemini-1.5-flash`.

Example `settings.json`:

```jsonc
{
  "llmCostEstimator.models": ["gpt-4o", "gpt-4o-mini", "claude-sonnet", "gemini-1.5-flash"],
  "llmCostEstimator.outputTokenAssumption": 800,
  "llmCostEstimator.currency": "USD"
}
```

## Updating pricing

> ⚠️ **The bundled prices are representative placeholders and change
> frequently. Verify them against each provider's official pricing page before
> relying on them.**
>
> - OpenAI — <https://openai.com/api/pricing/>
> - Anthropic — <https://www.anthropic.com/pricing>
> - Google — <https://ai.google.dev/pricing>

Prices live in [`src/pricing/pricing.json`](src/pricing/pricing.json), keyed by
model alias. Each entry looks like:

```json
"gpt-4o": {
  "label": "GPT-4o",
  "provider": "openai",
  "encoding": "o200k_base",
  "inputPer1M": 2.5,
  "outputPer1M": 10.0
}
```

- `inputPer1M` / `outputPer1M` are **USD per 1,000,000 tokens**.
- `provider` is `openai`, `anthropic`, or `google` (determines the tokenizer and
  whether the count is exact or an estimate).
- `encoding` is the BPE used to count tokens — `o200k_base` or `cl100k_base`.
  For Anthropic/Google it's only an approximation proxy.

To add a model or change a price, edit the JSON and rebuild
(`npm run compile`). The pricing file is bundled into the extension, so changes
take effect after a rebuild/reinstall. Pull requests that keep prices current
are very welcome.

## Contributing

Contributions are welcome — bug reports, pricing updates, new providers, and
features alike.

```bash
git clone https://github.com/your-username/llm-cost-estimator.git
cd llm-cost-estimator
npm install

npm test          # run unit tests (Vitest)
npm run smoke     # bundle + smoke-test the extension against a mocked VS Code
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run compile   # bundle to dist/ with esbuild
```

Then press **F5** in VS Code to launch the **Extension Development Host** and try
your changes live.

**Project layout:**

```
src/
  tokenizer/   # Tokenizer interface + per-provider implementations
  pricing/     # pricing.json + lookup & cost math
  core/        # estimator (pure, VS Code-free) + formatting
  ui/          # hover provider, status bar, QuickPick
  commands/    # command handlers
  extension.ts # activate() / deactivate()
test/          # Vitest unit tests for the core logic
```

The `core/`, `tokenizer/`, and `pricing/` layers are intentionally free of any
`vscode` import so they can be unit-tested directly.

This project is licensed under the [MIT License](LICENSE).

## Packaging & publishing

This extension is bundled with [esbuild](https://esbuild.github.io/) and packaged
with [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce).

```bash
npm run package       # production bundle -> dist/extension.js
npm run vsce:package  # create the .vsix (vsce package)
npx vsce publish      # publish to the Marketplace (requires a publisher + PAT)
```

Before publishing, set a real `publisher` in `package.json` and create a
[Marketplace publisher](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
with a Personal Access Token. The icon lives at `images/icon.png` (regenerate it
with `npm run generate-icon`).

---

Built with [`js-tiktoken`](https://github.com/dqbd/tiktoken). Not affiliated with
OpenAI, Anthropic, or Google.
