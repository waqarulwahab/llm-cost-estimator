# Contributing to LLM Cost & Token Estimator

Thanks for your interest in contributing! 🎉 This project is small, friendly, and
beginner-welcoming. Bug reports, pricing updates, docs, and features are all
appreciated.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute (easiest first)

1. **Update pricing** — prices change constantly. Edit
   [`src/pricing/pricing.json`](src/pricing/pricing.json) with a link to the
   provider's official pricing page in your PR. _(Great first contribution.)_
2. **Add a model** — add a new entry to `pricing.json` (label, provider, prices,
   context window). See existing entries for the shape.
3. **Report a bug or request a feature** — open an issue (templates provided).
4. **Improve docs** — README, examples, the MCP server docs.
5. **Pick a feature** — see the [ROADMAP](ROADMAP.md) and issues labeled
   [`good first issue`](https://github.com/waqarulwahab/llm-cost-estimator/labels/good%20first%20issue).

## Project layout

```
src/
  tokenizer/   # Tokenizer interface + per-provider implementations
  pricing/     # pricing.json + lookup & cost math
  core/        # estimator, prompt detector, scan, export, formatting — PURE (no vscode)
  ui/          # hover, status bar, CodeLens, QuickPick, webviews
  commands/    # command handlers
  extension.ts # activate() / deactivate()
test/          # Vitest unit + load tests
mcp-server/    # MCP server (reuses src/core, src/pricing)
```

> **Key principle:** everything under `core/`, `tokenizer/`, and `pricing/` is
> **free of any `vscode` import**, so it can be unit-tested directly and reused
> by the MCP server. Please keep it that way — UI/VS Code code lives in `ui/`,
> `commands/`, and `extension.ts`.

## Local setup

```bash
git clone https://github.com/waqarulwahab/llm-cost-estimator.git
cd llm-cost-estimator
npm install
```

Run the extension: press **F5** in VS Code to launch the Extension Development
Host.

## Before you open a PR

Please make sure these all pass (CI runs the same):

```bash
npm test           # unit + load tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier (auto-format)
npm run e2e        # bundle + end-to-end test against a mocked VS Code
```

Working on the MCP server too?

```bash
npm run mcp:test   # builds + stdio handshake test
```

## Pull request guidelines

- Keep PRs focused — one logical change per PR.
- Add or update tests for any logic change (the `core/` layer is easy to test).
- Run `npm run format` so style is consistent.
- Reference the issue you're addressing (e.g. "Closes #12").
- For pricing changes, **link the official source** so reviewers can verify.

## Commit messages

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `ci:`. Not required, but nice.

## Questions?

Open an issue or start a discussion — happy to help you land your first PR. 💛
