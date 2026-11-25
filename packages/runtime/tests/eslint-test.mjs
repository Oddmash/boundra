import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createBoundaryPlugin } from "../src/eslint.ts";

const root = resolve("fixture");
const file = resolve(root, "a.ts");
const violation = { file: "a.ts", line: 2, rule: "BR-001", message: "Invalid dependency", suggestion: "Use shared contracts" };
const report = (violations) => ({ status: violations.length ? "failed" : "passed", violations, meta: { command: "check-boundaries", violation_count: violations.length } });

test("maps project diagnostics to stable file and line locations", () => {
  const rule = createBoundaryPlugin({ root, report: report([violation]) }).rules.boundaries;
  const results = [];
  const run = rule.create({ filename: file, physicalFilename: file, sourceCode: { lines: ["", ""] }, report: item => results.push(item) });
  run["Program:exit"]?.();
  assert.deepEqual(results, [{ message: "BR-001: Invalid dependency Use shared contracts", loc: { line: 2, column: 0 } }]);
  const ignored = rule.create({ filename: `${file}/0`, physicalFilename: file, sourceCode: { lines: [] }, report: item => results.push(item) });
  assert.deepEqual(ignored, {});
});

test("accepts clean reports and rejects malformed, outside and stale diagnostics", () => {
  assert.doesNotThrow(() => createBoundaryPlugin({ root, report: report([]) }));
  for (const invalid of [{ status: "error" }, report([{ ...violation, file: "../a.ts" }]), report([{ ...violation, line: 0 }])]) {
    assert.throws(() => createBoundaryPlugin({ root, report: invalid }));
  }
  const rule = createBoundaryPlugin({ root, report: report([violation]) }).rules.boundaries;
  assert.throws(() => rule.create({ filename: file, physicalFilename: file, sourceCode: { lines: [""] }, report() {} })["Program:exit"]?.());
});

test("works with the real ESLint flat config API", { skip: !process.env.BOUNDRA_ESLINT_PACKAGE }, () => {
  const require = createRequire(resolve(process.env.BOUNDRA_ESLINT_PACKAGE, "package.json"));
  const { Linter } = require("eslint");
  const plugin = createBoundaryPlugin({ root, report: report([violation]) });
  const config = [{ files: ["**/*.ts"], plugins: { boundra: plugin }, rules: { "boundra/boundaries": "error" } }];
  const messages = new Linter({ cwd: root }).verify("const a = 1;\nconst b = 2;", config, { filename: file });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "boundra/boundaries");
  assert.equal(messages[0].line, 2);
  assert.equal(messages[0].column, 1);
});
