import * as vscode from "vscode";
import type { EstimateResult, ModelEstimate } from "../core/estimator";
import { ESTIMATE_MARKER, formatCost, formatTokens } from "../core/format";

/** Sorts estimates cheapest-first (by total cost). */
export function sortByCost(estimates: ModelEstimate[]): ModelEstimate[] {
  return [...estimates].sort((a, b) => a.totalCost - b.totalCost);
}

/**
 * Renders the multi-model comparison as a Markdown table for hovers and
 * tooltips. Shared so the hover and the status bar stay visually consistent.
 */
export function renderComparisonMarkdown(
  result: EstimateResult,
  opts: { heading?: string; footer?: string } = {},
): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.supportThemeIcons = true;

  if (opts.heading) {
    md.appendMarkdown(`**${opts.heading}**\n\n`);
  }

  md.appendMarkdown("| Model | Tokens | Input | Total\\* |\n|---|---:|---:|---:|\n");
  for (const e of sortByCost(result.estimates)) {
    const labelMark = e.isEstimate ? ` ${ESTIMATE_MARKER}` : "";
    const totalPrefix = e.isEstimate ? ESTIMATE_MARKER : "";
    md.appendMarkdown(
      `| ${e.label}${labelMark} | ${formatTokens(e.inputTokens)} | ` +
        `${formatCost(e.inputCost, result.currency)} | ` +
        `${totalPrefix}${formatCost(e.totalCost, result.currency)} |\n`,
    );
  }

  md.appendMarkdown(
    `\n\\* Total = input + **${formatTokens(result.outputTokenAssumption)}** assumed output tokens.\n`,
  );
  if (result.estimates.some((e) => e.isEstimate)) {
    md.appendMarkdown(
      `\n${ESTIMATE_MARKER} non-OpenAI token counts are **estimates** ` +
        `(no exact local tokenizer; approximated via an OpenAI encoding).\n`,
    );
  }
  if (result.unknownModels.length > 0) {
    md.appendMarkdown(`\n_Skipped unknown models: ${result.unknownModels.join(", ")}._\n`);
  }
  if (opts.footer) {
    md.appendMarkdown(`\n${opts.footer}\n`);
  }
  return md;
}
