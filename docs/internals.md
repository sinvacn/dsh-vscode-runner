# dsh-vscode-runner internals

Developer notes for the host core, the web routes and the browser bundle. User documentation: [README.md](../README.md) / [README.zh.md](../README.zh.md).

## Layout

```
index.js        Host plugin: Runner instance, 6 routes, vscode_launch tool
core.js         JSONC, discovery, substitution, catalog compiler, process runner
client.js       Browser module: Session header dialog, runs view, CSS
cordis.patch.yml  Adds the `vscode-runner` row to a profile
test/run.mjs    Self-contained fixture + execution tests
```

`package.json` declares two DSH surfaces:

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "platform": "web",
    "immediately": true,
    "inject": [
      "@deepseek-ai/dsh-client-ui-primitives"
    ]
  }
}
```

The browser module registers itself as `dsh-vscode-runner` with `window.__ModuleLoader__.load`. Keep this id identical to the package name.

## Host routes

All routes share `/vscode-runner` and are registered with `ctx.webServer.register({ kind: 'exact', path })`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/session-catalog?sessionId=` | catalog resolved from a Session working directory |
| `POST` | `/start` | `{ cwd, id, deviceId? }` |
| `GET` | `/runs?cwd=` | run views for a workspace |
| `POST` | `/stop` | `{ runId }` |
| `POST` | `/input` | `{ runId, data }` |
| `GET` | `/devices?cwd=` | `flutter devices --machine`, cached for 15 s |

Every request runs through `ctx.connection.requestRejection(req)` before the handler. The same `Runner` instance backs the routes and the `vscode_launch` tool.

Request bodies are capped at 64 KiB and must use `content-type: application/json`. Error responses use `{ code, message }`; the client maps `device-required` to the device picker, `unknown-item` to the “refresh” message and `not-runnable` to the item's reason.

## Workspace discovery

`discover(start)` is deterministic and does not trust a parent workspace blindly:

1. `findWorkspaceFile(start)` walks up at most 12 levels.
2. A `.code-workspace` that lists a folder containing `start` wins immediately.
3. A `.code-workspace` in `start` itself is accepted even when its folders are subdirectories.
4. An unrelated `.code-workspace` in an ancestor is never used. This keeps a single-folder project inside a larger workspace directory from being hijacked.
5. With no workspace file, the directory is a single-folder workspace; its `.vscode` directory is read.

For a workspace file, `folders` entries become folder sources. Relative paths resolve against the workspace file's directory. A folder without an explicit `name` uses its basename. Workspace settings are merged into each folder's settings, with the folder's `.vscode/settings.json` winning.

Each source has a stable id:

- workspace file: `workspace:<absolute .code-workspace path>`
- folder: `folder:<absolute folder path>`

Catalog item ids are derived from the source id and the array index:

- `launch:<source id>:<index>`
- `task:<source id>:<index>`
- `compound:<source id>:<index>`

They are stable for an unchanged file and are what `vscode_launch({ action: 'start' })` expects.

## Variable substitution

`createSubstituter(scope)` returns `{ substitute, hard, soft }`.

- `hard` variables make an item unrunnable (`${file}`, `${input:...}`, `${command:...}`, unknown variables, and unscoped workspace variables in a workspace-level source).
- `soft` variables are replaced by `''` and appended to the item's note (`${env:NAME}` when unset, missing `${config:...}`).

Folder sources resolve `${workspaceFolder}` and `${workspaceRoot}` to the folder. Workspace-level sources (`kind: 'workspace'`) deliberately leave them empty: VS Code requires `${workspaceFolder:Name}` there. The catalog reason explains this instead of silently starting in the wrong directory.

`${cwd}` resolves to the source base (the folder, or the `.code-workspace` directory for workspace-level entries). `${workspaceFolder:Name}` matches folder names case-insensitively, like VS Code.

## Compound resolution

`compileCompound` accepts both VS Code forms:

```json
"configurations": [
  "Launch Client",
  { "folder": "Client", "name": "Launch Client" }
]
```

- A string first looks in the compound's own source, then falls back to the first launch with that name elsewhere in the catalog.
- An object looks up `folder/name` using the workspace folder's display name (case-insensitive fallback).
- Missing references are skipped and reported as catalog warnings; the compound remains runnable if at least one member resolves.

At start time, every member is validated (runnable, device available) before any process starts, so a compound either starts all members or returns an error.

## Execution

`Runner` is host-only. It receives a subprocess factory from `ctx.subprocess.spawn(spec)` and builds specs with:

- POSIX: `[$SHELL, '-lc', script]`
- Windows: `[cmd.exe, '/d', '/s', '/c', script]`

`cwd`, merged environment, 5 s termination grace and a collected-output budget are included. `PATH` is augmented with common Flutter, Homebrew and `~/go/bin` locations.

A run moves through `preparing → running → exited | failed | stopped` (plus `stopping`). For a launch:

1. each `preLaunchTask` is resolved via `resolveTask(label, sourceId, tasksByLabel)` and passed to `runTask`;
2. `runTask` walks `dependsOn` recursively with a `seen` set to detect cycles; dependencies run sequentially even when `dependsOrder` is `parallel`;
3. the run's command starts, stdin is a pipe, and stdout/stderr are drained into a bounded log;
4. `stop` terminates the current handle; `terminated` prevents the next stage from starting.

`task.isBackground` is a hard error in `runTask` because there is no problem-matcher handshake. Starting a background task directly is allowed; it simply stays in `running` until stopped.

`runsView(cwd)` includes runs whose `workspacePath` or actual `cwd` is inside the requested directory, so a workspace root sees runs launched from its subfolders.

## Session catalog

`/session-catalog` resolves:

1. the Session's working directory (or the default directory);
2. the closest registered workspace containing it (`Runner.workspaceRootFor`);
3. the catalog at that root, then re-built at `workspace.root` when a `.code-workspace` was found above.

This is why the header dialog shows the whole project even when the agent's terminal is inside `app/src`.

## Browser bundle

`client.js` is a plain module-loader bundle, not an npm import graph. It registers one slot:

- `conversation.session.header.actions` — the play-icon dialog (`SessionRunAction`).

The dialog keeps search, category, collapsed groups, cursor, device state and the runs view in component state. Runs are polled every 1.5 s while the dialog is open and polling stops on unmount.

Styles are injected once as a `<style data-vscode-runner>` element by the apply effect and removed on unload. The component uses DSH design variables (`--dsw-alias-*`) so it follows the active theme.

Starting a configuration switches the dialog to the runs view and expands the new run. The **Back** button returns to the configuration list; there is no separate sidebar page.

## Testing

```sh
npm test
```

Fixtures are created under `os.tmpdir()`, so the suite never reads the repository's own `.vscode` files. `spawnWithPipes` implements the small part of the DSH subprocess handle used by `Runner`: `stdin`, `collected.stdout/stderr.readFrom(offset)`, `done`, `terminate()`.

CI runs the suite on Ubuntu and Windows with Node 20 and 22; macOS is the primary development machine and is tested locally. Execution tests that need POSIX `read`/`sleep` are skipped on Windows; compilation, discovery, quoting, client-bundle registration and host-wiring tests still run.

## Debugging

- Host: enable DSH logs and look for `vscode-runner:` effect labels. The plugin unload effect disposes all live processes.
- Client: check the browser console for module-loader errors; reload the plugin from **Settings → Plugins** after changing host code, then refresh the page for client code.
- Catalog problems: call the agent tool `vscode_launch({ action: 'list', cwd })` to see the raw catalog and warnings without the UI.
- Background task stuck: confirm `isBackground` is set. The runner refuses to await it as a dependency by design.
