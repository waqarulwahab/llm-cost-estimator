import * as vscode from "vscode";
import { estimate } from "./core/estimator";
import { estimateSelection } from "./commands/estimateSelection";
import { estimateAndShow } from "./commands/estimateText";
import { estimateClipboard } from "./commands/estimateClipboard";
import { selectModels } from "./commands/selectModels";
import { readSettings } from "./settings";
import { LlmCostHoverProvider } from "./ui/hoverProvider";
import { LlmCostCodeLensProvider } from "./ui/codeLensProvider";
import { ComparisonPanel } from "./ui/comparisonPanel";
import { showEstimateQuickPick } from "./ui/quickPick";
import { StatusBarManager } from "./ui/statusBar";

// Hover works in prose/config files too; CodeLens only where prompts live in code.
const HOVER_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "python",
  "markdown",
  "plaintext",
  "json",
  "jsonc",
  "yaml",
];
const CODELENS_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "python",
];

const LIVE_DEBOUNCE_MS = 120;
const LIVE_SELECTION_CAP = 50_000; // chars; above this, live status bar stays idle

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarManager();
  const codeLensProvider = new LlmCostCodeLensProvider(readSettings);
  context.subscriptions.push(statusBar, codeLensProvider);

  // --- Live selection updates (debounced) ---------------------------------
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  const runLiveUpdate = (): void => {
    const settings = readSettings();
    const editor = vscode.window.activeTextEditor;
    if (!settings.enableStatusBarSelection || !editor || editor.selection.isEmpty) {
      statusBar.setLive(null);
      ComparisonPanel.refreshIfOpen();
      return;
    }
    const text = editor.document.getText(editor.selection);
    if (!text.trim() || text.length > LIVE_SELECTION_CAP) {
      statusBar.setLive(null);
    } else {
      statusBar.setLive(estimate(text, settings));
    }
    ComparisonPanel.refreshIfOpen();
  };
  const scheduleLiveUpdate = (): void => {
    if (liveTimer) {
      clearTimeout(liveTimer);
    }
    liveTimer = setTimeout(runLiveUpdate, LIVE_DEBOUNCE_MS);
  };

  // --- Commands -----------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("llmCostEstimator.estimateSelection", () =>
      estimateSelection(statusBar),
    ),
    vscode.commands.registerCommand("llmCostEstimator.estimateClipboard", () =>
      estimateClipboard(statusBar),
    ),
    vscode.commands.registerCommand("llmCostEstimator.estimateText", (text: string) =>
      estimateAndShow(statusBar, text),
    ),
    vscode.commands.registerCommand("llmCostEstimator.openComparisonPanel", () =>
      ComparisonPanel.show(readSettings),
    ),
    vscode.commands.registerCommand("llmCostEstimator.selectModels", () => selectModels()),
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

  // --- Providers ----------------------------------------------------------
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(HOVER_LANGUAGES, new LlmCostHoverProvider(readSettings)),
    vscode.languages.registerCodeLensProvider(CODELENS_LANGUAGES, codeLensProvider),
  );

  // --- Listeners ----------------------------------------------------------
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(scheduleLiveUpdate),
    vscode.window.onDidChangeActiveTextEditor(() => {
      statusBar.setLive(null);
      scheduleLiveUpdate();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("llmCostEstimator")) {
        codeLensProvider.refresh();
        runLiveUpdate();
      }
    }),
    new vscode.Disposable(() => {
      if (liveTimer) {
        clearTimeout(liveTimer);
      }
    }),
  );
}

export function deactivate(): void {
  // All disposables are owned by context.subscriptions; nothing extra to clean up.
}
