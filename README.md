<div align="center">

<img src="docs/assets/boundra-mark.svg" alt="Boundra" width="104" />

# Boundra

**Keep TypeScript domain boundaries intact.**

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

[Website](https://oddmash.github.io/boundra/) · [Documentation](https://oddmash.github.io/boundra/docs/) · [npm](https://www.npmjs.com/package/boundra) · [AI-readable documentation](https://oddmash.github.io/boundra/llms.txt)

[![npm](https://img.shields.io/npm/v/boundra?color=ea580c)](https://www.npmjs.com/package/boundra) [![CI](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml/badge.svg)](https://github.com/Oddmash/boundra/actions/workflows/boundra.yml) [![License](https://img.shields.io/badge/license-MIT-ea580c)](LICENSE)

</div>

Boundra combines a Rust-powered static analysis CLI with a schema-backed TypeScript contract runtime. It helps domain-first applications keep imports, public interfaces and dependency declarations consistent as the codebase grows.

A client file should not import a server implementation. A billing domain should consume the order domain's public API only after declaring that dependency. Boundra checks those rules before changes merge, and its runtime validates contract inputs and results when calls execute. Keep your existing Next.js, Vite, backend and build tools.

[![Boundra boundary-check visualization showing a source import, a boundary inspector, and blocked or allowed routes](docs/assets/boundra-preview.png)](https://oddmash.github.io/boundra/)

*Illustrative boundary-check visualization. The browser does not execute the native CLI.*

**[User guide](docs/user-guide.md)** · [Adoption and trade-offs](docs/product-positioning.md)

## Quick start

Use Node.js 20 or later in an existing TypeScript project. The first CLI invocation downloads and verifies the matching native binary. Supported targets: Linux x64, macOS Intel and Apple Silicon, Windows x64. See [installation and offline usage](docs/cli-install.md).

Create two domains, declare their dependency, and generate a shared contract:

```sh
pnpm add boundra zod
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing --path commerce
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra check-boundaries --format json
```

This creates layer directories and manifests for `order` and `billing`. Billing may depend on order through its declared public entry points. Generated files are application-owned: edit them rather than rerunning generation. The dependency graph describes declared relationships, not every runtime call.

## What it checks

| Rule | Disallowed import or dependency |
| --- | --- |
| BR-001 | Client → server |
| BR-002 | Server → client |
| BR-003 | Shared → policy-denied capability |
| BR-004 | Domain → another domain's internals |
| BR-005 | App → domain internals |
| BR-006 | Domain → undeclared public API |

## Define and validate a contract

Generated query, mutation and route contracts use schemas as the source of truth for input and result types. Run the following standalone example in an ESM TypeScript module with your usual TypeScript runner. It uses a local transport, without a backend:

```ts
import { createBoundraClient, defineQuery } from "boundra";
import { z } from "zod";

const getOrder = defineQuery({
  name: "get-order",
  input: z.object({ orderId: z.string().min(1) }),
  result: z.object({
    orderId: z.string(),
    status: z.enum(["pending", "submitted"]),
  }),
});

const client = createBoundraClient(async ({ input }) => {
  const { orderId } = input as { orderId: string };
  return { orderId, status: "pending" };
});

const order = await client.query(getOrder, { orderId: "order-001" });
```

For real requests, use `createHttpTransport` with a compatible host endpoint or your own transport adapter. The host owns HTTP routing, authentication, authorization, persistence and error responses; Boundra validates the contract. It does not replace a framework, provide runtime isolation or serve as a production security control.

## Make boundaries part of CI

Run the checker alongside existing type checks, tests and builds. Boundra v0.7.0 adds an optional minimum-domain coverage requirement:

```sh
pnpm exec boundra check-boundaries --root . --format json --min-domains 2
```

Adjust the threshold to your project's expected domains. The JSON report contains diagnostics and scan coverage. `graph-domains --format mermaid` helps review declared dependencies. The optional `boundra/vite` plugin shows development diagnostics and is not injected into production builds.

## Explore the documentation

- [Quick start](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Boundary rules](docs/boundary-rules.md)
- [CLI installation](docs/cli-install.md)
- [CLI reference](docs/cli-spec-v1.md)
- [Configuration](docs/config-spec.md)
- [Contract schemas](docs/contract-schema-spec.md)
- [HTTP transport](docs/http-transport.md)
- [Order and billing example](examples/order-billing)
- [Vite integration](docs/vite-integration.md)
- [Performance](docs/performance.md)
- [Documentation index](docs/readme.md)
- [Contributing](CONTRIBUTING.md)

Boundra is in public preview. Keep the existing verification workflow while evaluating it; see [release notes](docs/releases/v0-7-0.md) for v0.7.0 and [the changelog](CHANGELOG.md) for version history.
