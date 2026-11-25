import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPaths } from "./classify-ci-scope.mjs";

const none = { runtime: false, cli: false, integration: false, notes: false };
const all = { runtime: true, cli: true, integration: true, notes: true };
for (const [name, paths, expected] of [
  ["landing only", ["site/src/layouts/landing.astro", "site/tests/landing.spec.mjs"], none],
  ["docs only", ["docs/user-guide.md", "README.md"], none],
  ["pages workflow", [".github/workflows/pages.yml"], none],
  ["release notes", ["docs/releases/v0-6-0.md", "CHANGELOG.md"], { ...none, notes: true }],
  ["runtime", ["packages/runtime/src/index.ts"], { ...none, runtime: true, integration: true }],
  ["native launcher", ["packages/runtime/bin/boundra.mjs"], { ...none, runtime: true, cli: true, integration: true }],
  ["Rust CLI", ["crates/boundra-cli/src/main.rs", "Cargo.lock"], { ...none, cli: true, integration: true }],
  ["example", ["examples/order-billing/src/index.ts"], { ...none, integration: true }],
  ["mixed site and runtime", ["site/src/layouts/landing.astro", "packages/runtime/src/index.ts"], { ...none, runtime: true, integration: true }],
  ["CI definition", [".github/workflows/boundra.yml"], all],
  ["workspace lockfile", ["pnpm-lock.yaml"], all],
  ["editor adapter", ["editors/vscode/extension.cjs"], all],
  ["unknown path", ["new-component/input.ts"], all],
  ["empty diff", [], none],
]) test(name, () => assert.deepEqual(classifyPaths(paths), expected));

test("manual, release or unavailable diff is conservative", () => assert.deepEqual(classifyPaths([], true), all));
