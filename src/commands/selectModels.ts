import * as vscode from "vscode";
import { getModelPricing, listModels } from "../pricing/pricing";
import { readSettings } from "../settings";

interface ModelPickItem extends vscode.QuickPickItem {
  key: string;
}

/**
 * Command handler for "LLM Cost: Select Models to Compare". Presents a
 * multi-select of the full catalog and writes the chosen keys to
 * `llmCostEstimator.models`.
 */
export async function selectModels(): Promise<void> {
  const current = new Set(readSettings().models);

  const items: ModelPickItem[] = listModels().map((key) => {
    const p = getModelPricing(key)!;
    return {
      key,
      label: p.label,
      description: key,
      detail: `${p.provider} · $${p.inputPer1M} in / $${p.outputPer1M} out per 1M`,
      picked: current.has(key),
    };
  });

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: "Select models to compare",
    placeHolder: "Choose the models shown in hovers, CodeLens, and the status bar",
  });
  if (!picked) {
    return; // cancelled
  }
  if (picked.length === 0) {
    vscode.window.showWarningMessage("LLM Cost: no models selected; keeping the previous list.");
    return;
  }

  const keys = picked.map((i) => i.key);
  await vscode.workspace
    .getConfiguration("llmCostEstimator")
    .update("models", keys, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`LLM Cost: now comparing ${keys.length} model(s).`);
}
