# Read-only Boundra MCP preview

The local stdio server exposes architecture metadata from a deliberately prepared workspace snapshot. It never executes a command, evaluates project code, writes files, opens a network connection or accepts a path from an MCP request.

## Prepare a workspace

From the selected workspace, run:

```sh
boundra graph-domains --format json > .boundra-graph.json
boundra check-boundaries --format json > .boundra-diagnostics.json
```

Violations produce exit status 1 and a valid diagnostic snapshot. Configuration and scan errors are rejected by the server. Keep the snapshots local, inspect them before sharing, and regenerate both when source or manifest information changes.

Start the server using your local Boundra executable with `mcp --root /absolute/workspace/path`. The root is selected at startup only. Both files must be regular, non-symbolic-link files inside that root, at most 8 MiB each.

## Protocol

The preview supports the MCP 2025-11-25 stdio handshake, tools/list and tools/call, and resources/list and resources/read. The versioned result schema is `boundra.architecture.v1`.

| Tool | Input | Result |
| --- | --- | --- |
| `domains` | `{}` | Declared domains and dependency edges |
| `impact` | `{ "domain": "billing" }` | Transitive dependents in the declared graph |
| `diagnostics` | `{}` | Boundary diagnostic metadata and scan coverage counts |

Resources: `boundra://architecture/v1/domains` and `boundra://architecture/v1/diagnostics` with JSON content.

No source contents, secrets, arbitrary files or execution tools are exposed. Diagnostic messages may contain local relative paths and import specifiers; review those before connecting a model. Snapshot data is not guaranteed fresh, and impact describes declared rather than observed dependencies. This is an experimental protocol adapter, not a verified integration with every MCP client.
