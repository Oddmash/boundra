# Framework consumer conformance

The Next.js fixture also exposes a real contract-backed HTTP route. The packed
client uses its native HTTP transport to call the route and validate the result;
a direct invalid request, malformed JSON, missing input and a fixture-only
handler failure exercise server-side validation and safe host error responses
without leaking the request body or internal error details.

The release gate exercises the packed package, not workspace source aliases. Run `pnpm install --frozen-lockfile`, then `node scripts/verify-framework-consumers.mjs` on Node 24 with Rust and Chromium available. The test creates a disposable project, installs pinned consumer dependencies, builds Next.js App Router and Vite, and checks the actual browser output. It verifies nested-domain coverage, a public alias, a structured application-to-internal-import diagnostic, and input/result validation through the compiled package. Vite development must include its development overlay module; production must not. The production scan covers JavaScript and source maps, and the fixture emits a PNG asset to ensure binary outputs are excluded from text decoding.

The fixture records build and boundary-check duration as observations, not cross-machine performance claims. The separate synthetic benchmark exercises 1,000 and 10,000 source files. This is not proof of compatibility with every framework configuration, bundler plugin, runtime or deployment target.
