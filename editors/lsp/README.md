# Boundra language-server evaluation

This experimental stdio adapter evaluates whether the existing native boundary diagnostics can be reused across language-server clients. It does not replace the VS Code Marketplace extension and is not published as a supported editor integration.

Run after building `boundra-cli`:

```sh
node editors/lsp/server.cjs --root /absolute/trusted/workspace --cli /absolute/path/to/boundra
```

The server uses one explicitly selected, trusted workspace and one explicitly selected native CLI. It rejects a mismatched initialization root, ignores documents outside the root, and does not accept executable paths or root changes from client requests. Never start it for a workspace you do not trust. It uses the same report decoding and coalescing/cancellation scheduler as the existing VS Code adapter.

## Lifecycle and document synchronization

- LSP 3.17 framed JSON-RPC over stdio, explicit single root, UTF-16 positions.
- Initialize and shutdown requests, exit notification, document open/save/close. Only disk-backed files are analyzed. Unsaved edits, virtual documents, completion, hover, code actions and multiple roots are out of scope.
- Open or save schedules a debounced full project scan. A newer event aborts the previous scan and suppresses stale results. Closing a document clears diagnostics for it. Invalid reports log an error instead of creating a false success state.
- Diagnostics use zero-based lines and column zero because the CLI does not expose columns. Full project checks remain required in CI.

## Evaluation and migration gates

The protocol test exercises fragmented framing, initialization, changed saved files, close, root rejection and graceful shutdown against the real native CLI. Run it with `BOUNDRA_CLI_PATH=/absolute/path/to/boundra node --test editors/lsp/server-test.cjs` and record the reported initial and refresh latency. The small local native fixture measured approximately 165 ms for initial and save-to-clear diagnostics; this is not a large-project benchmark. The dedicated CI workflow also exercises Neovim's actual built-in LSP client; the local environment does not have Neovim installed.

Before offering this as a supported integration, validate the same fixture on VS Code using a separate development-host client and Neovim's native LSP client, including cancellation during a large scan. Cursor support must be independently verified. Compare p50/p95 save-to-diagnostic latency and native process counts on small and large projects against the current VS Code extension, then decide whether to migrate. Keep the published adapter unchanged until these gates are met.
