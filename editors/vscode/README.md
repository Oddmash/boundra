# Boundra for VS Code (development preview)

Run the workspace-local `boundra` package on saved files and display boundary
violations in the Problems panel.

1. Clone the repository and open `editors/vscode` in desktop VS Code.
2. Select `Run Boundra Extension` in Run and Debug, then press F5. The launch
   configuration loads the unpackaged extension into a new Extension Development Host.
3. In that new window choose File > Open Folder and open a trusted Boundra
   workspace with `boundra` installed. The preview remains loaded in that host;
   no marketplace installation is needed.
4. Save a source file or invoke `Boundra: Check Workspace` from the Command Palette.
   View violations in Problems and CLI errors in the Boundra output channel.

The adapter discovers the nearest config within a workspace
folder, coalesces saves, cancels superseded checks and does not run in untrusted
or virtual workspaces. It does not install or publish an extension automatically.

Run adapter tests with `node --test editors/vscode/diagnostics.test.cjs`.
