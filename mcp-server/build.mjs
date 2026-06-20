// Bundles the MCP server (and the reused core logic from ../src) into a single
// self-contained ESM file with a node shebang, so it runs via `npx` / `node`.
import * as esbuild from "esbuild";

const production = process.argv.includes("--production");

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/index.js",
  banner: { js: "#!/usr/bin/env node" },
  minify: production,
  sourcemap: false,
  logLevel: "info",
});

console.error("[build] mcp-server bundled -> dist/index.js");
