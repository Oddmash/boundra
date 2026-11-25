# ADR 0012: Declarative Domain Restrictions

- Status: Proposed
- Date: 2026-11-25

## Context

Projects may need to prohibit particular domain-to-domain imports even when the target public API is declared and accessible under the built-in rules.

## Decision

Accept an optional `checkBoundaries.denyDomainDependencies` object mapping discovered source domain names to lists of discovered target domain names. Names are exact manifest identities, not filesystem patterns. Unknown names, self-restrictions and duplicate targets are configuration errors.

Each resolved import from a source into a denied target domain emits BR-007. Existing rules continue to run; a restriction cannot allow an import that another rule denies. Restrictions do not create dependencies and do not modify manifests or source files. Merely declaring a dependency without an import is not a BR-007 violation.

## Consequences

The policy is deterministic, portable and does not introduce a plugin runtime, external execution, or a new rule language. An empty object is equivalent to the previous behavior. Diagnostics use the existing rule/file/line/message/suggestion shape.

## Migration

Add restrictions to the JSON configuration only after the named domains exist. Run `boundra check-boundaries` to identify existing violations. Remove or refactor prohibited imports; existing built-in rules remain unchanged.
