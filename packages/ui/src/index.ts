import { overlayTokens } from "./overlay-tokens.js";

export type BoundraRuntimeDiagnostic = {
  name: "BoundraRuntimeError";
  code: string;
  contract: string;
  phase: "input" | "handler" | "result" | "transport";
  message: string;
  suggestion: string;
  issues: ReadonlyArray<{
    code: string;
    path: ReadonlyArray<string | number>;
    message: string;
  }>;
};

export type BoundraBoundaryDiagnostic = {
  rule: string;
  file: string;
  line: number;
  import: string;
  message: string;
  suggestion: string;
};

export type BoundraOverlayPayload = {
  source: "boundary";
  diagnostics: BoundraBoundaryDiagnostic[];
};

export type BoundraErrorViewOptions = {
  target?: HTMLElement;
  openInEditor?: (location: string) => void | Promise<void>;
};

export type BoundraErrorViewController = {
  reportRuntime(error: BoundraRuntimeDiagnostic): void;
  reportBoundary(payload: BoundraOverlayPayload): void;
  clear(source?: OverlaySource): void;
  dispose(): void;
};

type OverlaySource = "runtime" | "boundary";

type OverlayEntry = {
  code: string;
  title: string;
  message: string;
  suggestion: string;
  metadata: ReadonlyArray<readonly [label: string, value: string]>;
  editorLocation?: string;
};

const overlayId = "__boundra_error_view__";

export function createBoundraErrorView(
  options: BoundraErrorViewOptions = {},
): BoundraErrorViewController {
  if (typeof document === "undefined") {
    throw new Error("createBoundraErrorView requires a browser document");
  }

  const target = options.target ?? document.body;
  const entries: Record<OverlaySource, OverlayEntry[]> = {
    runtime: [],
    boundary: [],
  };
  let activeSource: OverlaySource = "runtime";
  let activeIndex = 0;
  let disposed = false;

  const render = () => {
    if (disposed) return;
    if (entries[activeSource].length === 0) {
      activeSource = activeSource === "runtime" ? "boundary" : "runtime";
      activeIndex = 0;
    }
    if (entries[activeSource].length === 0) {
      document.getElementById(overlayId)?.remove();
      return;
    }
    activeIndex = Math.min(activeIndex, entries[activeSource].length - 1);
    renderOverlay({
      target,
      entries,
      activeSource,
      activeIndex,
      onSelectSource(source) {
        activeSource = source;
        activeIndex = 0;
        render();
      },
      onSelectEntry(index) {
        activeIndex = index;
        render();
      },
      onDismiss() {
        entries[activeSource] = [];
        render();
      },
      onCopy(button) {
        void copyText(formatOverlaySummary(activeSource, entries[activeSource]))
          .then(() => setCopyStatus(button, "Copied"))
          .catch(() => setCopyStatus(button, "Copy unavailable"));
      },
      onOpenInEditor: options.openInEditor,
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && document.getElementById(overlayId)) {
      entries[activeSource] = [];
      render();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    reportRuntime(error) {
      entries.runtime = createRuntimeEntries(error);
      activeSource = "runtime";
      activeIndex = 0;
      render();
    },
    reportBoundary(payload) {
      entries.boundary = createBoundaryEntries(payload.diagnostics);
      if (entries.boundary.length > 0) {
        activeSource = "boundary";
        activeIndex = 0;
      }
      render();
    },
    clear(source) {
      if (source) {
        entries[source] = [];
      } else {
        entries.runtime = [];
        entries.boundary = [];
      }
      render();
    },
    dispose() {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      document.getElementById(overlayId)?.remove();
    },
  };
}

export function formatBoundraRuntimeSummary(
  error: BoundraRuntimeDiagnostic,
): string {
  return formatOverlaySummary("runtime", createRuntimeEntries(error));
}

export function formatBoundraBoundarySummary(
  payload: BoundraOverlayPayload,
): string {
  return formatOverlaySummary("boundary", createBoundaryEntries(payload.diagnostics));
}

function createRuntimeEntries(error: BoundraRuntimeDiagnostic): OverlayEntry[] {
  if (error.issues.length === 0) {
    return [{
      code: error.code,
      title: `Contract '${error.contract}' rejected ${error.phase}`,
      message: error.message,
      suggestion: error.suggestion,
      metadata: [
        ["contract", error.contract],
        ["phase", error.phase],
        ["path", "value"],
      ],
    }];
  }

  return error.issues.map((issue) => ({
    code: error.code,
    title: formatPath(issue.path),
    message: issue.message,
    suggestion: error.suggestion,
    metadata: [
      ["contract", error.contract],
      ["phase", error.phase],
      ["issue", issue.code],
      ["path", formatPath(issue.path)],
    ],
  }));
}

function createBoundaryEntries(
  diagnostics: ReadonlyArray<BoundraBoundaryDiagnostic>,
): OverlayEntry[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.rule,
    title: `${diagnostic.file}:${diagnostic.line}`,
    message: diagnostic.message,
    suggestion: diagnostic.suggestion,
    metadata: [
      ["file", diagnostic.file],
      ["line", String(diagnostic.line)],
      ...(diagnostic.import ? [["import", diagnostic.import] as const] : []),
    ],
    editorLocation: diagnostic.line > 0
      ? `${diagnostic.file}:${diagnostic.line}`
      : undefined,
  }));
}

function formatOverlaySummary(
  source: OverlaySource,
  entries: ReadonlyArray<OverlayEntry>,
): string {
  const heading = `Boundra ${source} diagnostics (${entries.length})`;
  const details = entries.map((entry, index) => {
    const metadata = entry.metadata
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");
    return [
      `${index + 1}. [${entry.code}] ${entry.title}`,
      metadata,
      `message: ${entry.message}`,
      `suggestion: ${entry.suggestion}`,
    ].filter(Boolean).join("\n");
  });
  return [heading, ...details].join("\n\n");
}

function renderOverlay(options: {
  target: HTMLElement;
  entries: Record<OverlaySource, OverlayEntry[]>;
  activeSource: OverlaySource;
  activeIndex: number;
  onSelectSource(source: OverlaySource): void;
  onSelectEntry(index: number): void;
  onDismiss(): void;
  onCopy(button: HTMLButtonElement): void;
  onOpenInEditor?: (location: string) => void | Promise<void>;
}) {
  document.getElementById(overlayId)?.remove();
  const activeEntries = options.entries[options.activeSource];
  const selected = activeEntries[options.activeIndex]!;
  const root = document.createElement("div");
  root.id = overlayId;
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", `${overlayId}_title`);
  root.tabIndex = -1;
  const { color, opacity, size, space, type } = overlayTokens;
  root.innerHTML = `
    <style>
      #${overlayId}{position:fixed;inset:0;z-index:${size.layer};padding:${size.framePaddingBlock} ${size.framePaddingInline};background:${color.backdrop};color:${color.text};font-family:${type.mono};overflow:auto}
      #${overlayId} *{box-sizing:border-box}#${overlayId} button{font:inherit}#${overlayId} .b-shell{width:min(${size.shellWidth},100%);min-height:${size.shellHeight};margin:auto;border:${size.border} solid ${color.shellBorder};border-radius:${size.shellRadius};background:${color.shell};box-shadow:${size.shellElevation} ${color.shadow};overflow:hidden}
      #${overlayId} .b-head{display:flex;align-items:center;justify-content:space-between;gap:${space.px20};padding:${space.px15} ${space.px20};background:${color.accent};color:${color.onAccent}}#${overlayId} .b-brand{font-size:${type.label};font-weight:${type.heavy};letter-spacing:${type.brandTracking};text-transform:uppercase}#${overlayId} .b-actions{display:flex;gap:${space.px8}}
      #${overlayId} .b-action{border:${size.border} solid ${color.actionBorder};border-radius:${size.pillRadius};padding:${space.px7} ${space.px11};background:${color.action};color:${color.onAccent};font-size:${type.label};font-weight:${type.strong};cursor:pointer}#${overlayId} .b-action:hover{background:${color.focus}}#${overlayId} .b-action:focus-visible,#${overlayId} .b-tab:focus-visible,#${overlayId} .b-item:focus-visible{outline:${size.emphasisBorder} solid ${color.focus};outline-offset:${size.focusOffset}}
      #${overlayId} .b-tabs{display:flex;gap:${space.px8};padding:${space.px14} ${space.px20};border-bottom:${size.border} solid ${color.separator};background:${color.secondarySurface}}#${overlayId} .b-tab{border:${size.border} solid ${color.tabBorder};border-radius:${size.pillRadius};padding:${space.px8} ${space.px13};background:transparent;color:${color.tabText};cursor:pointer}#${overlayId} .b-tab[aria-selected=true]{border-color:${color.accent};background:${color.selectedTab};color:${color.selectedTabText}}#${overlayId} .b-tab:disabled{opacity:${opacity.disabledTab};cursor:not-allowed}
      #${overlayId} .b-layout{display:grid;grid-template-columns:${size.listColumn} 1fr;min-height:${size.layoutHeight}}#${overlayId} .b-list{margin:0;padding:${space.px14};list-style:none;border-right:${size.border} solid ${color.separator};background:${color.list};overflow:auto}#${overlayId} .b-item{display:block;width:100%;margin:0 0 ${space.px8};border:${size.border} solid ${color.itemBorder};border-radius:${size.itemRadius};padding:${space.px14};background:${color.item};color:${color.itemText};text-align:left;cursor:pointer}#${overlayId} .b-item[aria-current=true]{border-color:${color.accent};background:${color.selectedItem}}#${overlayId} .b-code{display:block;margin-bottom:${space.px7};color:${color.accent};font-size:${type.code};font-weight:${type.heavy};letter-spacing:${type.labelTracking}}#${overlayId} .b-item-title{display:block;overflow:hidden;font-size:${type.item};line-height:${type.itemLineHeight};text-overflow:ellipsis;white-space:nowrap}
      #${overlayId} .b-detail{padding:${size.detailPadding};overflow:auto}#${overlayId} .b-kicker{margin:0 0 ${space.px10};color:${color.accent};font-size:${type.label};font-weight:${type.heavy};letter-spacing:${type.labelTracking};text-transform:uppercase}#${overlayId} h1{margin:0 0 ${space.px28};font:${type.headingWeight} ${type.heading}/${type.headingLineHeight} ${type.sans};letter-spacing:${type.headingTracking};overflow-wrap:anywhere}#${overlayId} dl{display:grid;grid-template-columns:max-content 1fr;gap:${space.px8} ${space.px18};margin:0 0 ${space.px24};padding:${space.px16} ${space.px18};border:${size.border} solid ${color.separator};border-radius:${size.metadataRadius};background:${color.secondarySurface};font-size:${type.label}}#${overlayId} dt{color:${color.metadataLabel}}#${overlayId} dd{margin:0;color:${color.metadataText};overflow-wrap:anywhere}
      #${overlayId} .b-message{margin:0;padding:${space.px18};border-left:${size.emphasisBorder} solid ${color.accent};background:${color.message};color:${color.messageText};white-space:pre-wrap;overflow-wrap:anywhere;line-height:${type.bodyLineHeight}}#${overlayId} .b-fix{margin:${space.px24} 0 0;color:${color.suggestion};font:${type.suggestion}/${type.bodyLineHeight} ${type.sans}}#${overlayId} .b-fix strong{color:${color.accent}}#${overlayId} .b-editor{margin-top:${space.px20};border:0;border-bottom:${size.border} solid ${color.accent};padding:0 0 ${space.px2};background:transparent;color:${color.accent};cursor:pointer}
      @media(max-width:${size.mobileBreakpoint}){#${overlayId}{padding:0}#${overlayId} .b-shell{min-height:100%;border:0;border-radius:0}#${overlayId} .b-head{align-items:flex-start}#${overlayId} .b-layout{display:block}#${overlayId} .b-list{display:flex;min-height:0;border-right:0;border-bottom:${size.border} solid ${color.separator};overflow-x:auto}#${overlayId} .b-item{min-width:${size.mobileItemWidth};margin:0 ${space.px8} 0 0}#${overlayId} .b-detail{padding:${space.px24} ${space.px20}}#${overlayId} dl{grid-template-columns:1fr;gap:${space.px4}}#${overlayId} dd{margin-bottom:${space.px8}}}
      @media(prefers-reduced-motion:reduce){#${overlayId} *{scroll-behavior:auto!important}}
    </style>
    <section class="b-shell">
      <header class="b-head"><span class="b-brand">Boundra development error view</span><div class="b-actions"><button class="b-action" data-copy type="button">Copy safe report</button><button class="b-action" data-dismiss type="button" aria-label="Dismiss current Boundra diagnostics">ESC ×</button></div></header>
      <nav class="b-tabs" role="tablist" aria-label="Diagnostic sources">${renderSourceTab("runtime", options)}${renderSourceTab("boundary", options)}</nav>
      <div class="b-layout">
        <ol class="b-list" aria-label="${escapeHtml(options.activeSource)} diagnostics">${activeEntries.map((entry, index) => renderEntryButton(entry, index, index === options.activeIndex)).join("")}</ol>
        <main class="b-detail"><p class="b-kicker">${escapeHtml(selected.code)} · ${options.activeIndex + 1} of ${activeEntries.length}</p><h1 id="${overlayId}_title">${escapeHtml(selected.title)}</h1><dl>${selected.metadata.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl><pre class="b-message">${escapeHtml(selected.message)}</pre><p class="b-fix"><strong>How to fix</strong><br>${escapeHtml(selected.suggestion)}</p>${selected.editorLocation && options.onOpenInEditor ? `<button class="b-editor" data-editor="${escapeHtml(selected.editorLocation)}" type="button">Open in editor ↗</button>` : ""}</main>
      </div>
    </section>`;

  root.querySelectorAll<HTMLButtonElement>("[data-source]").forEach((button) => {
    button.addEventListener("click", () => {
      options.onSelectSource(button.dataset.source as OverlaySource);
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-index]").forEach((button) => {
    button.addEventListener("click", () => {
      options.onSelectEntry(Number(button.dataset.index));
    });
  });
  root.querySelector<HTMLButtonElement>("[data-dismiss]")
    ?.addEventListener("click", options.onDismiss);
  root.querySelector<HTMLButtonElement>("[data-copy]")
    ?.addEventListener("click", (event) => {
      options.onCopy(event.currentTarget as HTMLButtonElement);
    });
  root.querySelector<HTMLButtonElement>("[data-editor]")
    ?.addEventListener("click", (event) => {
      const location = (event.currentTarget as HTMLButtonElement).dataset.editor;
      if (location && options.onOpenInEditor) {
        void options.onOpenInEditor(location);
      }
    });
  options.target.append(root);
  root.focus({ preventScroll: true });
}

function renderSourceTab(source: OverlaySource, options: {
  entries: Record<OverlaySource, OverlayEntry[]>;
  activeSource: OverlaySource;
}) {
  const count = options.entries[source].length;
  const label = source === "runtime" ? "Runtime" : "Boundaries";
  return `<button class="b-tab" data-source="${source}" type="button" role="tab" aria-selected="${source === options.activeSource}" ${count === 0 ? "disabled" : ""}>${label} · ${count}</button>`;
}

function renderEntryButton(
  entry: OverlayEntry,
  index: number,
  selected: boolean,
) {
  return `<li><button class="b-item" data-index="${index}" type="button" aria-current="${selected}"><span class="b-code">${escapeHtml(entry.code)}</span><span class="b-item-title">${escapeHtml(entry.title)}</span></button></li>`;
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(value);
}

function setCopyStatus(button: HTMLButtonElement, status: string) {
  button.textContent = status;
  window.setTimeout(() => {
    if (button.isConnected) button.textContent = "Copy safe report";
  }, 1600);
}

function formatPath(path: ReadonlyArray<string | number>) {
  return path.reduce<string>((value, part) =>
    typeof part === "number"
      ? `${value}[${part}]`
      : value
        ? `${value}.${part}`
        : part, "") || "value";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character]!);
}
