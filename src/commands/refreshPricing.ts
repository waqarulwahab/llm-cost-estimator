import * as vscode from "vscode";
import { buildLiveOverrides, DEFAULT_PRICING_SOURCE, type LiteLLMEntry } from "../core/livePricing";
import { loadPricing, setLivePricing, type LivePriceOverride } from "../pricing/pricing";

const CACHE_KEY = "llmCostEstimator.livePricing";

interface LivePricingCache {
  fetchedAt: number;
  source: string;
  overrides: Record<string, LivePriceOverride>;
}

/** Applies any cached live pricing into the table on activation (offline-friendly). */
export function applyCachedLivePricing(context: vscode.ExtensionContext): void {
  const cache = context.globalState.get<LivePricingCache>(CACHE_KEY);
  if (cache?.overrides) {
    setLivePricing(cache.overrides);
  }
}

/**
 * Fetches the live pricing source, applies the overrides, and caches them.
 * Falls back silently to bundled/cached prices on any error.
 */
export async function refreshPricing(
  context: vscode.ExtensionContext,
  opts: { silent?: boolean; onApplied?: () => void } = {},
): Promise<void> {
  const url = vscode.workspace
    .getConfiguration("llmCostEstimator")
    .get<string>("pricingSourceUrl", DEFAULT_PRICING_SOURCE);

  const run = async (): Promise<void> => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const source = (await res.json()) as Record<string, LiteLLMEntry>;
    const { overrides, updated } = buildLiveOverrides(source, loadPricing());
    setLivePricing(overrides);
    const cache: LivePricingCache = { fetchedAt: Date.now(), source: url, overrides };
    await context.globalState.update(CACHE_KEY, cache);
    opts.onApplied?.();
    if (!opts.silent) {
      vscode.window.showInformationMessage(
        `LLM Cost: refreshed pricing for ${updated.length} model(s) from the live source.`,
      );
    }
  };

  try {
    if (opts.silent) {
      await run();
    } else {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: "LLM Cost: refreshing pricing…" },
        run,
      );
    }
  } catch (err) {
    if (!opts.silent) {
      const msg = err instanceof Error ? err.message : "unknown error";
      vscode.window.showWarningMessage(
        `LLM Cost: couldn't refresh pricing (${msg}). Using bundled/cached prices.`,
      );
    }
  }
}
