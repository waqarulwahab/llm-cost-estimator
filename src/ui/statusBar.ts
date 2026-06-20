import * as vscode from "vscode";
import type { EstimateResult } from "../core/estimator";
import { formatCost, formatTokens } from "../core/format";
import { renderComparisonMarkdown, sortByCost } from "./markdown";

interface RunningTotal {
  label: string;
  total: number;
  isEstimate: boolean;
}

/**
 * Owns the status bar item. It has two modes:
 *
 *  - **Live** — while text is selected, it shows that selection's token count
 *    and cost (cheapest configured model) with a full comparison in the tooltip.
 *    Updated by the debounced selection listener.
 *  - **Session total** — with no selection, it shows a running total accumulated
 *    by the explicit `Estimate Selection` command (hovering never adds to it).
 *
 * Clicking opens the Comparison Panel.
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly totals = new Map<string, RunningTotal>();
  private headlineModel: string | undefined;
  private estimateCount = 0;
  private currency = "USD";
  private lastResult: EstimateResult | undefined;
  private live: EstimateResult | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "llmCostEstimator.openComparisonPanel";
    this.render();
    this.item.show();
  }

  /** Sets (or clears) the live selection estimate shown in the bar. */
  setLive(result: EstimateResult | null): void {
    this.live = result && result.estimates.length > 0 ? result : null;
    if (this.live) {
      this.currency = this.live.currency;
    }
    this.render();
  }

  /** Records an explicit estimate into the running session totals. */
  record(result: EstimateResult): void {
    if (result.estimates.length === 0) {
      return;
    }
    this.lastResult = result;
    this.currency = result.currency;
    this.estimateCount += 1;
    this.headlineModel = result.estimates[0].model;
    for (const e of result.estimates) {
      const prev = this.totals.get(e.model);
      this.totals.set(e.model, {
        label: e.label,
        total: (prev?.total ?? 0) + e.totalCost,
        isEstimate: e.isEstimate,
      });
    }
    this.render();
  }

  getLastResult(): EstimateResult | undefined {
    return this.lastResult;
  }

  /** Clears all running totals for the session. */
  reset(): void {
    this.totals.clear();
    this.estimateCount = 0;
    this.headlineModel = undefined;
    this.lastResult = undefined;
    this.render();
    vscode.window.showInformationMessage("LLM Cost: session total reset.");
  }

  private render(): void {
    if (this.live) {
      const cheapest = sortByCost(this.live.estimates)[0];
      const prefix = cheapest.isEstimate ? "~" : "";
      this.item.text =
        `$(symbol-number) ${formatTokens(cheapest.inputTokens)} tok · ` +
        `${prefix}${formatCost(cheapest.totalCost, this.currency)}`;
      this.item.tooltip = renderComparisonMarkdown(this.live, {
        heading: "LLM Cost — current selection",
        footer: "_Click to open the Comparison Panel._",
      });
      return;
    }

    const headline = this.headlineModel ? this.totals.get(this.headlineModel) : undefined;
    if (this.estimateCount === 0 || !headline) {
      this.item.text = "$(symbol-number) LLM Cost";
    } else {
      const prefix = headline.isEstimate ? "~" : "";
      this.item.text = `$(graph) ${prefix}${formatCost(headline.total, this.currency)}`;
    }
    this.item.tooltip = this.buildSessionTooltip();
  }

  private buildSessionTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.supportThemeIcons = true;
    md.appendMarkdown("**LLM Cost — session total**\n\n");

    if (this.estimateCount === 0) {
      md.appendMarkdown(
        "Select text to see a live estimate, or run **LLM Cost: Estimate Selection**.\n\n",
      );
      md.appendMarkdown("_Click to open the Comparison Panel._");
      return md;
    }

    const plural = this.estimateCount === 1 ? "" : "s";
    md.appendMarkdown(`Across ${this.estimateCount} estimate${plural} this session:\n\n`);
    md.appendMarkdown("| Model | Running total |\n|---|---:|\n");
    for (const [model, t] of this.totals) {
      const estMark = t.isEstimate ? " ~" : "";
      const headlineMark = model === this.headlineModel ? " ★" : "";
      md.appendMarkdown(
        `| ${t.label}${estMark}${headlineMark} | ${formatCost(t.total, this.currency)} |\n`,
      );
    }
    md.appendMarkdown("\n★ headline (status bar) · ~ estimated tokenization\n\n");
    md.appendMarkdown("_Click to open the Comparison Panel._");
    return md;
  }

  dispose(): void {
    this.item.dispose();
  }
}
