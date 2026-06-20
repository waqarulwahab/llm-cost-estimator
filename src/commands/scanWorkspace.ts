import * as vscode from "vscode";
import { scanTexts } from "../core/scan";
import { ScanReportPanel } from "../ui/scanReport";
import type { ExtensionSettings } from "../settings";

const INCLUDE_GLOB = "**/*.{js,jsx,ts,tsx,mjs,cjs,py,md,txt,json,jsonc,yaml,yml}";
const EXCLUDE_GLOB = "**/{node_modules,dist,out,build,.git,coverage,vendor,.next,.venv}/**";
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1_000_000;

/**
 * Command handler for "LLM Cost: Scan Workspace for Prompts". Finds prompt-like
 * strings across the workspace and shows an aggregated cost report.
 */
export async function scanWorkspace(getSettings: () => ExtensionSettings): Promise<void> {
  const settings = getSettings();
  const uris = await vscode.workspace.findFiles(INCLUDE_GLOB, EXCLUDE_GLOB, MAX_FILES);
  if (uris.length === 0) {
    vscode.window.showInformationMessage("LLM Cost: no scannable files found in the workspace.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "LLM Cost: scanning workspace for prompts…",
      cancellable: true,
    },
    async (progress, token) => {
      const files: { path: string; text: string }[] = [];
      const uriByPath = new Map<string, vscode.Uri>();
      let done = 0;

      for (const uri of uris) {
        if (token.isCancellationRequested) {
          break;
        }
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.size <= MAX_FILE_BYTES) {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(bytes).toString("utf8");
            const relPath = vscode.workspace.asRelativePath(uri);
            files.push({ path: relPath, text });
            uriByPath.set(relPath, uri);
          }
        } catch {
          // unreadable / binary file — skip
        }
        done++;
        if (done % 25 === 0) {
          progress.report({ message: `${done} / ${uris.length} files` });
        }
      }

      const report = scanTexts(files, settings);
      if (report.totalPrompts === 0) {
        vscode.window.showInformationMessage(
          `LLM Cost: scanned ${report.filesScanned} files, found no prompt-like strings.`,
        );
        return;
      }
      ScanReportPanel.show(report, uriByPath);
    },
  );
}
