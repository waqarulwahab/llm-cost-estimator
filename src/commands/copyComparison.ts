import * as vscode from "vscode";
import { estimate, type EstimateResult } from "../core/estimator";
import { resultToMarkdown } from "../core/export";
import { readSettings } from "../settings";
import type { StatusBarManager } from "../ui/statusBar";

/**
 * Command handler for "LLM Cost: Copy Comparison as Markdown". Uses the current
 * selection if there is one, otherwise the last estimate, otherwise the whole
 * file. Copies a Markdown table to the clipboard.
 */
export async function copyComparison(statusBar: StatusBarManager): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  let result: EstimateResult | undefined;

  if (editor && !editor.selection.isEmpty) {
    result = estimate(editor.document.getText(editor.selection), readSettings());
  } else {
    result = statusBar.getLastResult();
    if (!result && editor) {
      result = estimate(editor.document.getText(), readSettings());
    }
  }

  if (!result || result.estimates.length === 0) {
    vscode.window.showInformationMessage(
      "LLM Cost: nothing to copy — select text or run an estimate first.",
    );
    return;
  }

  await vscode.env.clipboard.writeText(resultToMarkdown(result));
  vscode.window.showInformationMessage("LLM Cost: comparison copied to clipboard as Markdown.");
}
