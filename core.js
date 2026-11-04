/**
 * VS Code launch-configuration discovery and execution core.
 *
 * This module is host-only. It reads a workspace's `*.code-workspace`,
 * `.vscode/launch.json`, `.vscode/tasks.json` and `.vscode/settings.json`
 * files, resolves the same variables VS Code resolves for the common launch
 * types, and runs the result through an injected subprocess factory.
 *
 * The design goal is "launch like the integrated terminal": pre-launch tasks,
 * cwd, env, compounds, tasks, stdin, and stop are all supported. It is not a
 * Debug Adapter Protocol client, so breakpoints and attach sessions are not
 * available; debug configurations run through their normal CLI equivalent.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const MAX_CONFIG_BYTES = 2 * 1024 * 1024
const TERMINAL_STATUSES = new Set(['exited', 'failed', 'stopped'])
const FILE_VARIABLES = new Set([
  'file',
  'fileBasename',
  'fileBasenameNoExtension',
  'fileDirname',
  'fileDirnameBasename',
  'fileExtname',
  'fileWorkspaceFolder',
  'relativeFile',
  'relativeFileDirname',
  'selectedText',
  'lineNumber',
  'columnNumber',
  'lineIndex',
  'lineNumber',
])
const ANSI_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g

// ---------------------------------------------------------------------------
// JSONC
// ---------------------------------------------------------------------------

/**
 * Parse JSON with comments and trailing commas, which is the format VS Code
 * uses for workspace, launch, task and settings files.
 */
export function parseJsonc(text, label = 'JSONC') {
  const trimmed = String(text).replace(/^\uFEFF/, '')
  const withoutComments = stripComments(trimmed)
  const withoutTrailingCommas = stripTrailingCommas(withoutComments)
  try {
    return JSON.parse(withoutTrailingCommas)
  } catch (error) {
    throw new Error(`${label}: ${error.message}`)
  }
}

function stripComments(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      const start = i
      i += 1
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === '"') {
          i += 1
          break
        }
        i += 1
      }
      out += text.slice(start, i)
      continue
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function stripTrailingCommas(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"') {
      const start = i
      i += 1
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === '"') {
          i += 1
          break
        }
        i += 1
      }
      out += text.slice(start, i)
      continue
    }
    if (ch === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j += 1
      if (text[j] === '}' || text[j] === ']') {
        i += 1
        continue
      }
    }
    out += ch
    i += 1
  }
  return out
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function isDirectory(target) {
  try {
    return (await fs.stat(target)).isDirectory()
  } catch {
    return false
  }
}

function unique(values) {
  return [...new Set(values)]
}

function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '').replace(/\r/g, '')
}

function toLabelArray(value) {
  const one = (item) => {
    if (typeof item === 'string') return item !== '' ? item : ''
    if (isRecord(item) && typeof item.label === 'string') return item.label
    return ''
  }
  if (typeof value === 'string' && value !== '') return [value]
  if (Array.isArray(value)) return value.map(one).filter((item) => item !== '')
  return []
}

function normalizeTaskGroup(value) {
  if (typeof value === 'string') return value
  if (isRecord(value) && typeof value.kind === 'string') return value.kind
  return ''
}

function getByPath(record, dotted) {
  if (!isRecord(record)) return undefined
  if (Object.prototype.hasOwnProperty.call(record, dotted)) return record[dotted]
  let current = record
  for (const part of dotted.split('.')) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) return undefined
    current = current[part]
  }
  return current
}

/**
 * Quote one argument for the shell the runner will use. POSIX shells get
 * single quotes; cmd.exe gets double quotes. Commands come from trusted
 * workspace files, but paths and arguments still need to survive spaces.
 */
export function quoteArg(value, platform = process.platform) {
  const text = String(value)
  if (platform === 'win32') {
    if (text === '') return '""'
    if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(text)) return text
    return `"${text.replace(/"/g, '\\"')}"`
  }
  if (text === '') return "''"
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text)) return text
  return `'${text.replace(/'/g, `'\\''`)}'`
}

function shellQuote(value) {
  return quoteArg(value, process.platform)
}

function toText(value) {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function platformOpener(platform) {
  if (platform === 'win32') return 'start ""'
  if (platform === 'linux') return 'xdg-open'
  return 'open'
}

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

/**
 * Create a VS Code variable substituter for one configuration source.
 * `hard` collects variables that make a configuration unrunnable (file
 * variables, prompts and commands); `soft` collects missing optional values
 * that are replaced with an empty string.
 */
function createSubstituter(scope) {
  const hard = []
  const soft = []

  function substitute(value) {
    if (typeof value !== 'string') return value
    return value.replace(/\$\{([^}]+)\}/g, (token, rawExpression) => {
      const expression = rawExpression.trim()
      if (expression === 'workspaceFolder' || expression === 'workspaceRoot') {
        const value = expression === 'workspaceFolder' ? scope.workspaceFolder : scope.workspaceRoot
        if (typeof value === 'string' && value !== '') return value
        hard.push(token)
        return token
      }
      if (expression === 'workspaceFolderBasename') {
        if (typeof scope.workspaceFolder === 'string' && scope.workspaceFolder !== '') {
          return path.basename(scope.workspaceFolder)
        }
        hard.push(token)
        return token
      }
      if (expression === 'cwd') return scope.cwd || scope.workspaceFolder || ''
      if (expression === 'userHome') return os.homedir()
      if (expression === 'pathSeparator' || expression === '/') return path.sep
      if (expression.startsWith('workspaceFolder:')) {
        const name = expression.slice('workspaceFolder:'.length)
        const folder = (scope.folders || []).find(
          (candidate) => candidate.name === name || candidate.name.toLowerCase() === name.toLowerCase(),
        )
        if (folder) return folder.path
        hard.push(token)
        return token
      }
      if (expression.startsWith('env:')) {
        const name = expression.slice('env:'.length)
        const value = scope.env[name]
        if (value === undefined) {
          soft.push(token)
          return ''
        }
        return String(value)
      }
      if (expression.startsWith('config:')) {
        const key = expression.slice('config:'.length)
        const value = getByPath(scope.settings, key)
        if (value === undefined) {
          soft.push(token)
          return ''
        }
        return toText(value)
      }
      if (expression.startsWith('input:')) {
        hard.push(token)
        return token
      }
      if (expression.startsWith('command:')) {
        hard.push(token)
        return token
      }
      if (FILE_VARIABLES.has(expression)) {
        hard.push(token)
        return token
      }
      hard.push(token)
      return token
    })
  }

  return { substitute, hard, soft }
}

function substituteEnv(raw, substituter) {
  const env = {}
  if (!isRecord(raw)) return env
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    env[key] = typeof value === 'string' ? substituter.substitute(value) : String(value)
  }
  return env
}

// ---------------------------------------------------------------------------
// Workspace discovery
// ---------------------------------------------------------------------------

async function readJsoncFile(file, warnings, optional = true) {
  let stat
  try {
    stat = await fs.stat(file)
  } catch (error) {
    if (error && error.code === 'ENOENT' && optional) return null
    warnings.push(`无法读取 ${file}: ${error.message}`)
    return null
  }
  if (!stat.isFile()) return null
  if (stat.size > MAX_CONFIG_BYTES) {
    warnings.push(`${file} 超过 ${MAX_CONFIG_BYTES} 字节，已跳过`)
    return null
  }
  try {
    return parseJsonc(await fs.readFile(file, 'utf8'), file)
  } catch (error) {
    warnings.push(error.message)
    return null
  }
}

async function findWorkspaceFile(start, warnings) {
  const target = path.resolve(start)
  let directory = target
  for (let depth = 0; depth < 12; depth += 1) {
    let names = []
    try {
      names = await fs.readdir(directory)
    } catch {
      names = []
    }
    const candidates = names.filter((name) => name.endsWith('.code-workspace')).sort()
    let sameDirectory = null
    for (const name of candidates) {
      const file = path.join(directory, name)
      try {
        const document = parseJsonc(await fs.readFile(file, 'utf8'), file)
        const candidate = { file, document }
        if (directory === target && sameDirectory === null) sameDirectory = candidate
        const folders = Array.isArray(document.folders) ? document.folders : []
        const containsTarget = folders.some((folder) => {
          if (!isRecord(folder) || typeof folder.path !== 'string') return false
          return isInside(target, path.resolve(directory, folder.path))
        })
        if (containsTarget) return candidate
      } catch (error) {
        warnings.push(error.message)
      }
    }
    // A workspace file next to the selected folder may describe it even when
    // its folders are subdirectories. Never adopt an unrelated workspace file
    // from an ancestor: that would hijack a single-folder project.
    if (sameDirectory !== null) return sameDirectory
    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  return null
}

async function discover(start, warnings) {
  const workspace = await findWorkspaceFile(start, warnings)
  let workspaceFile = null
  let workspaceDir = path.resolve(start)
  let workspaceDocument = null
  if (workspace !== null) {
    workspaceFile = workspace.file
    workspaceDir = path.dirname(workspace.file)
    workspaceDocument = workspace.document
  }

  const folderDefs = []
  if (workspaceDocument !== null && Array.isArray(workspaceDocument.folders) && workspaceDocument.folders.length > 0) {
    for (const folder of workspaceDocument.folders) {
      if (!isRecord(folder) || typeof folder.path !== 'string' || folder.path === '') continue
      const folderPath = path.resolve(workspaceDir, folder.path)
      const name = typeof folder.name === 'string' && folder.name !== '' ? folder.name : path.basename(folderPath)
      folderDefs.push({ name, path: folderPath })
    }
  }
  if (folderDefs.length === 0) {
    folderDefs.push({ name: path.basename(workspaceDir), path: workspaceDir })
  }

  const workspaceSettings = isRecord(workspaceDocument?.settings) ? workspaceDocument.settings : {}
  const workspaceLaunch = isRecord(workspaceDocument?.launch)
    ? workspaceDocument.launch
    : isRecord(workspaceDocument) && (Array.isArray(workspaceDocument.configurations) || Array.isArray(workspaceDocument.compounds))
      ? workspaceDocument
      : {}
  const workspaceTasks = isRecord(workspaceDocument?.tasks) && Array.isArray(workspaceDocument.tasks.tasks)
    ? workspaceDocument.tasks.tasks
    : Array.isArray(workspaceDocument?.tasks)
      ? workspaceDocument.tasks
      : []

  const sources = []
  if (workspaceFile !== null) {
    sources.push({
      id: `workspace:${workspaceFile}`,
      kind: 'workspace',
      label: path.basename(workspaceFile),
      path: workspaceFile,
      base: workspaceDir,
      workspaceFolder: '',
      settings: workspaceSettings,
      folders: folderDefs,
      configurations: Array.isArray(workspaceLaunch.configurations) ? workspaceLaunch.configurations : [],
      compounds: Array.isArray(workspaceLaunch.compounds) ? workspaceLaunch.compounds : [],
      tasks: workspaceTasks,
    })
  }

  for (const folder of folderDefs) {
    const vscodeDir = path.join(folder.path, '.vscode')
    const launch = await readJsoncFile(path.join(vscodeDir, 'launch.json'), warnings)
    const tasks = await readJsoncFile(path.join(vscodeDir, 'tasks.json'), warnings)
    const settings = await readJsoncFile(path.join(vscodeDir, 'settings.json'), warnings)
    sources.push({
      id: `folder:${folder.path}`,
      kind: 'folder',
      label: folder.name,
      path: folder.path,
      base: folder.path,
      workspaceFolder: folder.path,
      settings: { ...workspaceSettings, ...(isRecord(settings) ? settings : {}) },
      folders: folderDefs,
      configurations: Array.isArray(launch?.configurations) ? launch.configurations : [],
      compounds: Array.isArray(launch?.compounds) ? launch.compounds : [],
      tasks: Array.isArray(tasks?.tasks) ? tasks.tasks : [],
    })
  }

  return {
    workspaceFile,
    workspaceDir,
    workspaceDocument,
    folders: folderDefs,
    sources,
  }
}

// ---------------------------------------------------------------------------
// Catalog compilation
// ---------------------------------------------------------------------------

function sourceScope(source, env) {
  const folderScoped = source.kind === 'folder'
  return {
    workspaceFolder: folderScoped ? source.workspaceFolder : '',
    workspaceRoot: folderScoped ? source.base : '',
    cwd: source.base,
    folders: source.folders || [],
    settings: source.settings,
    env,
  }
}

function unresolvedReason(tokens, source) {
  const uniqueTokens = unique(tokens)
  let reason = `无法解析变量：${uniqueTokens.join('、')}`
  if (
    source.kind === 'workspace' &&
    uniqueTokens.some((token) => /\$\{workspace(Folder|Root|FolderBasename)\}/.test(token))
  ) {
    reason += '（工作区级配置请改用 ${workspaceFolder:目录名}）'
  }
  return reason
}

async function compileTask(raw, source, index, warnings, options) {
  if (!isRecord(raw)) return null
  const substituter = createSubstituter(sourceScope(source, options.env))
  const label = typeof raw.label === 'string' && raw.label !== '' ? raw.label : `任务 ${index + 1}`
  const type = typeof raw.type === 'string' ? raw.type : 'shell'
  const command = typeof raw.command === 'string'
    ? raw.command
    : isRecord(raw.command) && typeof raw.command.value === 'string'
      ? raw.command.value
      : ''
  const args = Array.isArray(raw.args)
    ? raw.args.map((value) => (typeof value === 'string' ? substituter.substitute(value) : toText(value)))
    : []

  let script = ''
  if (type === 'npm') {
    const npmScript = typeof raw.script === 'string' ? substituter.substitute(raw.script) : ''
    if (npmScript === '') {
      script = ''
    } else {
      script = ['npm', 'run', npmScript, ...(args.length > 0 ? ['--', ...args] : [])]
        .map(shellQuote)
        .join(' ')
    }
  } else if (command !== '') {
    const resolvedCommand = substituter.substitute(command)
    if (type === 'process') {
      script = [resolvedCommand, ...args].map(shellQuote).join(' ')
    } else if (args.length > 0) {
      script = `${resolvedCommand} ${args.map(shellQuote).join(' ')}`
    } else {
      script = resolvedCommand
    }
  }

  const rawCwd = isRecord(raw.options) && typeof raw.options.cwd === 'string' ? raw.options.cwd : ''
  const cwd = path.resolve(source.base, substituter.substitute(rawCwd) || '.')
  const env = substituteEnv(isRecord(raw.options) ? raw.options.env : undefined, substituter)
  const dependsOn = toLabelArray(raw.dependsOn)
  const dependsOrder = typeof raw.dependsOrder === 'string' ? raw.dependsOrder : 'parallel'
  const isBackground = raw.isBackground === true
  const group = normalizeTaskGroup(raw.group)
  const item = {
    id: `task:${source.id}:${index}`,
    kind: 'task',
    name: label,
    label,
    type,
    group,
    isBackground,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: source.kind,
    cwd,
    env,
    command: script,
    script,
    runnable: script !== '',
    reason: script === '' ? '任务没有可执行的 command' : '',
    note: dependsOn.length > 0 ? `依赖：${dependsOn.join('、')}` : '',
    needsDevice: false,
    devicePlaceholder: false,
    deviceId: '',
    preLaunchTasks: dependsOn,
    dependsOn,
    dependsOrder,
    members: [],
    memberNames: [],
  }
  if (isBackground) {
    item.note = `${item.note}${item.note ? '；' : ''}后台任务：直接运行会持续运行，不能作为 preLaunchTask 等待完成`
  }
  if (dependsOrder === 'parallel' && dependsOn.length > 1) {
    item.note = `${item.note}${item.note ? '；' : ''}dependsOrder=parallel 暂按顺序执行`
  }
  if (substituter.hard.length > 0) {
    item.runnable = false
    item.reason = unresolvedReason(substituter.hard, source)
  }
  if (substituter.soft.length > 0) {
    item.note = `${item.note}${item.note ? '；' : ''}未解析的变量：${unique(substituter.soft).join('、')}`
  }
  if (!script && item.reason === '任务没有可执行的 command') {
    warnings.push(`任务「${label}」没有可执行的 command`)
  }
  return item
}

async function compileLaunch(raw, source, index, tasksByLabel, warnings, options) {
  if (!isRecord(raw)) return null
  const substituter = createSubstituter(sourceScope(source, options.env))
  const name = typeof raw.name === 'string' && raw.name !== '' ? raw.name : `配置 ${index + 1}`
  const type = typeof raw.type === 'string' ? raw.type : ''
  const request = typeof raw.request === 'string' ? raw.request : 'launch'
  const rawCwd = typeof raw.cwd === 'string' ? raw.cwd : ''
  const cwd = path.resolve(source.base, substituter.substitute(rawCwd) || '.')
  const env = substituteEnv(raw.env, substituter)
  const program = typeof raw.program === 'string' ? substituter.substitute(raw.program) : ''
  const appArgs = Array.isArray(raw.args)
    ? raw.args.map((value) => (typeof value === 'string' ? substituter.substitute(value) : toText(value)))
    : []
  const item = {
    id: `launch:${source.id}:${index}`,
    kind: 'launch',
    name,
    type,
    request,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: source.kind,
    cwd,
    env,
    command: '',
    script: '',
    runnable: true,
    reason: '',
    note: '',
    needsDevice: false,
    devicePlaceholder: false,
    deviceId: '',
    preLaunchTasks: toLabelArray(raw.preLaunchTask),
    members: [],
    memberNames: [],
  }

  for (const label of item.preLaunchTasks) {
    if (resolveTask(label, source.id, tasksByLabel) === undefined) {
      item.runnable = false
      item.reason = `找不到 preLaunchTask「${label}」`
    }
  }

  if (request === 'attach') {
    item.runnable = false
    item.reason = '不支持 attach 调试会话'
  } else if (type === 'dart') {
    compileDart(item, raw, substituter, program, appArgs)
  } else if (type === 'node-terminal') {
    const command = typeof raw.command === 'string' ? substituter.substitute(raw.command) : ''
    if (command === '') {
      item.runnable = false
      item.reason = 'node-terminal 配置没有 command'
    } else {
      item.script = command
      item.command = command
    }
  } else if (type === 'go') {
    compileGo(item, raw, substituter, program, appArgs)
  } else if (type === 'node' || type === 'pwa-node') {
    compileNode(item, raw, substituter, program, appArgs)
  } else if (type === 'python' || type === 'debugpy') {
    compilePython(item, raw, substituter, program, appArgs)
  } else if (type === 'chrome' || type === 'pwa-chrome' || type === 'msedge' || type === 'pwa-msedge') {
    compileBrowser(item, raw, substituter)
  } else if (type === 'dotnet') {
    if (program === '') {
      item.runnable = false
      item.reason = 'dotnet 配置没有 program'
    } else {
      item.script = ['dotnet', program, ...appArgs].map(shellQuote).join(' ')
      item.command = item.script
    }
  } else if (type === 'ruby' || type === 'php') {
    if (program === '') {
      item.runnable = false
      item.reason = `${type} 配置没有 program`
    } else {
      item.script = [type, program, ...appArgs].map(shellQuote).join(' ')
      item.command = item.script
    }
  } else if (type === 'cppdbg' || type === 'cppvsdbg' || type === 'lldb' || type === 'gdb') {
    if (program === '') {
      item.runnable = false
      item.reason = 'C/C++ 配置没有 program'
    } else {
      item.script = [program, ...appArgs].map(shellQuote).join(' ')
      item.command = item.script
      item.note = '以普通进程启动，不附加调试器'
    }
  } else {
    compileGeneric(item, raw, substituter, program, appArgs)
  }

  if (item.command === '' && item.runnable) {
    item.command = item.script
  }
  if (substituter.hard.length > 0) {
    item.runnable = false
    item.reason = unresolvedReason(substituter.hard, source)
  }
  if (substituter.soft.length > 0) {
    item.note = `${item.note}${item.note ? '；' : ''}未解析的变量：${unique(substituter.soft).join('、')}`
  }
  if (!item.runnable && item.reason === '') item.reason = '该配置无法运行'
  if (!item.runnable) warnings.push(`「${name}」不可运行：${item.reason}`)
  return item
}

function addNote(item, note) {
  if (!note) return
  item.note = item.note === '' ? note : `${item.note}；${note}`
}

function compileDart(item, raw, substituter, program, appArgs) {
  const deviceId = typeof raw.deviceId === 'string' ? substituter.substitute(raw.deviceId) : ''
  const toolArgs = Array.isArray(raw.toolArgs)
    ? raw.toolArgs.filter((value) => typeof value === 'string').map((value) => substituter.substitute(value))
    : []
  const parts = ['flutter', 'run']
  if (deviceId !== '') {
    parts.push('-d', shellQuote(deviceId))
  } else {
    parts.push('-d', '__DSH_DEVICE__')
    item.needsDevice = true
    item.devicePlaceholder = true
  }
  if (raw.flutterMode === 'profile') parts.push('--profile')
  else if (raw.flutterMode === 'release') parts.push('--release')
  for (const value of toolArgs) parts.push(shellQuote(value))
  if (program !== '') parts.push(shellQuote(program))
  if (appArgs.length > 0) {
    parts.push('--')
    for (const value of appArgs) parts.push(shellQuote(value))
  }
  item.script = parts.join(' ')
  item.command = item.script.replace('__DSH_DEVICE__', '<设备>')
  item.deviceId = deviceId
  if (item.needsDevice) addNote(item, '运行时可选择 Dart/Flutter 设备')
}

function compileGo(item, raw, substituter, program, appArgs) {
  const mode = typeof raw.mode === 'string' ? raw.mode : 'auto'
  const buildFlags = Array.isArray(raw.buildFlags)
    ? raw.buildFlags.filter((value) => typeof value === 'string').map((value) => substituter.substitute(value))
    : []
  if (mode === 'remote') {
    item.runnable = false
    item.reason = '不支持 Go remote 调试模式'
    return
  }
  if (mode === 'exec') {
    if (program === '') {
      item.runnable = false
      item.reason = 'Go exec 模式没有 program'
      return
    }
    item.script = [program, ...appArgs].map(shellQuote).join(' ')
    item.command = item.script
    addNote(item, '直接运行已编译程序')
    return
  }
  if (mode === 'test') {
    item.script = ['go', 'test', program !== '' ? program : './...', ...appArgs].map(shellQuote).join(' ')
    item.command = item.script
    addNote(item, '以 go test 运行')
    return
  }
  if (program === '') {
    item.runnable = false
    item.reason = 'Go 配置没有 program'
    return
  }
  item.script = ['go', 'run', ...buildFlags, program, ...appArgs].map(shellQuote).join(' ')
  item.command = item.script
  addNote(item, '以 go run 启动，不附加 Delve 断点调试')
}

function compileNode(item, raw, substituter, program, appArgs) {
  const runtime = typeof raw.runtimeExecutable === 'string'
    ? substituter.substitute(raw.runtimeExecutable) || 'node'
    : 'node'
  const runtimeArgs = Array.isArray(raw.runtimeArgs)
    ? raw.runtimeArgs
        .filter((value) => typeof value === 'string')
        .map((value) => substituter.substitute(value))
    : []
  const keptRuntimeArgs = runtimeArgs.filter(
    (value) => value !== '--inspect-brk' && !value.startsWith('--inspect-brk='),
  )
  if (keptRuntimeArgs.length !== runtimeArgs.length) {
    addNote(item, '已忽略 --inspect-brk（DSH 不接管调试器）')
  }
  if (program === '') {
    item.runnable = false
    item.reason = 'Node 配置没有 program'
    return
  }
  item.script = [runtime, ...keptRuntimeArgs, program, ...appArgs].map(shellQuote).join(' ')
  item.command = item.script
}

function compilePython(item, raw, substituter, program, appArgs) {
  const rawRuntime = typeof raw.pythonPath === 'string'
    ? raw.pythonPath
    : typeof raw.python === 'string'
      ? raw.python
      : ''
  let runtime = ''
  if (rawRuntime.includes('${command:') || rawRuntime.includes('${input:')) {
    runtime = 'python3'
    addNote(item, '解释器变量需要 VS Code 交互，改用 python3')
  } else {
    runtime = rawRuntime === '' ? '' : substituter.substitute(rawRuntime)
  }
  if (runtime === '' || runtime.includes('${')) {
    runtime = 'python3'
    addNote(item, '未指定 Python 解释器，使用 python3')
  }
  const moduleName = typeof raw.module === 'string' ? substituter.substitute(raw.module) : ''
  if (moduleName !== '') {
    item.script = [runtime, '-m', moduleName, ...appArgs].map(shellQuote).join(' ')
  } else if (program !== '') {
    item.script = [runtime, program, ...appArgs].map(shellQuote).join(' ')
  } else {
    item.runnable = false
    item.reason = 'Python 配置没有 program 或 module'
    return
  }
  item.command = item.script
}

function compileBrowser(item, raw, substituter) {
  const url = typeof raw.url === 'string' ? substituter.substitute(raw.url) : ''
  if (url === '') {
    item.runnable = false
    item.reason = '浏览器配置没有 url'
    return
  }
  item.script = `${platformOpener(process.platform)} ${shellQuote(url)}`
  item.command = item.script
  addNote(item, '用系统默认浏览器打开，不建立调试连接')
}

function compileGeneric(item, raw, substituter, program, appArgs) {
  const command = typeof raw.command === 'string' ? substituter.substitute(raw.command) : ''
  if (command !== '') {
    item.script = appArgs.length > 0
      ? `${command} ${appArgs.map(shellQuote).join(' ')}`
      : command
    item.command = item.script
    return
  }
  if (program !== '') {
    item.script = [program, ...appArgs].map(shellQuote).join(' ')
    item.command = item.script
    if (item.type !== '') addNote(item, `以 ${item.type} 配置的 program 直接运行`)
    return
  }
  const url = typeof raw.url === 'string' ? substituter.substitute(raw.url) : ''
  if (url !== '') {
    item.script = `${platformOpener(process.platform)} ${shellQuote(url)}`
    item.command = item.script
    return
  }
  item.runnable = false
  item.reason = item.type === '' ? '配置没有 type、command、program 或 url' : `暂不支持 type「${item.type}」`
}

function compileCompound(raw, source, index, launchByName, launchByFolder, warnings) {
  if (!isRecord(raw)) return null
  const name = typeof raw.name === 'string' && raw.name !== '' ? raw.name : `复合配置 ${index + 1}`
  const refs = Array.isArray(raw.configurations) ? raw.configurations : []
  const names = []
  const memberItems = []
  const members = []
  for (const ref of refs) {
    let memberName = ''
    let folder = ''
    if (typeof ref === 'string') {
      memberName = ref
    } else if (isRecord(ref) && typeof ref.name === 'string') {
      memberName = ref.name
      folder = typeof ref.folder === 'string' ? ref.folder : ''
    }
    if (memberName === '') continue
    const display = folder !== '' ? `${folder}/${memberName}` : memberName
    names.push(display)
    const member =
      folder !== ''
        ? launchByFolder.get(`${folder}\u0000${memberName}`) ??
          launchByFolder.get(`${folder.toLowerCase()}\u0000${memberName.toLowerCase()}`)
        : launchByName.get(`${source.id}\u0000${memberName}`) ?? launchByName.get(memberName)
    if (member === undefined) {
      warnings.push(`复合配置「${name}」引用了不存在的配置「${display}」`)
      continue
    }
    members.push(member.id)
    memberItems.push(member)
  }
  const blocked = memberItems.find((member) => member.runnable === false)
  const needsDevice = memberItems.some((member) => member.needsDevice && member.deviceId === '')
  const item = {
    id: `compound:${source.id}:${index}`,
    kind: 'compound',
    name,
    type: 'compound',
    request: 'launch',
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: source.kind,
    cwd: source.base,
    env: {},
    command: '',
    script: '',
    runnable: members.length > 0 && blocked === undefined,
    reason:
      members.length === 0
        ? '复合配置没有可运行的成员'
        : blocked !== undefined
          ? `成员「${blocked.name}」不可运行：${blocked.reason}`
          : '',
    note: names.length > 0 ? `并行启动：${names.join('、')}` : '',
    needsDevice,
    devicePlaceholder: false,
    deviceId: '',
    preLaunchTasks: [],
    members,
    memberNames: names,
  }
  if (needsDevice) addNote(item, '运行时可选择 Dart/Flutter 设备')
  if (isRecord(raw) && raw.preLaunchTask !== undefined) {
    addNote(item, '复合配置的 preLaunchTask 暂不执行')
  }
  if (!item.runnable) warnings.push(`「${name}」不可运行：${item.reason}`)
  return item
}

function resolveTask(label, sourceId, tasksByLabel) {
  const entries = tasksByLabel.get(label)
  if (entries === undefined) return undefined
  const same = entries.find((task) => task.sourceId === sourceId)
  return same ?? entries[0]
}

/**
 * Build the serializable catalog for one directory.
 */
export async function buildCatalog(start, options = {}) {
  const env = options.env ?? process.env
  const cwd = path.resolve(start)
  const warnings = []
  const discovered = await discover(cwd, warnings)
  const sources = discovered.sources
  const taskItems = []
  const tasksByLabel = new Map()
  const launches = []
  const launchByName = new Map()
  const launchByFolder = new Map()

  for (const source of sources) {
    source._tasks = []
    for (let index = 0; index < source.tasks.length; index += 1) {
      const task = await compileTask(source.tasks[index], source, index, warnings, { env })
      if (task === null) continue
      source._tasks.push(task)
      taskItems.push(task)
      const entries = tasksByLabel.get(task.label)
      if (entries === undefined) tasksByLabel.set(task.label, [task])
      else entries.push(task)
    }
  }

  for (const source of sources) {
    source._launches = []
    for (let index = 0; index < source.configurations.length; index += 1) {
      const item = await compileLaunch(source.configurations[index], source, index, tasksByLabel, warnings, { env })
      if (item === null) continue
      source._launches.push(item)
      launches.push(item)
      launchByName.set(`${source.id}\u0000${item.name}`, item)
      if (!launchByName.has(item.name)) launchByName.set(item.name, item)
      if (source.kind === 'folder') {
        launchByFolder.set(`${source.label}\u0000${item.name}`, item)
        launchByFolder.set(`${source.label.toLowerCase()}\u0000${item.name.toLowerCase()}`, item)
      }
    }
  }

  for (const source of sources) {
    for (let index = 0; index < source.compounds.length; index += 1) {
      const item = compileCompound(
        source.compounds[index],
        source,
        index,
        launchByName,
        launchByFolder,
        warnings,
      )
      if (item === null) continue
      source._launches.push(item)
      launches.push(item)
    }
  }

  for (const item of [...launches, ...taskItems]) {
    if (!item.runnable) continue
    if (!(await isDirectory(item.cwd))) {
      item.runnable = false
      item.reason = `目录不存在：${item.cwd}`
      warnings.push(`「${item.name}」不可运行：${item.reason}`)
    }
  }

  return {
    cwd,
    workspace: {
      file: discovered.workspaceFile,
      root: discovered.workspaceDir,
      folders: discovered.folders.map((folder) => ({ name: folder.name, path: folder.path })),
    },
    sources: sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      label: source.label,
      path: source.path,
      base: source.base,
      workspaceFolder: source.workspaceFolder,
      launchCount: source._launches.length,
      taskCount: source._tasks.length,
    })),
    launches,
    tasks: taskItems,
    warnings: unique(warnings),
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export class Runner {
  /**
   * @param {object} options
   * @param {(spec: object) => object} options.spawn subprocess factory returning a handle with
   *   `stdin`, `collected`, `done`, and `terminate`.
   */
  constructor(options = {}) {
    if (typeof options.spawn !== 'function') throw new Error('Runner requires spawn(spec)')
    this.spawn = options.spawn
    this.env = options.env || process.env
    this.platform = options.platform || process.platform
    this.shell =
      options.shell || (this.platform === 'win32' ? '' : process.env.SHELL || '')
    this.defaultCwd = path.resolve(options.defaultCwd || process.cwd())
    this.workspaceRegistry = options.workspaceRegistry || null
    this.logLimit = Number.isFinite(options.logLimit) ? options.logLimit : 320 * 1024
    this.maxRuns = Number.isFinite(options.maxRuns) ? options.maxRuns : 40
    this.runs = new Map()
    this.nextRun = 1
    this.deviceCache = new Map()
  }

  async catalog(cwd) {
    const target = path.resolve(cwd || this.defaultCwd)
    if (!(await isDirectory(target))) {
      const error = new Error(`目录不存在：${target}`)
      error.code = 'no-directory'
      throw error
    }
    return buildCatalog(target, { env: this.env })
  }

  async workspaces() {
    const defaultCwd = this.defaultCwd
    const entries = []
    const seen = new Set()
    const add = (entry) => {
      const resolved = path.resolve(entry.path)
      if (seen.has(resolved)) return
      seen.add(resolved)
      entries.push({
        path: resolved,
        title: entry.title || path.basename(resolved),
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      })
    }
    if (this.workspaceRegistry !== null && typeof this.workspaceRegistry.list === 'function') {
      try {
        for (const workspace of this.workspaceRegistry.list()) {
          add({ path: workspace.path, title: workspace.title, updatedAt: workspace.updatedAt })
        }
      } catch {
        // An unavailable registry is not fatal: the default directory still works.
      }
    }
    if (entries.length === 0 && (await isDirectory(defaultCwd))) {
      add({ path: defaultCwd, title: path.basename(defaultCwd) })
    }
    let selected = ''
    if (seen.has(defaultCwd)) selected = defaultCwd
    else {
      const parent = entries
        .filter((entry) => isInside(defaultCwd, entry.path))
        .sort((left, right) => right.path.length - left.path.length)[0]
      if (parent !== undefined) selected = parent.path
      else {
        const recent = [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
        selected = recent !== undefined ? recent.path : ''
      }
    }
    return { defaultCwd, selected, workspaces: entries }
  }

  /**
   * Resolve the closest registered workspace that contains `cwd`. Session
   * working directories are often subdirectories; VS Code configurations live
   * at the project root, so the header dialog needs this expansion.
   */
  async workspaceRootFor(cwd) {
    const target = path.resolve(cwd || this.defaultCwd)
    const info = await this.workspaces()
    const candidates = info.workspaces
      .filter((entry) => isInside(target, entry.path))
      .sort((left, right) => right.path.length - left.path.length)
    return candidates[0]?.path || target
  }

  /**
   * Start one launch, task or compound. Returns immediately with run views;
   * pre-launch tasks and the process continue in the background.
   */
  async start(cwd, itemId, options = {}) {
    const catalog = await this.catalog(cwd)
    const item = [...catalog.launches, ...catalog.tasks].find((candidate) => candidate.id === itemId)
    if (item === undefined) {
      const error = new Error(`未知的运行配置：${itemId}`)
      error.code = 'unknown-item'
      throw error
    }
    if (item.kind === 'compound') {
      const members = item.members
        .map((memberId) => [...catalog.launches, ...catalog.tasks].find((candidate) => candidate.id === memberId))
        .filter((candidate) => candidate !== undefined)
      if (members.length === 0) {
        const error = new Error(item.reason || '复合配置没有可运行的成员')
        error.code = 'not-runnable'
        throw error
      }
      for (const member of members) this.#validateStart(member, options)
      return members.map((member) => this.#startOne(catalog, member, options))
    }
    this.#validateStart(item, options)
    return [this.#startOne(catalog, item, options)]
  }

  #validateStart(item, options) {
    if (!item.runnable) {
      const error = new Error(item.reason || '该配置无法运行')
      error.code = 'not-runnable'
      throw error
    }
    if (item.needsDevice && !options.deviceId) {
      const error = new Error('该配置需要先选择设备')
      error.code = 'device-required'
      throw error
    }
  }

  #startOne(catalog, item, options) {
    this.#prune()
    const run = {
      id: `run-${this.nextRun}`,
      itemId: item.id,
      itemName: item.name,
      kind: item.kind,
      type: item.type,
      group: item.group || '',
      isBackground: item.isBackground === true,
      sourceLabel: item.sourceLabel,
      cwd: item.cwd,
      workspacePath: catalog.cwd,
      status: 'preparing',
      phase: '准备启动',
      command: item.command,
      script: item.script,
      startedAt: Date.now(),
      endedAt: null,
      exitCode: null,
      log: '',
      logTruncated: false,
      truncated: false,
      canInput: false,
      terminated: false,
      currentHandle: null,
      offsets: { stdout: 0, stderr: 0 },
      taskResults: [],
      error: '',
      reason: item.reason,
      needsDevice: item.needsDevice,
      devicePlaceholder: item.devicePlaceholder,
      deviceId: options.deviceId || item.deviceId || '',
      preLaunchTasks: item.preLaunchTasks,
      members: item.members,
      memberNames: item.memberNames,
      env: item.env,
    }
    this.nextRun += 1
    this.runs.set(run.id, run)
    void this.#execute(catalog, item, run)
    return this.#view(run)
  }

  #prune() {
    if (this.runs.size < this.maxRuns) return
    const finished = [...this.runs.values()]
      .filter((run) => TERMINAL_STATUSES.has(run.status))
      .sort((left, right) => left.startedAt - right.startedAt)
    while (this.runs.size >= this.maxRuns && finished.length > 0) {
      this.runs.delete(finished.shift().id)
    }
  }

  async #execute(catalog, item, run) {
    try {
      for (const label of item.preLaunchTasks || []) {
        if (run.terminated) {
          this.#finish(run, 'stopped', null)
          return
        }
        const task = resolveTask(label, item.sourceId, this.#tasksByLabel(catalog))
        if (task === undefined) throw new Error(`找不到任务「${label}」`)
        await this.#runTask(catalog, run, task, new Set())
      }
      if (run.terminated) {
        this.#finish(run, 'stopped', null)
        return
      }
      let script = item.script
      if (item.devicePlaceholder) {
        script = item.script.replace('__DSH_DEVICE__', shellQuote(run.deviceId))
      }
      if (script === '') throw new Error(item.reason || '没有可执行的命令')
      run.command = script
      run.status = 'running'
      run.phase = ''
      this.#append(run, `\n$ ${script}\n`)
      const handle = this.spawn(this.#spec(script, item.cwd, item.env, true))
      run.currentHandle = handle
      run.offsets = { stdout: 0, stderr: 0 }
      run.canInput = Boolean(handle.stdin)
      this.#drain(run)
      handle.done.then(
        (outcome) => {
          this.#drain(run)
          this.#finish(
            run,
            run.terminated ? 'stopped' : outcome.exitCode === 0 ? 'exited' : 'failed',
            outcome.exitCode,
          )
        },
        (error) => {
          this.#drain(run)
          run.error = error instanceof Error ? error.message : String(error)
          this.#append(run, `\n[进程错误] ${run.error}\n`)
          this.#finish(run, 'failed', null)
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      run.error = message
      this.#append(run, `\n[错误] ${message}\n`)
      this.#finish(run, run.terminated ? 'stopped' : 'failed', null)
    }
  }

  #tasksByLabel(catalog) {
    const map = new Map()
    for (const task of catalog.tasks) {
      const entries = map.get(task.label)
      if (entries === undefined) map.set(task.label, [task])
      else entries.push(task)
    }
    return map
  }

  async #runTask(catalog, run, task, seen) {
    if (seen.has(task.id)) throw new Error(`任务依赖出现环：${task.label}`)
    if (!task.runnable) throw new Error(task.reason || `任务「${task.label}」不可运行`)
    if (task.isBackground) {
      throw new Error(
        `后台任务「${task.label}」不能作为 preLaunchTask 或 dependsOn 等待完成；请改为可退出的任务`,
      )
    }
    seen.add(task.id)
    try {
      for (const label of task.dependsOn || []) {
        if (run.terminated) return
        const dependency = resolveTask(label, task.sourceId, this.#tasksByLabel(catalog))
        if (dependency === undefined) throw new Error(`找不到任务「${label}」`)
        await this.#runTask(catalog, run, dependency, seen)
      }
      if (run.terminated) return
      run.phase = `任务：${task.label}`
      this.#append(run, `\n=== 任务：${task.label} ===\n$ ${task.script}\n`)
      const handle = this.spawn(this.#spec(task.script, task.cwd, task.env, false))
      run.currentHandle = handle
      run.offsets = { stdout: 0, stderr: 0 }
      run.canInput = false
      this.#drain(run)
      const outcome = await handle.done.catch((error) => {
        run.error = error instanceof Error ? error.message : String(error)
        return { exitCode: null, signal: null }
      })
      this.#drain(run)
      run.currentHandle = null
      run.taskResults.push({
        label: task.label,
        exitCode: outcome.exitCode,
        status: outcome.exitCode === 0 ? 'done' : 'failed',
      })
      if (run.terminated) return
      if (outcome.exitCode !== 0) {
        throw new Error(`任务「${task.label}」失败（退出码 ${outcome.exitCode ?? 'unknown'}）`)
      }
    } finally {
      seen.delete(task.id)
    }
  }

  #spec(script, cwd, env, interactive) {
    const merged = { ...this.#baseEnv(), ...(env || {}) }
    const collect = { maxBytes: this.logLimit, spill: { maxBytes: this.logLimit * 4 } }
    const stdio = {
      stdin: interactive ? 'pipe' : 'ignore',
      stdout: collect,
      stderr: collect,
    }
    if (this.platform === 'win32') {
      const shell = this.shell || process.env.COMSPEC || 'cmd.exe'
      return { argv: [shell, '/d', '/s', '/c', script], cwd, stdio, graceMs: 5000, env: merged }
    }
    const shell = this.shell || process.env.SHELL || '/bin/zsh'
    return { argv: [shell, '-lc', script], cwd, stdio, graceMs: 5000, env: merged }
  }

  #baseEnv() {
    const env = { ...this.env }
    const home = os.homedir()
    const extras = [
      env.FLUTTER_ROOT ? path.join(env.FLUTTER_ROOT, 'bin') : '',
      path.join(home, 'development', 'flutter', 'bin'),
      path.join(home, 'flutter', 'bin'),
      path.join(home, 'fvm', 'default', 'bin'),
      '/opt/homebrew/bin',
      '/usr/local/bin',
      path.join(home, 'go', 'bin'),
    ]
    const parts = String(env.PATH || '').split(path.delimiter).filter((part) => part !== '')
    for (const extra of extras) {
      if (extra !== '' && !parts.includes(extra)) parts.push(extra)
    }
    env.PATH = parts.join(path.delimiter)
    if (!env.HOME) env.HOME = home
    return env
  }

  #drain(run) {
    const handle = run.currentHandle
    if (!handle || !handle.collected) return
    for (const stream of ['stdout', 'stderr']) {
      const reader = handle.collected[stream]
      if (!reader || typeof reader.readFrom !== 'function') continue
      let read
      try {
        read = reader.readFrom(run.offsets[stream] || 0)
      } catch {
        continue
      }
      if (read === undefined || read === null) continue
      const nextOffset = Number(read.nextOffset)
      if (!Number.isFinite(nextOffset) || nextOffset <= (run.offsets[stream] || 0)) continue
      run.offsets[stream] = nextOffset
      const text = stripAnsi(read.text || '')
      if (text !== '') this.#append(run, text)
      if (read.lossy && !run.truncated) {
        run.truncated = true
        this.#append(run, '\n[输出过多，较早内容已截断]\n')
      }
    }
  }

  #append(run, text) {
    if (!text) return
    let next = run.log + text
    if (next.length > this.logLimit) {
      next = `…\n${next.slice(-this.logLimit)}`
      run.logTruncated = true
    }
    run.log = next
  }

  #finish(run, status, exitCode) {
    if (TERMINAL_STATUSES.has(run.status)) return
    run.status = status
    run.phase = ''
    run.exitCode = exitCode === undefined ? null : exitCode
    run.endedAt = Date.now()
    run.currentHandle = null
    run.canInput = false
    const suffix = exitCode === undefined || exitCode === null ? '' : `：${exitCode}`
    this.#append(run, `\n[${status}${suffix}]\n`)
  }

  stop(runId) {
    const run = this.runs.get(runId)
    if (run === undefined) {
      const error = new Error('运行不存在')
      error.code = 'unknown-run'
      throw error
    }
    if (TERMINAL_STATUSES.has(run.status)) return this.#view(run)
    run.terminated = true
    run.status = 'stopping'
    run.phase = '正在停止'
    const handle = run.currentHandle
    if (handle) {
      try {
        handle.terminate()
      } catch {
        // The authoritative status still arrives through `done`.
      }
    }
    return this.#view(run)
  }

  input(runId, data) {
    const run = this.runs.get(runId)
    if (run === undefined) {
      const error = new Error('运行不存在')
      error.code = 'unknown-run'
      throw error
    }
    if (run.status !== 'running') {
      const error = new Error('进程不在运行中')
      error.code = 'no-input'
      throw error
    }
    const stdin = run.currentHandle?.stdin
    if (!stdin) {
      const error = new Error('该进程不接受输入')
      error.code = 'no-input'
      throw error
    }
    const text = String(data)
    if (text.length > 4096) {
      const error = new Error('输入过长')
      error.code = 'invalid-input'
      throw error
    }
    const payload = text.endsWith('\n') ? text : `${text}\n`
    stdin.write(payload)
    this.#append(run, `\n> ${text}\n`)
    return this.#view(run)
  }

  runsView(cwd) {
    const target = cwd ? path.resolve(cwd) : null
    const runs = [...this.runs.values()]
      .filter(
        (run) =>
          target === null ||
          run.workspacePath === target ||
          isInside(run.workspacePath, target) ||
          isInside(run.cwd, target),
      )
      .sort((left, right) => right.startedAt - left.startedAt)
    return { runs: runs.map((run) => this.#view(run)) }
  }

  run(runId) {
    const run = this.runs.get(runId)
    if (run === undefined) {
      const error = new Error('运行不存在')
      error.code = 'unknown-run'
      throw error
    }
    return this.#view(run)
  }

  #view(run) {
    const logLimit = 160 * 1024
    const truncated = run.log.length > logLimit
    return {
      id: run.id,
      itemId: run.itemId,
      itemName: run.itemName,
      kind: run.kind,
      type: run.type,
      group: run.group,
      isBackground: run.isBackground,
      sourceLabel: run.sourceLabel,
      cwd: run.cwd,
      workspacePath: run.workspacePath,
      status: run.status,
      phase: run.phase,
      command: run.command,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      exitCode: run.exitCode,
      canInput: run.canInput,
      log: truncated ? run.log.slice(-logLimit) : run.log,
      logTruncated: truncated || run.logTruncated,
      taskResults: run.taskResults,
      reason: run.reason,
      error: run.error,
      needsDevice: run.needsDevice,
      deviceId: run.deviceId,
      memberNames: run.memberNames,
    }
  }

  async devices(cwd) {
    const target = path.resolve(cwd || this.defaultCwd)
    const cached = this.deviceCache.get(target)
    if (cached !== undefined && Date.now() - cached.at < 15000) return cached.devices
    const result = await this.#runOnce('flutter devices --machine', target, 25000)
    const text = result.stdout.trim()
    if (text === '') {
      const detail = result.stderr.trim()
      throw new Error(detail !== '' ? detail : `flutter devices 失败（退出码 ${result.exitCode ?? 'unknown'}）`)
    }
    let parsed
    try {
      const start = text.indexOf('[')
      if (start < 0) throw new Error('missing array')
      parsed = JSON.parse(text.slice(start))
    } catch {
      throw new Error(`无法解析 flutter devices 输出：${text.slice(0, 400)}`)
    }
    if (!Array.isArray(parsed)) throw new Error('flutter devices 输出不是数组')
    const devices = parsed
      .filter((entry) => isRecord(entry) && typeof entry.id === 'string' && entry.id !== '')
      .map((entry) => ({
        id: entry.id,
        name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : entry.id,
        platform: typeof entry.targetPlatform === 'string' ? entry.targetPlatform : '',
      }))
    this.deviceCache.set(target, { at: Date.now(), devices })
    return devices
  }

  async #runOnce(script, cwd, timeoutMs) {
    const handle = this.spawn(this.#spec(script, cwd, {}, false))
    const offsets = { stdout: 0, stderr: 0 }
    let stdout = ''
    let stderr = ''
    const read = () => {
      for (const stream of ['stdout', 'stderr']) {
        const reader = handle.collected?.[stream]
        if (!reader || typeof reader.readFrom !== 'function') continue
        try {
          const chunk = reader.readFrom(offsets[stream] || 0)
          if (chunk === undefined || chunk === null) continue
          const nextOffset = Number(chunk.nextOffset)
          if (!Number.isFinite(nextOffset) || nextOffset <= (offsets[stream] || 0)) continue
          offsets[stream] = nextOffset
          if (stream === 'stdout') stdout += chunk.text || ''
          else stderr += chunk.text || ''
        } catch {
          // Ignore a reader that was disposed with the process.
        }
      }
    }
    const timer = setTimeout(() => {
      try {
        handle.terminate()
      } catch {
        // Best effort.
      }
    }, timeoutMs)
    const outcome = await handle.done.catch(() => ({ exitCode: null, signal: null }))
    clearTimeout(timer)
    read()
    return { stdout: stripAnsi(stdout), stderr: stripAnsi(stderr), exitCode: outcome.exitCode }
  }

  dispose() {
    for (const run of this.runs.values()) {
      try {
        run.currentHandle?.terminate()
      } catch {
        // Best effort during plugin unload.
      }
    }
    this.runs.clear()
  }
}

function isInside(child, parent) {
  const normalize = (value) => {
    const resolved = path.resolve(value)
    const trimmed = resolved.length > 1 ? resolved.replace(/[\\/]+$/, '') : resolved
    return process.platform === 'win32' ? trimmed.toLowerCase() : trimmed
  }
  const childPath = normalize(child)
  const parentPath = normalize(parent)
  if (childPath === parentPath) return true
  const prefix = parentPath.endsWith(path.sep) ? parentPath : `${parentPath}${path.sep}`
  return childPath.startsWith(prefix)
}
