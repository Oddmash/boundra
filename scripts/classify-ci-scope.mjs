import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function classifyPaths(paths, full = false) {
  const scope = { runtime: full, cli: full, integration: full, notes: full };
  for (const path of paths) {
    if (path.startsWith("docs/releases/") || path === "CHANGELOG.md") {
      scope.notes = true;
      continue;
    }
    if (
      path.startsWith("site/") ||
      path.startsWith("docs/") ||
      path === ".github/workflows/pages.yml" ||
      /^[^/]+\.md$/i.test(path) ||
      /^\.github\/(?:ISSUE_TEMPLATE\/|PULL_REQUEST_TEMPLATE(?:\.md|\/)|CODEOWNERS$|workflows\/oddmash-)/i.test(path)
    ) continue;
    if (path.startsWith("crates/") || path.startsWith(".cargo/") || /^Cargo\.(?:toml|lock)$/.test(path)) {
      scope.cli = scope.integration = true;
      continue;
    }
    if (path.startsWith("packages/")) {
      scope.runtime = scope.integration = true;
      if (/^packages\/runtime\/(?:bin\/|package\.json$)/.test(path)) scope.cli = true;
      continue;
    }
    if (path.startsWith("examples/")) {
      scope.integration = true;
      continue;
    }
    scope.runtime = scope.cli = scope.integration = scope.notes = true;
  }
  return scope;
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

export function changedPaths(event, before) {
  if (event === "pull_request") {
    return git("diff", "--no-renames", "--name-only", "-z", "HEAD^1", "HEAD").split("\0").filter(Boolean);
  }
  if (event === "push" && /^[a-f0-9]{40}$/i.test(before ?? "") && !/^0+$/.test(before)) {
    git("cat-file", "-e", before + "^{commit}");
    return git("diff", "--no-renames", "--name-only", "-z", before, "HEAD").split("\0").filter(Boolean);
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let paths = null;
  if (process.env.FULL_VERIFY !== "true") {
    try {
      paths = changedPaths(process.env.EVENT_NAME, process.env.BEFORE_SHA);
    } catch {
      console.warn("Changed paths unavailable; running full checks.");
    }
  }
  const scope = classifyPaths(paths ?? [], paths === null);
  for (const [key, value] of Object.entries(scope)) appendFileSync(process.env.GITHUB_OUTPUT, key + "=" + value + "\n");
  console.log(JSON.stringify({ changed: paths?.length ?? "unknown", ...scope }));
}
