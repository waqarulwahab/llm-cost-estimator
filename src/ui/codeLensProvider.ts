import * as vscode from "vscode";
import { estimate } from "../core/estimator";
import { detectPromptSites } from "../core/detect";
import { formatCost, formatTokens } from "../core/format";
import { sortByCost } from "./markdown";
import type { ExtensionSettings } from "../settings";

const DOC_SCAN_LIMIT = 200_000; // chars
const MAX_LENSES = 200;

/**
 * Adds a CodeLens above each detected prompt-like string showing its token
 * count and cheapest cost, plus a one-click "compare" that opens the full
 * breakdown. This surfaces cost right where prompts live in code.
 */
export class LlmCostCodeLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  constructor(private readonly getSettings: () => ExtensionSettings) {}

  /** Ask VS Code to re-query lenses (e.g. after a settings change). */
  refresh(): void {
    this.emitter.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const settings = this.getSettings();
    if (!settings.enableCodeLens) {
      return [];
    }

    const text = document.getText();
    if (text.length > DOC_SCAN_LIMIT) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    for (const site of detectPromptSites(text).slice(0, MAX_LENSES)) {
      const result = estimate(site.content, settings);
      if (result.estimates.length === 0) {
        continue;
      }
      const cheapest = sortByCost(result.estimates)[0];
      const range = new vscode.Range(
        document.positionAt(site.contentStart),
        document.positionAt(site.contentEnd),
      );
      const prefix = cheapest.isEstimate ? "~" : "";
      const title =
        `$(symbol-number) ${formatTokens(cheapest.inputTokens)} tokens · ` +
        `${prefix}${formatCost(cheapest.totalCost, result.currency)} ${cheapest.label} · ` +
        `$(arrow-swap) compare ${result.estimates.length}`;

      lenses.push(
        new vscode.CodeLens(range, {
          title,
          tooltip: "Show the full multi-model cost breakdown for this prompt",
          command: "llmCostEstimator.estimateText",
          arguments: [site.content],
        }),
      );
    }
    return lenses;
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
