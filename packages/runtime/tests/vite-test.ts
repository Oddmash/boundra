import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { boundra, runBoundaryCheck } from "../src/vite";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
  plugin.configureServer({
    ws: { send(payload) { received = payload.data; publishCount += 1; } },
  });
  assert(
    JSON.stringify(received).includes("BR-005"),
    "Vite plugin should publish boundary diagnostics",
  );
  const injected = plugin.transformIndexHtml();
  assert(injected[0]?.attrs.src.includes("virtual:boundra-overlay"), "overlay should be injected");
  assert(plugin.apply === "serve", "overlay must be development-only");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/+page.svelte") });
  assert(publishCount === 2, "Svelte updates should rerun boundary checks");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/theme.css") });
  assert(publishCount === 2, "non-source updates should not rerun boundary checks");

  await writeFile(join(root, "apps/web/src/main.ts"), "export {};\n");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/main.ts") });
  assert((received as { diagnostics: unknown[] }).diagnostics.length === 0,
    "a successful scan should clear boundary diagnostics");

  await writeFile(join(root, "boundra.config.json"), "{ invalid json");
  plugin.handleHotUpdate({ file: join(root, "apps/web/src/main.ts") });
  const errorPayload = received as ReturnType<typeof runBoundaryCheck>;
  const projectError = errorPayload.diagnostics[0];
  assert(projectError?.rule === "PROJECT-001", "project loading errors should preserve the CLI diagnostic code");
  assert(projectError?.file === root, "project loading errors should identify the CLI root");
  assert(projectError?.message.includes("failed to load project"), "project loading errors should retain the CLI message");
  assert(projectError?.suggestion.includes("config or domain manifest"), "project loading errors should retain the CLI suggestion");

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
  } finally {
    process.chdir(previousDirectory);
  }

  console.log("vite-test: OK");
} finally {
  await rm(root, { recursive: true, force: true });
}
