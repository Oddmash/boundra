const vscode = require("vscode");
const { dirname } = require("node:path");
const { inside, findRoot, findLauncher, runCheck, createScheduler } = require("./diagnostics.cjs");

function activate(context) {
  if (!vscode.workspace.isTrusted) return;
  const output = vscode.window.createOutputChannel("Boundra");
  const roots = new Map();
  const schedule = (uri, directory = false) => {
    if (!uri || uri.scheme !== "file" || !vscode.workspace.isTrusted) return;
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return;
    const limit = folder.uri.fsPath;
    const root = findRoot(directory ? uri.fsPath : dirname(uri.fsPath), limit);
    if (!root) {
      for (const [key, state] of roots) if (inside(key, uri.fsPath)) state.scheduler.schedule();
      return;
    }
    let state = roots.get(root);
    if (!state) {
      const collection = vscode.languages.createDiagnosticCollection("boundra");
      const scheduler = createScheduler(signal => {
        if (!findRoot(root, root)) throw new Error("Boundra workspace config is missing.");
        const launcher = findLauncher(root, limit);
        if (!launcher) throw new Error("Install boundra in this workspace to enable diagnostics.");
        return runCheck(root, launcher, signal);
      }, result => {
        collection.clear();
        const byFile = new Map();
        for (const item of result.diagnostics) {
          const range = new vscode.Range(item.line - 1, 0, item.line - 1, 0);
          const diagnostic = new vscode.Diagnostic(range, `${item.message}\n${item.suggestion}`, vscode.DiagnosticSeverity.Error);
          diagnostic.source = "Boundra";
          diagnostic.code = item.rule;
          const list = byFile.get(item.file) ?? [];
          list.push(diagnostic);
          byFile.set(item.file, list);
        }
        for (const [file, diagnostics] of byFile) collection.set(vscode.Uri.file(file), diagnostics);
        for (const error of result.errors) output.appendLine(`[${root}] ${error}`);
      });
      state = { scheduler, collection };
      roots.set(root, state);
    }
    state.scheduler.schedule();
  };
  const relevant = uri => !/[\\/](?:node_modules|\.git|\.next|\.turbo|dist|build|target|coverage)[\\/]/.test(uri.fsPath) && schedule(uri);
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,svelte,json,jsonc}");
  context.subscriptions.push(output, watcher, watcher.onDidChange(relevant), watcher.onDidCreate(relevant), watcher.onDidDelete(relevant),
    vscode.window.onDidChangeActiveTextEditor(editor => schedule(editor?.document.uri)),
    vscode.workspace.onDidChangeWorkspaceFolders(event => {
      for (const folder of event.removed) for (const [root, state] of roots) if (inside(folder.uri.fsPath, root)) {
        state.scheduler.dispose(); state.collection.dispose(); roots.delete(root);
      }
      for (const folder of event.added) schedule(folder.uri, true);
    }),
    vscode.commands.registerCommand("boundra.checkWorkspace", () => {
      if (vscode.window.activeTextEditor) schedule(vscode.window.activeTextEditor.document.uri);
      else for (const folder of vscode.workspace.workspaceFolders ?? []) schedule(folder.uri, true);
      output.show(true);
    }),
    { dispose() { for (const state of roots.values()) { state.scheduler.dispose(); state.collection.dispose(); } roots.clear(); } });
  for (const folder of vscode.workspace.workspaceFolders ?? []) schedule(folder.uri, true);
  schedule(vscode.window.activeTextEditor?.document.uri);
}

module.exports = { activate };
