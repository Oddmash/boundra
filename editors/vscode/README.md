# Boundra for VS Code

Run the workspace-local `boundra` package on saved files and display boundary
violations in the Problems panel.

## Install the pre-release

From a terminal with the VS Code CLI available:

```sh
code --install-extension oddmash.boundra-vscode --pre-release
```

1. Install [Boundra from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=oddmash.boundra-vscode). Select the pre-release version if prompted.
2. Install `boundra` in your existing TypeScript project using `pnpm add -D boundra` or your usual package manager.
3. Create or open a trusted workspace with `boundra.config.json` and initialize the domain structure using `pnpm exec boundra init --name my-app` if needed.
4. Save a source file or invoke **Boundra: Check Workspace** from the Command Palette. View violations in Problems and CLI failures in the Boundra output channel.

The adapter discovers the nearest config within a workspace
folder, coalesces saves, cancels superseded checks and does not run in untrusted
or virtual workspaces. The extension does not install the CLI automatically.
Keep running the full native checker in CI.

Follow the [Boundra quickstart](https://oddmash.github.io/boundra/docs/quickstart/)
for a first boundary check. See the [CLI installation guide](https://oddmash.github.io/boundra/docs/cli-install/)
for supported platforms and native installation.

## Contributing

Clone the repository, open `editors/vscode` in desktop VS Code and run the `Run Boundra Extension` launch configuration (F5). Open a trusted fixture workspace in the Extension Development Host.

Run adapter tests with `node --test editors/vscode/diagnostics.test.cjs`.

The Marketplace pre-release is built and verified by the VS Code Extension
workflow. Publishing is a manual operation restricted to the repository's
`main` branch and the `marketplace` environment. It uses short-lived trusted
publishing credentials rather than a stored PAT.
