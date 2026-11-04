# dsh-vscode-runner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/sinvacn/dsh-vscode-runner/actions/workflows/ci.yml/badge.svg)](https://github.com/sinvacn/dsh-vscode-runner/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-4c6ef5)](https://github.com/deepseek-ai/deepseek-harness)

Run VS Code launch configurations, compounds and tasks from the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) Web UI. The catalog comes from the same files VS Code uses: `*.code-workspace`, `.vscode/launch.json`, `.vscode/tasks.json` and `.vscode/settings.json`.

English | [中文](README.zh.md)

## Features

- **Launch configurations, compounds and tasks** — lists all three, not just `launch.json`. Tasks can be run directly, and `preLaunchTask` / `dependsOn` chains are executed in order.
- **Single-folder and multi-root workspaces** — a project opened as one folder reads its `.vscode` directory; a `.code-workspace` reads workspace-level `launch` / `tasks` plus every listed folder's `.vscode` files.
- **VS Code variable substitution** — `${workspaceFolder}`, `${workspaceFolder:Name}`, `${workspaceFolderBasename}`, `${cwd}`, `${env:NAME}`, `${config:key}`, `${userHome}`, `${pathSeparator}` and `${/}`.
- **Runs like the integrated terminal** — `cwd`, `env`, `args`, `preLaunchTask`, `dependsOn`, stdin and stop are supported. Output is streamed with ANSI escapes removed.
- **One entry point, full run control** — the play icon in the Session header opens a dialog with search, categories, project grouping and keyboard navigation. After a start it switches to a runs view with live logs, stdin and stop, so no sidebar page is needed.
- **Flutter device selection** — Dart configurations without `deviceId` use `flutter devices --machine`; one device is selected automatically, several become a picker.
- **Agent tool** — the same engine is exposed as `vscode_launch` for listing, starting, stopping and inspecting runs from chat.

## Install

Tested with DSH `0.2.1-rc.5`.

```sh
dsh plugin --profile desktop add github:sinvacn/dsh-vscode-runner
```

Or ask the agent in chat:

> Install the dsh-vscode-runner plugin: `dsh plugin --profile desktop add github:sinvacn/dsh-vscode-runner`

Then open **Settings → Plugins** and make sure **VS Code Runner** is enabled. Refresh the page once; restart the desktop app if the Session header does not show the play icon.

## Usage

### Session header dialog

Click the **play icon** in the conversation header. The dialog lists launch configurations and tasks, grouped by the configuration's `cwd` (the sub-project), with search and category tabs.

- `↑` / `↓` move the cursor, `Enter` runs, `Esc` closes.
- A running item is marked green; clicking it opens the runs view.
- A Dart configuration that needs a device opens the device picker.

### Runs view

Starting a configuration switches the same dialog to the runs view, with the new run expanded:

- live output, with ANSI escapes removed;
- **Stop** while a run is preparing, running or stopping;
- an input box when the process accepts stdin (for example Flutter's `r` / `q`);
- the **Runs** footer button reopens the run history for the current workspace;
- **Back** returns to the configuration list.

No separate sidebar page or navigation is needed.

### What is executed

For a launch configuration:

1. `preLaunchTask` is resolved by label and run; a failing task stops the launch.
2. The configuration's `cwd` and `env` are applied.
3. The process starts through the user's shell (`$SHELL -lc` on POSIX, `cmd.exe` on Windows).

For a task:

1. `dependsOn` entries are run first (VS Code's default `parallel` order is currently executed sequentially).
2. The task's `command` / `args` / `options.cwd` / `options.env` are applied.

## Supported launch types

| `type` | How it runs |
| --- | --- |
| `dart` | `flutter run -d <device>`, with `toolArgs`, `args`, `program`, `flutterMode` |
| `go` | `go run` / `go test` / `mode: exec`; no Delve debugger |
| `node-terminal` | the `command` exactly as written |
| `node` / `pwa-node` | `node` or `runtimeExecutable` + `runtimeArgs` + `program`; `--inspect-brk` is removed |
| `python` / `debugpy` | `python3` or `pythonPath` + `program` / `module` |
| `chrome` / `pwa-chrome` / `msedge` / `pwa-msedge` | opens `url` in the system browser |
| `dotnet` | `dotnet <program>` |
| `ruby` / `php` | `<type> <program>` |
| `cppdbg` / `cppvsdbg` / `lldb` / `gdb` | runs `program` without a debugger |
| any type with `command`, `program` or `url` | generic command / executable / browser opener |

Configurations with `request: attach` are not runnable: DSH does not implement the Debug Adapter Protocol.

## Workspace discovery

The runner starts from the selected directory and looks for a workspace in this order:

1. A `.code-workspace` **in the same directory** is treated as the workspace (even if its folders are subdirectories).
2. Walking up the directory tree, a `.code-workspace` is used only if the selected directory is inside one of its listed folders. An unrelated workspace file in an ancestor is ignored, so a single-folder project is not hijacked by a parent multi-root workspace.
3. Otherwise the directory is a single-folder workspace and its own `.vscode` directory is read.

For a multi-root workspace, the catalog contains:

- workspace-level `launch.configurations`, `launch.compounds` and `tasks` from the `.code-workspace`;
- each folder's `.vscode/launch.json`, `.vscode/tasks.json` and `.vscode/settings.json`.

Workspace-level configurations must scope `${workspaceFolder}` explicitly (for example `${workspaceFolder:Client}`). Unscoped `${workspaceFolder}`, `${workspaceRoot}` and `${workspaceFolderBasename}` are invalid there and are reported as such, matching VS Code.

## Variables

| Variable | Meaning |
| --- | --- |
| `${workspaceFolder}` | the folder of the current `launch.json` / `tasks.json` |
| `${workspaceFolder:Name}` | a named folder from a `.code-workspace` |
| `${workspaceFolderBasename}` | basename of the current folder |
| `${workspaceRoot}` | deprecated alias for `${workspaceFolder}` |
| `${cwd}` | the task runner's current directory |
| `${env:NAME}` | process environment variable (empty with a warning if unset) |
| `${config:key.path}` | value from `.vscode/settings.json` |
| `${userHome}` | home directory |
| `${pathSeparator}`, `${/}` | platform path separator |

`${file}`, `${relativeFile}`, `${selectedText}`, `${lineNumber}`, `${input:...}` and `${command:...}` need editor or interactive context. Configurations using them are listed but marked **not runnable** with the reason.

## Agent tool

The host registers `vscode_launch` with these actions:

```json
{ "action": "list", "cwd": "/path/to/project" }
{ "action": "start", "cwd": "/path/to/project", "id": "launch:folder:/path/to/project:0" }
{ "action": "status", "cwd": "/path/to/project" }
{ "action": "stop", "runId": "run-3" }
{ "action": "input", "runId": "run-3", "data": "r" }
{ "action": "devices", "cwd": "/path/to/project" }
{ "action": "workspaces" }
{ "action": "session", "sessionId": "..." }
```

Call `list` first and reuse the returned item `id` for `start`.

## Security

- Every web route passes through `ctx.connection.requestRejection(req)` before it can read files or spawn a process. Unauthenticated, cross-site and Host/Origin-mismatched requests are rejected.
- Launch configurations and tasks are executable code by design. Only use this plugin with workspaces you trust, and review `.code-workspace` / `.vscode` files before running them.
- Environment variables are never returned to the browser: the catalog strips `env`.
- The agent tool and the UI share one `Runner` instance, so a run started in chat appears in the same dialog.

## Limitations

- **No DAP debugging.** Breakpoints, stepping, variable panes, `attach` sessions and `postDebugTask` are not implemented. `go`, `node`, Python and C/C++ configurations run as ordinary processes; `dart` still gets Flutter's own VM Service debugging.
- **Background tasks cannot be awaited.** A task with `"isBackground": true` can be run directly, but it cannot be a `preLaunchTask` or `dependsOn`, because there is no problem-matcher handshake to know when it is ready.
- **Compound `preLaunchTask` is not executed.** Members' own `preLaunchTask` entries are executed.
- **`dependsOrder: "parallel"` is currently sequential.** The task list says so when more than one dependency exists.
- **No task auto-detection.** Only tasks defined in `tasks.json` / `.code-workspace` are listed; npm, gulp, grunt and TypeScript auto-detected tasks are not.
- **Processes use pipes, not a PTY.** Output has no ANSI colors, and interactive programs work only if they accept piped stdin. Use the page's input box for input.
- **Same-directory workspace wins.** If a folder contains a `.code-workspace`, it is treated as a multi-root workspace even when it was opened as a single folder. Move or rename the workspace file to force single-folder mode.
- Host-generated diagnostics are currently in Chinese; the UI chrome is bilingual (English / 中文).

## Development

Requires Node.js 20 or newer. There are no runtime dependencies.

```sh
npm test
```

The suite creates temporary single-folder and multi-root workspaces and covers:

- JSONC parsing;
- single-folder discovery, `${workspaceFolder}`, `${config:...}`, task cwd and npm arguments;
- multi-root discovery, workspace-scoped variables, folder-qualified compounds, workspace tasks;
- ignoring an unrelated parent `.code-workspace`;
- same-directory workspace detection;
- workspace-root resolution for session subdirectories;
- POSIX and Windows argument quoting;
- real subprocess execution: `preLaunchTask` + `dependsOn`, stdin, stop and the background-task guard;
- client module registration through a stubbed module loader.

For implementation details, see [docs/internals.md](docs/internals.md).

## Files

| File | Purpose |
| --- | --- |
| `core.js` | JSONC parsing, workspace discovery, variable substitution, catalog compilation, process runner |
| `index.js` | Host plugin: authenticated web routes and the `vscode_launch` agent tool |
| `client.js` | Web UI: Session header play icon, configuration dialog, runs view, logs, input, device picker |
| `cordis.patch.yml` | Inserts the `vscode-runner` row into a DSH profile |
| `locale/{en,zh}.json` | Plugin Manager title and description |
| `icon.svg` | Plugin icon |
| `test/run.mjs` | Self-contained test suite |
| `CHANGELOG.md` | Release notes |
| `SECURITY.md` | Private vulnerability reporting |

## License

[MIT](LICENSE)
