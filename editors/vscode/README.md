# Boundra for VS Code (development preview)

Run the workspace-local `boundra` package on saved files and display boundary
violations in the Problems panel. Open the extension directory in VS Code and
launch an Extension Development Host, then open a trusted Boundra workspace with
`boundra` installed. Use `Boundra: Check Workspace` to rerun checks and open the
output channel. The adapter discovers the nearest config within a workspace
folder, coalesces saves, cancels superseded checks and does not run in untrusted
or virtual workspaces. It does not install or publish an extension automatically.

Run adapter tests with `node --test editors/vscode/diagnostics.test.cjs`.
