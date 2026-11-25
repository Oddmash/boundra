import { spawnSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type Diagnostic = { file: string; line: number; rule: string; message: string; suggestion: string };
type Context = {
  filename: string;
  physicalFilename: string;
  sourceCode: { lines: readonly string[] };
  report: (descriptor: { message: string; loc: { line: number; column: number } }) => void;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function inside(root: string, file: string) {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}

function readReport(root: string, report: unknown): Map<string, Diagnostic[]> {
  if (!record(report) || !Array.isArray(report.violations)
    || !record(report.meta) || report.meta.command !== "check-boundaries"
    || report.meta.violation_count !== report.violations.length
    || !((report.status === "passed" && report.violations.length === 0)
      || (report.status === "failed" && report.violations.length > 0))) {
    throw new Error("Invalid Boundra boundary report; run check-boundaries before linting.");
  }
  const diagnostics = new Map<string, Diagnostic[]>();
  for (const value of report.violations) {
    if (!record(value) || typeof value.file !== "string" || isAbsolute(value.file)
      || typeof value.line !== "number" || !Number.isSafeInteger(value.line) || value.line < 1
      || typeof value.rule !== "string" || typeof value.message !== "string" || typeof value.suggestion !== "string") {
      throw new Error("Invalid Boundra violation.");
    }
    const file = resolve(root, value.file);
    if (!inside(root, file) || file === root) throw new Error("Boundra violation is outside the project.");
    const list = diagnostics.get(file) ?? [];
    list.push({ file, line: value.line, rule: value.rule, message: value.message, suggestion: value.suggestion });
    diagnostics.set(file, list);
  }
  return diagnostics;
}

export function createBoundaryPlugin(options: { root: string; report?: unknown }) {
  const root = resolve(options.root);
  let report = options.report;
  if (report === undefined) {
    const launcher = fileURLToPath(new URL("../bin/boundra.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [launcher, "check-boundaries", "--root", root, "--format", "json"], {
      cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || (result.status !== 0 && result.status !== 1)) {
      throw new Error(`Boundra scan failed: ${result.error?.message || result.stderr.trim() || result.stdout.trim()}`);
    }
    report = JSON.parse(result.stdout);
    if (!record(report) || report.status !== (result.status === 0 ? "passed" : "failed")) throw new Error("Inconsistent Boundra scan status.");
  }
  const diagnostics = readReport(root, report);
  return {
    meta: { name: "boundra" },
    rules: {
      boundaries: {
        meta: { type: "problem" as const, schema: [] },
        create(context: Context) {
          if (context.filename !== context.physicalFilename || !isAbsolute(context.physicalFilename)) return {};
          const items = diagnostics.get(resolve(context.physicalFilename)) ?? [];
          return {
            "Program:exit"() {
              for (const item of items) {
                if (item.line > context.sourceCode.lines.length) throw new Error("Boundra report is stale; regenerate it before linting.");
                context.report({ message: `${item.rule}: ${item.message} ${item.suggestion}`, loc: { line: item.line, column: 0 } });
              }
            },
          };
        },
      },
    },
  };
}
