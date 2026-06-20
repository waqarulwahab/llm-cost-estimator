// End-to-end test: spawns the built MCP server and drives it over stdio with a
// real JSON-RPC handshake (initialize -> tools/list -> tools/call). Verifies the
// server actually responds correctly — not just that it builds.
import { spawn } from "node:child_process";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(dir, "..", "dist", "index.js");

const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
child.on("error", (e) => {
  console.error("✗ failed to spawn server:", e);
  process.exit(1);
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on("data", () => {}); // server logs go to stderr — ignore

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}
function request(id, method, params) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting for " + method)), 15000);
    pending.set(id, (m) => {
      clearTimeout(t);
      resolve(m);
    });
    send({ jsonrpc: "2.0", id, method, params });
  });
}

try {
  // 1) initialize
  const init = await request(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mcp-test", version: "1.0.0" },
  });
  assert(init.result, "initialize should return a result");
  assert.equal(init.result.serverInfo?.name, "llm-cost-estimator", "server name");
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  // 2) tools/list
  const list = await request(2, "tools/list", {});
  const names = list.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["count_tokens", "estimate_cost", "list_models"], "registered tools");

  // 3) estimate_cost
  const est = await request(3, "tools/call", {
    name: "estimate_cost",
    arguments: {
      text: "You are a helpful assistant that summarizes articles.",
      models: ["gpt-4o", "claude-haiku", "gemini-2.5-flash"],
      outputTokens: 200,
    },
  });
  const estText = est.result.content[0].text;
  assert(/GPT-4o/.test(estText) && /Claude Haiku/.test(estText), "estimate lists models");
  assert(/```json/.test(estText), "estimate includes structured JSON");

  // 4) count_tokens — exact for OpenAI
  const ct = await request(4, "tools/call", {
    name: "count_tokens",
    arguments: { text: "Hello, world!", model: "gpt-4o" },
  });
  const ctObj = JSON.parse(ct.result.content[0].text);
  assert.equal(ctObj.tokens, 4, `Hello, world! should be 4 tokens, got ${ctObj.tokens}`);
  assert.equal(ctObj.isEstimate, false, "OpenAI count is exact");

  // 5) list_models
  const lm = await request(5, "tools/call", { name: "list_models", arguments: {} });
  const models = JSON.parse(lm.result.content[0].text);
  assert(models.length >= 25, `expected >= 25 models, got ${models.length}`);

  // 6) unknown model -> error result
  const bad = await request(6, "tools/call", {
    name: "count_tokens",
    arguments: { text: "hi", model: "nope" },
  });
  assert.equal(bad.result.isError, true, "unknown model returns an error result");

  console.log("✓ MCP server verified over stdio:");
  console.log("  tools:", names.join(", "));
  console.log("  estimate_cost: OK · count_tokens(gpt-4o, 'Hello, world!')=4 · list_models:", models.length);
  child.kill();
  process.exit(0);
} catch (err) {
  console.error("✗ MCP test failed:", err.message);
  child.kill();
  process.exit(1);
}
