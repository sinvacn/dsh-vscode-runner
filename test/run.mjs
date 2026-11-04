/**
 * dsh-vscode-runner test suite.
 *
 * Run with `npm test` from the package root. The suite is self-contained: it
 * creates temporary single-folder and multi-root workspaces, then drives the
 * catalog compiler and the runner with a real child process.
 */

import assert from 'node:assert/strict'
import { spawn as childSpawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { buildCatalog, parseJsonc, quoteArg, Runner } from '../core.js'
import { apply } from '../index.js'

const POSIX = process.platform !== 'win32'

function spawnWithPipes(spec) {
  const child = childSpawn(spec.argv[0], spec.argv.slice(1), {
    cwd: spec.cwd,
    env: spec.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ exitCode: code, signal }))
    child.on('error', () => resolve({ exitCode: null, signal: null }))
  })
  return {
    stdin: child.stdin,
    collected: {
      stdout: {
        readFrom(offset) {
          return { text: stdout.slice(offset), nextOffset: stdout.length, lossy: false }
        },
      },
      stderr: {
        readFrom(offset) {
          return { text: stderr.slice(offset), nextOffset: stderr.length, lossy: false }
        },
      },
    },
    done,
    terminate() {
      child.kill('SIGTERM')
    },
  }
}

async function waitFor(check, label, timeoutMs = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await check()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  throw new Error(`TIMEOUT: ${label}`)
}

async function jsonc(file) {
  return parseJsonc(await readFile(file, 'utf8'), file)
}

function findLaunch(catalog, name) {
  return catalog.launches.find((item) => item.name === name)
}

function findTask(catalog, name) {
  return catalog.tasks.find((item) => item.name === name)
}

async function testJsonc() {
  const value = parseJsonc(`{
    // a comment
    "folders": [{ "path": "." },],
    /* block */
    "settings": { "a": "http://example.com", "b": "/* not a comment */" },
  }`)
  assert.equal(value.folders.length, 1)
  assert.equal(value.settings.a, 'http://example.com')
  assert.equal(value.settings.b, '/* not a comment */')
  console.log('  jsonc: ok')
}

async function testSingleFolder() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-single-'))
  try {
    await mkdir(path.join(root, '.vscode'), { recursive: true })
    await mkdir(path.join(root, 'sub'), { recursive: true })
    await writeFile(
      path.join(root, '.vscode', 'launch.json'),
      JSON.stringify({
        version: '0.2.0',
        configurations: [
          {
            name: 'single hello',
            type: 'node-terminal',
            request: 'launch',
            command: 'printf "hello\\n"',
            cwd: '${workspaceFolder}/sub',
            env: { DEMO_VALUE: '${config:demo.value}' },
          },
          {
            name: 'single scoped',
            type: 'node-terminal',
            request: 'launch',
            command: 'printf "%s\\n" "${workspaceFolderBasename}"',
          },
        ],
      }),
      'utf8',
    )
    await writeFile(
      path.join(root, '.vscode', 'tasks.json'),
      JSON.stringify({
        version: '2.0.0',
        tasks: [
          { label: 'single task', type: 'shell', command: 'printf "task\\n"', options: { cwd: '${workspaceFolder}/sub' } },
          { label: 'npm task', type: 'npm', script: 'build', args: ['--watch'] },
          { label: 'object deps', type: 'shell', command: 'printf "dep\\n"', dependsOn: [{ label: 'single task' }] },
        ],
      }),
      'utf8',
    )
    await writeFile(
      path.join(root, '.vscode', 'settings.json'),
      JSON.stringify({ demo: { value: 'configured' } }),
      'utf8',
    )

    const catalog = await buildCatalog(root, { env: { ...process.env, DEMO_ENV: 'env-value' } })
    assert.equal(catalog.workspace.file, null)
    assert.equal(catalog.workspace.root, root)
    assert.deepEqual(catalog.workspace.folders, [{ name: path.basename(root), path: root }])

    const hello = findLaunch(catalog, 'single hello')
    assert(hello)
    assert.equal(hello.cwd, path.join(root, 'sub'))
    assert.equal(hello.env.DEMO_VALUE, 'configured')
    assert.equal(hello.runnable, true)

    const scoped = findLaunch(catalog, 'single scoped')
    assert(scoped)
    assert.equal(scoped.runnable, true)
    assert(scoped.script.includes(path.basename(root)))

    const task = findTask(catalog, 'single task')
    assert(task)
    assert.equal(task.cwd, path.join(root, 'sub'))
    assert.equal(task.group, '')

    const npm = findTask(catalog, 'npm task')
    assert(npm)
    assert(npm.script.includes('npm run build -- --watch'))

    const deps = findTask(catalog, 'object deps')
    assert.deepEqual(deps.dependsOn, ['single task'])

    console.log('  single folder: ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function writeWorkspaceFixture(root) {
  await mkdir(path.join(root, 'app', '.vscode'), { recursive: true })
  await mkdir(path.join(root, 'lib', '.vscode'), { recursive: true })
  const workspace = {
    folders: [
      { path: 'app', name: 'App' },
      { path: 'lib', name: 'Lib' },
    ],
    settings: { 'demo.value': 'root' },
    launch: {
      configurations: [
        {
          name: 'ws scoped',
          type: 'node-terminal',
          request: 'launch',
          command: 'printf "%s\\n" "${workspaceFolder:App}"',
          cwd: '${workspaceFolder:App}',
        },
        {
          name: 'ws unscoped',
          type: 'node-terminal',
          request: 'launch',
          command: 'printf "%s\\n" "${workspaceFolder}"',
        },
      ],
      compounds: [
        {
          name: 'ws compound',
          configurations: [{ folder: 'App', name: 'app launch' }, 'lib launch'],
        },
      ],
    },
    tasks: {
      version: '2.0.0',
      tasks: [{ label: 'ws task', type: 'shell', command: 'printf "ws\\n"' }],
    },
  }
  await writeFile(
    path.join(root, 'demo.code-workspace'),
    `// workspace-level launch and task configuration\n${JSON.stringify(workspace, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    path.join(root, 'app', '.vscode', 'launch.json'),
    JSON.stringify({
      version: '0.2.0',
      configurations: [
        {
          name: 'app launch',
          type: 'node-terminal',
          request: 'launch',
          command: 'printf "%s\\n" "${workspaceFolder}"',
          cwd: '${workspaceFolder}',
        },
      ],
    }),
    'utf8',
  )
  await writeFile(
    path.join(root, 'lib', '.vscode', 'launch.json'),
    JSON.stringify({
      version: '0.2.0',
      configurations: [
        {
          name: 'lib launch',
          type: 'node-terminal',
          request: 'launch',
          command: 'printf "%s\\n" "${workspaceFolderBasename}"',
        },
      ],
    }),
    'utf8',
  )
}

async function testMultiRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-multi-'))
  try {
    await writeWorkspaceFixture(root)
    const catalog = await buildCatalog(root)
    assert.equal(path.basename(catalog.workspace.file), 'demo.code-workspace')
    assert.deepEqual(
      catalog.workspace.folders.map((folder) => folder.name),
      ['App', 'Lib'],
    )
    assert.equal(catalog.sources.length, 3)
    assert.equal(catalog.launches.length, 5)
    assert.equal(catalog.tasks.length, 1)

    const scoped = findLaunch(catalog, 'ws scoped')
    assert.equal(scoped.runnable, true)
    assert.equal(scoped.cwd, path.join(root, 'app'))
    assert(scoped.script.includes(path.join(root, 'app')))

    const unscoped = findLaunch(catalog, 'ws unscoped')
    assert.equal(unscoped.runnable, false)
    assert.match(unscoped.reason, /workspaceFolder/)
    assert.match(unscoped.reason, /工作区级配置/)

    const app = findLaunch(catalog, 'app launch')
    assert.equal(app.runnable, true)
    assert.equal(app.cwd, path.join(root, 'app'))

    const compound = findLaunch(catalog, 'ws compound')
    assert.equal(compound.runnable, true)
    assert.deepEqual(compound.memberNames, ['App/app launch', 'lib launch'])
    assert.equal(compound.members.length, 2)

    const fromFolder = await buildCatalog(path.join(root, 'app'))
    assert.equal(path.basename(fromFolder.workspace.file), 'demo.code-workspace')
    assert.equal(fromFolder.cwd, path.join(root, 'app'))
    assert.equal(fromFolder.launches.length, 5)

    const wsTask = findTask(catalog, 'ws task')
    assert(wsTask)
    assert.equal(wsTask.sourceKind, 'workspace')

    console.log('  multi-root workspace: ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function testNestedWorkspaceDoesNotHijack() {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-nested-'))
  try {
    await mkdir(path.join(parent, 'other'), { recursive: true })
    await writeFile(
      path.join(parent, 'unrelated.code-workspace'),
      JSON.stringify({ folders: [{ path: 'other' }] }),
      'utf8',
    )
    await mkdir(path.join(parent, 'project', '.vscode'), { recursive: true })
    await writeFile(
      path.join(parent, 'project', '.vscode', 'launch.json'),
      JSON.stringify({
        version: '0.2.0',
        configurations: [{ name: 'project launch', type: 'node-terminal', request: 'launch', command: 'true' }],
      }),
      'utf8',
    )
    const catalog = await buildCatalog(path.join(parent, 'project'))
    assert.equal(catalog.workspace.file, null)
    assert.equal(findLaunch(catalog, 'project launch').runnable, true)
    assert.equal(findLaunch(catalog, 'project launch').sourceKind, 'folder')
    console.log('  nested unrelated workspace: ok')
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
}

async function testSameDirectoryWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-samedir-'))
  try {
    await mkdir(path.join(root, 'app', '.vscode'), { recursive: true })
    await writeFile(
      path.join(root, 'side.code-workspace'),
      JSON.stringify({ folders: [{ path: 'app', name: 'App' }] }),
      'utf8',
    )
    await writeFile(
      path.join(root, 'app', '.vscode', 'launch.json'),
      JSON.stringify({
        version: '0.2.0',
        configurations: [{ name: 'side launch', type: 'node-terminal', request: 'launch', command: 'true' }],
      }),
      'utf8',
    )
    const catalog = await buildCatalog(root)
    assert.equal(path.basename(catalog.workspace.file), 'side.code-workspace')
    assert.equal(findLaunch(catalog, 'side launch').runnable, true)
    console.log('  same-directory workspace: ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function testWorkspaceRootFor() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-root-'))
  try {
    await mkdir(path.join(root, 'app', 'nested'), { recursive: true })
    const runner = new Runner({
      spawn: spawnWithPipes,
      defaultCwd: root,
      workspaceRegistry: {
        list: () => [{ path: root, title: 'root' }],
      },
    })
    assert.equal(await runner.workspaceRootFor(path.join(root, 'app', 'nested')), root)
    const outside = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-outside-'))
    try {
      assert.equal(await runner.workspaceRootFor(outside), outside)
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
    console.log('  workspace root resolution: ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function testQuoting() {
  assert.equal(quoteArg('plain', 'darwin'), 'plain')
  assert.equal(quoteArg('a b', 'darwin'), "'a b'")
  assert.equal(quoteArg("it's", 'darwin'), "'it'\\''s'")
  assert.equal(quoteArg('a b', 'win32'), '"a b"')
  console.log('  argument quoting: ok')
}

async function testExecution() {
  if (!POSIX) {
    console.log('  execution: skipped on win32')
    return
  }
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-exec-'))
  try {
    await mkdir(path.join(root, '.vscode'), { recursive: true })
    await writeFile(
      path.join(root, '.vscode', 'launch.json'),
      JSON.stringify({
        version: '0.2.0',
        configurations: [
          {
            name: 'hello',
            type: 'node-terminal',
            request: 'launch',
            command: 'printf "hello\\nworld\\n"',
            preLaunchTask: 'prepare',
          },
          {
            name: 'waits for input',
            type: 'node-terminal',
            request: 'launch',
            command: 'read line; printf "got:%s\\n" "$line"',
          },
          {
            name: 'long lived',
            type: 'node-terminal',
            request: 'launch',
            command: 'sleep 30',
          },
          {
            name: 'background prelaunch',
            type: 'node-terminal',
            request: 'launch',
            command: 'printf "should not start\\n"',
            preLaunchTask: 'watch',
          },
        ],
        compounds: [{ name: 'both', configurations: ['hello'] }],
      }),
      'utf8',
    )
    await writeFile(
      path.join(root, '.vscode', 'tasks.json'),
      JSON.stringify({
        version: '2.0.0',
        tasks: [
          { label: 'base', type: 'shell', command: 'printf "base\\n"' },
          { label: 'prepare', type: 'shell', command: 'printf "prep\\n"', dependsOn: 'base', dependsOrder: 'sequence' },
          { label: 'watch', type: 'shell', command: 'sleep 30', isBackground: true },
        ],
      }),
      'utf8',
    )

    const catalog = await buildCatalog(root)
    const runner = new Runner({
      spawn: spawnWithPipes,
      shell: process.env.SHELL || '/bin/sh',
      env: process.env,
      defaultCwd: root,
    })

    const [helloRun] = await runner.start(root, findLaunch(catalog, 'hello').id)
    const helloDone = await waitFor(
      () => {
        const current = runner.runsView(root).runs.find((entry) => entry.id === helloRun.id)
        return current && current.status !== 'preparing' && current.status !== 'running' ? current : null
      },
      'hello run',
    )
    assert.equal(helloDone.status, 'exited')
    assert.match(helloDone.log, /base/)
    assert.match(helloDone.log, /prep/)
    assert.match(helloDone.log, /hello/)
    assert(helloDone.log.indexOf('base') < helloDone.log.indexOf('prep'))
    assert.equal(helloDone.taskResults.length, 2)

    const [inputRun] = await runner.start(root, findLaunch(catalog, 'waits for input').id)
    await waitFor(() => {
      const current = runner.runsView(root).runs.find((entry) => entry.id === inputRun.id)
      return current && current.canInput
    }, 'input run running')
    runner.input(inputRun.id, 'abc')
    const inputDone = await waitFor(
      () => {
        const current = runner.runsView(root).runs.find((entry) => entry.id === inputRun.id)
        return current && current.status === 'exited' ? current : null
      },
      'input run exit',
    )
    assert.match(inputDone.log, /got:abc/)

    const [sleepRun] = await runner.start(root, findLaunch(catalog, 'long lived').id)
    await waitFor(() => {
      const current = runner.runsView(root).runs.find((entry) => entry.id === sleepRun.id)
      return current && current.status === 'running'
    }, 'sleep running')
    runner.stop(sleepRun.id)
    const stopped = await waitFor(
      () => {
        const current = runner.runsView(root).runs.find((entry) => entry.id === sleepRun.id)
        return current && current.status === 'stopped' ? current : null
      },
      'sleep stopped',
    )
    assert.equal(stopped.status, 'stopped')

    const [bgRun] = await runner.start(root, findLaunch(catalog, 'background prelaunch').id)
    const bgDone = await waitFor(
      () => {
        const current = runner.runsView(root).runs.find((entry) => entry.id === bgRun.id)
        return current && (current.status === 'failed' || current.status === 'exited') ? current : null
      },
      'background prelaunch failure',
    )
    assert.equal(bgDone.status, 'failed')
    assert.match(bgDone.log, /后台任务/)
    assert.doesNotMatch(bgDone.log, /should not start/)

    const compoundRuns = await runner.start(root, findLaunch(catalog, 'both').id)
    assert.equal(compoundRuns.length, 1)
    await waitFor(
      () => {
        const current = runner.runsView(root).runs.find((entry) => entry.id === compoundRuns[0].id)
        return current && (current.status === 'exited' || current.status === 'failed')
      },
      'compound member exit',
    )

    console.log('  execution, preLaunchTask, stdin, stop, background guard: ok')
    runner.dispose()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function testClientBundle() {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  let loaded = null
  const react = {
    createElement: () => null,
    Fragment: Symbol('Fragment'),
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useMemo: () => undefined,
    useRef: () => ({ current: null }),
  }
  const primitives = { Modal: () => null }
  const fakeWindow = {
    __ModuleLoader__: {
      load(value) {
        loaded = value
      },
    },
  }
  vm.runInNewContext(source, {
    window: fakeWindow,
    require: (id) => (id === 'react' ? react : primitives),
    console,
    setTimeout,
    clearTimeout,
    document: {
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {}, remove() {} }),
      head: { appendChild() {} },
    },
  })
  assert(loaded !== null, 'client bundle registers with the module loader')
  assert.equal(loaded.id, 'dsh-vscode-runner')
  const plugin = loaded.factory((id) => (id === 'react' ? react : primitives))
  assert.equal(typeof plugin.apply, 'function')
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale'])
  console.log('  client bundle: ok')
}

async function testHostWiring() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-runner-host-'))
  try {
    await mkdir(path.join(root, '.vscode'), { recursive: true })
    await writeFile(
      path.join(root, '.vscode', 'launch.json'),
      JSON.stringify({
        version: '0.2.0',
        configurations: [{ name: 'host wiring', type: 'node-terminal', request: 'launch', command: 'true' }],
      }),
      'utf8',
    )
    const routes = []
    const effects = []
    const tools = []
    const ctx = {
      get(name) {
        if (name === 'agents') return { get: () => undefined }
        if (name === 'workingDirectory') return { defaultDirectory: root, ensure: async () => root }
        if (name === 'workspaceRegistry') return { list: () => [{ path: root, title: 'root' }] }
        return undefined
      },
      subprocess: { spawn: spawnWithPipes },
      effect(fn) {
        const cleanup = fn()
        if (typeof cleanup === 'function') effects.push(cleanup)
      },
      webServer: {
        register(route) {
          routes.push(route)
          return () => {}
        },
      },
      connection: { requestRejection: () => undefined },
      tools: {
        register(tool) {
          tools.push(tool)
          return () => {}
        },
      },
    }
    apply(ctx)
    assert.deepEqual(
      routes.map((route) => route.path).sort(),
      [
        '/vscode-runner/devices',
        '/vscode-runner/input',
        '/vscode-runner/runs',
        '/vscode-runner/session-catalog',
        '/vscode-runner/start',
        '/vscode-runner/stop',
      ],
    )
    assert.equal(tools.length, 1)
    assert.equal(tools[0].name, 'vscode_launch')
    const listed = await tools[0].execute({ action: 'list', cwd: root })
    assert.equal(listed.ok, true, JSON.stringify(listed))
    assert.equal(listed.data.launches[0].name, 'host wiring')
    for (const cleanup of effects.reverse()) cleanup()
    console.log('  host routes and agent tool: ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

console.log('dsh-vscode-runner tests')
await testJsonc()
await testSingleFolder()
await testMultiRoot()
await testNestedWorkspaceDoesNotHijack()
await testSameDirectoryWorkspace()
await testWorkspaceRootFor()
await testQuoting()
await testExecution()
await testClientBundle()
await testHostWiring()
console.log('all tests passed')
