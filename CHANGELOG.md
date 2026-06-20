# Changelog

All notable changes to this extension are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

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

[0.1.0]: https://github.com/your-username/llm-cost-estimator/releases/tag/v0.1.0
