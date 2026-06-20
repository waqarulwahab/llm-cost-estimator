import * as vscode from "vscode";
import { estimate } from "../core/estimator";
import { resultToMarkdown } from "../core/export";
import { getModelPricing, listModels } from "../pricing/pricing";
import { currencySymbol } from "../core/format";
import type { ExtensionSettings } from "../settings";

function basename(p: string): string {
  if (!p) {
    return "untitled";
  }
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

interface Source {
  text: string;
  title: string;
}

/** Resolves the text to compare: the active selection, or the whole file. */
function currentSource(): Source {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { text: "", title: "No active editor" };
  }
  const name = editor.document.isUntitled ? "untitled" : basename(editor.document.fileName);
  const sel = editor.selection;
  if (!sel.isEmpty) {
    return { text: editor.document.getText(sel), title: `Selection · ${name}` };
  }
  return { text: editor.document.getText(), title: `Whole file · ${name}` };
}

function buildPayload(text: string, title: string, settings: ExtensionSettings) {
  const result = estimate(text, {
    models: listModels(),
    outputTokenAssumption: settings.outputTokenAssumption,
    currency: settings.currency,
  });
  const models = result.estimates.map((e) => {
    const pricing = getModelPricing(e.model);
    return {
      key: e.model,
      label: e.label,
      provider: e.provider,
      isEstimate: e.isEstimate,
      inputTokens: e.inputTokens,
      inputPer1M: pricing?.inputPer1M ?? 0,
      outputPer1M: pricing?.outputPer1M ?? 0,
      contextWindow: pricing?.contextWindow ?? null,
    };
  });
  return {
    type: "data" as const,
    title,
    charCount: text.length,
    outputTokens: result.outputTokenAssumption,
    currency: result.currency,
    currencySymbol: currencySymbol(result.currency),
    configured: settings.models,
    models,
  };
}

/**
 * Singleton webview panel comparing the current selection/file across the whole
 * model catalog, with a live output-token slider (costs recompute client-side,
 * so the slider is instant — no re-tokenization needed).
 */
export class ComparisonPanel {
  private static instance: ComparisonPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(private readonly getSettings: () => ExtensionSettings) {
    this.panel = vscode.window.createWebviewPanel(
      "llmCostComparison",
      "LLM Cost Comparison",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel.webview.html = this.html();

    this.panel.webview.onDidReceiveMessage(
      (msg) => {
        if (msg?.type === "ready" || msg?.type === "refresh") {
          this.postData();
        } else if (msg?.type === "copy") {
          this.copyMarkdown(Number(msg.outputTokens));
        }
      },
      undefined,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  static show(getSettings: () => ExtensionSettings): void {
    if (ComparisonPanel.instance) {
      ComparisonPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      ComparisonPanel.instance.postData();
      return;
    }
    ComparisonPanel.instance = new ComparisonPanel(getSettings);
  }

  /** Re-pushes data if the panel is currently open (used on selection change). */
  static refreshIfOpen(): void {
    ComparisonPanel.instance?.postData();
  }

  private postData(): void {
    const { text, title } = currentSource();
    void this.panel.webview.postMessage(buildPayload(text, title, this.getSettings()));
  }

  private copyMarkdown(outputTokens: number): void {
    const settings = this.getSettings();
    const { text } = currentSource();
    const result = estimate(text, {
      models: listModels(),
      outputTokenAssumption: Number.isFinite(outputTokens)
        ? outputTokens
        : settings.outputTokenAssumption,
      currency: settings.currency,
    });
    if (result.estimates.length === 0) {
      vscode.window.showInformationMessage("LLM Cost: nothing to copy.");
      return;
    }
    void vscode.env.clipboard.writeText(resultToMarkdown(result));
    vscode.window.showInformationMessage("LLM Cost: comparison copied to clipboard as Markdown.");
  }

  private html(): string {
    const nonce = makeNonce();
    const csp = `default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    return PANEL_HTML.replace(/__CSP__/g, csp).replace(/__NONCE__/g, nonce);
  }

  dispose(): void {
    ComparisonPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// Self-contained webview document. Data arrives via postMessage; costs are
// computed in the page so the output-token slider updates instantly.
const PANEL_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="__CSP__" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 14px 16px 28px;
  }
  h1 { font-size: 1.15em; margin: 0 0 2px; }
  .sub { color: var(--vscode-descriptionForeground); margin-bottom: 14px; }
  .controls {
    display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: center;
    padding: 12px 14px; margin-bottom: 14px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border, transparent);
    border-radius: 6px;
  }
  .control { display: flex; align-items: center; gap: 8px; }
  .control label { color: var(--vscode-descriptionForeground); }
  input[type="range"] { width: 180px; accent-color: var(--vscode-progressBar-background); }
  input[type="number"] {
    width: 84px; padding: 3px 6px;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--vscode-contrastBorder, #8884));
    border-radius: 4px;
  }
  button {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
    border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: 7px 10px; border-bottom: 1px solid var(--vscode-widget-border, #8883); }
  th:first-child, td:first-child { text-align: left; }
  th { cursor: pointer; user-select: none; color: var(--vscode-descriptionForeground); font-weight: 600; white-space: nowrap; }
  th.active::after { content: " \\25BC"; font-size: 0.8em; }
  tbody tr:hover { background: var(--vscode-list-hoverBackground); }
  tr.cheapest td { background: var(--vscode-editor-selectionHighlightBackground, #2d6); }
  tr.cheapest td:first-child::before { content: "\\2605 "; color: var(--vscode-charts-yellow, gold); }
  .prov { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
  .badge {
    display: inline-block; font-size: 0.72em; padding: 0 5px; border-radius: 8px; margin-left: 6px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
  }
  .est { color: var(--vscode-charts-orange, #d80); }
  .note { margin-top: 16px; color: var(--vscode-descriptionForeground); font-size: 0.9em; line-height: 1.5; }
  .note a { color: var(--vscode-textLink-foreground); }
  .empty { padding: 40px 0; text-align: center; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>
  <h1>LLM Cost Comparison</h1>
  <div class="sub" id="sub">Loading…</div>

  <div class="controls" id="controls" style="display:none">
    <div class="control">
      <label for="slider">Output tokens</label>
      <input type="range" id="slider" min="0" max="4000" step="50" />
      <input type="number" id="outNum" min="0" />
    </div>
    <div class="control">
      <input type="checkbox" id="configuredOnly" />
      <label for="configuredOnly">Configured models only</label>
    </div>
    <div class="control">
      <button id="refresh">↻ Refresh from editor</button>
      <button id="copy">⧉ Copy as Markdown</button>
    </div>
  </div>

  <table id="table" style="display:none">
    <thead>
      <tr>
        <th data-sort="label">Model</th>
        <th data-sort="inputTokens">Tokens</th>
        <th data-sort="inputCost">Input</th>
        <th data-sort="outputCost">Output</th>
        <th data-sort="total" class="active">Total</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>

  <div class="empty" id="empty" style="display:none">
    No text to compare. Select some text (or open a file) and click <b>Refresh from editor</b>.
  </div>

  <div class="note">
    Total = input + the assumed output tokens above. Output pricing usually
    dominates, so the slider matters. <span class="est">Orange ~</span> = non-OpenAI
    token counts are estimates (approximated via an OpenAI encoding).<br />
    ⚠️ Prices are representative placeholders — always verify against each
    provider's official pricing page.
  </div>

<script nonce="__NONCE__">
  const vscode = acquireVsCodeApi();
  let state = null;
  let sortKey = "total";
  let sortDir = 1; // 1 = ascending
  let configuredOnly = false;

  const el = (id) => document.getElementById(id);

  function fmtTokens(n) { return Math.round(n).toLocaleString("en-US"); }
  function fmtCost(v, sym, code) {
    const abs = Math.abs(v);
    const digits = abs === 0 ? 2 : abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
    const prefix = sym || (code ? code.toUpperCase() + " " : "");
    return prefix + v.toFixed(digits);
  }

  function rows(outTokens) {
    const list = (state.models || []).filter(
      (m) => !configuredOnly || (state.configured || []).includes(m.key),
    );
    return list.map((m) => {
      const inputCost = (m.inputTokens / 1e6) * m.inputPer1M;
      const outputCost = (outTokens / 1e6) * m.outputPer1M;
      return { ...m, inputCost, outputCost, total: inputCost + outputCost };
    });
  }

  function render() {
    if (!state) return;
    const out = Number(el("outNum").value);
    el("sub").textContent =
      state.title + " · " + fmtTokens(state.charCount) + " chars · " +
      (state.models ? state.models.length : 0) + " models · assuming " +
      fmtTokens(out) + " output tokens";

    const hasText = state.charCount > 0 && state.models && state.models.length > 0;
    el("controls").style.display = "flex";
    el("table").style.display = hasText ? "table" : "none";
    el("empty").style.display = hasText ? "none" : "block";
    if (!hasText) return;

    let data = rows(out);
    data.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });
    const minTotal = Math.min.apply(null, data.map((d) => d.total));

    const sym = state.currencySymbol, code = state.currency;
    el("tbody").innerHTML = data
      .map((d) => {
        const est = d.isEstimate ? '<span class="est"> ~</span>' : "";
        const over =
          d.contextWindow && d.inputTokens + out > d.contextWindow
            ? '<span class="est" title="exceeds context window"> ⚠</span>'
            : "";
        const cheap = d.total === minTotal ? ' class="cheapest"' : "";
        return (
          "<tr" + cheap + "><td>" + escapeHtml(d.label) + est + over +
          '<span class="prov">  ' + escapeHtml(d.provider) + "</span></td>" +
          "<td>" + fmtTokens(d.inputTokens) + "</td>" +
          "<td>" + fmtCost(d.inputCost, sym, code) + "</td>" +
          "<td>" + fmtCost(d.outputCost, sym, code) + "</td>" +
          "<td>" + fmtCost(d.total, sym, code) + "</td></tr>"
        );
      })
      .join("");

    document.querySelectorAll("th").forEach((th) => {
      th.classList.toggle("active", th.dataset.sort === sortKey);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  el("slider").addEventListener("input", (e) => { el("outNum").value = e.target.value; render(); });
  el("outNum").addEventListener("input", (e) => {
    let v = Math.max(0, Number(e.target.value) || 0);
    el("slider").value = Math.min(v, 4000);
    render();
  });
  el("configuredOnly").addEventListener("change", (e) => { configuredOnly = e.target.checked; render(); });
  el("refresh").addEventListener("click", () => vscode.postMessage({ type: "refresh" }));
  el("copy").addEventListener("click", () =>
    vscode.postMessage({ type: "copy", outputTokens: Number(el("outNum").value) }),
  );
  document.querySelectorAll("th").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = key === "label" ? 1 : 1; }
      render();
    });
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg && msg.type === "data") {
      state = msg;
      el("slider").value = Math.min(msg.outputTokens, 4000);
      el("outNum").value = msg.outputTokens;
      render();
    }
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
