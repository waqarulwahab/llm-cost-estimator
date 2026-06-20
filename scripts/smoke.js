// Smoke test: loads the *bundled* dist/extension.js with a mocked `vscode`
// module and exercises activate(), the estimate command, and the hover provider.
// This catches CJS/bundling/wiring regressions that unit tests (which import
// source directly) cannot. Not shipped (scripts/ is in .vscodeignore).
//
// Run with: node scripts/smoke.js   (after `npm run compile`)
const Module = require("module");
const path = require("path");
const assert = require("assert");

// ---- Minimal vscode stub -------------------------------------------------
const registeredCommands = new Map();
const hoverProviders = [];
const messages = [];
let lastQuickPick = null;
const clipboard = { text: "" };

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}
class Range {
  constructor(sl, sc, el, ec) {
    this.start = new Position(sl, sc);
    this.end = new Position(el, ec);
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

const vscode = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  QuickPickItemKind: { Separator: -1, Default: 0 },
  Position,
  Range,
  MarkdownString,
  Hover,
  window: {
    activeTextEditor: undefined,
    createStatusBarItem() {
      return {
        text: "",
        tooltip: undefined,
        command: undefined,
        show() {},
        hide() {},
        dispose() {},
      };
    },
    showInformationMessage(msg) {
      messages.push(["info", msg]);
      return Promise.resolve(undefined);
    },
    showWarningMessage(msg) {
      messages.push(["warn", msg]);
      return Promise.resolve(undefined);
    },
    async showQuickPick(items) {
      lastQuickPick = items;
      return undefined; // simulate user dismissing
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
  },
  workspace: {
    getConfiguration() {
      const values = {
        models: ["gpt-4o", "claude-sonnet", "claude-haiku"],
        outputTokenAssumption: 500,
        currency: "USD",
        enableHover: true,
      };
      return { get: (key, dflt) => (key in values ? values[key] : dflt) };
    },
  },
  env: {
    clipboard: {
      writeText(t) {
        clipboard.text = t;
        return Promise.resolve();
      },
    },
  },
};

// Intercept `require("vscode")`.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") {
    return vscode;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// ---- Fake editor/document helpers ---------------------------------------
function fakeDocument(lines) {
  return {
    uri: { toString: () => "file:///smoke" },
    getText(range) {
      if (!range) {
        return lines.join("\n");
      }
      // single-line range slice (sufficient for these tests)
      return lines[range.start.line].slice(range.start.character, range.end.character);
    },
    lineAt(line) {
      return { text: lines[line] };
    },
  };
}

async function main() {
  const ext = require(path.resolve(__dirname, "..", "dist", "extension.js"));
  assert(typeof ext.activate === "function", "activate should be exported");
  assert(typeof ext.deactivate === "function", "deactivate should be exported");

  const subscriptions = [];
  ext.activate({ subscriptions });

  // Commands + hover provider registered.
  for (const id of [
    "llmCostEstimator.estimateSelection",
    "llmCostEstimator.showLastBreakdown",
    "llmCostEstimator.resetSessionTotal",
  ]) {
    assert(registeredCommands.has(id), `command ${id} should be registered`);
  }
  assert(hoverProviders.length === 1, "one hover provider should be registered");
  assert(subscriptions.length >= 4, "disposables should be pushed to subscriptions");

  // --- Estimate command over a selection ---
  const doc = fakeDocument(['const prompt = "You are a helpful assistant.";']);
  const selection = {
    isEmpty: false,
    start: new Position(0, 16),
    end: new Position(0, 44),
    contains: () => true,
  };
  vscode.window.activeTextEditor = { document: doc, selection };

  await registeredCommands.get("llmCostEstimator.estimateSelection")();
  assert(Array.isArray(lastQuickPick), "estimate command should show a quick pick");
  const modelRows = lastQuickPick.filter((i) => i.summary);
  assert(modelRows.length === 3, `expected 3 model rows, got ${modelRows.length}`);
  assert(
    modelRows.every((i) => /total/.test(i.description)),
    "each row should show a total cost",
  );
  console.log("  quickpick rows:", modelRows.map((r) => `${r.label} ${r.description}`).join(" | "));

  // --- Hover over a string literal ---
  const provider = hoverProviders[0].provider;
  const hoverDoc = fakeDocument(['  system_prompt = "Summarize the following text."']);
  // position inside the string literal
  const hover = await provider.provideHover(hoverDoc, new Position(0, 25), {});
  assert(hover && hover.contents instanceof MarkdownString, "hover should return markdown");
  assert(/LLM Cost Estimate/.test(hover.contents.value), "hover should have a heading");
  assert(/GPT-4o/.test(hover.contents.value), "hover should list GPT-4o");
  assert(/Claude/.test(hover.contents.value), "hover should list a Claude model");
  assert(/estimate/i.test(hover.contents.value), "hover should carry the estimate disclaimer");

  // --- Hover where there is no string literal returns nothing ---
  const noHover = await provider.provideHover(fakeDocument(["let x = 42;"]), new Position(0, 8), {});
  assert(noHover === undefined, "hover over non-string should return undefined");

  // --- showLastBreakdown re-opens the quick pick ---
  lastQuickPick = null;
  await registeredCommands.get("llmCostEstimator.showLastBreakdown")();
  assert(Array.isArray(lastQuickPick), "showLastBreakdown should re-open the quick pick");

  // --- reset ---
  await registeredCommands.get("llmCostEstimator.resetSessionTotal")();
  assert(
    messages.some(([, m]) => /reset/i.test(m)),
    "reset should notify the user",
  );

  ext.deactivate();
  console.log("\n✓ smoke test passed: activate, estimate command, hover, breakdown, reset all work");
}

main().catch((err) => {
  console.error("✗ smoke test failed:", err);
  process.exit(1);
});
