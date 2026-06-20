# Changelog

All notable changes to this extension are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [0.3.0] - 2026-06-21

Power-user features and project-wide visibility.

### Added

- **Workspace scan** (`LLM Cost: Scan Workspace for Prompts`) — finds every
  prompt-like string across the project and shows an aggregated report: total
  estimated cost per run, prompts, tokens, and a per-file table. Click a file to
  jump straight to its first prompt.
- **Custom models** via the `llmCostEstimator.customModels` setting — add or
  override models (label, provider, prices, encoding, context window) without
  editing `pricing.json`. Invalid entries are reported, not silently dropped.
- **Context-window awareness** — a `⚠` marker appears in hovers, the CodeLens,
  the panel, and exports when a prompt + assumed output exceeds a model's window.
- **Copy comparison as Markdown** (`LLM Cost: Copy Comparison as Markdown`, plus
  a button in the panel) — drops a ready-to-paste table on your clipboard.

### Testing

- Added a **load/performance suite** (`npm run test:load`) covering 1 MB inputs,
  the full-catalog encoding cache, 5,000-string detection, pathological input,
  500-file scans, and 2,000-estimate throughput — all with regression-catching
  time budgets.
- Expanded the **end-to-end harness** (`npm run e2e`) to exercise every command,
  the workspace scan, custom models, and copy-as-Markdown against the bundle.

## [0.2.0] - 2026-06-21

A big step up from the MVP — focused on discoverability and "wow".

### Added

- **CodeLens on prompts** — a token-count + cost lens above detected prompt
  strings in JavaScript/TypeScript/Python. Click it for the full breakdown.
  Toggle with `llmCostEstimator.enableCodeLens`.
- **Live, selection-aware status bar** — select any text and its token count and
  cheapest cost appear instantly (no command needed); the tooltip shows every
  configured model. Toggle with `llmCostEstimator.enableStatusBarSelection`.
- **Comparison Panel** (`LLM Cost: Open Comparison Panel`) — a themed webview
  dashboard comparing the **whole model catalog** with a live **output-token
  slider** (costs recompute instantly, client-side), sortable columns, and a
  "configured models only" filter. Also reachable from the editor toolbar icon
  and by clicking the status bar.
- **`LLM Cost: Estimate Clipboard`** and **`LLM Cost: Select Models to Compare`**
  commands.
- **Expanded model catalog (25+):** GPT-4.1 / o-series, Claude 4 / 3.7 / 3.5,
  Gemini 2.5 / 2.0, DeepSeek, Mistral, Llama, and Grok — alongside the originals.
- **More hover languages** — Markdown, JSON/JSONC, YAML, and plaintext, in
  addition to JS/TS/Python.
- **Multi-line prompt detection** — the hover and CodeLens now understand
  multi-line template literals.

### Changed

- The status bar now opens the Comparison Panel on click (the QuickPick is still
  available via `LLM Cost: Show Last Breakdown`).
- Tokenizer architecture generalized so any provider can be added in
  `pricing.json` without code changes (OpenAI stays exact; the rest are labeled
  estimates).

## [0.1.0] - 2026-06-21

Initial release — the MVP.

### Added

- **Multi-model cost comparison** — see token count and estimated cost for the
  same text across GPT-4o, Claude, Gemini and more, side by side.
- **Hover tooltip** — hover over a selection or a string literal in
  JavaScript/TypeScript/Python to see the comparison inline.
- **`LLM Cost: Estimate Selection` command** — estimate the current selection
  (or the whole file when nothing is selected) and view a per-model breakdown in
  a QuickPick. Select a row to copy a summary to the clipboard.
- **Status bar running total** — a live session cost total. Click it to re-open
  the last breakdown. Reset with `LLM Cost: Reset Session Total`.
- **Local-first tokenization** — exact OpenAI BPE counting via `js-tiktoken`
  (`o200k_base` / `cl100k_base`); Anthropic and Google counts are clearly
  labeled approximations. No API key required.
- **Settings** — configurable model list, assumed output tokens, currency label,
  and a hover toggle.
- **Bundled, editable pricing** in `src/pricing/pricing.json` with a "verify
  prices" note.

[0.3.0]: https://github.com/your-username/llm-cost-estimator/releases/tag/v0.3.0
[0.2.0]: https://github.com/your-username/llm-cost-estimator/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-username/llm-cost-estimator/releases/tag/v0.1.0
