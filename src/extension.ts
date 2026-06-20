import * as vscode from "vscode";
import { estimateSelection } from "./commands/estimateSelection";
import { readSettings } from "./settings";
import { LlmCostHoverProvider } from "./ui/hoverProvider";
import { showEstimateQuickPick } from "./ui/quickPick";
import { StatusBarManager } from "./ui/statusBar";

// Languages where prompt/string hovers are most useful. Kept intentionally small
// to start; users building LLM apps mostly work in these.
const HOVER_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "python",
];

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("llmCostEstimator.estimateSelection", () =>
      estimateSelection(statusBar),
    ),

    vscode.commands.registerCommand("llmCostEstimator.showLastBreakdown", async () => {
      const last = statusBar.getLastResult();
      if (!last) {
        vscode.window.showInformationMessage(
          'LLM Cost: no estimate yet — run "LLM Cost: Estimate Selection" first.',
        );
        return;
      }
      await showEstimateQuickPick(last);
    }),

    vscode.commands.registerCommand("llmCostEstimator.resetSessionTotal", () => statusBar.reset()),
  );

  // The hover provider reads settings live, so config changes take effect without
  // re-registration. A string[] selector matches the languages on any scheme
  // (including untitled buffers).
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(HOVER_LANGUAGES, new LlmCostHoverProvider(readSettings)),
  );
}

export function deactivate(): void {
  // All disposables are owned by context.subscriptions; nothing extra to clean up.
}
