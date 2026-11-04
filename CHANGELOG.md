# Changelog

## 0.1.1

- use a single Session-header play icon as the only entry point;
- remove the redundant sidebar **Run Configurations** page and its route-level
  navigation;
- starting a configuration now switches the dialog to an in-dialog runs view
  with live logs, stop and stdin;
- re-open run history from the dialog's **Runs** footer button.

## 0.1.0

Initial public release, migrated from the local `@local/dsh-vscode-runner`
plugin.

- list and run `launch.json` configurations, `launch.json` compounds and
  `tasks.json` tasks;
- single-folder projects and multi-root `.code-workspace` projects;
- workspace-level `launch` / `tasks` plus each folder's `.vscode` files;
- `${workspaceFolder}`, `${workspaceFolder:Name}`, `${workspaceFolderBasename}`,
  `${cwd}`, `${env:NAME}`, `${config:key}`, `${userHome}`, `${pathSeparator}`
  and `${/}` substitution;
- `preLaunchTask`, `dependsOn`, `cwd`, `env`, stdin, stop and live logs;
- Flutter device discovery through `flutter devices --machine`;
- Session header dialog and sidebar run page;
- `vscode_launch` agent tool.

Fixed while open-sourcing:

- an unrelated parent `.code-workspace` no longer hijacks a single-folder
  project;
- workspace-level unscoped `${workspaceFolder}` is rejected with an explanation
  instead of silently resolving to the workspace directory;
- folder-qualified compound member objects (`{ "folder", "name" }`) resolve;
- compound items inherit the device-required state of their members and are
  marked unrunnable when a member is unrunnable;
- background tasks are rejected as `preLaunchTask` / `dependsOn` instead of
  waiting forever;
- npm task arguments are passed after `--`;
- task groups and dependency labels are surfaced in the UI;
- session working directories resolve to the closest registered workspace;
- Windows shell selection and argument quoting;
- cross-platform relative paths in the UI.
