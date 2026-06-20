import * as vscode from "vscode";
import { estimate } from "../core/estimator";
import { readSettings } from "../settings";
import { showEstimateQuickPick } from "../ui/quickPick";
import type { StatusBarManager } from "../ui/statusBar";

/**
 * Command handler for "LLM Cost: Estimate Selection".
 *
 * Estimates the current selection (or the whole document when nothing is
 * selected — an explicit, user-initiated action), records it into the running
 * session total, and shows the multi-model breakdown.
 */
export async function estimateSelection(statusBar: StatusBarManager): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("LLM Cost: open a file to estimate.");
    return;
  }

  const selection = editor.selection;
  const text = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);

  if (!text.trim()) {
    vscode.window.showInformationMessage("LLM Cost: nothing to estimate (selection is empty).");
    return;
  }

  const settings = readSettings();
  const result = estimate(text, settings);

  if (result.estimates.length === 0) {
    vscode.window.showWarningMessage(
      `LLM Cost: no known models configured (${result.unknownModels.join(", ") || "none"}). ` +
        `Set "llmCostEstimator.models" to known pricing keys.`,
    );
    return;
  }

  statusBar.record(result);
  await showEstimateQuickPick(result);
}
