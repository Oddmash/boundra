const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve, join, dirname } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { findRoot, findLauncher, decodeReport, runCheck, createScheduler, publishDiagnostics } = require("./diagnostics.cjs");
const { activate } = require("./extension.cjs");

test("discovers nested workspace and launcher without crossing folder", () => {
  const limit = resolve("workspace");
  const root = join(limit, "packages", "example");
  const file = join(root, "src");
  const config = join(root, "boundra.config.json");
  const launcher = join(limit, "node_modules", "boundra", "bin", "boundra.mjs");
  const exists = path => [config, launcher].includes(path);
  assert.equal(findRoot(file, limit, exists), root);
  assert.equal(findRoot(root, root, exists), root);
  assert.equal(findRoot(root, root, () => false), undefined);
  assert.equal(findLauncher(root, limit, exists), launcher);
  assert.equal(findRoot(dirname(limit), limit, exists), undefined);
  assert.equal(findLauncher(root, root, exists), undefined);
});

test("maps line diagnostics and rejects malformed or out-of-workspace locations", () => {
  const root = resolve("workspace");
  const violation = { file: "src/main.ts", line: 8, rule: "BR-005", message: "invalid import", suggestion: "use public API" };
  const report = JSON.stringify({ status: "failed", violations: [violation] });
  assert.deepEqual(decodeReport(root, report, 1).diagnostics, [{ ...violation, file: join(root, "src", "main.ts") }]);
  assert.deepEqual(decodeReport(root, JSON.stringify({status: "passed", violations: []}), 0).diagnostics, []);
  assert.throws(() => decodeReport(root, JSON.stringify({ status: "failed", violations: [{...violation, file: "../outside.ts"}] }), 1));
  assert.throws(() => decodeReport(root, report, 0));
  assert.throws(() => decodeReport(root, JSON.stringify({status: "failed", violations: []}), 1));
  assert.deepEqual(decodeReport(root, JSON.stringify({status: "error", errors: [{code: "PROJECT-001", message: "bad config", suggestion: "fix config"}]}), 2).errors, ["PROJECT-001: bad config\nfix config"]);
});

test("executes an asynchronous local launcher and retains violation exit status", async () => {
  const root = await mkdtemp(join(tmpdir(), "boundra-editor-"));
  try {
    const launcher = join(root, "launcher.mjs");
    await writeFile(launcher, `process.stdout.write(JSON.stringify({status: "failed", violations: [{file:"test.ts",line:2,rule:"BR-005",message:"invalid",suggestion:"fix"}]})); process.exitCode = 1;`);
    const result = await runCheck(root, launcher, new AbortController().signal);
    assert.equal(result.diagnostics[0].file, join(root, "test.ts"));
    assert.equal(result.diagnostics[0].line, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("coalesces, cancels and discards outdated scans", async () => {
  const requests = [];
  const published = [];
  const scheduler = createScheduler(signal => new Promise(resolve => requests.push({signal, resolve})), result => published.push(result), 5);
  scheduler.schedule(); scheduler.schedule();
  await delay(30);
  assert.equal(requests.length, 1);
  scheduler.schedule();
  assert.equal(requests[0].signal.aborted, true);
  await delay(30);
  assert.equal(requests.length, 2);
  requests[0].resolve("old"); requests[1].resolve("new");
  await delay(10);
  assert.deepEqual(published, ["new"]);
  scheduler.schedule();
  scheduler.dispose();
  await delay(30);
  assert.equal(requests.length, 2);
});

test("replaces all published diagnostics including deleted files", () => {
  const collection = new Map();
  const publish = files => publishDiagnostics(collection, files.map(file => ({file})), file => file, item => item.file);
  publish(["deleted.ts", "kept.ts"]);
  assert.deepEqual([...collection.keys()], ["deleted.ts", "kept.ts"]);
  publish(["kept.ts"]);
  assert.deepEqual([...collection.keys()], ["kept.ts"]);
  publish([]);
  assert.equal(collection.size, 0);
});

test("does not activate in untrusted workspaces and disposes removed workspace roots", async () => {
  const untrusted = { workspace: { isTrusted: false } };
  assert.doesNotThrow(() => activate({ subscriptions: [] }, untrusted));
  const root = await mkdtemp(join(tmpdir(), "boundra-editor-lifecycle-"));
  try {
    await writeFile(join(root, "boundra.config.json"), "{}");
    const disposable = () => ({ dispose() {} });
    let folderChanged;
    let collections = 0;
    let disposed = 0;
    const folder = { uri: { scheme: "file", fsPath: root } };
    const virtual = { uri: { scheme: "virtual", fsPath: root } };
    const event = () => disposable();
    const context = { subscriptions: [] };
    const vscode = {
      workspace: {
        isTrusted: true, workspaceFolders: [virtual, folder], getWorkspaceFolder: () => folder,
        createFileSystemWatcher: () => ({ ...disposable(), onDidChange: event, onDidCreate: event, onDidDelete: event }),
        onDidSaveTextDocument: event, onDidCreateFiles: event, onDidDeleteFiles: event, onDidRenameFiles: event,
        onDidChangeWorkspaceFolders: listener => { folderChanged = listener; return disposable(); },
      },
      window: { createOutputChannel: disposable, onDidChangeActiveTextEditor: event },
      commands: { registerCommand: event },
      languages: { createDiagnosticCollection() { collections += 1; return { dispose() { disposed += 1; } }; } },
    };
    activate(context, vscode);
    assert.equal(collections, 1, "virtual folder must not create diagnostics or schedule the CLI");
    folderChanged({ removed: [folder], added: [] });
    assert.equal(disposed, 1);
    folderChanged({ removed: [], added: [folder] });
    assert.equal(collections, 2);
    folderChanged({ removed: [folder], added: [] });
    assert.equal(disposed, 2);
    for (const entry of context.subscriptions) entry.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});
