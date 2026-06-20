import * as vscode from "vscode";
import { estimate } from "../core/estimator";
import { readSettings } from "../settings";
import { showEstimateQuickPick } from "../ui/quickPick";
import type { StatusBarManager } from "../ui/statusBar";

/**
 * Core flow shared by every "estimate this text" entry point (selection,
 * clipboard, CodeLens): estimate, record into the session total, show the
 * multi-model breakdown.
 */
export async function estimateAndShow(statusBar: StatusBarManager, text: string): Promise<void> {
  if (!text.trim()) {
    vscode.window.showInformationMessage("LLM Cost: nothing to estimate.");
    return;
  }

  const settings = readSettings();
  const result = estimate(text, settings);

  if (result.estimates.length === 0) {
    vscode.window.showWarningMessage(
      `LLM Cost: no known models configured (${result.unknownModels.join(", ") || "none"}). ` +
        `Run "LLM Cost: Select Models to Compare".`,
    );
    return;
  }

  statusBar.record(result);
  await showEstimateQuickPick(result);
}
