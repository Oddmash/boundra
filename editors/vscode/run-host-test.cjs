const { runTests } = require("@vscode/test-electron");
const { mkdtemp, mkdir, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { resolve, join } = require("node:path");

async function main() {
  const root = await mkdtemp(join(tmpdir(), "boundra-editor-host-"));
  try {
    const workspace = join(root, "workspace");
    await mkdir(workspace);
    await runTests({
      version: "1.95.3",
      extensionDevelopmentPath: __dirname,
      extensionTestsPath: join(__dirname, "host-test.cjs"),
      extensionTestsEnv: { BOUNDRA_CLI_PATH: resolve(__dirname, "../../target/debug/boundra"), BOUNDRA_RUNTIME_SOURCE: resolve(__dirname, "../../packages/runtime") },
      launchArgs: [workspace, "--user-data-dir", join(root, "profile"), "--extensions-dir", join(root, "extensions"), "--disable-extensions", "--skip-welcome", "--skip-release-notes"],
    });
  } finally { await rm(root, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
