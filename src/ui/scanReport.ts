import * as vscode from "vscode";
import type { ScanReport } from "../core/scan";
import { currencySymbol } from "../core/format";

/** Singleton webview showing the result of a workspace prompt scan. */
export class ScanReportPanel {
  private static instance: ScanReportPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private report: ScanReport | undefined;
  private uriByPath = new Map<string, vscode.Uri>();

  private constructor() {
    this.panel = vscode.window.createWebviewPanel(
      "llmCostScanReport",
      "LLM Cost — Workspace Scan",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage(
      (msg) => {
        if (msg?.type === "ready") {
          this.postData();
        } else if (msg?.type === "open" && typeof msg.path === "string") {
          void this.openAt(msg.path, Number(msg.line) || 0);
        }
      },
      undefined,
      this.disposables,
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  static show(report: ScanReport, uriByPath: Map<string, vscode.Uri>): void {
    if (!ScanReportPanel.instance) {
      ScanReportPanel.instance = new ScanReportPanel();
    }
    const inst = ScanReportPanel.instance;
    inst.report = report;
    inst.uriByPath = uriByPath;
    inst.panel.reveal(vscode.ViewColumn.Active);
    inst.postData();
  }

  private async openAt(path: string, line: number): Promise<void> {
    const uri = this.uriByPath.get(path);
    if (!uri) {
      return;
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
    const pos = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  private postData(): void {
    if (!this.report) {
      return;
    }
    const r = this.report;
    void this.panel.webview.postMessage({
      type: "data",
      currencySymbol: currencySymbol(r.currency),
      currency: r.currency,
      modelLabel: r.modelLabel,
      filesScanned: r.filesScanned,
      totalPrompts: r.totalPrompts,
      totalTokens: r.totalTokens,
      totalCost: r.totalCost,
      files: r.files.map((f) => ({
        path: f.path,
        promptCount: f.promptCount,
        tokens: f.tokens,
        cost: f.cost,
        line: f.prompts[0]?.line ?? 0,
      })),
    });
  }

  private html(): string {
    const nonce = makeNonce();
    const csp = `default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    return SCAN_HTML.replace(/__CSP__/g, csp).replace(/__NONCE__/g, nonce);
  }

  dispose(): void {
    ScanReportPanel.instance = undefined;
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

const SCAN_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="__CSP__" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 14px 16px 28px; }
  h1 { font-size: 1.15em; margin: 0 0 12px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .card { padding: 10px 14px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border, transparent); border-radius: 6px; min-width: 120px; }
  .card .v { font-size: 1.5em; font-weight: 700; }
  .card .l { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--vscode-widget-border, #8883); }
  th:first-child, td:first-child { text-align: left; }
  th { cursor: pointer; user-select: none; color: var(--vscode-descriptionForeground); }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: var(--vscode-list-hoverBackground); }
  .path { color: var(--vscode-textLink-foreground); }
  .empty { padding: 40px 0; text-align: center; color: var(--vscode-descriptionForeground); }
  .note { margin-top: 16px; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
</style>
</head>
<body>
  <h1>Workspace prompt scan</h1>
  <div class="cards" id="cards"></div>
  <table id="table" style="display:none">
    <thead>
      <tr>
        <th data-sort="path">File</th>
        <th data-sort="promptCount">Prompts</th>
        <th data-sort="tokens">Tokens</th>
        <th data-sort="cost">Cost / run</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="empty" id="empty" style="display:none">No prompt-like strings found in the scanned files.</div>
  <div class="note" id="note"></div>

<script nonce="__NONCE__">
  const vscode = acquireVsCodeApi();
  let state = null, sortKey = "cost", sortDir = 1;
  const el = (id) => document.getElementById(id);
  const fmtN = (n) => Math.round(n).toLocaleString("en-US");
  function fmtCost(v, sym, code) {
    const abs = Math.abs(v); const d = abs === 0 ? 2 : abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
    return (sym || (code ? code.toUpperCase() + " " : "")) + v.toFixed(d);
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
  function render() {
    if (!state) return;
    const sym = state.currencySymbol, code = state.currency;
    el("cards").innerHTML =
      card(fmtCost(state.totalCost, sym, code), "Est. cost / run") +
      card(fmtN(state.totalPrompts), "Prompts") +
      card(fmtN(state.totalTokens), "Tokens") +
      card(fmtN(state.filesScanned), "Files scanned");
    el("note").textContent = "Costs are for one run on " + state.modelLabel +
      ". Click a file to jump to its first prompt. Prices are placeholders — verify with each provider.";
    const has = state.files.length > 0;
    el("table").style.display = has ? "table" : "none";
    el("empty").style.display = has ? "none" : "block";
    if (!has) return;
    const data = state.files.slice().sort((a,b)=>{
      const av=a[sortKey], bv=b[sortKey];
      return (typeof av==="string"? av.localeCompare(bv): av-bv) * sortDir;
    });
    el("tbody").innerHTML = data.map((f)=>
      '<tr data-path="'+escapeHtml(f.path)+'" data-line="'+f.line+'">' +
      '<td class="path">'+escapeHtml(f.path)+'</td>' +
      '<td>'+fmtN(f.promptCount)+'</td>' +
      '<td>'+fmtN(f.tokens)+'</td>' +
      '<td>'+fmtCost(f.cost, sym, code)+'</td></tr>'
    ).join("");
    el("tbody").querySelectorAll("tr").forEach((tr)=>{
      tr.addEventListener("click", ()=> vscode.postMessage({ type:"open", path: tr.dataset.path, line: Number(tr.dataset.line) }));
    });
  }
  function card(v, l){ return '<div class="card"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>'; }
  document.querySelectorAll("th").forEach((th)=> th.addEventListener("click", ()=>{
    const k = th.dataset.sort; if (sortKey===k) sortDir*=-1; else { sortKey=k; sortDir = k==="path"?1:-1; } render();
  }));
  window.addEventListener("message", (e)=>{ if (e.data && e.data.type==="data"){ state = e.data; render(); } });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
