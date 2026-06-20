import * as vscode from "vscode";
import { estimate } from "../core/estimator";
import { findStringAt, findStrings } from "../core/detect";
import type { ExtensionSettings } from "../settings";
import { renderComparisonMarkdown } from "./markdown";

// Above this document size we only scan the hovered line (not the whole file)
// to keep hovers instant.
const WHOLE_DOC_SCAN_LIMIT = 200_000;

/**
 * Shows token counts and a multi-model cost comparison when hovering over a
 * selection or a string literal. The primary, delightful interaction.
 *
 * Only the small hovered range is tokenized — never the whole file.
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

    return new vscode.Hover(
      renderComparisonMarkdown(result, { heading: "LLM Cost Estimate" }),
      target.range,
    );
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

  // 2) Otherwise, the string literal under the cursor.
  return findStringTarget(document, position);
}

function findStringTarget(
  document: vscode.TextDocument,
  position: vscode.Position,
): HoverTarget | undefined {
  // Whole-document scan handles multi-line template literals, but is bounded for
  // performance; very large files fall back to a single-line scan.
  if (document.getText().length <= WHOLE_DOC_SCAN_LIMIT) {
    const span = findStringAt(document.getText(), document.offsetAt(position));
    if (!span) {
      return undefined;
    }
    const range = new vscode.Range(
      document.positionAt(span.contentStart),
      document.positionAt(span.contentEnd),
    );
    return { text: span.content, range };
  }

  // Large-file fallback: scan just the current line.
  const lineText = document.lineAt(position.line).text;
  for (const span of findStrings(lineText)) {
    if (position.character >= span.contentStart && position.character <= span.contentEnd) {
      const range = new vscode.Range(
        position.line,
        span.contentStart,
        position.line,
        span.contentEnd,
      );
      return { text: span.content, range };
    }
  }
  return undefined;
}
