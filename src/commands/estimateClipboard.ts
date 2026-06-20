import * as vscode from "vscode";
import { estimateAndShow } from "./estimateText";
import type { StatusBarManager } from "../ui/statusBar";

/** Command handler for "LLM Cost: Estimate Clipboard". */
export async function estimateClipboard(statusBar: StatusBarManager): Promise<void> {
  const text = await vscode.env.clipboard.readText();
  if (!text.trim()) {
    vscode.window.showInformationMessage("LLM Cost: clipboard is empty.");
    return;
  }
  await estimateAndShow(statusBar, text);
}
