const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdir, symlink, writeFile } = require("node:fs/promises");
const { dirname, join } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const vscode = require("vscode");

async function waitFor(predicate) {
  const deadline = Date.now() + 20000;
  while (!predicate() && Date.now() < deadline) await delay(100);
  assert.ok(predicate(), "timed out waiting for the editor diagnostics");
}

exports.run = async () => {
  assert.ok(vscode.workspace.isTrusted, "the isolated test workspace must be trusted by VS Code");
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(root);
  const native = process.env.BOUNDRA_CLI_PATH;
  const runtime = process.env.BOUNDRA_RUNTIME_SOURCE;
  assert.ok(native && runtime);
  const cli = (...args) => execFileSync(native, [...args, "--root", root], {encoding: "utf8"});
  cli("init", "--name", "editor-host-fixture");
  cli("create-domain", "order");
  await mkdir(join(root, "node_modules"), {recursive: true});
  await symlink(runtime, join(root, "node_modules", "boundra"), process.platform === "win32" ? "junction" : "dir");
  const file = join(root, "domains", "order", "client", "test.ts");
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, "import '../server/public';\n");
  const uri = vscode.Uri.file(file);
  const extension = vscode.extensions.getExtension("oddmash.boundra-vscode");
  assert.ok(extension, "development extension was not loaded");
  await extension.activate();
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  const save = async (text) => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.ok(await document.save());
  };
  await vscode.commands.executeCommand("boundra.checkWorkspace");
  const diagnostics = () => vscode.languages.getDiagnostics(uri).filter(item => item.source === "Boundra");
  await waitFor(() => diagnostics().some(item => item.code === "BR-001" && item.range.start.line === 0));
  await save("export {};\n");
  await waitFor(() => diagnostics().length === 0);
  await save("import '../server/public';\n");
  await waitFor(() => diagnostics().some(item => item.code === "BR-001"));
  const deletion = new vscode.WorkspaceEdit();
  deletion.deleteFile(uri);
  assert.ok(await vscode.workspace.applyEdit(deletion));
  await waitFor(() => diagnostics().length === 0);
  console.log("Boundra VS Code host test: OK");
};
