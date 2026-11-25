import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { boundra, runBoundaryCheck } from "../src/vite";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await delay(10);
  assert(predicate(), "timed out waiting for Vite diagnostics");
}

const root = await mkdtemp(join(tmpdir(), "boundra-vite-test-"));
try {
  await mkdir(join(root, "apps/web/src"), { recursive: true });
  await mkdir(join(root, "domains/tasks/server/internal"), { recursive: true });
  await mkdir(join(root, "domains/tasks/shared"), { recursive: true });
  await writeFile(join(root, "boundra.config.json"), JSON.stringify({
    paths: { apps: "apps", domains: "domains" },
  }));
  await writeFile(join(root, "domains/tasks/shared/public.ts"), "export {};\n");
  await writeFile(join(root, "domains/tasks/server/internal/store.ts"), "export {};\n");
  await writeFile(join(root, "domains/tasks/domain.json"), JSON.stringify({
    name: "tasks",
    publicApi: { client: [], server: [], shared: ["./shared/public.ts"] },
    dependsOn: [],
  }));
  await writeFile(
    join(root, "apps/web/src/main.ts"),
    "import '@domains/tasks/server/internal/store';\n",
  );
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { paths: { "@domains/*": ["domains/*"] } },
  }));

  const cliPath = resolve("target/debug/boundra");
  const plugin = boundra({ root, cliPath });
  let received: unknown;
  let publishCount = 0;
  const watcher: { listener?: (event: string, file: string) => void } = {};
  plugin.configureServer({
    ws: { send(payload) { received = payload.data; publishCount += 1; } },
    watcher: {
      on(_event, callback) { watcher.listener = callback; },
      off(_event, callback) { if (watcher.listener === callback) delete watcher.listener; },
    },
  });
  assert(Number(publishCount) === 0, "initial check should not block startup");
  await waitFor(() => publishCount === 1);
  assert(
    JSON.stringify(received).includes("BR-005"),
    "Vite plugin should publish boundary diagnostics",
  );
  const injected = plugin.transformIndexHtml();
  assert(injected[0]?.attrs.src.includes("virtual:boundra-overlay"), "overlay should be injected");
  assert(plugin.apply === "serve", "overlay must be development-only");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/+page.svelte") });
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/+page.svelte") });
  watcher.listener?.("change", join(root, "apps/web/src/+page.svelte"));
  await waitFor(() => publishCount === 2);
  assert(publishCount === 2, "Svelte updates should rerun boundary checks");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/theme.css") });
  await delay(100);
  assert(publishCount === 2, "non-source updates should not rerun boundary checks");

  await writeFile(join(root, "apps/web/src/main.ts"), "export {};\n");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/main.ts") });
  await waitFor(() => publishCount === 3);
  assert((received as { diagnostics: unknown[] }).diagnostics.length === 0,
    "a successful scan should clear boundary diagnostics");

  await writeFile(join(root, "boundra.config.json"), "{ invalid json");
  watcher.listener?.("change", join(root, "boundra.config.json"));
  await waitFor(() => publishCount === 4);
  const errorPayload = received as ReturnType<typeof runBoundaryCheck>;
  const projectError = errorPayload.diagnostics[0];
  assert(projectError?.rule === "PROJECT-001", "project loading errors should preserve the CLI diagnostic code");
  assert(projectError?.file === root, "project loading errors should identify the CLI root");
  assert(projectError?.message.includes("failed to load project"), "project loading errors should retain the CLI message");
  assert(projectError?.suggestion.includes("config or domain manifest"), "project loading errors should retain the CLI suggestion");

  plugin.handleHotUpdate({ file: join(root, "apps/web/src/main.ts") });
  plugin.closeBundle();
  assert(watcher.listener === undefined, "closing the plugin should remove the watcher");
  await delay(100);
  assert(Number(publishCount) === 4, "disposing should prevent pending scans from publishing");

  const missingCli = runBoundaryCheck(root, join(root, "missing-boundra"));
  assert(missingCli.diagnostics[0]?.rule === "PROJECT-002",
    "a missing CLI must report a diagnostic instead of clearing the overlay");
  assert(missingCli.diagnostics[0]?.message.length > 0,
    "a missing CLI must provide a failure message");

  const previousDirectory = process.cwd();
  try {
    process.chdir(root);
    await writeFile(join(root, "check-boundaries"), "process.stdout.write('{}');\n");
    assert(runBoundaryCheck(root, process.execPath).diagnostics[0]?.rule === "PROJECT-002",
      "unexpected JSON must not be reported as a successful scan");
    await writeFile(join(root, "check-boundaries"),
      "process.stdout.write(JSON.stringify({ violations: [] })); process.exitCode = 2;\n");
    assert(runBoundaryCheck(root, process.execPath).diagnostics[0]?.rule === "PROJECT-002",
      "a nonzero exit with empty diagnostics must not clear the overlay");

    await writeFile(join(root, "scan-input"), "old");
    await writeFile(join(root, "check-boundaries"), `
const fs = require('node:fs');
const value = fs.readFileSync('scan-input', 'utf8');
fs.writeFileSync('scan-started', value);
setTimeout(() => process.stdout.write(JSON.stringify({ violations: [{
  rule: 'BR-005', file: 'test.ts', line: 1, import: value, message: value, suggestion: 'fix'
}] })), 250);
`);
    const slowPlugin = boundra({ root, cliPath: process.execPath });
    const published: string[] = [];
    slowPlugin.configureServer({ ws: { send(payload) { published.push(payload.data.diagnostics[0]?.message ?? ""); } } });
    await waitFor(() => existsSync(join(root, "scan-started")));
    await writeFile(join(root, "scan-input"), "new");
    slowPlugin.handleHotUpdate({ file: join(root, "test.ts") });
    await waitFor(() => published.length > 0);
    assert(published.length === 1 && published[0] === "new", "superseded asynchronous results must not be published");
    assert(await readFile(join(root, "scan-started"), "utf8") === "new", "the latest scan must run");
    slowPlugin.closeBundle();
  } finally {
    process.chdir(previousDirectory);
  }

  console.log("vite-test: OK");
} finally {
  await rm(root, { recursive: true, force: true });
}
