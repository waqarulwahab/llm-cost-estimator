import type { EstimateResult } from "./estimator";
import {
  ESTIMATE_MARKER,
  formatCost,
  formatTokens,
  OVER_CONTEXT_MARKER,
  sortByCost,
} from "./format";

/**
 * Renders an estimate as a plain Markdown table (for copy-to-clipboard / docs).
 * Pure string output — no VS Code types — so it is easy to test.
 */
export function resultToMarkdown(result: EstimateResult): string {
  const c = result.currency;
  const lines: string[] = [];
  lines.push(
    `**LLM cost estimate** — ${formatTokens(result.charCount)} chars · ` +
      `assuming ${formatTokens(result.outputTokenAssumption)} output tokens`,
  );
  lines.push("");
  lines.push("| Model | Tokens | Input | Output | Total |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const e of sortByCost(result.estimates)) {
    const mark =
      (e.isEstimate ? ` ${ESTIMATE_MARKER}` : "") +
      (e.overContext ? ` ${OVER_CONTEXT_MARKER}` : "");
    lines.push(
      `| ${e.label}${mark} | ${formatTokens(e.inputTokens)} | ${formatCost(e.inputCost, c)} | ` +
        `${formatCost(e.outputCost, c)} | ${formatCost(e.totalCost, c)} |`,
    );
  }
  lines.push("");
  if (result.estimates.some((e) => e.isEstimate)) {
    lines.push(
      `${ESTIMATE_MARKER} non-OpenAI counts are estimates (approximated via an OpenAI encoding).`,
    );
  }
  if (result.estimates.some((e) => e.overContext)) {
    lines.push(`${OVER_CONTEXT_MARKER} exceeds the model's context window.`);
  }
  return lines.join("\n");
}
