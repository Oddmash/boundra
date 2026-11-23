<div align="center">

<img src="docs/assets/boundra-mark.svg" alt="Boundra" width="120" />

# Boundra

**Domain boundaries before architecture drifts.**

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

</div>

**[User guide](docs/user-guide.md)** · [Product positioning and trade-offs](docs/product-positioning.md)

[![npm](https://img.shields.io/npm/v/boundra?color=ea580c)](https://www.npmjs.com/package/boundra) [![CI](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml/badge.svg)](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml) [![License](https://img.shields.io/badge/license-MIT-ea580c)](LICENSE)

Boundra is a schema-backed TypeScript contract runtime and a Rust static-analysis CLI for domain-first applications. Use it with your existing Next.js, Vite, and server stack.

When an application crosses domain boundaries, imports can quietly create accidental coupling. Boundra detects client/server boundary violations, undeclared domain dependencies, and internal imports before they reach production. Its runtime validates contract input and output.

## Quick start

Requires Node.js 20 or later. The launcher downloads the matching checksummed native binary on first use.

```bash
pnpm add boundra zod
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain tasks
pnpm exec boundra generate resource tasks/task
pnpm exec boundra check-boundaries
```

## What it checks

| Rule | Disallowed dependency |
| --- | --- |
| BR-001 | Client → server |
| BR-002 | Server → client |
| BR-003 | Shared → policy-denied capability |
| BR-004 | Domain → other domain internals |
| BR-005 | App → domain internals |
| BR-006 | Domain → undeclared public API |

## Define a contract

```ts
import { defineQuery, createBoundraClient, createHttpTransport } from "boundra";
import { z } from "zod";

const getTask = defineQuery({
  name: "get-task",
  input: z.object({ id: z.string().min(1) }),
  result: z.object({ id: z.string(), title: z.string(), done: z.boolean() }),
});

const client = createBoundraClient(
  createHttpTransport({ baseUrl: "/api/boundra" }),
);
const task = await client.query(getTask, { id: "task-001" });
```

## Developer workflow

Use `check-boundaries --format json` in CI and `graph-domains --format mermaid` to visualize the dependency graph. The optional `boundra/vite` plugin displays development diagnostics without changing production error handling.

## Documentation

- [Quick Start](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Boundary Rules](docs/boundary-rules.md)
- [CLI Installation](docs/cli-install.md)
- [CLI Specification](docs/cli-spec-v1.md)
- [Vite Integration](docs/vite-integration.md)
- [Performance](docs/performance.md)
- [Documentation Index](docs/readme.md)
- [Contributing](CONTRIBUTING.md)

Public preview. CLI and JSON contracts evolve additively where possible; breaking architectural decisions are recorded in ADRs.
