const { execFile } = require("node:child_process");
const { existsSync } = require("node:fs");
const { dirname, isAbsolute, join, relative, resolve, sep } = require("node:path");

function inside(root, path) {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}

function findRoot(directory, limit, exists = existsSync) {
  for (let current = resolve(directory); inside(limit, current); current = dirname(current)) {
    if (exists(join(current, "boundra.config.json"))) return current;
    if (current === resolve(limit) || dirname(current) === current) break;
  }
}

function findLauncher(root, limit, exists = existsSync) {
  for (let current = resolve(root); inside(limit, current); current = dirname(current)) {
    const candidate = join(current, "node_modules", "boundra", "bin", "boundra.mjs");
    if (exists(candidate)) return candidate;
    if (current === resolve(limit) || dirname(current) === current) break;
  }
}

function decodeReport(root, stdout, status) {
  const report = JSON.parse(stdout);
  if (status === 2 || status === 3) {
    if (report.status === "error" && Array.isArray(report.errors) && report.errors.length && report.errors.every(item => typeof item?.code === "string" && typeof item?.message === "string" && typeof item?.suggestion === "string")) {
      return { diagnostics: [], errors: report.errors.map(item => `${item.code}: ${item.message}\n${item.suggestion}`) };
    }
  } else if ((status === 0 && report.status === "passed") || (status === 1 && report.status === "failed")) {
    if (Array.isArray(report.violations) && (status === 0 ? report.violations.length === 0 : report.violations.length > 0) && report.violations.every(item => typeof item?.file === "string" && !isAbsolute(item.file) && inside(root, resolve(root, item.file)) && Number.isSafeInteger(item.line) && item.line > 0 && typeof item.rule === "string" && typeof item.message === "string" && typeof item.suggestion === "string")) {
      return { diagnostics: report.violations.map(item => ({ ...item, file: resolve(root, item.file) })), errors: [] };
    }
  }
  throw new Error("invalid Boundra CLI diagnostic report");
}

function runCheck(root, launcher, signal) {
  return new Promise((resolvePromise, reject) => {
    execFile(process.execPath, [launcher, "check-boundaries", "--root", root, "--format", "json"], {
      cwd: root, signal, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    }, (error, stdout, stderr) => {
      const status = error ? error.code : 0;
      try { resolvePromise(decodeReport(root, stdout, status)); }
      catch (decodeError) { reject(error && typeof error.code !== "number" ? error : new Error(stderr.trim() || decodeError.message)); }
    });
  });
}

function createScheduler(run, publish, delay = 150) {
  let timer, controller, revision = 0, disposed = false;
  return {
    schedule() {
      if (disposed) return;
      const current = ++revision;
      clearTimeout(timer);
      controller?.abort();
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const result = await run(controller.signal);
          if (!disposed && current === revision) publish(result);
        } catch (error) {
          if (!disposed && current === revision) publish({ diagnostics: [], errors: [String(error.message ?? error)] });
        }
      }, delay);
    },
    dispose() { disposed = true; ++revision; clearTimeout(timer); controller?.abort(); },
  };
}

module.exports = { inside, findRoot, findLauncher, decodeReport, runCheck, createScheduler };
