import * as vscode from "vscode";
import type { EstimateResult, ModelEstimate } from "../core/estimator";
import { ESTIMATE_MARKER, formatCost, formatTokens } from "../core/format";

interface CostQuickPickItem extends vscode.QuickPickItem {
  /** A copy-to-clipboard summary line, present on selectable model rows. */
  summary?: string;
}

/**
 * Shows the multi-model comparison as a QuickPick (cheapest first). Selecting a
 * model copies a one-line summary to the clipboard.
 */
export async function showEstimateQuickPick(result: EstimateResult): Promise<void> {
  if (result.estimates.length === 0) {
    const list = result.unknownModels.join(", ") || "none configured";
    vscode.window.showWarningMessage(
      `LLM Cost: no known models to estimate (configured: ${list}). Check "llmCostEstimator.models".`,
    );
    return;
  }

  const anyEstimate = result.estimates.some((e) => e.isEstimate);
  const items = buildItems(result);
  const picked = await vscode.window.showQuickPick(items, {
    title:
      `LLM Cost · ${formatTokens(result.charCount)} chars · ` +
      `assuming ${formatTokens(result.outputTokenAssumption)} output tokens` +
      (anyEstimate ? ` · ${ESTIMATE_MARKER} = estimated` : ""),
    placeHolder: "Estimated cost per model (cheapest first) — select to copy a summary",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (picked?.summary) {
    await vscode.env.clipboard.writeText(picked.summary);
    vscode.window.showInformationMessage("LLM Cost: estimate copied to clipboard.");
  }
}

function buildItems(result: EstimateResult): CostQuickPickItem[] {
  const sorted = [...result.estimates].sort((a, b) => a.totalCost - b.totalCost);
  const items: CostQuickPickItem[] = sorted.map((e) => itemFor(e, result.currency));

  if (result.unknownModels.length > 0) {
    items.push({ label: "", kind: vscode.QuickPickItemKind.Separator });
    items.push({
      label: "$(warning) Unknown models skipped",
      detail: result.unknownModels.join(", "),
    });
  }
  return items;
}

function itemFor(e: ModelEstimate, currency: string): CostQuickPickItem {
  const labelMark = e.isEstimate ? ` ${ESTIMATE_MARKER}` : "";
  const totalPrefix = e.isEstimate ? ESTIMATE_MARKER : "";
  const totalStr = `${totalPrefix}${formatCost(e.totalCost, currency)}`;

  const detail =
    `${formatTokens(e.inputTokens)} input tokens · ` +
    `input ${formatCost(e.inputCost, currency)} + ` +
    `output(${formatTokens(e.outputTokens)}) ${formatCost(e.outputCost, currency)}` +
    (e.isEstimate ? " · token count estimated" : "");

  const summary =
    `${e.label}: ${formatTokens(e.inputTokens)} input tokens, total ${totalStr} ` +
    `(input ${formatCost(e.inputCost, currency)} + ${formatTokens(e.outputTokens)} ` +
    `output ${formatCost(e.outputCost, currency)})`;

  return {
    label: `$(symbol-number) ${e.label}${labelMark}`,
    description: `total ${totalStr}`,
    detail,
    summary,
  };
}
