# Product positioning and adoption decision

## Recommendation

Boundra is an opt-in architectural contract tool for domain-first TypeScript codebases, not a replacement application framework. Its core proposition is a shared domain manifest that drives scaffolding, import policy, and relationship visualization, combined with validated input/result contracts. The CLI and runtime can be adopted separately.

## Who should adopt it?

- Teams with multiple business domains, shared packages, and recurring boundary drift.
- Teams maintaining multiple entry points or using AI-assisted code generation that need explicit, reviewable dependency policy.
- Teams that already want a domain-first structure and need consistent schemas and adapters, rather than another framework.

Avoid adopting it merely because the repository is large. A small site or an application already governed successfully by Nx or custom ESLint rules may gain little. A project using tRPC for typed remote calls can retain it and evaluate only Boundra's CLI.

## Alternative comparison

| Tool | Actual strength | Trade-off relative to Boundra |
| --- | --- | --- |
| ESLint no-restricted-imports | Familiar, customizable static import restrictions in existing lint pipelines | The team maintains path rules; the rule itself does not own a domain manifest, dependency graph, or contract generator |
| Nx enforce-module-boundaries | Project/tag-based constraints integrated with Nx and its project model | Excellent choice for existing Nx workspaces; Boundra's domain manifests and schema contracts are a different, narrower workflow |
| dependency-cruiser | Configurable module dependency rules and graph visualization, including reachability and cycles | More general graph analysis; does not prescribe Boundra's client/server/shared contract layout |
| tRPC | Inferred end-to-end TypeScript API types with a dedicated RPC ecosystem | Strong choice when RPC is the key problem; Boundra addresses source architecture and lets the host own transport |
| Next.js server/client boundaries | Runtime/framework-aware component composition and environment constraints | Boundra checks designated source layers; it cannot replace Next.js build/runtime semantics |

Primary sources: [ESLint](https://eslint.org/docs/latest/rules/no-restricted-imports), [Nx](https://nx.dev/docs/kb/enforce-module-boundaries), [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [tRPC](https://trpc.io/docs), [Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components).

These are capability comparisons, not benchmark results or claims that alternatives cannot express equivalent architecture with custom configuration.

## Benefits and costs

| Benefit | Cost or limitation | Evidence |
| --- | --- | --- |
| Explicit dependency ownership | Manifest updates and public API design become part of feature work | BR-004 through BR-006, graph-domains, manifest spec |
| Predictable file locations and generated contracts | Existing code may need migration; generated stubs still require implementation | CLI spec and clean-room verification |
| Runtime schema validation | Added validation work and dependency on schema authoring; does not implement authentication, persistence, or authorization | Contract and transport specs |
| Machine-readable diagnostics | Custom parser/resolver scope can miss unsupported import resolution; a passing scan is not a proof of complete isolation | Parser corpus and config spec |
| Native CLI | Initial release download and platform availability; offline environments need a provisioned binary | Packaging spec |

The repository's historical synthetic timing is documented in [performance.md](performance.md). It is not a head-to-head comparison. Current Node compatibility and native target coverage are exercised in CI; Next.js and Vite application-specific onboarding still need representative consumer verification. Boundra is not a security boundary or a substitute for compiler, framework, deployment, or application tests.

## Evidence-led next work

| Priority | Task | Gate |
| --- | --- | --- |
| P0 | Reliable adoption and scan coverage | Fresh install, at least two expected domains scanned, clean fixture and actionable diagnostic |
| P1 | Real Next.js App Router and Vite consumer fixtures | Compile/build and verify alias resolution, public entries, runtime and development integration |
| P1 | Compare parser precision against a reference parser and established tools | Same corpus, exact import tuples and independently labeled outcomes; measure false positives and negatives |
| P2 | Evaluate adoption overhead and performance | Same project and environment; record time to configure, maintenance steps, repeated scan times and memory |

Do not introduce an extension DSL, new routing framework, or custom bundler before the core adoption evidence demonstrates a need. Reassess independent development if existing tools satisfy the target workflow with less maintenance.

## Adoption exit criteria

A pilot is successful only if developers can configure a slice without breaking existing builds, the checker observes the intended domains, diagnostics are actionable, and recurring maintenance costs are acceptable. Actual adoption and comparative speed are not yet measured. Keep the existing lint, typecheck and framework build during evaluation.
