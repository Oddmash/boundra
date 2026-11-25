# Roadmap

## Phase 0: Foundation Design

Status: complete.

Completed:

- project charter
- architecture baseline
- boundary rules
- CLI specification
- config and manifest specs
- naming convention
- initial ADR

## Phase 1: Core Tooling MVP

Status: complete.

Completed:

- `create-domain`
- `check-boundaries`
- BR-001 through BR-006
- JSON diagnostics and exit codes
- config and manifest loading
- CI integration example
- fixture test coverage

## Phase 2: Framework Workflow MVP

Status: complete for the first slice.

Completed:

- `graph-domains`
- `generate route|query|mutation`
- generated contract registration in `domain.json`
- TypeScript runtime helper surface in `packages/runtime`
- CLI internals split into modules

Completed in the framework-quality follow-up:

- schema-backed codegen templates
- executable contract runtime and client/server adapters
- generated shared public exports
- help/usage output tests

## Phase 3: Dogfooding

Status: complete for the first internal flow.

Completed:

- promoted the framework-neutral TypeScript consumer to `examples/order-billing`
- created `order` and `billing` domains through the Boundra CLI
- type-checked generated route/query/mutation contracts against
  `boundra`
- exercised a declared cross-domain public API import
- added one local and CI verification command with `pnpm verify-example`
- executed runtime input/result validation, client transport, and a server route
- removed manual dependency editing with `add-dependency`
- stabilized CLI error codes, context, suggestions, and JSON failure output

Goals:

- use Boundra in a real internal app flow
- create multiple domains
- wire generated contracts into an app or package
- observe missing runtime APIs
- refine generated file structure before packaging

Done when:

- normal development can use Boundra without manual manifest editing
- generated contracts are useful enough to keep
- repeated friction is captured as concrete issues or docs updates

Resolved friction is documented in `docs/dogfooding-notes.md` and ADR 0002.

## Phase 4: Core Stabilization

Goals:

- introduce a stronger parser backend if needed
- improve diagnostics and suggestions
- improve performance on larger workspaces
- stabilize JSON output schemas
- harden manifest/config schema compatibility

Current priority:

- enforce app-to-domain public API boundaries
- expose provider-neutral runtime validation issues for adapters and overlays
- add a one-command project initialization and npm CLI experience
- build a development-only Vite error overlay on the structured diagnostic protocol
- continue collecting parser edge cases before reconsidering SWC
- harden packaging and the public quickstart

Validated during stabilization:

- a 773-file real Next.js monorepo matched TypeScript on all 2,559 unique
  source-file/module-path pairs after narrow parser fixes
- JSONC `tsconfig.json`, generated framework output, and agent worktrees are
  handled by the default project model
- configured app, domain, and package roots are enforced by every boundary rule
- relative `tsconfig extends` aliases and Svelte sources are checked by default
- manifest dependencies are enforced against imports and must remain acyclic
- a 10,000-file boundary fixture remains below 250 ms warm median and 6 MB RSS

## Phase 5: Extension Design

Goals:

- evaluate Starlark policy/codegen hooks after dogfooding
- keep Lua as an optional local automation candidate
- avoid extension runtime before real customization pressure exists

## Phase 6: External Release

Goals:

- package `boundra` as compiled ESM and declarations
- publish native CLI archives with checksums
- write public quickstart
- provide examples after dogfooding
- publish only after CLI commands and generated layouts stabilize

Packaging direction is defined by ADR 0003 and `docs/packaging-spec.md`.

## Phase 7: Developer Experience Expansion

Expand the existing Rust engine and TypeScript framework surface without
introducing another bundler, runtime, ORM, or UI framework.

| Priority | Capability | Acceptance criteria |
| --- | --- | --- |
| P0 | Domain impact inspection | Direct and indirect consumers from manifests; stable JSON; no source mutations |
| P1 | Workspace doctor | Explain missing config, malformed manifests, empty scans and unsupported environments using existing diagnostics |
| P1 | Editor integration | Reuse checker diagnostics in an editor adapter with cancellation and debounced updates; no duplicate rule implementation |
| P1 | CI annotations | Map deterministic diagnostics to standard CI reports and retain existing exit semantics |
| P2 | Incremental checks | Demonstrate equivalent diagnostics to a full scan and measurable gains on realistic workspaces before enabling caching |
| P2 | Contract adapters | Validate framework-neutral contract behavior against real Next.js, Vite and server consumers before introducing framework-specific packages |
| P2 | Extension contracts | Evaluate declarative policies and code generation templates before adopting an extension language |

The initial impact command uses the declared dependency graph, not runtime
call tracing. Changes to rule semantics or manifest compatibility require an ADR.
