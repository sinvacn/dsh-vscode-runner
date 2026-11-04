/**
 * Host half of the VS Code runner bundle.
 *
 * It exposes the catalog and run controls as six same-origin web routes
 * (the browser half fetches them) and as one agent tool. Every route passes
 * through the composition's Connection trust fence, exactly like the shipped
 * open-in-app feature, so an unauthenticated or foreign-origin request never
 * reaches a process spawn.
 */

import { Runner } from './core.js'

export const name = 'vscode-runner'
export const inject = ['webServer', 'connection', 'subprocess', 'tools']

const BASE = '/vscode-runner'
const MAX_BODY_BYTES = 64 * 1024
const TOOL_NAME = 'vscode_launch'

const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['list', 'start', 'stop', 'input', 'status', 'devices', 'workspaces', 'session'],
      description: 'list: show launch configurations, compounds and tasks; start: run one item; stop: stop one run; input: send stdin to a run; status: show runs for a directory; devices: list Flutter devices; workspaces: list registered workspaces; session: list the catalog for a session directory.',
    },
    cwd: {
      type: 'string',
      description: 'Absolute workspace directory. Defaults to the session default directory.',
    },
    id: {
      type: 'string',
      description: 'Item id returned by action "list" (start only).',
    },
    runId: {
      type: 'string',
      description: 'Run id returned by action "start" (stop only).',
    },
    deviceId: {
      type: 'string',
      description: 'Flutter device id when the selected Dart configuration has no deviceId.',
    },
    data: {
      type: 'string',
      description: 'Input text for action "input" (Enter is appended).',
    },
    sessionId: {
      type: 'string',
      description: 'Session id for action "session" (defaults to the selected workspace).',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const TOOL_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
    error: { type: 'string' },
    code: { type: 'string' },
  },
  required: ['ok'],
  additionalProperties: false,
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

function statusFor(error) {
  switch (error?.code) {
    case 'no-directory':
    case 'unknown-item':
    case 'unknown-run':
      return 404
    case 'device-required':
    case 'not-runnable':
    case 'no-input':
      return 409
    case 'invalid-input':
      return 400
    default:
      return 500
  }
}

function fail(res, error) {
  const message = error instanceof Error ? error.message : String(error)
  sendJson(res, error?.status ?? statusFor(error), { code: error?.code || 'error', message })
}

function methodNotAllowed(res, allow) {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

function queryOf(req) {
  return new URL(req.url || '/', 'http://localhost').searchParams
}

async function readJsonBody(req) {
  const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    const error = new Error('content-type must be application/json')
    error.status = 415
    error.code = 'unsupported-media-type'
    throw error
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      req.resume()
      const error = new Error('request body is too large')
      error.status = 413
      error.code = 'payload-too-large'
      throw error
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('request body must be valid JSON')
    error.status = 400
    error.code = 'bad-request'
    throw error
  }
}

function requireString(body, key) {
  const value = body?.[key]
  if (typeof value !== 'string' || value === '') {
    const error = new Error(`"${key}" must be a non-empty string`)
    error.status = 400
    error.code = 'bad-request'
    throw error
  }
  return value
}

function summarize(item) {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    type: item.type,
    group: item.group ?? '',
    isBackground: item.isBackground === true,
    request: item.request ?? '',
    sourceLabel: item.sourceLabel ?? '',
    sourceKind: item.sourceKind ?? '',
    cwd: item.cwd ?? '',
    command: item.command ?? '',
    runnable: item.runnable !== false,
    reason: item.reason ?? '',
    note: item.note ?? '',
    needsDevice: item.needsDevice === true,
    deviceId: item.deviceId ?? '',
    preLaunchTasks: item.preLaunchTasks ?? [],
    dependsOn: item.dependsOn ?? [],
    dependsOrder: item.dependsOrder ?? '',
    memberNames: item.memberNames ?? [],
    members: item.members ?? [],
  }
}

function publicCatalog(catalog) {
  const stripEnv = ({ env: _env, ...item }) => item
  return {
    ...catalog,
    launches: catalog.launches.map(stripEnv),
    tasks: catalog.tasks.map(stripEnv),
  }
}

function summarizeCatalog(catalog) {
  return {
    cwd: catalog.cwd,
    workspace: catalog.workspace,
    sources: catalog.sources,
    launches: catalog.launches.map(summarize),
    tasks: catalog.tasks.map(summarize),
    warnings: catalog.warnings,
  }
}

export function apply(ctx) {
  const agents = ctx.get('agents')
  const workingDirectory = ctx.get('workingDirectory')
  const workspaceRegistry = ctx.get('workspaceRegistry')
  const runner = new Runner({
    spawn: (spec) => ctx.subprocess.spawn(spec),
    env: process.env,
    defaultCwd: workingDirectory?.defaultDirectory || process.cwd(),
    workspaceRegistry,
  })
  ctx.effect(() => () => runner.dispose(), 'vscode-runner: processes')

  async function cwdForSession(sessionId) {
    let cwd = runner.defaultCwd
    if (typeof sessionId === 'string' && sessionId !== '') {
      try {
        const agent = agents?.get(sessionId)
        if (agent !== undefined && workingDirectory !== undefined) {
          cwd = await workingDirectory.ensure(agent)
        }
      } catch {
        // A missing or offline session falls back to the selected workspace.
      }
    }
    if (cwd === runner.defaultCwd) {
      const workspaces = await runner.workspaces()
      cwd = workspaces.selected || cwd
    }
    return runner.workspaceRootFor(cwd)
  }

  async function catalogForSession(sessionId) {
    const startCwd = await cwdForSession(sessionId)
    const catalog = await runner.catalog(startCwd)
    const rootCwd = catalog.workspace?.root || catalog.cwd
    const finalCatalog = rootCwd === catalog.cwd ? catalog : await runner.catalog(rootCwd)
    return { cwd: finalCatalog.cwd, catalog: publicCatalog(finalCatalog) }
  }

  /** Ask the Host/Origin fence and browser authentication about a request. */
  const rejected = (req, res) => {
    let rejection
    try {
      rejection = ctx.connection.requestRejection(req)
    } catch {
      rejection = 403
    }
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  const route = (path, allow, handler, label) => {
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: 'exact',
          path,
          handler: async (req, res) => {
            if (rejected(req, res)) return
            if (req.method !== allow) {
              methodNotAllowed(res, allow)
              return
            }
            try {
              await handler(req, res)
            } catch (error) {
              fail(res, error)
            }
          },
        }),
      label,
    )
  }

  route(
    `${BASE}/session-catalog`,
    'GET',
    async (req, res) => {
      sendJson(res, 200, await catalogForSession(queryOf(req).get('sessionId') || ''))
    },
    `vscode-runner: GET ${BASE}/session-catalog`,
  )

  route(
    `${BASE}/start`,
    'POST',
    async (req, res) => {
      const body = await readJsonBody(req)
      const cwd = typeof body?.cwd === 'string' && body.cwd !== '' ? body.cwd : runner.defaultCwd
      const id = requireString(body, 'id')
      const deviceId = typeof body?.deviceId === 'string' && body.deviceId !== '' ? body.deviceId : undefined
      const runs = await runner.start(cwd, id, { deviceId })
      sendJson(res, 200, { runs })
    },
    `vscode-runner: POST ${BASE}/start`,
  )

  route(
    `${BASE}/runs`,
    'GET',
    async (req, res) => {
      const cwd = queryOf(req).get('cwd') || runner.defaultCwd
      sendJson(res, 200, runner.runsView(cwd))
    },
    `vscode-runner: GET ${BASE}/runs`,
  )

  route(
    `${BASE}/stop`,
    'POST',
    async (req, res) => {
      const body = await readJsonBody(req)
      const runId = requireString(body, 'runId')
      sendJson(res, 200, { run: runner.stop(runId) })
    },
    `vscode-runner: POST ${BASE}/stop`,
  )

  route(
    `${BASE}/input`,
    'POST',
    async (req, res) => {
      const body = await readJsonBody(req)
      const runId = requireString(body, 'runId')
      const data = requireString(body, 'data')
      sendJson(res, 200, { run: runner.input(runId, data) })
    },
    `vscode-runner: POST ${BASE}/input`,
  )

  route(
    `${BASE}/devices`,
    'GET',
    async (req, res) => {
      const cwd = queryOf(req).get('cwd') || runner.defaultCwd
      try {
        const devices = await runner.devices(cwd)
        sendJson(res, 200, { devices })
      } catch (error) {
        sendJson(res, 200, {
          devices: [],
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    `vscode-runner: GET ${BASE}/devices`,
  )

  const tool = {
    name: TOOL_NAME,
    description:
      'List and run VS Code launch configurations, compounds and tasks discovered from *.code-workspace, .vscode/launch.json and tasks.json. Supports single-folder and multi-root workspaces. Use action "list" first, then "start" with the returned item id. Debug-incompatible aspects: breakpoints, attach sessions and postDebugTask are not available; configurations run through their normal CLI equivalent (for example go run or flutter run). Background tasks cannot be used as preLaunchTask or dependsOn.',
    parameters: TOOL_PARAMETERS,
    output: {
      schema: TOOL_OUTPUT_SCHEMA,
      render(_args, value) {
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
      },
    },
    async execute(args) {
      const input = typeof args === 'object' && args !== null ? args : {}
      const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : runner.defaultCwd
      try {
        switch (input.action) {
          case 'list': {
            return { ok: true, data: summarizeCatalog(await runner.catalog(cwd)) }
          }
          case 'start': {
            if (typeof input.id !== 'string' || input.id === '') {
              return { ok: false, code: 'bad-request', error: 'id is required for action "start"' }
            }
            const deviceId = typeof input.deviceId === 'string' && input.deviceId !== '' ? input.deviceId : undefined
            const runs = await runner.start(cwd, input.id, { deviceId })
            return { ok: true, data: { runs } }
          }
          case 'stop': {
            if (typeof input.runId !== 'string' || input.runId === '') {
              return { ok: false, code: 'bad-request', error: 'runId is required for action "stop"' }
            }
            return { ok: true, data: { run: runner.stop(input.runId) } }
          }
          case 'input': {
            if (typeof input.runId !== 'string' || input.runId === '') {
              return { ok: false, code: 'bad-request', error: 'runId is required for action "input"' }
            }
            if (typeof input.data !== 'string') {
              return { ok: false, code: 'bad-request', error: 'data is required for action "input"' }
            }
            return { ok: true, data: { run: runner.input(input.runId, input.data) } }
          }
          case 'status': {
            return { ok: true, data: runner.runsView(cwd) }
          }
          case 'devices': {
            const devices = await runner.devices(cwd)
            return { ok: true, data: { devices } }
          }
          case 'workspaces': {
            return { ok: true, data: await runner.workspaces() }
          }
          case 'session': {
            return { ok: true, data: await catalogForSession(input.sessionId) }
          }
          default:
            return { ok: false, code: 'bad-request', error: `unknown action: ${String(input.action)}` }
        }
      } catch (error) {
        return {
          ok: false,
          code: error?.code || 'error',
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
  ctx.effect(() => ctx.tools.register(tool), 'vscode-runner: vscode_launch tool')
}
