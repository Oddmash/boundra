import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import type { BoundraOverlayPayload } from "./dev-overlay.js";

const virtualId = "virtual:boundra-overlay";
const resolvedVirtualId = `\0${virtualId}`;

export type BoundraViteOptions = {
  root?: string;
  cliPath?: string;
};

type ViteServer = {
  ws: { send(payload: { type: "custom"; event: string; data: BoundraOverlayPayload }): void };
};

export function boundra(options: BoundraViteOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  let server: ViteServer | undefined;

  const publish = () => {
    const payload = runBoundaryCheck(root, options.cliPath);
    server?.ws.send({ type: "custom", event: "boundra:diagnostics", data: payload });
  };

  return {
    name: "boundra",
    apply: "serve" as const,
    resolveId(id: string) {
      return id === virtualId ? resolvedVirtualId : undefined;
    },
    load(id: string) {
      if (id !== resolvedVirtualId) return undefined;
      return `import { installBoundraDevOverlay } from "boundra/dev-overlay";
const overlay = installBoundraDevOverlay();
if (import.meta.hot) {
  import.meta.hot.on("boundra:diagnostics", (payload) => overlay.report(payload));
  import.meta.hot.dispose(() => overlay.dispose());
}`;
    },
    transformIndexHtml() {
      return [{ tag: "script", attrs: { type: "module", src: `/@id/${virtualId}` }, injectTo: "head" }];
    },
    configureServer(value: ViteServer) {
      server = value;
      publish();
    },
    handleHotUpdate(context: { file: string }) {
      if (/\.(?:[cm]?[jt]sx?|svelte)$/.test(context.file)) publish();
    },
  };
}

type BoundaryDiagnostic = BoundraOverlayPayload["diagnostics"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBoundaryDiagnostic(value: unknown): value is BoundaryDiagnostic {
  return isRecord(value)
    && typeof value.rule === "string"
    && typeof value.file === "string"
    && typeof value.line === "number"
    && typeof value.import === "string"
    && typeof value.message === "string"
    && typeof value.suggestion === "string";
}

function toCliDiagnostic(value: unknown, root: string): BoundaryDiagnostic | undefined {
  if (!isRecord(value)
    || typeof value.code !== "string"
    || typeof value.message !== "string"
    || typeof value.suggestion !== "string") return undefined;

  const context = isRecord(value.context) ? value.context : {};
  const file = typeof context.file === "string" ? context.file
    : typeof context.root === "string" ? context.root : root;
  return {
    rule: value.code,
    file,
    line: 0,
    import: "",
    message: value.message,
    suggestion: value.suggestion,
  };
}

export function runBoundaryCheck(root: string, cliPath = "boundra"): BoundraOverlayPayload {
  const result = spawnSync(cliPath, ["check-boundaries", "--root", root, "--format", "json"], {
    encoding: "utf8",
  });

  try {
    const output: unknown = JSON.parse(result.stdout);
    if (isRecord(output) && output.status === "error" && Array.isArray(output.errors)) {
      const diagnostics = output.errors.map((error) => toCliDiagnostic(error, root));
      if (diagnostics.length > 0 && diagnostics.every((item): item is BoundaryDiagnostic => item !== undefined)) {
        return { source: "boundary", diagnostics };
      }
    }
    if (isRecord(output)
      && Array.isArray(output.violations)
      && output.violations.every(isBoundaryDiagnostic)
      && (result.status === 0 || (result.status === 1 && output.violations.length > 0))) {
      return { source: "boundary", diagnostics: output.violations };
    }
  } catch {}

  return {
    source: "boundary",
    diagnostics: [{
      rule: "PROJECT-002",
      file: root,
      line: 0,
      import: "",
      message: result.stderr?.trim() || result.error?.message || "invalid response from Boundra boundary check",
      suggestion: "ensure the Boundra CLI is installed and the project config is valid",
    }],
  };
}
