import * as vscode from "vscode";
import type { EstimateResult } from "../core/estimator";
import { formatCost } from "../core/format";

interface RunningTotal {
  label: string;
  total: number;
  isEstimate: boolean;
}

/**
 * Owns the status bar item showing a running cost total for the session. The
 * "headline" figure is the first configured model's cumulative total; the
 * tooltip breaks the total down per model. Clicking re-opens the last
 * breakdown via the `showLastBreakdown` command.
 *
 * Only explicit estimates (the command) feed the total — hovering does not, so
 * the figure reflects deliberate measurements rather than incidental mouseovers.
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly totals = new Map<string, RunningTotal>();
  private headlineModel: string | undefined;
  private estimateCount = 0;
  private currency = "USD";
  private lastResult: EstimateResult | undefined;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "llmCostEstimator.showLastBreakdown";
    this.render();
    this.item.show();
  }

  /** Records an estimate into the running session totals and refreshes the badge. */
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
    const headline = this.headlineModel ? this.totals.get(this.headlineModel) : undefined;
    if (this.estimateCount === 0 || !headline) {
      this.item.text = "$(symbol-number) LLM Cost";
    } else {
      const prefix = headline.isEstimate ? "~" : "";
      this.item.text = `$(graph) ${prefix}${formatCost(headline.total, this.currency)}`;
    }
    this.item.tooltip = this.buildTooltip();
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.supportThemeIcons = true;
    md.appendMarkdown("**LLM Cost — session total**\n\n");

    if (this.estimateCount === 0) {
      md.appendMarkdown(
        "No estimates yet. Select text and run **LLM Cost: Estimate Selection**.",
      );
      return md;
    }

    const plural = this.estimateCount === 1 ? "" : "s";
    md.appendMarkdown(`Across ${this.estimateCount} estimate${plural} this session:\n\n`);
    md.appendMarkdown("| Model | Running total |\n|---|---:|\n");
    for (const [model, t] of this.totals) {
      const estMark = t.isEstimate ? " ~" : "";
      const headlineMark = model === this.headlineModel ? " ★" : "";
      md.appendMarkdown(`| ${t.label}${estMark}${headlineMark} | ${formatCost(t.total, this.currency)} |\n`);
    }
    md.appendMarkdown("\n★ headline (status bar) · ~ estimated tokenization\n\n");
    md.appendMarkdown("_Click to show the last breakdown._");
    return md;
  }

  dispose(): void {
    this.item.dispose();
  }
}
