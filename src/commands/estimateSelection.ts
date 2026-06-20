import * as vscode from "vscode";
import { estimateAndShow } from "./estimateText";
import type { StatusBarManager } from "../ui/statusBar";

/**
 * Command handler for "LLM Cost: Estimate Selection". Estimates the current
 * selection, or the whole document when nothing is selected (an explicit,
 * user-initiated action).
 */
export async function estimateSelection(statusBar: StatusBarManager): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("LLM Cost: open a file to estimate.");
    return;
  }

  const selection = editor.selection;
  const text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);

  await estimateAndShow(statusBar, text);
}
