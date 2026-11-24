# CI Integration

## Add Boundra to your application

Install `boundra` and `zod` with your project package manager, initialize the project, and commit the configuration and domain manifests. Run the boundary check alongside your existing typecheck, tests, and build. Here is a minimal GitHub Actions example for a pnpm application using the published CLI:

```yaml
name: Check boundaries

on:
  pull_request:
  push:
    branches: [main]

jobs:
  boundaries:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec boundra check-boundaries --root . --format json
```

For npm projects, replace the last two commands with `npm ci` and `npx boundra check-boundaries --root . --format json`. The native launcher retrieves the matching released CLI on first use. See [installation](cli-install.md) for offline or unsupported platform requirements. An empty scan can pass with a warning in published v0.6.0; inspect the JSON coverage counts and use the [user guide](user-guide.md) coverage check if your project requires a minimum number of domains.

## Boundra repository verification

Use the committed example flow as the required CI gate. It type-checks the
TypeScript surface, executes runtime and example flows, runs Rust tests, checks
boundaries, and renders the domain graph:

```yaml
name: Boundra

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify-example:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify-example
      - run: pnpm verify-clean-room
      - run: cargo clippy --workspace --all-targets -- -D warnings
```

## Local Verification

Run the same aggregate gate locally:

```bash
pnpm verify-example
```

The individual boundary command remains suitable for repositories that only
adopt Boundra's analyzer. On the unreleased CLI, mature workspaces can require
an expected minimum number of scanned domains, so a misconfigured empty scan
cannot pass silently:

```bash
boundra check-boundaries --format json --min-domains 2
```

Set the threshold to the number expected in your adoption slice. Without the
option, the CLI retains its existing warning-only empty-scan behavior.

## Exit Codes

- `0`: no boundary violations
- `1`: boundary violations found
- `2`: config, manifest, or CLI usage error
- `3`: runtime scan or file system error

## JSON Output

CI and agent integrations should prefer JSON output:

```bash
cargo run -p boundra-cli -- check-boundaries --root examples/order-billing --format json
```

Example:

```json
{
  "status": "failed",
  "violations": [
    {
      "rule": "BR-001",
      "file": "domains/order/client/use-order.ts",
      "line": 3,
      "import": "../server/order-service",
      "message": "client layer cannot import server layer",
      "suggestion": "move shared contract to shared layer or call through an API boundary"
    }
  ],
  "meta": {
    "command": "check-boundaries",
    "violation_count": 1
  }
}
```
