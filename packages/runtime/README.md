# Boundra

A Rust-powered static architecture checker and schema-backed TypeScript contract
runtime for domain-first applications. The `boundra` npm package includes the
native CLI launcher as well as the TypeScript runtime. Keep your existing
framework, backend and build tools.

[Website](https://oddmash.github.io/boundra/) · [User guide](https://oddmash.github.io/boundra/docs/user-guide/) · [AI-readable documentation](https://oddmash.github.io/boundra/llms.txt) · [Source repository](https://github.com/Oddmash/boundra)

## Install

Node.js 20 or later is required. The CLI launcher downloads and verifies the
matching native binary on first execution. Published targets include Linux x64,
macOS Intel and Apple Silicon, and Windows x64. For offline or controlled
environments, provide an existing binary via `BOUNDRA_CLI_PATH`.

```sh
pnpm add boundra zod
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing --path commerce
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra check-boundaries --format json
```

The CLI discovers domain manifests, enforces client/server layers, verifies
public entry points and checks that cross-domain imports match declared
dependencies. The example creates two domains and declares billing's dependency
on order. Generated files are application-owned after creation.

See [installation and target platforms](https://oddmash.github.io/boundra/docs/cli-install/) and the
[boundary rules](https://oddmash.github.io/boundra/docs/boundary-rules/).

## Define and validate a contract

Generated contracts use Zod for schema authoring. The runtime only requires
the structural `parse(unknown)` contract and does not depend on Zod.

Run this standalone example in an ESM TypeScript module with your usual
TypeScript runner. It uses a local transport:

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

Input is validated before transport and the result is validated before it is
returned. Use `createHttpTransport` for a compatible HTTP endpoint, or implement
your own adapter. Your host retains routing, authentication, authorization,
persistence and error-response handling. Boundra is not a replacement framework
or runtime security boundary.

## Public API

- `defineRoute`, `defineQuery`, `defineMutation`: declare schema-backed contracts
- `createBoundraClient`: validate query and mutation requests and results
- `createHttpTransport`, `BoundraHttpError`: connect to a compatible HTTP endpoint and retain structured, bounded non-2xx response details
- `BoundraCallOptions`: propagate an optional per-call `AbortSignal`
- `implementRoute`, `implementQuery`, `implementMutation`, `executeContract`: bind and execute server implementations
- `BoundraRuntimeError`: inspect normalized validation issues and serialize diagnostics
- `defineConfig` and `BoundraConfig` from `boundra/config`: author configuration with TypeScript
- `createBoundraErrorView` from `boundra/ui`: render framework-neutral development diagnostics
- `boundra/vite`: integrate boundary and runtime diagnostics into Vite development
- `boundra/eslint`: create a flat-config plugin from a single project boundary scan

### ESLint (flat config)

```js
import { createBoundaryPlugin } from "boundra/eslint";

export default [{
  plugins: { boundra: createBoundaryPlugin({ root: import.meta.dirname }) },
  rules: { "boundra/boundaries": "error" },
}];
```

The adapter takes one full scan when the config loads, reusing its diagnostics for every linted file. Use a fresh ESLint process for each lint run, without `--cache`, to avoid stale project-wide diagnostics. The snapshot does not support live editor refresh or processor-generated virtual documents. Run `boundra check-boundaries` in CI to cover files excluded by ESLint. A malformed or failed scan aborts configuration rather than silently passing lint.

Configuration-aware TypeScript tooling can use the public config contract:

```ts
import { defineConfig } from "boundra/config";

const config = defineConfig({
  paths: {
    domains: "domains",
  },
});
```

The native CLI still discovers `boundra.config.json`. The `boundra/config`
subpath provides authoring types and helpers without requiring the Rust CLI to
execute JavaScript or TypeScript configuration files. See
[configuration authoring](https://oddmash.github.io/boundra/docs/config-authoring/) for supported fields.

Validation failures include provider-neutral field issues. The following
extends the contract example:

```ts
import { BoundraRuntimeError } from "boundra";

try {
  await client.query(getOrder, { orderId: "" });
} catch (error) {
  if (error instanceof BoundraRuntimeError) {
    console.log(error.code, error.issues[0]?.path, error.issues[0]?.message);
  }
}
```

`error.toJSON()` returns a normalized diagnostic shape without the original
input or internal `cause`, suitable for development overlays and application
error UIs. Applications should not display arbitrary server error bodies.

Query and mutation calls accept optional per-call cancellation:

```ts
const controller = new AbortController();
await client.query(getOrder, { orderId: "order-001" }, {
  signal: controller.signal,
});
```

The signal reaches custom transports and `createHttpTransport`. If the request
is intentionally aborted, the original cancellation error is preserved.

## Verify in CI

Run the checker alongside existing type checks, tests and builds. Boundra
v0.7.0 adds the optional `--min-domains` coverage requirement:

```sh
pnpm exec boundra check-boundaries --root . --format json --min-domains 2
```

Choose a threshold that matches your architecture. See
[CI integration](https://oddmash.github.io/boundra/docs/ci-integration/) for exit codes and coverage
reporting.

## Documentation

- [CLI reference](https://oddmash.github.io/boundra/docs/cli-spec-v1/)
- [Contract schemas](https://oddmash.github.io/boundra/docs/contract-schema-spec/)
- [HTTP transport](https://oddmash.github.io/boundra/docs/http-transport/)
- [Vite integration](https://oddmash.github.io/boundra/docs/vite-integration/)
- [Browser development error view](https://oddmash.github.io/boundra/docs/error-view/)
- [Korean documentation](https://oddmash.github.io/boundra/docs/ko/) · [Japanese documentation](https://oddmash.github.io/boundra/docs/ja/) · [Simplified Chinese documentation](https://oddmash.github.io/boundra/docs/zh-cn/)
- [Release notes](https://github.com/Oddmash/boundra/releases) · [MIT license](https://github.com/Oddmash/boundra/blob/main/LICENSE)

Boundra is in public preview. Evaluate it alongside your existing verification
workflow; a clean scan does not establish complete runtime isolation.
