import * as vscode from "vscode";
import { estimate, type EstimateResult } from "../core/estimator";
import { ESTIMATE_MARKER, formatCost, formatTokens } from "../core/format";
import type { ExtensionSettings } from "../settings";

/**
 * Shows token counts and a multi-model cost comparison when hovering over a
 * selection or a string literal. This is the primary, delightful interaction.
 *
 * To stay fast we only tokenize the small hovered range — never the whole file.
 */
export class LlmCostHoverProvider implements vscode.HoverProvider {
  constructor(private readonly getSettings: () => ExtensionSettings) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const settings = this.getSettings();
    if (!settings.enableHover) {
      return undefined;
    }

    const target = resolveHoverTarget(document, position);
    if (!target || !target.text.trim()) {
      return undefined;
    }

    const result = estimate(target.text, settings);
    if (result.estimates.length === 0) {
      return undefined;
    }

    return new vscode.Hover(renderHoverMarkdown(result), target.range);
  }
}

interface HoverTarget {
  text: string;
  range: vscode.Range;
}

function resolveHoverTarget(
  document: vscode.TextDocument,
  position: vscode.Position,
): HoverTarget | undefined {
  // 1) Prefer an active, non-empty selection that contains the hovered position.
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.toString() === document.uri.toString()) {
    const sel = editor.selection;
    if (!sel.isEmpty && sel.contains(position)) {
      return { text: document.getText(sel), range: sel };
    }
  }

  // 2) Otherwise, a string literal under the cursor.
  return findStringLiteral(document, position);
}

function findStringLiteral(
  document: vscode.TextDocument,
  position: vscode.Position,
): HoverTarget | undefined {
  const line = document.lineAt(position.line).text;
  const found = scanStringOnLine(line, position.character);
  if (!found) {
    return undefined;
  }
  const range = new vscode.Range(
    position.line,
    found.contentStart,
    position.line,
    found.contentEnd,
  );
  return { text: found.content, range };
}

/**
 * Naive single-line string scanner: finds a quoted span (', ", or `) that
 * contains the character offset `ch` and returns its inner content. Good enough
 * for hovering prompt strings; multi-line template literals fall back to no hover.
 */
function scanStringOnLine(
  line: string,
  ch: number,
): { contentStart: number; contentEnd: number; content: string } | undefined {
  const quotes = new Set(["'", '"', "`"]);
  let i = 0;
  while (i < line.length) {
    if (quotes.has(line[i])) {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === quote) {
          break;
        }
        j += 1;
      }
      if (j >= line.length) {
        break; // unterminated string — give up
      }
      // The string occupies [i .. j] inclusive of quotes; hover hits if inside.
      if (ch > i && ch <= j) {
        return { contentStart: i + 1, contentEnd: j, content: line.slice(i + 1, j) };
      }
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return undefined;
}

function renderHoverMarkdown(result: EstimateResult): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.supportThemeIcons = true;
  md.appendMarkdown("**LLM Cost Estimate**\n\n");

  const currency = result.currency;
  md.appendMarkdown("| Model | Tokens | Input | Total\\* |\n|---|---:|---:|---:|\n");
  for (const e of result.estimates) {
    const labelMark = e.isEstimate ? ` ${ESTIMATE_MARKER}` : "";
    const totalPrefix = e.isEstimate ? ESTIMATE_MARKER : "";
    md.appendMarkdown(
      `| ${e.label}${labelMark} | ${formatTokens(e.inputTokens)} | ` +
        `${formatCost(e.inputCost, currency)} | ${totalPrefix}${formatCost(e.totalCost, currency)} |\n`,
    );
  }

  md.appendMarkdown(
    `\n\\* Total = input + **${formatTokens(result.outputTokenAssumption)}** assumed output tokens.\n`,
  );
  if (result.estimates.some((e) => e.isEstimate)) {
    md.appendMarkdown(
      `\n${ESTIMATE_MARKER} Anthropic/Google token counts are **estimates** ` +
        `(no exact local tokenizer; approximated via an OpenAI encoding).\n`,
    );
  }
  if (result.unknownModels.length > 0) {
    md.appendMarkdown(`\n_Skipped unknown models: ${result.unknownModels.join(", ")}._\n`);
  }
  return md;
}
