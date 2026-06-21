// Renders a static PNG of the demo (the VS Code Marketplace blocks SVG in
// READMEs). Uses @resvg/resvg-js (install with: npm i @resvg/resvg-js --no-save).
// Run: node scripts/generate-demo-png.mjs
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(dir, "..", "images", "demo.png");

const MONO = "Consolas, 'Courier New', monospace";
const SANS = "'Segoe UI', Arial, sans-serif";

// Static (non-animated) version of images/demo.svg — card fully visible, fonts
// set explicitly so the rasterizer renders text reliably.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 470" width="760" height="470">
  <rect x="20" y="20" width="720" height="430" rx="12" fill="#181825" stroke="#313244" stroke-width="1.5"/>
  <circle cx="46" cy="46" r="5" fill="#f38ba8"/>
  <circle cx="64" cy="46" r="5" fill="#f9e2af"/>
  <circle cx="82" cy="46" r="5" fill="#a6e3a1"/>
  <text x="380" y="50" text-anchor="middle" font-family="${MONO}" font-size="12" fill="#6c7086">agent.ts — LLM Cost &amp; Token Estimator</text>
  <line x1="20" y1="66" x2="740" y2="66" stroke="#313244" stroke-width="1"/>

  <text font-family="${MONO}" font-size="14.5" x="44" y="102" fill="#6c7086">1</text>
  <text font-family="${MONO}" font-size="14.5" x="70" y="102" fill="#6c7086">// the system prompt for our agent</text>
  <text font-family="${MONO}" font-size="14.5" x="44" y="134" fill="#6c7086">2</text>
  <text font-family="${MONO}" font-size="14.5" x="70" y="134"><tspan fill="#cba6f7">const</tspan><tspan fill="#cdd6f4"> </tspan><tspan fill="#89b4fa">systemPrompt</tspan><tspan fill="#cdd6f4"> = </tspan><tspan fill="#a6e3a1">"You are a helpful assistant."</tspan><tspan fill="#cdd6f4">;</tspan></text>
  <rect x="247" y="139" width="218" height="2.5" rx="1.25" fill="#89b4fa"/>

  <rect x="120" y="172" width="520" height="244" rx="10" fill="#11111b" stroke="#45475a" stroke-width="1.5"/>
  <text x="142" y="202" font-family="${SANS}" font-size="15" font-weight="700" fill="#cdd6f4">LLM Cost Estimate</text>
  <rect x="300" y="189" width="92" height="18" rx="9" fill="#1e1e2e" stroke="#45475a"/>
  <text x="346" y="202" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#a6adc8">16 tokens</text>

  <text x="142" y="234" font-family="${MONO}" font-size="11" fill="#6c7086">MODEL</text>
  <text x="470" y="234" font-family="${MONO}" font-size="11" fill="#6c7086" text-anchor="end">TOKENS</text>
  <text x="618" y="234" font-family="${MONO}" font-size="11" fill="#6c7086" text-anchor="end">TOTAL*</text>
  <line x1="142" y1="244" x2="618" y2="244" stroke="#313244"/>

  <rect x="130" y="252" width="500" height="30" rx="6" fill="#26233a"/>
  <text x="142" y="272" font-family="${SANS}" font-size="13" fill="#f9e2af">★</text>
  <text x="160" y="272" font-family="${SANS}" font-size="13.5" fill="#cdd6f4">Claude Haiku <tspan fill="#fab387">~</tspan></text>
  <text x="470" y="272" font-family="${MONO}" font-size="13" fill="#a6adc8" text-anchor="end">16</text>
  <text x="618" y="272" font-family="${MONO}" font-size="13.5" fill="#a6e3a1" text-anchor="end" font-weight="700">~$0.0020</text>

  <text x="160" y="306" font-family="${SANS}" font-size="13.5" fill="#cdd6f4">GPT-4o</text>
  <text x="470" y="306" font-family="${MONO}" font-size="13" fill="#a6adc8" text-anchor="end">16</text>
  <text x="618" y="306" font-family="${MONO}" font-size="13.5" fill="#cdd6f4" text-anchor="end">$0.0050</text>

  <text x="160" y="338" font-family="${SANS}" font-size="13.5" fill="#cdd6f4">Claude Sonnet <tspan fill="#fab387">~</tspan></text>
  <text x="470" y="338" font-family="${MONO}" font-size="13" fill="#a6adc8" text-anchor="end">16</text>
  <text x="618" y="338" font-family="${MONO}" font-size="13.5" fill="#cdd6f4" text-anchor="end">~$0.0075</text>

  <line x1="142" y1="360" x2="618" y2="360" stroke="#313244"/>
  <text x="142" y="382" font-family="${SANS}" font-size="11" fill="#6c7086">★ cheapest · <tspan fill="#fab387">~</tspan> estimate (non-OpenAI) · total = input + 500 assumed output tokens</text>
  <text x="142" y="402" font-family="${SANS}" font-size="11" fill="#7f849c">Compare 25+ models · local-first · no API key</text>
</svg>`;

const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1520 }, background: "transparent" });
const png = resvg.render().asPng();
fs.writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
