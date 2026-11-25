import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = resolve(import.meta.dirname, "..");
const workspace = await mkdtemp(join(tmpdir(), "boundra-framework-"));
const project = join(workspace, "consumer");
const artifacts = join(workspace, "artifacts");
const binary = join(root, "target", "release", "boundra");
const run = (command, args, cwd = project) => {
  const start = performance.now();
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", BOUNDRA_CLI_PATH: binary }, maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  console.log(command, args.join(" "), Math.round(performance.now() - start) + "ms");
  if (result.status !== 0) throw new Error(result.stdout + "\n" + result.stderr);
  return result.stdout;
};
const write = async (path, value) => {
  const file = join(project, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, value);
};
const json = (path, value) => write(path, JSON.stringify(value, null, 2) + "\n");
const cli = (...args) => run(binary, [...args, "--root", project]);
try {
  await mkdir(artifacts, { recursive: true });
  await mkdir(project, { recursive: true });
  run("cargo", ["build", "--release", "-p", "boundra-cli"], root);
  run("pnpm", ["--filter", "boundra", "pack", "--pack-destination", artifacts], root);
  const tarball = (await readdir(artifacts)).find(name => name.endsWith(".tgz"));
  assert.ok(tarball);
  await json("package.json", {
    name: "boundra-framework-consumer", private: true, type: "module",
    imports: { "#order": "./domains/commerce/order/shared/public.ts" },
    dependencies: { boundra: "file:" + join(artifacts, tarball), zod: "4.4.3", next: "16.4.6", react: "19.3.1", "react-dom": "19.3.1", vite: "7.3.1", typescript: "5.9.3", "@types/node": "25.9.9", "@types/react": "19.3.0", playwright: "1.65.1" }
  });
  const paths = { "@domains/*": ["domains/*"] };
  await json("tsconfig.json", { compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, skipLibCheck: true, noEmit: true, baseUrl: ".", paths, jsx: "preserve" } });
  cli("init", "--name", "consumer");
  cli("create-domain", "order", "--path", "commerce");
  cli("create-domain", "billing");
  cli("add-dependency", "billing/order");
  cli("generate", "query", "order/get-order");
  await write("domains/commerce/order/shared/public.ts", `import { defineQuery, createBoundraClient } from "boundra";
import { z } from "zod";
export const query = defineQuery({name: "order-summary", input: z.object({id: z.string().min(1)}), result: z.object({id: z.string(), status: z.literal("ready")})});
export const readOrder = () => createBoundraClient(async () => ({id: "order-1", status: "ready"})).query(query, {id: "order-1"});
`);
  await write("domains/commerce/order/server/internal.ts", "export const internal = 1;\n");
  await write("domains/commerce/order/server/public.ts", `import { implementQuery } from "boundra";
import { query } from "../shared/public";
export const orderImplementation = implementQuery(query, ({id}) => {
  if (id === "fixture-failure") throw new Error("fixture-only internal failure");
  return {id, status: "ready" as const};
});
`);
  await write("domains/billing/shared/public.ts", 'export { query } from "@domains/commerce/order/shared/public";\n');
  await write("apps/next/app/layout.tsx", 'import type { ReactNode } from "react";\nexport default function Layout({children}: {children: ReactNode}) { return <html lang="en"><body>{children}</body></html>; }');
  await write("apps/next/app/page.tsx", 'import { readOrder } from "@domains/commerce/order/shared/public";\nexport default async function Page() { const order = await readOrder(); return <main>Next order: {order.status}</main>; }');
  await write("apps/next/app/contracts/order-summary/route.ts", `import { BoundraRuntimeError, executeContract } from "boundra";
import { orderImplementation } from "@domains/commerce/order/server/public";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({code: "RUNTIME-001"}, {status: 400}); }
  try {
    const input = body && typeof body === "object" && "input" in body ? body.input : undefined;
    const result = await executeContract(orderImplementation, input);
    return Response.json({result});
  } catch (error) {
    if (error instanceof BoundraRuntimeError && error.phase === "input") return Response.json({code: error.code}, {status: 400});
    return Response.json({code: "REQUEST_FAILED"}, {status: 500});
  }
}
`);
  await json("apps/next/tsconfig.json", { extends: "../../tsconfig.json", compilerOptions: { baseUrl: "../..", paths, jsx: "react-jsx" }, include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"] });
  await write("apps/vite/index.html", '<!doctype html><html lang="en"><head><title>Boundra consumer</title></head><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>');
  await write("apps/vite/src/pixel.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=", "base64"));
  await write("apps/vite/src/main.ts", 'import { readOrder } from "#order";\nimport pixel from "./pixel.png";\nconst image = document.createElement("img"); image.src = pixel; image.alt = ""; document.body.append(image);\nconst app = document.querySelector("main")!; readOrder().then(order => { app.textContent = "Vite order: " + order.status; });');
  await write("apps/vite/vite.config.mjs", 'import { defineConfig } from "vite";\nimport { boundra } from "boundra/vite";\nimport { fileURLToPath } from "node:url";\nexport default defineConfig({build: {assetsInlineLimit: 0}, plugins: [boundra({root: fileURLToPath(new URL("../..", import.meta.url)), cliPath: process.env.BOUNDRA_CLI_PATH})], resolve: {alias: {"#order": fileURLToPath(new URL("../../domains/commerce/order/shared/public.ts", import.meta.url))}}, server: {fs: {allow: [fileURLToPath(new URL("../..", import.meta.url))]}}});');
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
  run("npm", ["exec", "--", "playwright", "install", "--with-deps", "chromium"]);
  const check = JSON.parse(cli("check-boundaries", "--format", "json", "--min-domains", "2"));
  assert.equal(check.status, "passed");
  assert.equal(check.meta.analyzed_domain_count, 2);
  await write("apps/next/app/forbidden.ts", 'import { internal } from "@domains/commerce/order/server/internal"; export { internal };');
  const violation = spawnSync(binary, ["check-boundaries", "--root", project, "--format", "json"], { encoding: "utf8" });
  assert.equal(violation.status, 1);
  assert.ok(JSON.parse(violation.stdout).violations.some(item => item.rule === "BR-005"));
  await rm(join(project, "apps/next/app/forbidden.ts"));
  run("npm", ["exec", "--", "next", "build", "--webpack"], join(project, "apps/next"));
  run("npm", ["exec", "--", "vite", "build"], join(project, "apps/vite"));
  await write("browser.mjs", `import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
import { createBoundraClient, createHttpTransport } from "boundra";
import { query } from "./domains/commerce/order/shared/public.ts";
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "apps/next", "-H", "127.0.0.1", "-p", "41379"], {stdio: "inherit"});
const server = await createServer({root: "apps/vite", server: {host: "127.0.0.1", port: 0}});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch("http://127.0.0.1:41379")).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Next server did not start");
  const client = createBoundraClient(createHttpTransport({baseUrl: "http://127.0.0.1:41379"}));
  assert.deepEqual(await client.query(query, {id: "live-order"}), {id: "live-order", status: "ready"});
  const invalid = await fetch("http://127.0.0.1:41379/contracts/order-summary", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({input: {id: ""}})});
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {code: "RUNTIME-001"});
  for (const body of ["{", JSON.stringify({}), JSON.stringify(null)]) {
    const malformed = await fetch("http://127.0.0.1:41379/contracts/order-summary", {method: "POST", headers: {"content-type": "application/json"}, body});
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {code: "RUNTIME-001"});
  }
  const failed = await fetch("http://127.0.0.1:41379/contracts/order-summary", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({input: {id: "fixture-failure"}})});
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), {code: "REQUEST_FAILED"});
  await page.goto("http://127.0.0.1:41379");
  await page.getByText("Next order: ready").waitFor();
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByText("Vite order: ready").waitFor();
  assert.ok((await page.content()).includes("virtual:boundra-overlay"));
  const files = (await readdir("apps/vite/dist/assets", {withFileTypes: true})).filter(entry => entry.isFile());
  assert.ok(files.some(file => file.name.endsWith(".png")), "Expected an emitted binary asset");
  const textFiles = files.filter(file => [".js", ".mjs", ".cjs", ".map"].some(extension => file.name.endsWith(extension)));
  assert.ok(textFiles.some(file => file.name.endsWith(".js")), "Expected an emitted JavaScript bundle");
  for (const file of textFiles) assert.ok(!(await readFile("apps/vite/dist/assets/" + file.name, "utf8")).includes("boundra:diagnostics"), file.name);
} finally {
  await browser?.close();
  await server.close();
  next.kill();
}
`);
  run("node", ["browser.mjs"]);
  console.log("framework consumer conformance: OK");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
