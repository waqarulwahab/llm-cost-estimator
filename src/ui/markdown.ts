import * as vscode from "vscode";
import type { EstimateResult } from "../core/estimator";
import {
  ESTIMATE_MARKER,
  formatCost,
  formatTokens,
  OVER_CONTEXT_MARKER,
  sortByCost,
} from "../core/format";

export { sortByCost };

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
    const ctxMark = e.overContext ? ` ${OVER_CONTEXT_MARKER}` : "";
    const totalPrefix = e.isEstimate ? ESTIMATE_MARKER : "";
    md.appendMarkdown(
      `| ${e.label}${labelMark}${ctxMark} | ${formatTokens(e.inputTokens)} | ` +
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
  if (result.estimates.some((e) => e.overContext)) {
    md.appendMarkdown(`\n${OVER_CONTEXT_MARKER} exceeds the model's context window.\n`);
  }
  if (result.unknownModels.length > 0) {
    md.appendMarkdown(`\n_Skipped unknown models: ${result.unknownModels.join(", ")}._\n`);
  }
  if (opts.footer) {
    md.appendMarkdown(`\n${opts.footer}\n`);
  }
  return md;
}
