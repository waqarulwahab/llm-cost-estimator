// Smoke test: loads the *bundled* dist/extension.js with a mocked `vscode`
// module and exercises activate(), the estimate commands, the hover provider,
// the CodeLens provider, the live status bar, and the webview comparison panel.
// This catches CJS/bundling/wiring regressions that unit tests (which import
// source directly) cannot. Not shipped (scripts/ is in .vscodeignore).
//
// Run with: node scripts/smoke.js   (after `npm run compile`)
const Module = require("module");
const path = require("path");
const assert = require("assert");

const registeredCommands = new Map();
const hoverProviders = [];
const codeLensProviders = [];
const selectionListeners = [];
const messages = [];
const configUpdates = {};
let lastQuickPick = null;
let singlePickResponse = undefined;
let multiPickResponse = undefined;
let lastStatusBarItem = null;
let lastWebviewPanel = null;
const clip = { text: "" };

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}
class Range {
  constructor(sl, sc, el, ec) {
    this.start = sl instanceof Position ? sl : new Position(sl, sc);
    this.end = el instanceof Position ? el : new Position(el, ec);
  }
}
class MarkdownString {
  constructor(value, supportThemeIcons) {
    this.value = value || "";
    this.supportThemeIcons = !!supportThemeIcons;
  }
  appendMarkdown(s) {
    this.value += s;
    return this;
  }
}
class Hover {
  constructor(contents, range) {
    this.contents = contents;
    this.range = range;
  }
}
class CodeLens {
  constructor(range, command) {
    this.range = range;
    this.command = command;
  }
}
class EventEmitter {
  constructor() {
    this._cbs = [];
    this.event = (cb) => {
      this._cbs.push(cb);
      return { dispose() {} };
    };
  }
  fire(v) {
    this._cbs.forEach((cb) => cb(v));
  }
  dispose() {}
}
class Disposable {
  constructor(fn) {
    this._fn = fn;
  }
  dispose() {
    if (this._fn) this._fn();
  }
}
class Selection {
  constructor(anchor, active) {
    this.anchor = anchor;
    this.active = active;
    this.start = anchor;
    this.end = active;
  }
}

// Virtual workspace for the scan command.
const VFS = {
  "/proj/a.ts": 'const systemPrompt = "You are a careful, concise assistant for developers.";\nconst x = "hi";',
  "/proj/b.ts": 'const userMessage = "Summarize the following article in three short bullet points please.";',
  "/proj/readme.md": "# notes\njust prose, no quoted prompts here",
};
function makeUri(p) {
  return { path: p, fsPath: p, toString: () => "file://" + p };
}

const vscode = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  QuickPickItemKind: { Separator: -1, Default: 0 },
  ViewColumn: { Active: -1, Beside: -2, One: 1 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  ProgressLocation: { Notification: 15, Window: 10, SourceControl: 1 },
  TextEditorRevealType: { Default: 0, InCenter: 1 },
  Position,
  Range,
  Selection,
  MarkdownString,
  Hover,
  CodeLens,
  EventEmitter,
  Disposable,
  window: {
    activeTextEditor: undefined,
    createStatusBarItem() {
      lastStatusBarItem = {
        text: "",
        tooltip: undefined,
        command: undefined,
        show() {},
        hide() {},
        dispose() {},
      };
      return lastStatusBarItem;
    },
    createWebviewPanel(viewType, title) {
      const panel = {
        viewType,
        title,
        visible: true,
        _posted: [],
        _msg: null,
        _onDispose: null,
        webview: {
          _html: "",
          cspSource: "vscode-resource://test",
          get html() {
            return this._html;
          },
          set html(v) {
            this._html = v;
          },
          onDidReceiveMessage(cb) {
            panel._msg = cb;
            return { dispose() {} };
          },
          postMessage(msg) {
            panel._posted.push(msg);
            return Promise.resolve(true);
          },
          asWebviewUri(u) {
            return u;
          },
        },
        onDidDispose(cb) {
          panel._onDispose = cb;
          return { dispose() {} };
        },
        reveal() {
          panel._revealed = true;
        },
        dispose() {
          if (panel._onDispose) panel._onDispose();
        },
      };
      lastWebviewPanel = panel;
      return panel;
    },
    showInformationMessage(msg) {
      messages.push(["info", msg]);
      return Promise.resolve(undefined);
    },
    showWarningMessage(msg) {
      messages.push(["warn", msg]);
      return Promise.resolve(undefined);
    },
    async showQuickPick(items, opts) {
      lastQuickPick = items;
      return opts && opts.canPickMany ? multiPickResponse : singlePickResponse;
    },
    onDidChangeTextEditorSelection(cb) {
      selectionListeners.push(cb);
      return { dispose() {} };
    },
    onDidChangeActiveTextEditor() {
      return { dispose() {} };
    },
    async withProgress(_opts, task) {
      return task({ report() {} }, { isCancellationRequested: false });
    },
    async showTextDocument() {
      return {
        selection: undefined,
        revealRange() {},
      };
    },
  },
  commands: {
    registerCommand(id, cb) {
      registeredCommands.set(id, cb);
      return { dispose() {} };
    },
  },
  languages: {
    registerHoverProvider(selector, provider) {
      hoverProviders.push({ selector, provider });
      return { dispose() {} };
    },
    registerCodeLensProvider(selector, provider) {
      codeLensProviders.push({ selector, provider });
      return { dispose() {} };
    },
  },
  workspace: {
    getConfiguration() {
      const values = {
        models: ["gpt-4o", "claude-sonnet", "claude-haiku"],
        outputTokenAssumption: 500,
        currency: "USD",
        enableHover: true,
        enableCodeLens: true,
        enableStatusBarSelection: true,
        customModels: {
          "corp-gpt": {
            label: "Corp GPT",
            provider: "openai",
            inputPer1M: 1,
            outputPer1M: 2,
            contextWindow: 64000,
          },
        },
      };
      return {
        get: (key, dflt) => (key in values ? values[key] : dflt),
        update: (key, val) => {
          configUpdates[key] = val;
          return Promise.resolve();
        },
      };
    },
    onDidChangeConfiguration() {
      return { dispose() {} };
    },
    async findFiles() {
      return Object.keys(VFS).map(makeUri);
    },
    asRelativePath(uri) {
      return (uri.path || "").replace(/^\/proj\//, "");
    },
    async openTextDocument() {
      return { getText: () => "" };
    },
    fs: {
      async stat(uri) {
        return { size: Buffer.byteLength(VFS[uri.path] || "", "utf8") };
      },
      async readFile(uri) {
        return new Uint8Array(Buffer.from(VFS[uri.path] || "", "utf8"));
      },
    },
  },
  env: {
    clipboard: {
      writeText(t) {
        clip.text = t;
        return Promise.resolve();
      },
      readText() {
        return Promise.resolve(clip.text);
      },
    },
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") return vscode;
  return originalLoad.call(this, request, parent, isMain);
};

// ---- Fake editor/document helpers ---------------------------------------
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}
function fakeDocument(text, opts = {}) {
  const starts = lineStarts(text);
  const offsetAt = (pos) => starts[pos.line] + pos.character;
  const positionAt = (off) => {
    let line = 0;
    while (line + 1 < starts.length && starts[line + 1] <= off) line++;
    return new Position(line, off - starts[line]);
  };
  return {
    uri: { toString: () => opts.uri || "file:///smoke" },
    fileName: opts.fileName || "smoke.ts",
    isUntitled: !!opts.isUntitled,
    getText(range) {
      if (!range) return text;
      return text.slice(offsetAt(range.start), offsetAt(range.end));
    },
    offsetAt,
    positionAt,
    lineAt(line) {
      return { text: text.split("\n")[line] };
    },
  };
}
function wholeRange(text) {
  const lines = text.split("\n");
  return new Range(0, 0, lines.length - 1, lines[lines.length - 1].length);
}
function emptySelectionAt(line, ch) {
  const r = new Range(line, ch, line, ch);
  r.isEmpty = true;
  r.contains = () => false;
  return r;
}
function fullSelection(text) {
  const r = wholeRange(text);
  r.isEmpty = false;
  r.contains = () => true;
  return r;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ext = require(path.resolve(__dirname, "..", "dist", "extension.js"));
  assert(typeof ext.activate === "function", "activate should be exported");
  assert(typeof ext.deactivate === "function", "deactivate should be exported");

  const subscriptions = [];
  const globalState = {
    _store: {},
    get(k) {
      return this._store[k];
    },
    update(k, v) {
      this._store[k] = v;
      return Promise.resolve();
    },
  };
  ext.activate({ subscriptions, globalState });

  // Commands + providers registered.
  for (const id of [
    "llmCostEstimator.estimateSelection",
    "llmCostEstimator.estimateClipboard",
    "llmCostEstimator.estimateText",
    "llmCostEstimator.openComparisonPanel",
    "llmCostEstimator.selectModels",
    "llmCostEstimator.scanWorkspace",
    "llmCostEstimator.copyComparison",
    "llmCostEstimator.showLastBreakdown",
    "llmCostEstimator.resetSessionTotal",
    "llmCostEstimator.refreshPricing",
  ]) {
    assert(registeredCommands.has(id), `command ${id} should be registered`);
  }
  assert(hoverProviders.length === 1, "one hover provider should be registered");
  assert(codeLensProviders.length === 1, "one code lens provider should be registered");
  assert(selectionListeners.length === 1, "a selection listener should be registered");

  // --- Estimate command over a selection ---
  {
    const text = 'const prompt = "You are a helpful assistant.";';
    const doc = fakeDocument(text);
    vscode.window.activeTextEditor = { document: doc, selection: fullSelection(text) };
    await registeredCommands.get("llmCostEstimator.estimateSelection")();
    const modelRows = lastQuickPick.filter((i) => i.summary);
    assert(modelRows.length === 3, `expected 3 model rows, got ${modelRows.length}`);
    console.log("  quickpick:", modelRows.map((r) => `${r.label} ${r.description}`).join(" | "));
  }

  // --- Hover over a string literal (multi-line capable scanner) ---
  {
    const provider = hoverProviders[0].provider;
    const text = 'system_prompt = "Summarize the following text into three concise bullet points."';
    const doc = fakeDocument(text);
    vscode.window.activeTextEditor = { document: doc, selection: emptySelectionAt(0, 30) };
    const hover = await provider.provideHover(doc, new Position(0, 30), {});
    assert(hover && hover.contents instanceof MarkdownString, "hover should return markdown");
    const v = hover.contents.value;
    assert(/LLM Cost Estimate/.test(v), "hover heading");
    assert(/GPT-4o/.test(v) && /Claude/.test(v), "hover lists models");
    assert(/estimate/i.test(v), "hover estimate disclaimer");
  }

  // --- CodeLens over prompt sites ---
  {
    const provider = codeLensProviders[0].provider;
    const code = [
      'const systemPrompt = "You are concise and helpful.";',
      'const greeting = "hi";',
      'const userMessage = "Explain transformers like I am five, with a simple analogy.";',
    ].join("\n");
    const doc = fakeDocument(code);
    const lenses = provider.provideCodeLenses(doc, {});
    assert(lenses.length >= 2, `expected >= 2 lenses, got ${lenses.length}`);
    assert(
      lenses.every((l) => l.command.command === "llmCostEstimator.estimateText"),
      "lens command should be estimateText",
    );
    assert(typeof lenses[0].command.arguments[0] === "string", "lens passes the prompt text");
    console.log("  codelens[0]:", lenses[0].command.title);

    // Clicking a lens (estimateText) shows the breakdown.
    lastQuickPick = null;
    await registeredCommands.get("llmCostEstimator.estimateText")(lenses[0].command.arguments[0]);
    assert(Array.isArray(lastQuickPick), "estimateText should show a quick pick");
  }

  // --- Comparison panel (webview) ---
  {
    const text = "You are a helpful assistant that writes concise summaries of articles.";
    const doc = fakeDocument(text, { fileName: "demo.ts" });
    vscode.window.activeTextEditor = { document: doc, selection: emptySelectionAt(0, 0) };
    await registeredCommands.get("llmCostEstimator.openComparisonPanel")();
    assert(lastWebviewPanel, "a webview panel should be created");
    assert(/LLM Cost Comparison/.test(lastWebviewPanel.webview.html), "panel html renders");
    // Simulate the webview signaling it is ready.
    assert(typeof lastWebviewPanel._msg === "function", "panel registers a message handler");
    lastWebviewPanel._msg({ type: "ready" });
    await delay(0);
    const dataMsg = lastWebviewPanel._posted.find((m) => m.type === "data");
    assert(dataMsg, "panel should post data on ready");
    assert(dataMsg.models.length >= 20, `panel should compare the full catalog (${dataMsg.models.length})`);
    assert(
      dataMsg.models.every((m) => typeof m.inputTokens === "number" && m.inputPer1M >= 0),
      "panel data has tokens + pricing per model",
    );
    // Custom model from settings should be merged into the catalog.
    assert(
      dataMsg.models.some((m) => m.key === "corp-gpt"),
      "custom model (corp-gpt) should appear in the catalog",
    );
    console.log("  panel models compared:", dataMsg.models.length, "(incl. custom corp-gpt)");
  }

  // --- Workspace scan ---
  {
    await registeredCommands.get("llmCostEstimator.scanWorkspace")();
    const dataMsg = lastWebviewPanel._posted.find((m) => m.type === "data" && "totalPrompts" in m);
    assert(dataMsg, "scan should post a report to the webview");
    assert(dataMsg.totalPrompts >= 2, `scan should find prompts (${dataMsg.totalPrompts})`);
    assert(dataMsg.files.length >= 2, "scan report lists files with prompts");
    console.log(
      "  scan:",
      dataMsg.filesScanned,
      "files,",
      dataMsg.totalPrompts,
      "prompts,",
      dataMsg.totalTokens,
      "tokens",
    );
  }

  // --- Copy comparison as Markdown ---
  {
    const text = "Translate the following paragraph into formal French, preserving tone.";
    const doc = fakeDocument(text);
    vscode.window.activeTextEditor = { document: doc, selection: fullSelection(text) };
    clip.text = "";
    await registeredCommands.get("llmCostEstimator.copyComparison")();
    assert(/\| Model \|/.test(clip.text), "copyComparison should put a Markdown table on the clipboard");
    console.log("  clipboard markdown bytes:", clip.text.length);
  }

  // --- Estimate clipboard ---
  {
    clip.text = "Translate this sentence into French.";
    lastQuickPick = null;
    await registeredCommands.get("llmCostEstimator.estimateClipboard")();
    assert(Array.isArray(lastQuickPick), "estimateClipboard should show a quick pick");
  }

  // --- Select models writes the setting ---
  {
    multiPickResponse = [{ key: "gpt-4o" }, { key: "claude-haiku" }, { key: "gemini-2.5-pro" }];
    await registeredCommands.get("llmCostEstimator.selectModels")();
    assert(
      JSON.stringify(configUpdates.models) === JSON.stringify(["gpt-4o", "claude-haiku", "gemini-2.5-pro"]),
      "selectModels should update the models setting",
    );
  }

  // --- Refresh pricing (live pricing) with a stubbed fetch ---
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        "gpt-4o": {
          input_cost_per_token: 0.000005,
          output_cost_per_token: 0.00002,
          max_input_tokens: 128000,
        },
      }),
    });
    messages.length = 0;
    await registeredCommands.get("llmCostEstimator.refreshPricing")();
    globalThis.fetch = realFetch;

    const cache = globalState._store["llmCostEstimator.livePricing"];
    assert(cache?.overrides?.["gpt-4o"], "refresh should cache a gpt-4o override");
    assert(
      Math.abs(cache.overrides["gpt-4o"].inputPer1M - 5) < 1e-6,
      `gpt-4o live input price should be $5/1M, got ${cache.overrides["gpt-4o"].inputPer1M}`,
    );
    assert(messages.some(([, m]) => /refreshed pricing/i.test(m)), "refresh should notify");
    console.log("  refresh pricing: gpt-4o ->", cache.overrides["gpt-4o"].inputPer1M, "$/1M (live)");
  }

  // --- Live status bar on selection change (debounced) ---
  {
    const text = "Write a haiku about software bugs and debugging late at night.";
    const doc = fakeDocument(text);
    vscode.window.activeTextEditor = { document: doc, selection: fullSelection(text) };
    selectionListeners[0]({ textEditor: vscode.window.activeTextEditor });
    await delay(250); // wait out the debounce
    assert(/tok/.test(lastStatusBarItem.text), `status bar should show live tokens, got "${lastStatusBarItem.text}"`);
    console.log("  status bar (live):", lastStatusBarItem.text);
  }

  // --- showLastBreakdown + reset ---
  {
    lastQuickPick = null;
    await registeredCommands.get("llmCostEstimator.showLastBreakdown")();
    assert(Array.isArray(lastQuickPick), "showLastBreakdown should re-open the quick pick");
    await registeredCommands.get("llmCostEstimator.resetSessionTotal")();
    assert(messages.some(([, m]) => /reset/i.test(m)), "reset should notify");
  }

  ext.deactivate();
  console.log(
    "\n✓ e2e passed: commands, hover, codelens, comparison panel, custom models, workspace scan,",
    "copy-as-markdown, clipboard, selectModels, refresh pricing, live status bar",
  );
}

main().catch((err) => {
  console.error("✗ smoke test failed:", err);
  process.exit(1);
});
