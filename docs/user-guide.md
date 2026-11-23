# Boundra user guide

[한국어](user-guide.ko.md) · [日本語](user-guide.ja.md) · [简体中文](user-guide.zh-cn.md)

Boundra combines a Rust source architecture checker with a framework-neutral TypeScript contract runtime. This guide uses public v0.6.0 behavior. It does not assume a new framework, hosted service, or automatic API server.

## 1. Install and verify

Use Node.js 20 or newer and a compatible package manager. In an existing TypeScript project:

```sh
pnpm add boundra zod
pnpm exec boundra --version
```

With npm, use `npm install boundra zod` and `npx boundra --version`. The CLI launcher downloads the matching release binary and verifies the checksum on first invocation. Published targets are Linux x64, macOS Intel/Apple Silicon and Windows x64. For offline builds, provision the binary and set `BOUNDRA_CLI_PATH` to its path. See [CLI installation](cli-install.md).

## 2. Adopt one slice first

Start in a clean working tree and retain the existing typecheck, tests and framework build. From the project root:

```sh
pnpm exec boundra init --name my-app
pnpm exec boundra create-domain order
pnpm exec boundra create-domain billing --path commerce
pnpm exec boundra add-dependency billing/order
pnpm exec boundra generate query order/get-order
pnpm exec boundra generate route billing/create-invoice
pnpm exec boundra check-boundaries --format json
pnpm exec boundra graph-domains --format mermaid
```

`init` preserves existing directories and refuses an existing config. `create-domain` scaffolds layer directories, public entry points and a manifest; the group directory does not change the manifest name. Once generated, files are yours to edit. Re-running generation is not an update operation.

The intended dependency is billing → order. Order must not depend back on billing. The graph describes declared dependencies, not every runtime call.

| Directory | Responsibility |
| --- | --- |
| apps/ | App entry points and composition |
| domains/order/client/ | Client queries, mutations and UI orchestration |
| domains/order/server/ | Server handlers and business logic |
| domains/order/shared/ | Pure contracts and schemas |
| domains/commerce/billing/ | A nested domain with its own manifest |
| packages/ | Reusable workspace packages |

## 3. Declare public interfaces

The CLI owns initial scaffolding. Each domain manifest declares `name`, the relative public API paths, and `dependsOn`. For billing, `dependsOn: ["order"]` is the permitted relationship. A cross-domain import still needs a public entry point and must respect layers. Prefer importing from `shared/public`, `client/public`, or `server/public` rather than reaching past the interface.

| Rule | What to change when reported |
| --- | --- |
| BR-001 | Move schema/types to shared; call server behavior through an adapter |
| BR-002 | Move pure logic out of client code |
| BR-003 | Remove runtime/UI/database dependencies from shared |
| BR-004 | Use the target domain's declared public API |
| BR-005 | Have the application consume a declared domain entry point |
| BR-006 | Declare an intentional dependency, or remove the coupling |

Only the documented manifest fields are enforced; metadata and policy placeholders are not authorization controls. See [manifest specification](domain-manifest-spec.md) and [boundary rules](boundary-rules.md).

## 4. Implement a real contract

Edit the generated `domains/order/shared/contracts/get-order.ts`:

```ts
import { defineQuery, type InferSchema } from "boundra";
import { z } from "zod";

export const getOrderInputSchema = z.object({
  orderId: z.string().min(1),
});

export const getOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "submitted"]),
});

export type GetOrderQueryInput = InferSchema<typeof getOrderInputSchema>;
export type GetOrderQueryResult = InferSchema<typeof getOrderResultSchema>;

export const getOrderQuery = defineQuery({
  name: "get-order",
  input: getOrderInputSchema,
  result: getOrderResultSchema,
});
```

The generated query adapter calls `client.query(getOrderQuery, input)` and is exported from the client public entry point. To try the behavior without a network or backend, use a TypeScript runner in the project and a local typed transport:

```ts
import { createBoundraClient, type BoundraTransport } from "boundra";
import { getOrder } from "./domains/order/client/public";

const transport: BoundraTransport = async (request) => {
  if (request.name !== "get-order") throw new Error("Unknown contract");
  const input = request.input as { orderId: string };
  return { orderId: input.orderId, status: "pending" };
};

const client = createBoundraClient(transport);
const order = await getOrder(client, { orderId: "order-001" });
console.log(order);
```

An empty order ID should reject with RUNTIME-001 before transport. An invalid result should reject with RUNTIME-002. The committed [order-billing example](../examples/order-billing) exercises the query, mutation and route together; from the Boundra repository run `pnpm verify-example` after installing workspace dependencies and Rust.

## 5. Connect an actual backend

Use `createHttpTransport({ baseUrl: "/api/boundra" })` when your host serves the corresponding API. The default transport sends POST requests to `/api/boundra/contracts/<name>` with kind, name and input. Your server returns `{ "result": ... }`. The host owns routing, identity, authorization, persistence, and safe error responses; Boundra validates the contract. For server-owned behavior use `implementRoute` with the generated route contract and `executeContract` in your host adapter. See [HTTP transport](http-transport.md) and [contract schema](contract-schema-spec.md).

Queries and mutations accept a per-call abort signal. Non-2xx responses and transport errors are surfaced through RUNTIME-003, except intentional cancellation. Avoid displaying raw response bodies.

## 6. Configure the analyzer and framework

Keep `boundra.config.json` at the project root. Set `paths.apps`, `paths.domains` and `paths.packages` to your actual layout. The CLI reads root TypeScript paths and relative extends, and simple root package imports strings. Conditional imports and package-based tsconfig extends are not resolved. A successful boundary scan does not prove that bundler output includes an alias target.

- Vite: add `boundra()` from `boundra/vite` to the existing Vite plugins. The development overlay reports runtime and boundary diagnostics. [Vite integration](vite-integration.md).
- Next.js: keep the App Router and its server/client rules. If needed, explicitly report normalized errors from a development-only Client Component using `boundra/ui`. There is no automatic Next.js plugin. [Error view](error-view.md).
- Other hosts: use the CLI independently, or implement a compatible transport.

Read [configuration](config-spec.md) before customizing extensions, ignore patterns or shared capability classification.

## 7. CI and review

Run `pnpm exec boundra check-boundaries --root . --format json` on PRs alongside the compiler, tests and framework build. Exit codes: 0 clean, 1 violation, 2 invalid usage/config, 3 internal/I/O error. Inspect JSON `meta.scanned_file_count` and `meta.analyzed_domain_count`: an empty scan can return success with a warning, so separately require the expected minimum coverage in a mature workspace.

```sh
pnpm exec boundra check-boundaries --format json > boundra-report.json
node --input-type=module -e 'import fs from "node:fs"; const r = JSON.parse(fs.readFileSync("boundra-report.json", "utf8")); if (r.status !== "passed" || !Number.isInteger(r.meta?.scanned_file_count) || r.meta.scanned_file_count < 1 || !Number.isInteger(r.meta?.analyzed_domain_count) || r.meta.analyzed_domain_count < 2) process.exit(1)'
```

Adjust the expected domain count to your pilot. Keep the report out of version control if it contains internal paths.

## 8. Troubleshooting

| Symptom | Next action |
| --- | --- |
| CLI not found or unsupported platform | Verify Node and target; use the matching native archive or controlled binary path |
| Cannot initialize again | Inspect the existing config; do not delete it just to rerun init |
| Unknown domain | Check configured domain root, manifest filename and logical name |
| Unexpected clean scan | Inspect coverage counters, paths, ignored files and supported resolver inputs |
| Generated file exists | Edit existing application-owned code or choose a different contract name |
| HTTP call fails | Verify the host endpoint, response envelope and transport handling |
| Overlay not visible in Next.js | Use the explicit host integration; Vite plugins do not run in Next.js |

## 9. Decide whether to retain Boundra

Measure adoption cost and representative failures against existing tools. Start with one domain before migrating the entire repository. Read [product positioning](product-positioning.md) for the alternatives, limitations, and evidence gates. Boundra is a development architecture guardrail, not runtime isolation or a production security control.
