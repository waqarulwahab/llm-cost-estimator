import * as vscode from "vscode";
import type { EstimateOptions } from "./core/estimator";

/** Extension settings, read live from `llmCostEstimator.*`. */
export interface ExtensionSettings extends EstimateOptions {
  enableHover: boolean;
  enableCodeLens: boolean;
  enableStatusBarSelection: boolean;
}

const DEFAULT_MODELS = ["gpt-4o", "claude-sonnet", "claude-haiku"];

/**
 * Reads the current configuration. Called on every estimate/hover/lens so
 * changes to settings take effect immediately without reloading the window.
 */
export function readSettings(): ExtensionSettings {
  const cfg = vscode.workspace.getConfiguration("llmCostEstimator");
  return {
    models: cfg.get<string[]>("models", DEFAULT_MODELS),
    outputTokenAssumption: cfg.get<number>("outputTokenAssumption", 500),
    currency: cfg.get<string>("currency", "USD"),
    enableHover: cfg.get<boolean>("enableHover", true),
    enableCodeLens: cfg.get<boolean>("enableCodeLens", true),
    enableStatusBarSelection: cfg.get<boolean>("enableStatusBarSelection", true),
  };
}
