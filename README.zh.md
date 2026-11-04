# dsh-vscode-runner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/sinvacn/dsh-vscode-runner/actions/workflows/ci.yml/badge.svg)](https://github.com/sinvacn/dsh-vscode-runner/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-4c6ef5)](https://github.com/deepseek-ai/deepseek-harness)

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的 Web 界面中列出并执行 VS Code 的运行配置。配置来源与 VS Code 一致：`*.code-workspace`、`.vscode/launch.json`、`.vscode/tasks.json` 与 `.vscode/settings.json`。

[English](README.md) | 中文

## 功能

- **启动配置、复合配置和任务**：三者都会列出，不只读 `launch.json`。任务可以直接执行，`preLaunchTask` / `dependsOn` 会按顺序串起来运行。
- **单工程与多根工作区**：单 folder 工程读取自身 `.vscode`；`.code-workspace` 同时读取工作区级 `launch` / `tasks` 和每个 folder 的 `.vscode`。
- **VS Code 变量替换**：`${workspaceFolder}`、`${workspaceFolder:名称}`、`${workspaceFolderBasename}`、`${cwd}`、`${env:NAME}`、`${config:key}`、`${userHome}`、`${pathSeparator}` 与 `${/}`。
- **像集成终端一样运行**：支持 `cwd`、`env`、`args`、`preLaunchTask`、`dependsOn`、标准输入和停止；输出实时刷新并清理 ANSI 控制符。
- **一个入口，完整运行控制**：会话标题栏播放图标打开浮层，支持搜索、分类、按子项目分组和键盘操作；启动后浮层切换到运行视图，直接查看日志、发送输入和停止，不再需要侧边栏页面。
- **Flutter 设备选择**：没有 `deviceId` 的 Dart 配置会调用 `flutter devices --machine`；只有一台时自动使用，多台时弹出选择器。
- **Agent 工具**：同一套引擎注册为 `vscode_launch`，可以在对话里列出、启动、停止和查看运行。

## 安装

已在 DSH `0.2.1-rc.5` 上验证。

```sh
dsh plugin --profile desktop add github:sinvacn/dsh-vscode-runner
```

或者直接在对话里让 agent 安装：

> 安装 dsh-vscode-runner 插件：`dsh plugin --profile desktop add github:sinvacn/dsh-vscode-runner`

然后在 **设置 → 插件** 中确认 **VS Code 运行器** 已启用。刷新页面；如果会话标题栏没有出现播放图标，重启桌面应用。

## 使用

### 会话标题栏浮层

点击对话标题栏的 **播放图标**。浮层会列出启动配置和任务，按配置的 `cwd`（子项目）分组，并支持搜索和分类切换。

- `↑` / `↓` 移动光标，`Enter` 运行，`Esc` 关闭。
- 正在运行的配置带绿色状态；点击可打开运行视图。
- 需要设备的 Dart 配置会先打开设备选择。

### 运行视图

启动配置后，同一个浮层会切换到运行视图，并自动展开新运行：

- 实时输出（已清理 ANSI 控制符）；
- 运行中可 **停止**；
- 进程接受标准输入时显示输入框（例如 Flutter 的 `r` / `q`）；
- 底部 **运行记录** 按钮可重新打开当前工作区的历史运行；
- **返回** 回到配置列表。

不需要额外的侧边栏页面或页面跳转。

### 实际执行流程

启动配置：

1. 按 label 找到 `preLaunchTask` 并执行；任务失败则停止。
2. 应用配置的 `cwd` 和 `env`。
3. 通过用户 shell 启动进程（POSIX 为 `$SHELL -lc`，Windows 为 `cmd.exe`）。

任务：

1. 先执行 `dependsOn`（VS Code 默认的 `parallel` 目前按顺序执行）。
2. 应用任务的 `command` / `args` / `options.cwd` / `options.env`。

## 支持的启动类型

| `type` | 执行方式 |
| --- | --- |
| `dart` | `flutter run -d <device>`，支持 `toolArgs`、`args`、`program`、`flutterMode` |
| `go` | `go run` / `go test` / `mode: exec`；不附加 Delve |
| `node-terminal` | 原样执行 `command` |
| `node` / `pwa-node` | `node` 或 `runtimeExecutable` + `runtimeArgs` + `program`；移除 `--inspect-brk` |
| `python` / `debugpy` | `python3` 或 `pythonPath` + `program` / `module` |
| `chrome` / `pwa-chrome` / `msedge` / `pwa-msedge` | 用系统默认浏览器打开 `url` |
| `dotnet` | `dotnet <program>` |
| `ruby` / `php` | `<type> <program>` |
| `cppdbg` / `cppvsdbg` / `lldb` / `gdb` | 以普通进程运行 `program` |
| 其他带 `command`、`program` 或 `url` 的配置 | 通用命令 / 可执行文件 / 浏览器打开 |

`request: attach` 的配置不可运行：DSH 不实现 Debug Adapter Protocol。

## 工作区发现

从选中目录开始，按以下顺序判断：

1. **同目录**存在 `.code-workspace` 时，把它当作工作区（即使 folder 是子目录）。
2. 向上遍历父目录时，只有当选中目录位于该 `.code-workspace` 的某个 folder 内时才采用它。父目录里无关的工作区文件会被忽略，避免单工程被上层多根工作区“劫持”。
3. 否则按单 folder 工程处理，读取该目录自己的 `.vscode`。

多根工作区的 catalog 包括：

- `.code-workspace` 里的工作区级 `launch.configurations`、`launch.compounds` 和 `tasks`；
- 每个 folder 的 `.vscode/launch.json`、`.vscode/tasks.json` 和 `.vscode/settings.json`。

工作区级配置必须显式限定 `${workspaceFolder}`（例如 `${workspaceFolder:Client}`）。未限定的 `${workspaceFolder}`、`${workspaceRoot}`、`${workspaceFolderBasename}` 在该位置不合法，会按 VS Code 的规则标记为不可运行。

## 变量

| 变量 | 含义 |
| --- | --- |
| `${workspaceFolder}` | 当前 `launch.json` / `tasks.json` 所属 folder |
| `${workspaceFolder:名称}` | `.code-workspace` 中指定名称的 folder |
| `${workspaceFolderBasename}` | 当前 folder 的 basename |
| `${workspaceRoot}` | `${workspaceFolder}` 的废弃别名 |
| `${cwd}` | 任务运行器的当前目录 |
| `${env:NAME}` | 进程环境变量；未设置时替换为空并给出提示 |
| `${config:key.path}` | `.vscode/settings.json` 中的值 |
| `${userHome}` | 用户主目录 |
| `${pathSeparator}`、`${/}` | 平台路径分隔符 |

`${file}`、`${relativeFile}`、`${selectedText}`、`${lineNumber}`、`${input:...}`、`${command:...}` 需要编辑器或交互上下文。使用它们的配置会列出，但标记为 **不可运行** 并附带原因。

## Agent 工具

Host 注册 `vscode_launch`，支持：

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

先调用 `list`，再把返回项的 `id` 传给 `start`。

## 安全

- 所有 Web 路由在读取文件或启动进程之前，都会先经过 `ctx.connection.requestRejection(req)`。未认证、跨站、Host/Origin 不匹配的请求会被拒绝。
- 启动配置和任务本质上就是可执行代码。只在你信任的工作区使用，并在运行前检查 `.code-workspace` / `.vscode` 文件。
- 环境变量不会返回给浏览器：catalog 会去掉 `env`。
- Agent 工具与 UI 共用一个 `Runner` 实例，对话里启动的运行会显示在同一个浮层中。

## 限制

- **不实现 DAP 调试**：没有断点、单步、变量面板、`attach` 调试和 `postDebugTask`。`go`、`node`、Python、C/C++ 以普通进程运行；`dart` 仍可使用 Flutter 自带的 VM Service。
- **后台任务不能等待**：`"isBackground": true` 的任务可以直接运行，但不能作为 `preLaunchTask` 或 `dependsOn`，因为没有 problem matcher 握手来判断就绪。
- **复合配置的 `preLaunchTask` 不执行**：成员配置自己的 `preLaunchTask` 会执行。
- **`dependsOrder: "parallel"` 目前按顺序执行**：依赖多于一个时，任务列表会给出提示。
- **不自动发现任务**：只列出 `tasks.json` / `.code-workspace` 中定义的任务；npm、gulp、grunt、TypeScript 自动探测的任务不在范围内。
- **使用管道而非 PTY**：输出没有 ANSI 颜色；交互程序需要接受管道输入。输入请用页面输入框。
- **同目录工作区优先**：如果 folder 内同时有 `.code-workspace`，即使实际是以单 folder 打开，也会按多根工作区处理。要强制单工程模式，请移走或改名该工作区文件。
- Host 端诊断信息目前为中文；界面本身支持中英文。

## 开发

需要 Node.js 20 或更高版本，无运行时依赖。

```sh
npm test
```

测试会创建临时的单 folder 和多根工作区，覆盖：

- JSONC 解析；
- 单 folder 发现、`${workspaceFolder}`、`${config:...}`、任务 cwd 与 npm 参数；
- 多根发现、工作区级变量、folder 限定的复合配置、工作区任务；
- 忽略父目录里无关的 `.code-workspace`；
- 同目录工作区识别；
- 会话子目录到工作区根的解析；
- POSIX 与 Windows 参数引用；
- 真实子进程执行：`preLaunchTask` + `dependsOn`、标准输入、停止、后台任务保护；
- 通过模拟 module loader 验证 client bundle 注册。

实现细节见 [docs/internals.md](docs/internals.md)。

## 文件

| 文件 | 作用 |
| --- | --- |
| `core.js` | JSONC 解析、工作区发现、变量替换、catalog 编译、进程运行器 |
| `index.js` | Host 插件：带认证的 Web 路由与 `vscode_launch` Agent 工具 |
| `client.js` | Web UI：会话标题栏播放图标、配置浮层、运行视图、日志、输入、设备选择 |
| `cordis.patch.yml` | 向 DSH profile 插入 `vscode-runner` 行 |
| `locale/{en,zh}.json` | 插件管理器的标题与描述 |
| `icon.svg` | 插件图标 |
| `test/run.mjs` | 自包含测试套件 |
| `CHANGELOG.md` | 版本记录 |
| `SECURITY.md` | 私下报告安全问题 |

## 许可

[MIT](LICENSE)
