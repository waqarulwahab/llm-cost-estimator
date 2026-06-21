# Publishing & Release Guide

This repo ships **two artifacts** from one shared core:

| Artifact | Goes to | Users install with |
| --- | --- | --- |
| **VS Code extension** (`llm-cost-estimator`) | VS Code Marketplace + Open VSX | Marketplace search, or a `.vsix` |
| **MCP server** (`llm-cost-estimator-mcp`) | npm | `npx -y llm-cost-estimator-mcp` |

You can publish **manually** (a few commands) or **automatically** (push a git
tag → GitHub Actions does everything). Both are covered below.

---

## 1. One-time setup

### 1a. VS Code Marketplace (extension)

1. Create a **publisher** at <https://marketplace.visualstudio.com/manage> (the
   `publisher` field in `package.json` must match — currently `waqarulwahab`).
2. Create an Azure DevOps **Personal Access Token** with the **Marketplace →
   Manage** scope: <https://dev.azure.com> → User settings → Personal access
   tokens. Copy it — this is your `VSCE_PAT`.

### 1b. Open VSX (optional — for Cursor / VSCodium / Gitpod users)

1. Sign in at <https://open-vsx.org> with GitHub, create a namespace matching the
   publisher.
2. Generate an access token (`OVSX_PAT`).

### 1c. npm (MCP server)

1. Create/sign in to an npm account: `npm login` (or <https://www.npmjs.com>).
2. Create an **Automation** access token at
   <https://www.npmjs.com/settings/~/tokens> → this is your `NPM_TOKEN`.

### 1d. Add the tokens as GitHub repo secrets (for automated releases)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Used for | Required? |
| --- | --- | --- |
| `VSCE_PAT` | Publish extension to Marketplace | optional |
| `OVSX_PAT` | Publish extension to Open VSX | optional |
| `NPM_TOKEN` | Publish MCP server to npm | optional |

The release workflow skips any publish step whose secret is missing, so you can
add them one at a time.

---

## 2. Automated release (recommended)

Everything is wired so a **version tag** cuts a full release:

```bash
# 1. Bump versions (keep extension + MCP in sync)
npm version 0.4.0 --no-git-tag-version
npm version --prefix mcp-server 0.4.0 --no-git-tag-version
# update CHANGELOG.md, then commit
git add -A && git commit -m "release: v0.4.0"

# 2. Tag and push
git tag v0.4.0
git push origin main --tags
```

On the tag push, [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Runs lint · typecheck · tests · e2e (fails the release if anything is red).
2. Packages the `.vsix` and **creates a GitHub Release** with it attached + auto
   notes (always).
3. Publishes to the **Marketplace** (if `VSCE_PAT`), **Open VSX** (if `OVSX_PAT`),
   and **npm** (if `NPM_TOKEN`).
4. If `NPM_TOKEN` is set, also lists the MCP server on the **Official MCP
   Registry** via GitHub OIDC — no extra token needed (the `id-token: write`
   permission proves ownership of the `io.github.waqarulwahab/*` namespace).

---

## 3. Manual publishing

### Extension → Marketplace

```bash
npm run package                       # production bundle
npx @vscode/vsce login waqarulwahab   # paste VSCE_PAT once
npx @vscode/vsce publish              # or: vsce publish minor / patch
```

### Extension → Open VSX

```bash
npx @vscode/vsce package --no-dependencies
npx ovsx publish llm-cost-estimator-*.vsix -p "<OVSX_PAT>"
```

### MCP server → npm

```bash
cd mcp-server
npm test                  # build + stdio handshake check
npm publish --access public
```

(`prepublishOnly` rebuilds the production bundle automatically.)

---

## 4. How end users consume each artifact

### The VS Code extension

- **Marketplace:** Extensions view → search **"LLM Cost & Token Estimator"** →
  Install.
- **Or a `.vsix`:** `code --install-extension llm-cost-estimator-0.3.1.vsix`
  (download from the GitHub Release).

### The MCP server (Claude / Cursor)

Once on npm, no local build is needed — clients launch it via `npx`:

```jsonc
// Claude Desktop: %APPDATA%\Claude\claude_desktop_config.json  (Windows)
//                 ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
{
  "mcpServers": {
    "llm-cost-estimator": { "command": "npx", "args": ["-y", "llm-cost-estimator-mcp"] }
  }
}
```

```bash
# Claude Code (CLI)
claude mcp add llm-cost-estimator -- npx -y llm-cost-estimator-mcp
```

```jsonc
// Cursor: ~/.cursor/mcp.json
{ "mcpServers": { "llm-cost-estimator": { "command": "npx", "args": ["-y", "llm-cost-estimator-mcp"] } } }
```

Full MCP details: [mcp-server/README.md](mcp-server/README.md).

---

## 5. Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push/PR to
`main`:

- **Extension job:** `npm ci` → lint → typecheck → unit + load tests → e2e →
  package `.vsix` (uploaded as a build artifact).
- **MCP job:** `npm ci` → typecheck → stdio end-to-end test.

A red build blocks releases, since the release workflow re-runs the same checks.
