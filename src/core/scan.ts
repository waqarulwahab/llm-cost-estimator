import { detectPromptSites } from "./detect";
import { estimate, type EstimateOptions } from "./estimator";
import { getModelPricing } from "../pricing/pricing";

export interface ScannedPrompt {
  /** 0-based line where the prompt starts (for navigation). */
  line: number;
  /** Content-start offset within the file. */
  offset: number;
  /** Short single-line preview of the prompt. */
  preview: string;
  tokens: number;
  cost: number;
  overContext: boolean;
}

export interface FileScanResult {
  path: string;
  promptCount: number;
  tokens: number;
  cost: number;
  prompts: ScannedPrompt[];
}

export interface ScanReport {
  files: FileScanResult[];
  filesScanned: number;
  totalPrompts: number;
  totalTokens: number;
  totalCost: number;
  modelKey: string;
  modelLabel: string;
  currency: string;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** Binary-search the 0-based line for a character offset. */
function lineForOffset(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function preview(content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? oneLine.slice(0, 79) + "…" : oneLine;
}

/**
 * Scans a set of in-memory files for prompt-like strings and aggregates the
 * estimated cost (on the first known configured model) per file and overall.
 *
 * Pure and VS Code-free so it is directly unit- and load-testable. The command
 * layer supplies file contents via the workspace API.
 */
export function scanTexts(
  files: ReadonlyArray<{ path: string; text: string }>,
  options: EstimateOptions,
): ScanReport {
  const modelKey = options.models.find((m) => getModelPricing(m)) ?? "gpt-4o";
  const modelLabel = getModelPricing(modelKey)?.label ?? modelKey;
  const singleModel: EstimateOptions = {
    models: [modelKey],
    outputTokenAssumption: options.outputTokenAssumption,
    currency: options.currency,
  };

  const results: FileScanResult[] = [];
  let totalPrompts = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const file of files) {
    const sites = detectPromptSites(file.text);
    if (sites.length === 0) {
      continue;
    }
    const starts = lineStarts(file.text);
    const prompts: ScannedPrompt[] = [];
    let fileTokens = 0;
    let fileCost = 0;

    for (const site of sites) {
      const e = estimate(site.content, singleModel).estimates[0];
      const tokens = e?.inputTokens ?? 0;
      const cost = e?.totalCost ?? 0;
      fileTokens += tokens;
      fileCost += cost;
      prompts.push({
        line: lineForOffset(starts, site.contentStart),
        offset: site.contentStart,
        preview: preview(site.content),
        tokens,
        cost,
        overContext: e?.overContext ?? false,
      });
    }

    results.push({
      path: file.path,
      promptCount: prompts.length,
      tokens: fileTokens,
      cost: fileCost,
      prompts,
    });
    totalPrompts += prompts.length;
    totalTokens += fileTokens;
    totalCost += fileCost;
  }

  results.sort((a, b) => b.cost - a.cost);

  return {
    files: results,
    filesScanned: files.length,
    totalPrompts,
    totalTokens,
    totalCost,
    modelKey,
    modelLabel,
    currency: options.currency ?? "USD",
  };
}
