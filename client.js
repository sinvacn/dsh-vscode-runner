window.__ModuleLoader__.load({
  id: 'dsh-vscode-runner',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef } = React
    const { Modal } = require('@deepseek-ai/dsh-client-ui-primitives')

    const NS = 'vscodeRunner'
    const PANEL_ID = 'vscode-runner'

    const zh = {
      title: '运行配置',
      subtitle: '从 .code-workspace、.vscode/launch.json 与 tasks.json 读取 VS Code 运行配置，点击即可执行。',
      workspace: '工作区',
      refresh: '刷新',
      loading: '加载中…',
      launchConfigs: '启动配置',
      tasks: '任务',
      runs: '运行记录',
      emptyTitle: '没有找到 VS Code 运行配置',
      emptyBody: '当前工作区没有 .code-workspace、.vscode/launch.json 或 .vscode/tasks.json，或其中没有可列出的配置项。',
      run: '运行',
      runTask: '执行',
      chooseDevice: '选择设备运行',
      preparing: '准备中',
      running: '运行中',
      stopping: '停止中',
      exited: '已退出',
      failed: '失败',
      stopped: '已停止',
      stop: '停止',
      showLog: '查看日志',
      hideLog: '收起日志',
      logEmpty: '等待输出…',
      inputPlaceholder: '向进程发送输入（如 r / q / 序号）',
      send: '发送',
      sourceWorkspace: '工作区文件',
      sourceFolder: '目录',
      workspaceFile: '配置文件',
      singleFolder: '单目录工作区',
      requiresDevice: '需选择设备',
      compound: '复合配置',
      unsupported: '不可运行',
      device: '选择 Flutter 设备',
      loadingDevices: '正在查找设备…',
      noDevices: '没有找到可用的 Flutter 设备，请先启动模拟器或连接真机。',
      deviceError: '查找设备失败',
      dismiss: '关闭',
      warnings: '提示',
      members: '成员：{names}',
      noRuns: '还没有运行记录。点击上方配置的「运行」后，这里会显示输出。',
      noWorkspace: '没有可用工作区',
      error: '操作失败',
      retry: '重试',
      disclaimer: 'DSH 以普通进程启动这些配置；断点、单步与 attach 调试请在 VS Code 中进行。',
      runStarted: '已启动',
      defaultWorkspace: '默认目录',
      folders: '{count} 个目录',
      exitCode: '退出码 {code}',
      startedAt: '开始于 {time}',
      duration: '耗时 {time}',
      unknownItem: '该配置已变化，请刷新后重试。',
      active: '进行中',
      sessionAction: '运行配置',
      openFullPanel: '打开完整运行面板',
      menuEmpty: '没有找到可运行的配置',
      menuStarting: '启动中…',
      sessionStarted: '已启动',
      menuBack: '返回配置列表',
      menuEmptyBody: '在 .code-workspace 或 .vscode/launch.json 里添加启动配置后，这里会列出来。',
      menuDeviceTitle: '选择设备',
      preLaunchCount: '前置任务 {count} 个',
      dependsCount: '依赖 {count} 个',
      sessionSummary: '{launches} 个启动配置 · {tasks} 个任务',
      searchPlaceholder: '搜索配置、项目或命令…',
      searchClear: '清除搜索',
      filterAll: '全部',
      filterLaunch: '启动配置',
      filterTask: '任务',
      shownCount: '显示 {shown} / {total}',
      configCount: '{count} 个配置',
      activeRuns: '{count} 个运行中',
      activeRunsHint: '点击查看运行日志',
      noMatches: '没有匹配的配置',
      noMatchesBody: '试试更短的关键词，或切换分类。',
      clearFilter: '清除筛选',
      runItem: '运行 {name}',
      viewRun: '查看运行',
      modalHint: '↑↓ 选择 · Enter 运行 · Esc 关闭',
      openLog: '查看日志',
      loadingConfigs: '正在读取运行配置…',
      devicePickHint: '选择运行设备后立即启动',
      back: '返回',
      listSeparator: '、',
      labelSeparator: '：',
    }

    const en = {
      title: 'Run Configurations',
      subtitle: 'Reads VS Code launch configurations and tasks from .code-workspace, .vscode/launch.json and tasks.json, and runs them with one click.',
      workspace: 'Workspace',
      refresh: 'Refresh',
      loading: 'Loading…',
      launchConfigs: 'Launch configurations',
      tasks: 'Tasks',
      runs: 'Runs',
      emptyTitle: 'No VS Code run configurations found',
      emptyBody: 'This workspace has no .code-workspace, .vscode/launch.json or .vscode/tasks.json entries to list.',
      run: 'Run',
      runTask: 'Run task',
      chooseDevice: 'Choose device',
      preparing: 'Preparing',
      running: 'Running',
      stopping: 'Stopping',
      exited: 'Exited',
      failed: 'Failed',
      stopped: 'Stopped',
      stop: 'Stop',
      showLog: 'Show log',
      hideLog: 'Hide log',
      logEmpty: 'Waiting for output…',
      inputPlaceholder: 'Send input to the process (for example r / q / a number)',
      send: 'Send',
      sourceWorkspace: 'Workspace file',
      sourceFolder: 'Folder',
      workspaceFile: 'Configuration',
      singleFolder: 'Single-folder workspace',
      requiresDevice: 'Device required',
      compound: 'Compound',
      unsupported: 'Not runnable',
      device: 'Choose a Flutter device',
      loadingDevices: 'Looking for devices…',
      noDevices: 'No Flutter device found. Start a simulator or connect a device first.',
      deviceError: 'Could not find devices',
      dismiss: 'Close',
      warnings: 'Notes',
      members: 'Members: {names}',
      noRuns: 'No runs yet. Press Run above and the output appears here.',
      noWorkspace: 'No workspace available',
      error: 'Operation failed',
      retry: 'Retry',
      disclaimer: 'DSH starts these configurations as ordinary processes. Use VS Code for breakpoints, stepping and attach sessions.',
      runStarted: 'Started',
      defaultWorkspace: 'Default directory',
      folders: '{count} folders',
      exitCode: 'Exit code {code}',
      startedAt: 'Started at {time}',
      duration: 'Duration {time}',
      unknownItem: 'This configuration changed. Refresh and try again.',
      active: 'Active',
      sessionAction: 'Run configuration',
      openFullPanel: 'Open full run panel',
      menuEmpty: 'No runnable configuration found',
      menuStarting: 'Starting…',
      sessionStarted: 'Started',
      menuBack: 'Back to configurations',
      menuEmptyBody: 'Add launch configurations in .code-workspace or .vscode/launch.json to see them here.',
      menuDeviceTitle: 'Choose a device',
      preLaunchCount: 'Pre-launch tasks: {count}',
      dependsCount: 'Dependencies: {count}',
      sessionSummary: '{launches} launch configurations · {tasks} tasks',
      searchPlaceholder: 'Search configurations, projects or commands…',
      searchClear: 'Clear search',
      filterAll: 'All',
      filterLaunch: 'Launch',
      filterTask: 'Tasks',
      shownCount: 'Showing {shown} / {total}',
      configCount: '{count} configurations',
      activeRuns: '{count} running',
      activeRunsHint: 'Open the run log',
      noMatches: 'No matching configuration',
      noMatchesBody: 'Try a shorter keyword or switch categories.',
      clearFilter: 'Clear filters',
      runItem: 'Run {name}',
      viewRun: 'View run',
      modalHint: '↑↓ select · Enter run · Esc close',
      openLog: 'View log',
      loadingConfigs: 'Reading run configurations…',
      devicePickHint: 'Pick a device to start',
      back: 'Back',
      listSeparator: ', ',
      labelSeparator: ': ',
    }

    let translate = null
    let openFullPanel = () => {}

    function fallbackTranslate(key, vars) {
      const template = zh[key] ?? en[key] ?? key
      if (vars === undefined) return template
      return String(template).replace(/\{(\w+)\}/g, (match, name) =>
        vars[name] === undefined ? match : String(vars[name]),
      )
    }

    function useT(props) {
      return typeof props?.t === 'function' ? props.t : translate ?? fallbackTranslate
    }

    function formatClock(timestamp) {
      if (!timestamp) return ''
      try {
        return new Date(timestamp).toLocaleTimeString()
      } catch {
        return ''
      }
    }

    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms < 0) return '—'
      if (ms < 1000) return `${Math.round(ms)}ms`
      const seconds = Math.floor(ms / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m ${seconds % 60}s`
      const hours = Math.floor(minutes / 60)
      return `${hours}h ${minutes % 60}m`
    }

    function relativePath(root, target) {
      if (typeof root !== 'string' || typeof target !== 'string' || root === '' || target === '') return target
      const normalize = (value) => value.replace(/\\/g, '/').replace(/\/+$/, '')
      const base = normalize(root)
      const next = normalize(target)
      if (next === base) return ''
      return next.startsWith(`${base}/`) ? next.slice(base.length + 1) : target
    }

    function statusMeta(status, t) {
      switch (status) {
        case 'preparing':
          return { label: t('preparing'), tone: 'warn' }
        case 'running':
          return { label: t('running'), tone: 'success' }
        case 'stopping':
          return { label: t('stopping'), tone: 'warn' }
        case 'exited':
          return { label: t('exited'), tone: 'idle' }
        case 'failed':
          return { label: t('failed'), tone: 'error' }
        case 'stopped':
          return { label: t('stopped'), tone: 'idle' }
        default:
          return { label: String(status ?? ''), tone: 'idle' }
      }
    }

    async function api(path, init) {
      const response = await fetch(path, {
        method: init?.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(init?.headers ?? {}),
        },
        body: init?.body,
      })
      const text = await response.text()
      let payload = null
      if (text !== '') {
        try {
          payload = JSON.parse(text)
        } catch {
          payload = { message: text }
        }
      }
      if (!response.ok) {
        const error = new Error(payload?.message || `HTTP ${response.status}`)
        error.code = payload?.code
        error.status = response.status
        throw error
      }
      return payload
    }

    // -----------------------------------------------------------------------
    // Small presentational pieces
    // -----------------------------------------------------------------------

    function PanelIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 18
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': true,
          style: { display: 'block', color: 'currentColor' },
        },
        h('rect', {
          x: 3.25,
          y: 4.25,
          width: 17.5,
          height: 15.5,
          rx: 4,
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }),
        h('path', {
          d: 'M9.6 8.5l6.4 3.5-6.4 3.5z',
          fill: 'currentColor',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
      )
    }

    function Badge(props) {
      const tone = props.tone ? ` is-${props.tone}` : ''
      return h('span', { className: `vsc-run-badge${tone}` }, props.children)
    }

    function DevicePicker(props) {
      const { state, t, onPick, onClose } = props
      return h(
        'div',
        { className: 'vsc-run-device' },
        h('div', { className: 'vsc-run-device-title' }, t('device')),
        state.loading ? h('div', { className: 'vsc-run-note' }, t('loadingDevices')) : null,
        state.error ? h('div', { className: 'vsc-run-reason' }, `${t('deviceError')}${t('labelSeparator')}${state.error}`) : null,
        !state.loading && state.devices.length > 0
          ? h(
              'div',
              { className: 'vsc-run-device-list' },
              state.devices.map((device) =>
                h(
                  'button',
                  {
                    key: device.id,
                    type: 'button',
                    className: 'vsc-run-btn',
                    onClick: () => onPick(device),
                  },
                  `${device.name}${device.platform ? ` · ${device.platform}` : ''}`,
                ),
              ),
            )
          : null,
        !state.loading && !state.error && state.devices.length === 0
          ? h('div', { className: 'vsc-run-note' }, t('noDevices'))
          : null,
        h('button', { type: 'button', className: 'vsc-run-btn is-ghost', onClick: onClose }, t('dismiss')),
      )
    }

    function ItemRow(props) {
      const { item, t, active, busy, deviceMenu, onRun, onPickDevice, onCloseDevice } = props
      const runnable = item.runnable !== false
      const pending = active || busy
      const showDevice = deviceMenu !== null && deviceMenu.itemId === item.id
      const label = item.kind === 'task' ? t('runTask') : t('run')
      const buttonLabel = !runnable
        ? t('unsupported')
        : busy
          ? t('preparing')
          : active
            ? t('running')
            : item.needsDevice && !item.deviceId
              ? t('chooseDevice')
              : label
      return h(
        'div',
        { className: `vsc-run-item${runnable ? '' : ' is-disabled'}` },
        h(
          'div',
          { className: 'vsc-run-item-row' },
          h(
            'div',
            { className: 'vsc-run-item-body' },
            h(
              'div',
              { className: 'vsc-run-item-title' },
              h('span', { className: 'vsc-run-name' }, item.name),
              item.kind === 'compound' ? h(Badge, { tone: 'accent' }, t('compound')) : null,
              item.type ? h(Badge, null, typeLabel(item.type)) : null,
              item.group ? h(Badge, { tone: 'muted' }, item.group) : null,
              item.needsDevice && !item.deviceId ? h(Badge, { tone: 'warn' }, t('requiresDevice')) : null,
              !runnable ? h(Badge, { tone: 'error' }, t('unsupported')) : null,
            ),
            item.command
              ? h('code', { className: 'vsc-run-cmd', title: item.command }, item.command)
              : null,
            item.note ? h('div', { className: 'vsc-run-note' }, item.note) : null,
            item.kind === 'compound' && Array.isArray(item.memberNames) && item.memberNames.length > 0
              ? h('div', { className: 'vsc-run-note' }, t('members', { names: item.memberNames.join(t('listSeparator')) }))
              : null,
            !runnable && item.reason ? h('div', { className: 'vsc-run-reason' }, item.reason) : null,
          ),
          h(
            'div',
            { className: 'vsc-run-item-actions' },
            pending ? h('span', { className: 'vsc-run-pending' }, active ? t('running') : t('preparing')) : null,
            h(
              'button',
              {
                type: 'button',
                className: 'vsc-run-btn is-primary',
                disabled: pending || !runnable || active,
                onClick: () => onRun(item),
                title: item.command || item.reason || item.name,
              },
              buttonLabel,
            ),
          ),
        ),
        showDevice
          ? h(DevicePicker, {
              state: deviceMenu,
              t,
              onPick: (device) => onPickDevice(item, device),
              onClose: onCloseDevice,
            })
          : null,
      )
    }

    function RunCard(props) {
      const { run, t, expanded, onToggle, onStop, onInput, now } = props
      const [text, setText] = useState('')
      const [stick, setStick] = useState(true)
      const preRef = useRef(null)
      const meta = statusMeta(run.status, t)
      const running = run.status === 'running'
      const inFlight = running || run.status === 'preparing' || run.status === 'stopping'
      const duration = formatDuration((run.endedAt ?? now) - run.startedAt)

      useEffect(() => {
        const element = preRef.current
        if (expanded && stick && element) element.scrollTop = element.scrollHeight
      }, [run.log, expanded, stick])

      function submit() {
        if (text === '') return
        onInput(run, text)
        setText('')
      }

      return h(
        'div',
        { className: 'vsc-run-run' },
        h(
          'div',
          { className: 'vsc-run-run-head' },
          h('span', { className: `vsc-run-dot is-${meta.tone}` }),
          h('span', { className: 'vsc-run-run-name', title: run.cwd }, run.itemName),
          run.sourceLabel ? h(Badge, null, run.sourceLabel) : null,
          h('span', { className: `vsc-run-status is-${meta.tone}` }, meta.label),
          run.phase ? h('span', { className: 'vsc-run-phase' }, run.phase) : null,
          h('span', { className: 'vsc-run-spacer' }),
          h(
            'span',
            { className: 'vsc-run-time', title: t('startedAt', { time: formatClock(run.startedAt) }) },
            `${formatClock(run.startedAt)} · ${duration}`,
          ),
          inFlight
            ? h(
                'button',
                { type: 'button', className: 'vsc-run-btn is-ghost', onClick: () => onStop(run) },
                t('stop'),
              )
            : null,
          h(
            'button',
            { type: 'button', className: 'vsc-run-btn is-ghost', onClick: () => onToggle(run.id) },
            expanded ? t('hideLog') : t('showLog'),
          ),
        ),
        expanded
          ? h(
              'div',
              { className: 'vsc-run-log-wrap' },
              h(
                'pre',
                {
                  className: 'vsc-run-log',
                  ref: preRef,
                  onScroll: (event) => {
                    const element = event.currentTarget
                    setStick(element.scrollHeight - element.scrollTop - element.clientHeight < 24)
                  },
                },
                run.log === '' ? t('logEmpty') : run.log,
              ),
              run.canInput
                ? h(
                    'div',
                    { className: 'vsc-run-input' },
                    h('input', {
                      value: text,
                      placeholder: t('inputPlaceholder'),
                      onChange: (event) => setText(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' && !event.nativeEvent?.isComposing) submit()
                      },
                    }),
                    h('button', { type: 'button', className: 'vsc-run-btn', onClick: submit }, t('send')),
                  )
                : null,
            )
          : null,
      )
    }

    function groupBySource(items, sources) {
      const sourceById = new Map((sources ?? []).map((source) => [source.id, source]))
      const groups = new Map()
      for (const item of items) {
        let group = groups.get(item.sourceId)
        if (group === undefined) {
          group = { source: sourceById.get(item.sourceId), items: [] }
          groups.set(item.sourceId, group)
        }
        group.items.push(item)
      }
      return [...groups.values()]
    }

    function ItemGroups(props) {
      const { items, sources, t, activeItemIds, busyItem, deviceMenu, onRun, onPickDevice, onCloseDevice } = props
      const groups = useMemo(() => groupBySource(items, sources), [items, sources])
      return h(
        React.Fragment,
        null,
        groups.map((group) => {
          const source = group.source
          const label = source ? source.label : ''
          const pathText = source
            ? source.kind === 'workspace'
              ? source.path
              : relativePath(source.base, source.path)
            : ''
          return h(
            'div',
            { className: 'vsc-run-group', key: source ? source.id : label },
            h(
              'div',
              { className: 'vsc-run-group-head' },
              h(
                'span',
                { className: 'vsc-run-group-label' },
                source?.kind === 'workspace' ? h(Badge, { tone: 'muted' }, t('sourceWorkspace')) : null,
                source?.kind === 'folder' ? h(Badge, { tone: 'muted' }, t('sourceFolder')) : null,
                h('span', { className: 'vsc-run-group-name' }, label),
              ),
              pathText ? h('span', { className: 'vsc-run-source-path', title: source?.path }, pathText) : null,
            ),
            h(
              'div',
              { className: 'vsc-run-items' },
              group.items.map((item) =>
                h(ItemRow, {
                  key: item.id,
                  item,
                  t,
                  active: activeItemIds.has(item.id),
                  busy: busyItem === item.id,
                  deviceMenu,
                  onRun,
                  onPickDevice,
                  onCloseDevice,
                }),
              ),
            ),
          )
        }),
      )
    }

    // -----------------------------------------------------------------------
    // Page
    // -----------------------------------------------------------------------

    function RunnerPage(props) {
      const t = useT(props)
      const [workspaceInfo, setWorkspaceInfo] = useState({ workspaces: [], defaultCwd: '', selected: '' })
      const [cwd, setCwd] = useState('')
      const [catalog, setCatalog] = useState(null)
      const [runs, setRuns] = useState([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [busyItem, setBusyItem] = useState('')
      const [expanded, setExpanded] = useState(() => new Set())
      const [deviceMenu, setDeviceMenu] = useState(null)
      const [reloadToken, setReloadToken] = useState(0)
      const [now, setNow] = useState(() => Date.now())

      useEffect(() => {
        let cancelled = false
        ;(async () => {
          try {
            const data = await api('vscode-runner/workspaces')
            if (cancelled) return
            setWorkspaceInfo(data ?? { workspaces: [], defaultCwd: '', selected: '' })
            const next = data?.selected || data?.defaultCwd || data?.workspaces?.[0]?.path || ''
            setCwd(next)
            if (next === '') setLoading(false)
          } catch (cause) {
            if (!cancelled) {
              setError(cause.message)
              setLoading(false)
            }
          }
        })()
        return () => {
          cancelled = true
        }
      }, [])

      useEffect(() => {
        if (cwd === '') return
        let cancelled = false
        setLoading(true)
        ;(async () => {
          try {
            const data = await api(`vscode-runner/catalog?cwd=${encodeURIComponent(cwd)}`)
            if (cancelled) return
            setCatalog(data)
            setError('')
            setLoading(false)
          } catch (cause) {
            if (cancelled) return
            setCatalog(null)
            setError(cause.message)
            setLoading(false)
          }
        })()
        return () => {
          cancelled = true
        }
      }, [cwd, reloadToken])

      useEffect(() => {
        if (cwd === '') return
        let cancelled = false
        let timer = null
        const tick = async () => {
          try {
            const data = await api(`vscode-runner/runs?cwd=${encodeURIComponent(cwd)}`)
            if (!cancelled && Array.isArray(data?.runs)) setRuns(data.runs)
          } catch {
            // A transient read failure keeps the last rendered runs.
          }
          if (!cancelled) timer = setTimeout(tick, 1200)
        }
        tick()
        return () => {
          cancelled = true
          if (timer !== null) clearTimeout(timer)
        }
      }, [cwd, reloadToken])

      useEffect(() => {
        setRuns([])
        setExpanded(new Set())
        setDeviceMenu(null)
      }, [cwd])

      useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [])

      async function refreshRuns() {
        if (cwd === '') return
        try {
          const data = await api(`vscode-runner/runs?cwd=${encodeURIComponent(cwd)}`)
          if (Array.isArray(data?.runs)) setRuns(data.runs)
        } catch {
          // Keep the current list.
        }
      }

      async function doStart(item, deviceId) {
        if (busyItem !== '') return
        setBusyItem(item.id)
        setError('')
        try {
          const body = { cwd, id: item.id }
          if (deviceId !== undefined && deviceId !== '') body.deviceId = deviceId
          const data = await api('vscode-runner/start', {
            method: 'POST',
            body: JSON.stringify(body),
          })
          const started = Array.isArray(data?.runs) ? data.runs : []
          if (started.length > 0) {
            setExpanded((previous) => {
              const next = new Set(previous)
              for (const run of started) next.add(run.id)
              return next
            })
            setRuns((previous) => [...started, ...previous])
          }
          await refreshRuns()
        } catch (cause) {
          if (cause.code === 'device-required') {
            setBusyItem('')
            await openDevice(item)
          } else if (cause.code === 'not-runnable') {
            setError(cause.message)
          } else if (cause.code === 'unknown-item') {
            setError(t('unknownItem'))
          } else {
            setError(cause.message)
          }
        } finally {
          setBusyItem('')
        }
      }

      async function openDevice(item) {
        setDeviceMenu({ itemId: item.id, loading: true, devices: [], error: '' })
        try {
          const data = await api(`vscode-runner/devices?cwd=${encodeURIComponent(cwd)}`)
          const devices = Array.isArray(data?.devices) ? data.devices : []
          if (data?.error) {
            setDeviceMenu({ itemId: item.id, loading: false, devices, error: data.error })
            return
          }
          if (devices.length === 1) {
            setDeviceMenu(null)
            await doStart(item, devices[0].id)
            return
          }
          setDeviceMenu({ itemId: item.id, loading: false, devices, error: '' })
        } catch (cause) {
          setDeviceMenu({ itemId: item.id, loading: false, devices: [], error: cause.message })
        }
      }

      function handleRun(item) {
        if (item.needsDevice && !item.deviceId) {
          void openDevice(item)
          return
        }
        void doStart(item)
      }

      function handlePickDevice(item, device) {
        setDeviceMenu(null)
        void doStart(item, device.id)
      }

      async function handleStop(run) {
        try {
          await api('vscode-runner/stop', {
            method: 'POST',
            body: JSON.stringify({ runId: run.id }),
          })
          await refreshRuns()
        } catch (cause) {
          setError(cause.message)
        }
      }

      async function handleInput(run, text) {
        try {
          await api('vscode-runner/input', {
            method: 'POST',
            body: JSON.stringify({ runId: run.id, data: text }),
          })
        } catch (cause) {
          setError(cause.message)
        }
        await refreshRuns()
      }

      function toggleRun(runId) {
        setExpanded((previous) => {
          const next = new Set(previous)
          if (next.has(runId)) next.delete(runId)
          else next.add(runId)
          return next
        })
      }

      function refresh() {
        setError('')
        setReloadToken((value) => value + 1)
      }

      const activeItemIds = useMemo(
        () =>
          new Set(
            runs
              .filter(
                (run) =>
                  run.status === 'preparing' || run.status === 'running' || run.status === 'stopping',
              )
              .map((run) => run.itemId),
          ),
        [runs],
      )

      const launches = catalog?.launches ?? []
      const tasks = catalog?.tasks ?? []
      const sources = catalog?.sources ?? []
      const workspaces = workspaceInfo.workspaces ?? []
      const workspacePath = catalog?.cwd ?? cwd
      const configFile = catalog?.workspace?.file
      const empty = catalog !== null && launches.length === 0 && tasks.length === 0

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'vsc-run-page' },
          h(
            'div',
            { className: 'vsc-run-wrap' },
            h(
              'header',
              { className: 'vsc-run-header' },
              h(
                'div',
                { className: 'vsc-run-heading' },
                h('h1', { className: 'vsc-run-title' }, t('title')),
                h('p', { className: 'vsc-run-subtitle' }, t('subtitle')),
              ),
              h(
                'div',
                { className: 'vsc-run-toolbar' },
                h(
                  'label',
                  { className: 'vsc-run-field' },
                  h('span', { className: 'vsc-run-field-label' }, t('workspace')),
                  h(
                    'select',
                    {
                      className: 'vsc-run-select',
                      value: cwd,
                      disabled: workspaces.length === 0,
                      onChange: (event) => {
                        setDeviceMenu(null)
                        setCwd(event.target.value)
                      },
                    },
                    workspaces.length === 0
                      ? h('option', { value: '' }, t('noWorkspace'))
                      : workspaces.map((workspace) =>
                          h(
                            'option',
                            { key: workspace.path, value: workspace.path },
                            workspace.title || workspace.path,
                          ),
                        ),
                  ),
                ),
                h(
                  'button',
                  { type: 'button', className: 'vsc-run-btn', onClick: refresh, disabled: loading },
                  loading ? t('loading') : t('refresh'),
                ),
              ),
            ),
            error !== ''
              ? h(
                  'div',
                  { className: 'vsc-run-error' },
                  h('span', null, `${t('error')}${t('labelSeparator')}${error}`),
                  h(
                    'button',
                    { type: 'button', className: 'vsc-run-btn is-ghost', onClick: () => setError('') },
                    t('dismiss'),
                  ),
                )
              : null,
            workspacePath !== ''
              ? h(
                  'div',
                  { className: 'vsc-run-meta' },
                  configFile
                    ? h(
                        'span',
                        { title: configFile },
                        `${t('workspaceFile')}${t('labelSeparator')}${baseName(configFile)}`,
                      )
                    : h('span', null, t('singleFolder')),
                  h('span', { className: 'vsc-run-meta-sep' }, '·'),
                  h('span', { title: workspacePath }, workspacePath),
                  catalog?.workspace?.folders?.length > 1
                    ? h(
                        React.Fragment,
                        null,
                        h('span', { className: 'vsc-run-meta-sep' }, '·'),
                        h('span', null, t('folders', { count: catalog.workspace.folders.length })),
                      )
                    : null,
                )
              : null,
            catalog?.warnings?.length > 0
              ? h(
                  'details',
                  { className: 'vsc-run-warnings' },
                  h('summary', null, `${t('warnings')} (${catalog.warnings.length})`),
                  h(
                    'ul',
                    null,
                    catalog.warnings.map((warning, index) => h('li', { key: index }, warning)),
                  ),
                )
              : null,
            loading && catalog === null
              ? h('div', { className: 'vsc-run-loading' }, t('loading'))
              : null,
            empty
              ? h(
                  'div',
                  { className: 'vsc-run-empty' },
                  h('div', { className: 'vsc-run-empty-title' }, t('emptyTitle')),
                  h('div', { className: 'vsc-run-empty-body' }, t('emptyBody')),
                )
              : null,
            !empty && launches.length > 0
              ? h(
                  'section',
                  { className: 'vsc-run-section' },
                  h(
                    'div',
                    { className: 'vsc-run-section-head' },
                    h('h2', { className: 'vsc-run-section-title' }, t('launchConfigs')),
                    h('span', { className: 'vsc-run-count' }, launches.length),
                  ),
                  h(ItemGroups, {
                    items: launches,
                    sources,
                    t,
                    activeItemIds,
                    busyItem,
                    deviceMenu,
                    onRun: handleRun,
                    onPickDevice: handlePickDevice,
                    onCloseDevice: () => setDeviceMenu(null),
                  }),
                )
              : null,
            !empty && tasks.length > 0
              ? h(
                  'section',
                  { className: 'vsc-run-section' },
                  h(
                    'div',
                    { className: 'vsc-run-section-head' },
                    h('h2', { className: 'vsc-run-section-title' }, t('tasks')),
                    h('span', { className: 'vsc-run-count' }, tasks.length),
                  ),
                  h(ItemGroups, {
                    items: tasks,
                    sources,
                    t,
                    activeItemIds,
                    busyItem,
                    deviceMenu,
                    onRun: handleRun,
                    onPickDevice: handlePickDevice,
                    onCloseDevice: () => setDeviceMenu(null),
                  }),
                )
              : null,
            h(
              'section',
              { className: 'vsc-run-section' },
              h(
                'div',
                { className: 'vsc-run-section-head' },
                h('h2', { className: 'vsc-run-section-title' }, t('runs')),
                runs.length > 0 ? h('span', { className: 'vsc-run-count' }, runs.length) : null,
              ),
              runs.length === 0
                ? h('div', { className: 'vsc-run-note vsc-run-runs-empty' }, t('noRuns'))
                : h(
                    'div',
                    { className: 'vsc-run-runs' },
                    runs.map((run) =>
                      h(RunCard, {
                        key: run.id,
                        run,
                        t,
                        now,
                        expanded: expanded.has(run.id),
                        onToggle: toggleRun,
                        onStop: handleStop,
                        onInput: handleInput,
                      }),
                    ),
                  ),
            ),
            h('p', { className: 'vsc-run-disclaimer' }, t('disclaimer')),
          ),
        ),
      )
    }

    // -----------------------------------------------------------------------
    // Session-header entry: a floating run dialog
    // -----------------------------------------------------------------------

    function HeaderRunIcon(props) {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        props.flash === true
          ? h('path', {
              d: 'M5 12.5l4.3 4.3L19 7',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            })
          : h('path', {
              d: 'M8 5.2l10.5 6.8L8 18.8z',
              fill: 'currentColor',
              stroke: 'currentColor',
              strokeWidth: 1,
              strokeLinejoin: 'round',
            }),
      )
    }

    function Glyph(props) {
      const size = typeof props?.size === 'number' ? props.size : 16
      const common = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      }
      switch (props?.name) {
        case 'search':
          return h(
            'svg',
            common,
            h('circle', { cx: 10.5, cy: 10.5, r: 6.25, stroke: 'currentColor', strokeWidth: 1.6 }),
            h('path', {
              d: 'M15.2 15.2L20 20',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
            }),
          )
        case 'close':
          return h(
            'svg',
            common,
            h('path', {
              d: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
            }),
          )
        case 'refresh':
          return h(
            'svg',
            common,
            h('path', {
              d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
            }),
            h('path', {
              d: 'M19.8 4.8v4.4h-4.4',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }),
          )
        case 'folder':
          return h(
            'svg',
            common,
            h('path', {
              d: 'M3.8 7.2a2 2 0 0 1 2-2h3l2 2.2h7.4a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2z',
              stroke: 'currentColor',
              strokeWidth: 1.5,
              strokeLinejoin: 'round',
            }),
          )
        case 'terminal':
          return h(
            'svg',
            common,
            h('rect', {
              x: 3.6,
              y: 5,
              width: 16.8,
              height: 14,
              rx: 2,
              stroke: 'currentColor',
              strokeWidth: 1.5,
            }),
            h('path', {
              d: 'M7.2 9.2l2.8 2.8-2.8 2.8M12.4 15h4.4',
              stroke: 'currentColor',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }),
          )
        case 'arrow-right':
          return h(
            'svg',
            common,
            h('path', {
              d: 'M5 12h13M13 6.5l5.5 5.5-5.5 5.5',
              stroke: 'currentColor',
              strokeWidth: 1.7,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }),
          )
        case 'chevron':
          return h(
            'svg',
            common,
            h('path', {
              d: 'M5.5 9l6.5 6 6.5-6',
              stroke: 'currentColor',
              strokeWidth: 1.7,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }),
          )
        case 'device':
          return h(
            'svg',
            common,
            h('rect', {
              x: 6.5,
              y: 2.8,
              width: 11,
              height: 18.4,
              rx: 2.4,
              stroke: 'currentColor',
              strokeWidth: 1.5,
            }),
            h('path', {
              d: 'M10.5 18.2h3',
              stroke: 'currentColor',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
            }),
          )
        case 'warning':
          return h(
            'svg',
            common,
            h('path', {
              d: 'M12 3.8l8.4 15H3.6z',
              stroke: 'currentColor',
              strokeWidth: 1.5,
              strokeLinejoin: 'round',
            }),
            h('path', {
              d: 'M12 9v4.2M12 16.2v.2',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
            }),
          )
        case 'play':
        default:
          return h(
            'svg',
            common,
            h('path', {
              d: 'M8 5.2l10.5 6.8L8 18.8z',
              fill: 'currentColor',
              stroke: 'currentColor',
              strokeWidth: 1,
              strokeLinejoin: 'round',
            }),
          )
      }
    }

    function Spinner() {
      return h('span', { className: 'vsc-run-spinner', 'aria-hidden': true })
    }

    function baseName(path) {
      if (typeof path !== 'string' || path === '') return ''
      const trimmed = path.replace(/[\\/]+$/, '')
      const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
      return cut >= 0 ? trimmed.slice(cut + 1) : trimmed
    }

    function typeLabel(type) {
      switch (type) {
        case 'dart':
          return 'Flutter'
        case 'go':
          return 'Go'
        case 'node-terminal':
        case 'shell':
          return 'Shell'
        case 'node':
        case 'pwa-node':
          return 'Node'
        case 'python':
        case 'debugpy':
          return 'Python'
        case 'chrome':
        case 'pwa-chrome':
          return 'Browser'
        case 'cppdbg':
        case 'lldb':
        case 'gdb':
          return 'C++'
        default:
          return type || ''
      }
    }

    // 会话弹窗里通常只有一个工作区文件，按 source 分组会把十几项塞成一组；
    // 按配置的 cwd（也就是具体子项目）分组更利于扫读。
    function groupByProject(items) {
      const groups = new Map()
      for (const item of items) {
        const key = item.cwd || item.sourceId || ''
        let group = groups.get(key)
        if (group === undefined) {
          group = {
            key,
            label: baseName(item.cwd) || item.sourceLabel || '',
            path: item.cwd || '',
            items: [],
          }
          groups.set(key, group)
        }
        group.items.push(item)
      }
      return [...groups.values()]
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    function Highlight(props) {
      const text = String(props?.text ?? '')
      const query = typeof props?.query === 'string' ? props.query.trim() : ''
      if (query === '') return text
      const escaped = escapeRegExp(query)
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
      return h(
        React.Fragment,
        null,
        parts.map((part, index) =>
          index % 2 === 1
            ? h('mark', { key: index, className: 'vsc-run-mark' }, part)
            : h(React.Fragment, { key: index }, part),
        ),
      )
    }

    function itemMatches(item, query) {
      if (query === '') return true
      const needle = query.toLowerCase()
      const haystack = [
        item.name,
        item.type,
        typeLabel(item.type),
        item.cwd,
        item.sourceLabel,
        item.command,
        item.note,
        item.reason,
        ...(Array.isArray(item.memberNames) ? item.memberNames : []),
      ]
        .filter((value) => typeof value === 'string' && value !== '')
        .join('\n')
        .toLowerCase()
      return haystack.includes(needle)
    }

    function rowMeta(item, t) {
      const project = baseName(item.cwd)
      if (Array.isArray(item.memberNames) && item.memberNames.length > 0) {
        return {
          project,
          command: '',
          text: t('members', { names: item.memberNames.join(t('listSeparator')) }),
        }
      }
      if (typeof item.command === 'string' && item.command !== '') {
        return { project, command: item.command, text: '' }
      }
      const pieces = []
      if (typeof item.note === 'string' && item.note !== '') pieces.push(item.note)
      if (typeof item.reason === 'string' && item.reason !== '') pieces.push(item.reason)
      return { project, command: '', text: pieces.join(' · ') }
    }

    function DialogRow(props) {
      const { item, t, index, active, busy, cursor, query, onPick } = props
      const runnable = item.runnable !== false
      const pending = busy === item.id
      const blocked = busy !== ''
      const disabled = !runnable || (blocked && !active)
      const needsDevice = item.needsDevice && !item.deviceId
      const tone = item.kind === 'task' ? 'task' : runnable ? 'run' : 'blocked'
      const meta = rowMeta(item, t)
      const label = !runnable
        ? `${item.name} · ${t('unsupported')}`
        : active
          ? `${item.name} · ${t('running')} · ${t('viewRun')}`
          : pending
            ? `${item.name} · ${t('menuStarting')}`
            : t('runItem', { name: item.name })
      return h(
        'button',
        {
          type: 'button',
          className: `vsc-run-row${active ? ' is-active' : ''}${pending ? ' is-pending' : ''}${
            cursor && !disabled ? ' is-cursor' : ''
          }${disabled ? ' is-disabled' : ''}`,
          disabled,
          'data-vsc-row-index': index,
          'aria-label': label,
          title: [item.name, item.command, item.note, item.reason].filter(Boolean).join('\n'),
          onClick: () => onPick(item),
        },
        h(
          'span',
          { className: `vsc-run-row-icon is-${tone}` },
          h(Glyph, { name: item.kind === 'task' ? 'terminal' : 'play', size: 14 }),
        ),
        h(
          'span',
          { className: 'vsc-run-row-main' },
          h(
            'span',
            { className: 'vsc-run-row-title' },
            h('span', { className: 'vsc-run-row-name' }, h(Highlight, { text: item.name, query })),
            item.kind === 'compound' ? h('span', { className: 'vsc-run-chip is-accent' }, t('compound')) : null,
            needsDevice ? h('span', { className: 'vsc-run-chip is-warn' }, t('requiresDevice')) : null,
            item.kind !== 'compound' && Array.isArray(item.preLaunchTasks) && item.preLaunchTasks.length > 0
              ? h(
                  'span',
                  { className: 'vsc-run-chip' },
                  item.kind === 'task'
                    ? t('dependsCount', { count: item.preLaunchTasks.length })
                    : t('preLaunchCount', { count: item.preLaunchTasks.length }),
                )
              : null,
            !runnable ? h('span', { className: 'vsc-run-chip is-error' }, t('unsupported')) : null,
          ),
          h(
            'span',
            { className: `vsc-run-row-sub${!runnable && item.reason ? ' is-error' : ''}` },
            meta.project !== ''
              ? h('span', { className: 'vsc-run-row-project' }, meta.project)
              : null,
            meta.project !== '' && (meta.command !== '' || meta.text !== '')
              ? h('span', { className: 'vsc-run-row-sep' }, '·')
              : null,
            meta.command !== ''
              ? h('code', { className: 'vsc-run-row-cmd', title: meta.command }, meta.command)
              : meta.text !== ''
                ? h('span', { className: 'vsc-run-row-text' }, meta.text)
                : null,
          ),
        ),
        h(
          'span',
          { className: 'vsc-run-row-tail' },
          active
            ? h(
                React.Fragment,
                null,
                h(
                  'span',
                  { className: 'vsc-run-running' },
                  h('span', { className: 'vsc-run-pulse' }),
                  t('running'),
                ),
                h('span', { className: 'vsc-run-row-arrow' }, h(Glyph, { name: 'arrow-right', size: 12 })),
              )
            : pending
              ? h('span', { className: 'vsc-run-running is-pending' }, h(Spinner), t('menuStarting'))
              : null,
          !active && !pending && item.type && item.kind !== 'compound'
            ? h(
                'span',
                { className: `vsc-run-type is-${tone}` },
                item.kind === 'task' ? typeLabel(item.type) || t('filterTask') : typeLabel(item.type),
              )
            : null,
          !active && !pending && runnable
            ? h('span', { className: 'vsc-run-row-play' }, h(Glyph, { name: 'play', size: 11 }))
            : null,
        ),
      )
    }

    function DialogGroup(props) {
      const { group, t, root, activeItemIds, busy, cursor, query, onPick, onToggle, collapsible } = props
      const collapsed = group.collapsed === true
      const path = relativePath(root, group.path)
      const head = h(
        React.Fragment,
        null,
        collapsible ? h('span', { className: 'vsc-run-dgroup-chevron' }, h(Glyph, { name: 'chevron', size: 12 })) : null,
        h('span', { className: 'vsc-run-dgroup-name' }, group.label),
        path !== '' && path !== root && path !== group.label
          ? h('span', { className: 'vsc-run-dgroup-path', title: group.path }, path)
          : null,
        h('span', { className: 'vsc-run-dgroup-count' }, String(group.items.length)),
      )
      return h(
        'div',
        { className: `vsc-run-dgroup${collapsed ? ' is-collapsed' : ''}` },
        props.showHeader
          ? collapsible
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'vsc-run-dgroup-head',
                  title: group.path || group.label,
                  'aria-expanded': !collapsed,
                  onClick: onToggle,
                },
                head,
              )
            : h(
                'div',
                { className: 'vsc-run-dgroup-head is-static', title: group.path || group.label },
                head,
              )
          : null,
        collapsed
          ? null
          : h(
              'div',
              { className: 'vsc-run-dgroup-list' },
              group.rows.map((row) =>
                h(DialogRow, {
                  key: row.item.id,
                  item: row.item,
                  t,
                  index: row.index,
                  active: activeItemIds.has(row.item.id),
                  busy,
                  cursor: row.index === cursor,
                  query,
                  onPick,
                }),
              ),
            ),
      )
    }

    function DialogSection(props) {
      const { title, icon, count, children } = props
      return h(
        'section',
        { className: 'vsc-run-sec' },
        h(
          'div',
          { className: 'vsc-run-sec-head' },
          h('span', { className: 'vsc-run-sec-icon' }, h(Glyph, { name: icon, size: 12 })),
          h('span', { className: 'vsc-run-sec-title' }, title),
          h('span', { className: 'vsc-run-sec-count' }, String(count)),
        ),
        children,
      )
    }

    function DialogDeviceView(props) {
      const { item, state, t, onBack, onPick, onRetry, backRef } = props
      return h(
        'div',
        { className: 'vsc-run-device-view' },
        h(
          'button',
          { ref: backRef, type: 'button', className: 'vsc-run-back', onClick: onBack },
          h('span', { className: 'vsc-run-back-chevron' }, h(Glyph, { name: 'chevron', size: 12 })),
          t('back'),
        ),
        h(
          'div',
          { className: 'vsc-run-device-head' },
          h('span', { className: 'vsc-run-device-head-title' }, t('menuDeviceTitle')),
          h('span', { className: 'vsc-run-device-item-name', title: item.name }, item.name),
          h('span', { className: 'vsc-run-device-hint' }, t('devicePickHint')),
        ),
        state.loading
          ? h(
              'div',
              { className: 'vsc-run-device-status' },
              h(Spinner),
              t('loadingDevices'),
            )
          : state.error !== ''
            ? h(
                'div',
                { className: 'vsc-run-device-error-box', role: 'alert' },
                h('span', null, `${t('deviceError')} · ${state.error}`),
                h(
                  'button',
                  { type: 'button', className: 'vsc-run-device-retry', onClick: onRetry },
                  t('retry'),
                ),
              )
            : state.devices.length === 0
              ? h('div', { className: 'vsc-run-device-empty' }, t('noDevices'))
              : h(
                  'div',
                  { className: 'vsc-run-device-options' },
                  state.devices.map((device) =>
                    h(
                      'button',
                      {
                        key: device.id,
                        type: 'button',
                        className: 'vsc-run-device-card',
                        onClick: () => onPick(device),
                      },
                      h('span', { className: 'vsc-run-device-icon' }, h(Glyph, { name: 'device', size: 16 })),
                      h(
                        'span',
                        { className: 'vsc-run-device-main' },
                        h('span', { className: 'vsc-run-device-card-name' }, device.name),
                        device.platform
                          ? h('span', { className: 'vsc-run-device-card-meta' }, device.platform)
                          : null,
                      ),
                      h('span', { className: 'vsc-run-device-pick' }, h(Glyph, { name: 'arrow-right', size: 12 })),
                    ),
                  ),
                ),
      )
    }

    function DialogSkeleton() {
      return h(
        'div',
        { className: 'vsc-run-skeleton', 'aria-hidden': true },
        [0, 1, 2, 3, 4].map((index) =>
          h(
            'div',
            { className: 'vsc-run-skeleton-row', key: index },
            h('span', { className: 'vsc-run-skeleton-icon' }),
            h(
              'span',
              { className: 'vsc-run-skeleton-lines' },
              h('span', {
                className: 'vsc-run-skeleton-line',
                style: { width: `${44 + ((index * 17) % 34)}%` },
              }),
              h('span', {
                className: 'vsc-run-skeleton-line is-short',
                style: { width: `${27 + ((index * 11) % 26)}%` },
              }),
            ),
          ),
        ),
      )
    }

    function DialogEmpty(props) {
      const { icon, title, body, action, onAction, tone } = props
      return h(
        'div',
        { className: 'vsc-run-dialog-empty' },
        h(
          'span',
          { className: `vsc-run-empty-icon${tone ? ` is-${tone}` : ''}` },
          h(Glyph, { name: icon, size: 20 }),
        ),
        h('div', { className: 'vsc-run-dialog-empty-title' }, title),
        body !== '' ? h('div', { className: 'vsc-run-dialog-empty-body' }, body) : null,
        action
          ? h(
              'button',
              { type: 'button', className: 'vsc-run-dialog-empty-action', onClick: onAction },
              action,
            )
          : null,
      )
    }

    function SessionRunAction(props) {
      const t = useT(props)
      const sessionId = props.sessionId
      const [open, setOpen] = useState(false)
      const [loading, setLoading] = useState(false)
      const [catalog, setCatalog] = useState(null)
      const [menuCwd, setMenuCwd] = useState('')
      const [error, setError] = useState('')
      const [busyId, setBusyId] = useState('')
      const [deviceFor, setDeviceFor] = useState(null)
      const [deviceState, setDeviceState] = useState(null)
      const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())
      const [query, setQuery] = useState('')
      const [kindFilter, setKindFilter] = useState('all')
      const [cursor, setCursor] = useState(0)
      const [runs, setRuns] = useState([])
      const [hasMore, setHasMore] = useState(false)
      const [flash, setFlash] = useState(false)
      const buttonRef = useRef(null)
      const searchRef = useRef(null)
      const bodyRef = useRef(null)
      const deviceBackRef = useRef(null)
      const focusSearchPending = useRef(false)
      const flashTimer = useRef(null)
      const loadSeq = useRef(0)
      const busyRef = useRef(false)

      const launches = useMemo(() => catalog?.launches ?? [], [catalog])
      const tasks = useMemo(() => catalog?.tasks ?? [], [catalog])
      const sources = useMemo(() => catalog?.sources ?? [], [catalog])

      const activeItemIds = useMemo(
        () =>
          new Set(
            runs
              .filter(
                (run) =>
                  run.status === 'preparing' || run.status === 'running' || run.status === 'stopping',
              )
              .map((run) => run.itemId),
          ),
        [runs],
      )

      const view = useMemo(() => {
        const q = query.trim()
        const matches = (item) => itemMatches(item, q)
        const buildGroups = (items) =>
          groupByProject(items.filter(matches)).map((group) => ({
            ...group,
            rows: [],
            collapsed: false,
          }))
        const launchGroups = kindFilter === 'task' ? [] : buildGroups(launches)
        const taskGroups = kindFilter === 'launch' ? [] : buildGroups(tasks)
        const flat = []
        const decorate = (groups, prefix) => {
          for (const group of groups) {
            const key = `${prefix}:${group.key}`
            const collapsed = q === '' && collapsedGroups.has(key)
            group.collapseKey = key
            group.collapsed = collapsed
            group.rows = group.items.map((item) => {
              if (collapsed) return { item, index: -1 }
              const index = flat.length
              flat.push(item)
              return { item, index }
            })
          }
        }
        decorate(launchGroups, 'launch')
        decorate(taskGroups, 'task')
        const launchCount = launchGroups.reduce((total, group) => total + group.items.length, 0)
        const taskCount = taskGroups.reduce((total, group) => total + group.items.length, 0)
        return {
          launchGroups,
          taskGroups,
          launchCount,
          taskCount,
          flat,
          matchCount: launchCount + taskCount,
          total: launches.length + tasks.length,
        }
      }, [launches, tasks, query, kindFilter, collapsedGroups])

      useEffect(
        () => () => {
          if (flashTimer.current !== null) clearTimeout(flashTimer.current)
        },
        [],
      )

      useEffect(() => {
        loadSeq.current += 1
        busyRef.current = false
        setOpen(false)
        setCatalog(null)
        setMenuCwd('')
        setDeviceFor(null)
        setDeviceState(null)
        setError('')
        setBusyId('')
        setLoading(false)
        setCollapsedGroups(new Set())
        setQuery('')
        setKindFilter('all')
        setCursor(0)
        setRuns([])
        setFlash(false)
      }, [sessionId])

      useEffect(() => {
        if (!open || menuCwd === '') return undefined
        let cancelled = false
        let timer = null
        const tick = async () => {
          try {
            const data = await api(`vscode-runner/runs?cwd=${encodeURIComponent(menuCwd)}`)
            if (!cancelled && Array.isArray(data?.runs)) setRuns(data.runs)
          } catch {
            // A transient read failure keeps the last known active state.
          }
          if (!cancelled) timer = setTimeout(tick, 1500)
        }
        void tick()
        return () => {
          cancelled = true
          if (timer !== null) clearTimeout(timer)
        }
      }, [open, menuCwd])

      useEffect(() => {
        setCursor(0)
      }, [query, kindFilter])

      useEffect(() => {
        if (!open) return
        if (deviceFor !== null) {
          deviceBackRef.current?.focus?.()
          return
        }
        if (focusSearchPending.current && catalog !== null) {
          searchRef.current?.focus?.()
          focusSearchPending.current = false
        }
      }, [open, deviceFor, catalog])

      useEffect(() => {
        setCursor((previous) => {
          if (view.flat.length === 0) return -1
          if (previous < 0 || previous >= view.flat.length) return 0
          return previous
        })
      }, [view.flat.length])

      useEffect(() => {
        if (!open) {
          setHasMore(false)
          return undefined
        }
        const frame = window.requestAnimationFrame(updateScrollFade)
        return () => window.cancelAnimationFrame(frame)
      }, [open, view.flat.length, query, kindFilter, deviceFor, loading, catalog])

      useEffect(() => {
        if (kindFilter === 'launch' && launches.length === 0) setKindFilter('all')
        if (kindFilter === 'task' && tasks.length === 0) setKindFilter('all')
      }, [kindFilter, launches.length, tasks.length])

      function close() {
        loadSeq.current += 1
        busyRef.current = false
        setOpen(false)
        setDeviceFor(null)
        setDeviceState(null)
        setError('')
        setLoading(false)
        setBusyId('')
        setQuery('')
        setKindFilter('all')
        setCursor(0)
      }

      async function load() {
        const seq = (loadSeq.current += 1)
        setLoading(true)
        setError('')
        setDeviceFor(null)
        setDeviceState(null)
        try {
          const data = await api(
            `vscode-runner/session-catalog?sessionId=${encodeURIComponent(sessionId || '')}`,
          )
          if (seq !== loadSeq.current) return
          setCatalog(data?.catalog ?? null)
          setMenuCwd(data?.cwd || '')
        } catch (cause) {
          if (seq !== loadSeq.current) return
          setCatalog(null)
          setError(cause.message)
        } finally {
          if (seq === loadSeq.current) setLoading(false)
        }
      }

      function openDialog() {
        focusSearchPending.current = true
        setOpen(true)
        setQuery('')
        setKindFilter('all')
        setCursor(0)
        setRuns([])
        setError('')
        setDeviceFor(null)
        setDeviceState(null)
        setCollapsedGroups(new Set())
        void load()
      }

      function toggle(event) {
        event.preventDefault()
        event.stopPropagation()
        if (open) close()
        else openDialog()
      }

      function markStarted() {
        setFlash(true)
        if (flashTimer.current !== null) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => {
          setFlash(false)
          flashTimer.current = null
        }, 2500)
      }

      async function doStart(item, deviceId) {
        if (busyRef.current) return
        busyRef.current = true
        setBusyId(item.id)
        setError('')
        try {
          const body = { cwd: menuCwd, id: item.id }
          if (deviceId !== undefined && deviceId !== '') body.deviceId = deviceId
          await api('vscode-runner/start', { method: 'POST', body: JSON.stringify(body) })
          close()
          markStarted()
        } catch (cause) {
          busyRef.current = false
          setBusyId('')
          if (cause.code === 'device-required') {
            await openDevices(item)
          } else if (cause.code === 'unknown-item') {
            setError(t('unknownItem'))
          } else {
            setError(cause.message)
          }
        } finally {
          busyRef.current = false
          setBusyId('')
        }
      }

      async function openDevices(item) {
        setDeviceFor(item)
        setDeviceState({ loading: true, devices: [], error: '' })
        setError('')
        try {
          const data = await api(`vscode-runner/devices?cwd=${encodeURIComponent(menuCwd)}`)
          const devices = Array.isArray(data?.devices) ? data.devices : []
          if (data?.error) {
            setDeviceState({ loading: false, devices: [], error: data.error })
            return
          }
          if (devices.length === 1) {
            setDeviceFor(null)
            setDeviceState(null)
            await doStart(item, devices[0].id)
            return
          }
          setDeviceState({ loading: false, devices, error: '' })
        } catch (cause) {
          setDeviceState({ loading: false, devices: [], error: cause.message })
        }
      }

      function pick(item) {
        if (busyId !== '') return
        if (item.runnable === false) {
          setError(item.reason || t('unsupported'))
          return
        }
        if (activeItemIds.has(item.id)) {
          openPanel()
          return
        }
        if (item.needsDevice && !item.deviceId) {
          void openDevices(item)
          return
        }
        void doStart(item)
      }

      function openPanel() {
        close()
        openFullPanel()
      }

      function toggleGroup(group) {
        setCollapsedGroups((previous) => {
          const next = new Set(previous)
          if (next.has(group.collapseKey)) next.delete(group.collapseKey)
          else next.add(group.collapseKey)
          return next
        })
      }

      function updateScrollFade() {
        const element = bodyRef.current
        if (element === null) {
          setHasMore(false)
          return
        }
        const next = element.scrollHeight - element.scrollTop - element.clientHeight > 10
        setHasMore((previous) => (previous === next ? previous : next))
      }

      function scrollToIndex(index) {
        const node = bodyRef.current?.querySelector(`[data-vsc-row-index="${index}"]`)
        if (node !== null && typeof node?.scrollIntoView === 'function') {
          node.scrollIntoView({ block: 'nearest' })
        }
      }

      function moveCursor(delta) {
        if (view.flat.length === 0) return
        let next = cursor
        for (let step = 0; step < view.flat.length; step += 1) {
          if (next < 0) next = delta > 0 ? 0 : view.flat.length - 1
          else next = (next + delta + view.flat.length) % view.flat.length
          if (view.flat[next].runnable !== false) break
        }
        setCursor(next)
        window.requestAnimationFrame(() => scrollToIndex(next))
      }

      function runCursor() {
        if (cursor < 0 || cursor >= view.flat.length) return
        const item = view.flat[cursor]
        if (item.runnable === false) return
        pick(item)
      }

      function onDialogKeyDown(event) {
        if (event.defaultPrevented || event.nativeEvent?.isComposing) return
        if (deviceFor !== null) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          moveCursor(event.key === 'ArrowDown' ? 1 : -1)
          return
        }
        if (event.key === 'Enter' && event.target?.tagName === 'INPUT') {
          event.preventDefault()
          runCursor()
        }
      }

      const workspaceLabel =
        sources.find((source) => source.kind === 'workspace')?.label ||
        baseName(menuCwd) ||
        menuCwd
      const hasConfigs = view.total > 0
      const activeCount = activeItemIds.size
      const summary =
        loading && catalog === null
          ? t('loadingConfigs')
          : error !== '' && catalog === null
            ? t('error')
            : hasConfigs
              ? t('sessionSummary', { launches: launches.length, tasks: tasks.length })
              : t('menuEmpty')
      const tabs =
        launches.length > 0 && tasks.length > 0
          ? [
              { id: 'all', label: t('filterAll'), count: launches.length + tasks.length },
              { id: 'launch', label: t('filterLaunch'), count: launches.length },
              { id: 'task', label: t('filterTask'), count: tasks.length },
            ]
          : []
      const title = flash ? t('sessionStarted') : t('sessionAction')

      let body = null
      if (deviceFor !== null && deviceState !== null) {
        body = h(DialogDeviceView, {
          item: deviceFor,
          state: deviceState,
          t,
          onBack: () => {
            focusSearchPending.current = true
            setDeviceFor(null)
            setDeviceState(null)
          },
          onPick: (device) => {
            const current = deviceFor
            setDeviceFor(null)
            setDeviceState(null)
            void doStart(current, device.id)
          },
          onRetry: () => {
            if (deviceFor !== null) void openDevices(deviceFor)
          },
          backRef: deviceBackRef,
        })
      } else if (loading && catalog === null) {
        body = h(DialogSkeleton)
      } else if (error !== '' && catalog === null) {
        body = h(DialogEmpty, {
          icon: 'warning',
          tone: 'error',
          title: t('error'),
          body: error,
          action: t('retry'),
          onAction: () => {
            void load()
          },
        })
      } else if (!hasConfigs) {
        body = h(DialogEmpty, {
          icon: 'terminal',
          title: t('menuEmpty'),
          body: t('menuEmptyBody'),
        })
      } else if (view.matchCount === 0) {
        body = h(DialogEmpty, {
          icon: 'search',
          title: t('noMatches'),
          body: t('noMatchesBody'),
          action: t('clearFilter'),
          onAction: () => {
            setQuery('')
            setKindFilter('all')
            searchRef.current?.focus?.()
          },
        })
      } else {
        body = h(
          React.Fragment,
          null,
          error !== ''
            ? h(
                'div',
                { className: 'vsc-run-dialog-error', role: 'alert' },
                h(Glyph, { name: 'warning', size: 14 }),
                h('span', { className: 'vsc-run-dialog-error-text' }, error),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'vsc-run-dialog-error-retry',
                    onClick: () => setError(''),
                  },
                  t('dismiss'),
                ),
              )
            : null,
          activeCount > 0
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'vsc-run-active-strip',
                  title: t('activeRunsHint'),
                  onClick: openPanel,
                },
                h('span', { className: 'vsc-run-pulse' }),
                h('span', { className: 'vsc-run-active-text' }, t('activeRuns', { count: activeCount })),
                h(
                  'span',
                  { className: 'vsc-run-active-action' },
                  t('viewRun'),
                  h(Glyph, { name: 'arrow-right', size: 12 }),
                ),
              )
            : null,
          view.launchCount > 0
            ? h(
                DialogSection,
                { title: t('launchConfigs'), icon: 'play', count: view.launchCount },
                view.launchGroups.map((group) =>
                  h(DialogGroup, {
                    key: group.key,
                    group,
                    t,
                    root: menuCwd,
                    showHeader: view.launchGroups.length > 1,
                    collapsible: query.trim() === '',
                    activeItemIds,
                    busy: busyId,
                    cursor,
                    query,
                    onPick: pick,
                    onToggle: () => toggleGroup(group),
                  }),
                ),
              )
            : null,
          view.taskCount > 0
            ? h(
                DialogSection,
                { title: t('tasks'), icon: 'terminal', count: view.taskCount },
                view.taskGroups.map((group) =>
                  h(DialogGroup, {
                    key: group.key,
                    group,
                    t,
                    root: menuCwd,
                    showHeader: view.taskGroups.length > 1,
                    collapsible: query.trim() === '',
                    activeItemIds,
                    busy: busyId,
                    cursor,
                    query,
                    onPick: pick,
                    onToggle: () => toggleGroup(group),
                  }),
                ),
              )
            : null,
        )
      }

      const head = h(
        'div',
        { className: 'vsc-run-dialog-head' },
        h('span', { className: 'vsc-run-dialog-icon' }, h(Glyph, { name: 'play', size: 15 })),
        h(
          'div',
          { className: 'vsc-run-dialog-heading' },
          h('div', { className: 'vsc-run-dialog-title' }, t('sessionAction')),
          h(
            'div',
            { className: 'vsc-run-dialog-sub' },
            workspaceLabel !== ''
              ? h(
                  'span',
                  { className: 'vsc-run-dialog-workspace', title: menuCwd },
                  h(Glyph, { name: 'folder', size: 12 }),
                  h('span', { className: 'vsc-run-dialog-workspace-label' }, workspaceLabel),
                )
              : null,
            workspaceLabel !== '' ? h('span', { className: 'vsc-run-dialog-sep' }, '·') : null,
            h('span', { className: 'vsc-run-dialog-summary' }, summary),
          ),
        ),
        h(
          'div',
          { className: 'vsc-run-dialog-tools' },
          h(
            'button',
            {
              type: 'button',
              className: `vsc-run-icon-btn${loading ? ' is-busy' : ''}`,
              title: t('refresh'),
              'aria-label': t('refresh'),
              disabled: loading || busyId !== '',
              onClick: () => {
                void load()
              },
            },
            loading ? h(Spinner) : h(Glyph, { name: 'refresh', size: 15 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'vsc-run-icon-btn',
              title: t('dismiss'),
              'aria-label': t('dismiss'),
              onClick: close,
            },
            h(Glyph, { name: 'close', size: 15 }),
          ),
        ),
      )

      const toolbar =
        catalog !== null && hasConfigs && deviceFor === null
          ? h(
              'div',
              { className: 'vsc-run-dialog-toolbar' },
              h(
                'label',
                { className: 'vsc-run-search' },
                h('span', { className: 'vsc-run-search-icon' }, h(Glyph, { name: 'search', size: 14 })),
                h('input', {
                  ref: searchRef,
                  type: 'text',
                  value: query,
                  placeholder: t('searchPlaceholder'),
                  'aria-label': t('searchPlaceholder'),
                  'data-modal-autofocus': '',
                  autoComplete: 'off',
                  spellCheck: false,
                  onChange: (event) => setQuery(event.target.value),
                }),
                query !== ''
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'vsc-run-search-clear',
                        title: t('searchClear'),
                        'aria-label': t('searchClear'),
                        onClick: () => {
                          setQuery('')
                          searchRef.current?.focus?.()
                        },
                      },
                      h(Glyph, { name: 'close', size: 12 }),
                    )
                  : null,
              ),
              tabs.length > 0
                ? h(
                    'div',
                    { className: 'vsc-run-tabs', role: 'tablist' },
                    tabs.map((tab) =>
                      h(
                        'button',
                        {
                          key: tab.id,
                          type: 'button',
                          role: 'tab',
                          className: `vsc-run-tab${kindFilter === tab.id ? ' is-active' : ''}`,
                          'aria-selected': kindFilter === tab.id,
                          onClick: () => setKindFilter(tab.id),
                        },
                        h('span', null, tab.label),
                        h('span', { className: 'vsc-run-tab-count' }, String(tab.count)),
                      ),
                    ),
                  )
                : null,
            )
          : null

      const foot = h(
        'div',
        { className: 'vsc-run-dialog-foot' },
        h(
          'div',
          { className: 'vsc-run-foot-info' },
          h(
            'span',
            { className: 'vsc-run-foot-count' },
            loading && catalog === null
              ? t('loading')
              : catalog === null
                ? '—'
                : view.flat.length !== view.total
                  ? t('shownCount', { shown: view.flat.length, total: view.total })
                  : t('configCount', { count: view.total }),
          ),
        ),
        h(
          'div',
          { className: 'vsc-run-foot-actions' },
          deviceFor === null && view.flat.length > 0
            ? h('span', { className: 'vsc-run-hint', 'aria-hidden': true }, t('modalHint'))
            : null,
          h(
            'button',
            { type: 'button', className: 'vsc-run-open-panel', onClick: openPanel },
            h('span', null, t('openFullPanel')),
            h(Glyph, { name: 'arrow-right', size: 12 }),
          ),
        ),
      )

      return h(
        'div',
        { className: 'vsc-run-header-anchor' },
        h(
          'button',
          {
            ref: buttonRef,
            type: 'button',
            className: `vsc-run-header-action${flash ? ' is-flash' : ''}`,
            title,
            'aria-label': title,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: toggle,
          },
          h(HeaderRunIcon, { flash }),
        ),
        h(
          Modal,
          {
            open,
            title: t('sessionAction'),
            closeLabel: t('dismiss'),
            onClose: close,
            headless: true,
            className: 'vsc-run-modal',
            onKeyDownCapture: onDialogKeyDown,
          },
          h(
            'div',
            { className: 'vsc-run-dialog' },
            head,
            toolbar,
            h(
              'div',
              { className: 'vsc-run-body-wrap' },
              h(
                'div',
                { className: 'vsc-run-dialog-body', ref: bodyRef, onScroll: updateScrollFade },
                body,
              ),
              h('div', {
                className: `vsc-run-body-fade${hasMore ? ' is-visible' : ''}`,
                'aria-hidden': true,
              }),
            ),
            foot,
          ),
        ),
      )
    }

    // -----------------------------------------------------------------------
    // Styles
    // -----------------------------------------------------------------------

    const CSS = `
.vsc-run-page{box-sizing:border-box;height:100%;min-height:100%;width:100%;padding:calc(var(--dsh-frame-top-clearance,0px) + 28px) 32px 56px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:inherit;font-size:13px;line-height:1.5;overflow:auto;overscroll-behavior:contain}
.vsc-run-wrap{box-sizing:border-box;width:100%;max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.vsc-run-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap}
.vsc-run-heading{display:flex;flex-direction:column;gap:4px;min-width:240px}
.vsc-run-title{margin:0;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-.01em}
.vsc-run-subtitle{margin:0;max-width:620px;color:var(--dsw-alias-label-secondary);font-size:12px}
.vsc-run-toolbar{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}
.vsc-run-field{display:flex;flex-direction:column;gap:4px}
.vsc-run-field-label{color:var(--dsw-alias-label-secondary);font-size:11px}
.vsc-run-select{box-sizing:border-box;min-width:200px;max-width:320px;height:30px;padding:0 28px 0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.vsc-run-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.vsc-run-btn{box-sizing:border-box;height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:5px;transition:background .12s ease,border-color .12s ease}
.vsc-run-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.vsc-run-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.vsc-run-btn:disabled{opacity:.45;cursor:default}
.vsc-run-btn.is-primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:500}
.vsc-run-btn.is-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.88}
.vsc-run-btn.is-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary);padding:0 7px}
.vsc-run-btn.is-ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.vsc-run-error{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-error-primary);font-size:12px}
.vsc-run-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:-6px}
.vsc-run-meta-sep{opacity:.5}
.vsc-run-warnings{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:8px 12px;color:var(--dsw-alias-label-secondary);font-size:11px}
.vsc-run-warnings summary{cursor:pointer;color:var(--dsw-alias-state-warn-primary)}
.vsc-run-warnings ul{margin:6px 0 0;padding-left:18px}
.vsc-run-loading{padding:28px 0;text-align:center;color:var(--dsw-alias-label-secondary)}
.vsc-run-empty{padding:40px 24px;border:1px dashed var(--dsw-alias-border-l1);border-radius:10px;text-align:center;background:var(--dsw-alias-bg-layer-1)}
.vsc-run-empty-title{font-size:14px;font-weight:600;margin-bottom:6px}
.vsc-run-empty-body{color:var(--dsw-alias-label-secondary);font-size:12px;max-width:600px;margin:0 auto}
.vsc-run-section{display:flex;flex-direction:column;gap:10px}
.vsc-run-section-head{display:flex;align-items:center;gap:8px;padding-bottom:2px}
.vsc-run-section-title{margin:0;font-size:13px;font-weight:600;letter-spacing:.01em}
.vsc-run-count{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;text-align:center}
.vsc-run-group{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.vsc-run-group-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.vsc-run-group-label{display:inline-flex;align-items:center;gap:6px;min-width:0}
.vsc-run-group-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vsc-run-source-path{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52%}
.vsc-run-items{display:flex;flex-direction:column}
.vsc-run-item{border-bottom:1px solid var(--dsw-alias-border-l1)}
.vsc-run-item:last-child{border-bottom:0}
.vsc-run-item.is-disabled{opacity:.72}
.vsc-run-item-row{display:flex;align-items:center;gap:14px;padding:10px 12px}
.vsc-run-item-body{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.vsc-run-item-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.vsc-run-name{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:18px;white-space:nowrap;border:1px solid transparent}
.vsc-run-badge.is-accent{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.vsc-run-badge.is-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.vsc-run-badge.is-error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.vsc-run-badge.is-muted{background:transparent;border-color:var(--dsw-alias-border-l1);font-size:10px}
.vsc-run-cmd{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
.vsc-run-note{color:var(--dsw-alias-label-secondary);font-size:11px}
.vsc-run-reason{color:var(--dsw-alias-state-error-primary);font-size:11px}
.vsc-run-item-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.vsc-run-pending{color:var(--dsw-alias-label-secondary);font-size:11px}
.vsc-run-device{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border-top:1px dashed var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.vsc-run-device-title{color:var(--dsw-alias-label-secondary);font-size:11px}
.vsc-run-device-list{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.vsc-run-runs{display:flex;flex-direction:column;gap:8px}
.vsc-run-runs-empty{padding:6px 0 2px}
.vsc-run-run{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.vsc-run-run-head{display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:34px;flex-wrap:wrap}
.vsc-run-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.vsc-run-dot.is-success{background:var(--dsw-alias-state-success-primary)}
.vsc-run-dot.is-error{background:var(--dsw-alias-state-error-primary)}
.vsc-run-dot.is-warn{background:var(--dsw-alias-state-warn-primary)}
.vsc-run-run-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
.vsc-run-status{font-size:11px;color:var(--dsw-alias-label-secondary)}
.vsc-run-status.is-success{color:var(--dsw-alias-state-success-primary)}
.vsc-run-status.is-error{color:var(--dsw-alias-state-error-primary)}
.vsc-run-status.is-warn{color:var(--dsw-alias-state-warn-primary)}
.vsc-run-phase{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.vsc-run-spacer{flex:1}
.vsc-run-time{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.vsc-run-log-wrap{border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column}
.vsc-run-log{margin:0;padding:10px 12px;max-height:300px;overflow:auto;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.vsc-run-input{display:flex;gap:8px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.vsc-run-input input{box-sizing:border-box;flex:1;min-width:0;height:30px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.vsc-run-input input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.vsc-run-disclaimer{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px}
@media (max-width:720px){.vsc-run-page{padding:calc(var(--dsh-frame-top-clearance,0px) + 18px) 16px 40px}.vsc-run-header{flex-direction:column;gap:12px}.vsc-run-toolbar{width:100%}.vsc-run-select{max-width:none;flex:1}.vsc-run-item-row{align-items:flex-start;flex-direction:column}.vsc-run-item-actions{width:100%;justify-content:flex-end}.vsc-run-source-path{display:none}.vsc-run-run-name{max-width:160px}.vsc-run-phase{max-width:140px}}
.vsc-run-header-anchor{position:relative;display:inline-flex;align-items:center}
.vsc-run-header-action{box-sizing:border-box;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .12s ease,color .12s ease}
.vsc-run-header-action:hover,.vsc-run-header-action:focus-visible{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.vsc-run-header-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.vsc-run-header-action.is-flash{color:var(--dsw-alias-state-success-primary)}
.vsc-run-modal.vsc-run-modal{box-sizing:border-box;width:min(752px,100%);max-height:min(760px,100%);padding:0;gap:0;overflow:hidden;border-radius:var(--dsw-radius-panel,14px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.vsc-run-dialog{display:flex;flex-direction:column;width:100%;min-height:0;max-height:100%;flex:1 1 auto}
.vsc-run-dialog-head{display:flex;align-items:flex-start;gap:12px;flex:none;padding:18px 20px 14px}
.vsc-run-dialog-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;margin-top:1px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-brand-primary)}
.vsc-run-dialog-heading{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.vsc-run-dialog-title{font-size:16px;line-height:23px;font-weight:600;letter-spacing:.01em}
.vsc-run-dialog-sub{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.vsc-run-dialog-workspace{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:340px;padding:1px 7px 1px 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.vsc-run-dialog-workspace-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-dialog-sep{color:var(--dsw-alias-label-tertiary);opacity:.7}
.vsc-run-dialog-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-dialog-tools{display:flex;align-items:center;gap:4px;flex:none;margin:-2px -6px 0 0}
.vsc-run-icon-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s ease,color .12s ease}
.vsc-run-icon-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.vsc-run-icon-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.vsc-run-icon-btn:disabled{opacity:.45;cursor:default}
.vsc-run-icon-btn.is-busy{color:var(--dsw-alias-brand-primary)}
.vsc-run-dialog-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:none;padding:0 20px 12px}
.vsc-run-search{box-sizing:border-box;display:flex;align-items:center;gap:7px;flex:1 1 240px;min-width:200px;height:34px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);transition:border-color .12s ease,box-shadow .12s ease}
.vsc-run-search:focus-within{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 20%,transparent)}
.vsc-run-search-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-tertiary)}
.vsc-run-search input{box-sizing:border-box;flex:1;min-width:0;height:100%;padding:0;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px}
.vsc-run-search input::placeholder{color:var(--dsw-alias-label-tertiary)}
.vsc-run-search-clear{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.vsc-run-search-clear:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}
.vsc-run-search-clear:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.vsc-run-tabs{display:inline-flex;align-items:center;gap:2px;flex:none;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.vsc-run-tab{box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:background .12s ease,color .12s ease}
.vsc-run-tab:hover{color:var(--dsw-alias-label-primary)}
.vsc-run-tab:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.vsc-run-tab.is-active{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.vsc-run-tab-count{font-size:10.5px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.vsc-run-tab.is-active .vsc-run-tab-count{color:var(--dsw-alias-label-secondary)}
.vsc-run-body-wrap{position:relative;display:flex;flex:1 1 auto;min-height:0}
.vsc-run-dialog-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 10px 10px}
.vsc-run-body-fade{position:absolute;left:1px;right:1px;bottom:0;height:26px;pointer-events:none;background:linear-gradient(to bottom,transparent,var(--dsw-alias-bg-layer-2));opacity:0;transition:opacity .12s ease;border-radius:0 0 6px 6px}
.vsc-run-body-fade.is-visible{opacity:1}
.vsc-run-dialog-error{display:flex;align-items:flex-start;gap:8px;flex:none;margin:2px 2px 8px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;word-break:break-word}
.vsc-run-dialog-error > svg{margin-top:1px}
.vsc-run-dialog-error-text{flex:1;min-width:0}
.vsc-run-dialog-error-retry{flex:none;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:600;line-height:18px;cursor:pointer;text-decoration:underline}
.vsc-run-active-strip{box-sizing:border-box;display:flex;align-items:center;gap:8px;flex:none;width:100%;margin:2px 2px 8px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 36%,transparent);border-radius:8px;background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer;transition:background .12s ease}
.vsc-run-active-strip:hover{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,var(--dsw-alias-bg-layer-2))}
.vsc-run-active-strip:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.vsc-run-active-text{flex:1;min-width:0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-active-action{display:inline-flex;align-items:center;gap:4px;flex:none;color:var(--dsw-alias-state-success-primary);font-size:11.5px;font-weight:500}
.vsc-run-sec{display:flex;flex-direction:column;gap:2px;padding:2px 0 6px}
.vsc-run-sec + .vsc-run-sec{margin-top:4px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}
.vsc-run-sec-head{display:flex;align-items:center;gap:6px;padding:6px 8px 4px}
.vsc-run-sec-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-tertiary)}
.vsc-run-sec-title{font-size:11px;line-height:16px;font-weight:600;letter-spacing:.03em;color:var(--dsw-alias-label-secondary)}
.vsc-run-sec-count{min-width:17px;height:17px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:17px;text-align:center;font-variant-numeric:tabular-nums}
.vsc-run-dgroup{display:flex;flex-direction:column;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.vsc-run-dgroup + .vsc-run-dgroup{margin-top:6px}
.vsc-run-dgroup-head{box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;gap:6px;width:100%;padding:5px 10px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);border-radius:0;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:17px;text-align:left;cursor:pointer}
.vsc-run-dgroup-head:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}
.vsc-run-dgroup-head:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.vsc-run-dgroup-head.is-static{cursor:default}
.vsc-run-dgroup-head.is-static:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.vsc-run-dgroup-chevron{display:inline-flex;align-items:center;justify-content:center;flex:none;width:14px;height:14px;color:var(--dsw-alias-label-tertiary);transition:transform .12s ease}
.vsc-run-dgroup.is-collapsed .vsc-run-dgroup-chevron{transform:rotate(-90deg)}
.vsc-run-dgroup.is-collapsed .vsc-run-dgroup-head{border-bottom-color:transparent}
.vsc-run-dgroup-name{flex:none;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.vsc-run-dgroup-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10.5px}
.vsc-run-dgroup-count{flex:none;min-width:0;height:auto;margin-left:auto;padding:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:17px;font-variant-numeric:tabular-nums}
.vsc-run-dgroup-list{display:flex;flex-direction:column;gap:2px;padding:2px}
.vsc-run-row{box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;transition:background .12s ease,border-color .12s ease}
.vsc-run-row:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}
.vsc-run-row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.vsc-run-row.is-cursor{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.vsc-run-row.is-active{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 7%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 34%,transparent)}
.vsc-run-row.is-active:hover{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 11%,transparent)}
.vsc-run-row.is-disabled{opacity:.55;cursor:default}
.vsc-run-row.is-pending{opacity:.82}
.vsc-run-row-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);transition:background .12s ease,color .12s ease,border-color .12s ease}
.vsc-run-row:hover .vsc-run-row-icon{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.vsc-run-row-icon.is-task{color:var(--dsw-alias-label-tertiary)}
.vsc-run-row-icon.is-blocked{color:var(--dsw-alias-state-error-primary)}
.vsc-run-row.is-active .vsc-run-row-icon{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 34%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary)}
.vsc-run-row-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.vsc-run-row-title{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.vsc-run-row-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:19px;font-weight:500}
.vsc-run-chip{display:inline-flex;align-items:center;flex:none;height:17px;padding:0 5px;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:17px;font-weight:500;white-space:nowrap}
.vsc-run-chip.is-accent{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent);background:transparent;color:var(--dsw-alias-brand-primary)}
.vsc-run-chip.is-warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 45%,transparent);background:transparent;color:var(--dsw-alias-state-warn-primary)}
.vsc-run-chip.is-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);background:transparent;color:var(--dsw-alias-state-error-primary)}
.vsc-run-row-sub{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:17px;white-space:nowrap}
.vsc-run-row-sub.is-error{color:var(--dsw-alias-state-error-primary)}
.vsc-run-row-project{flex:none;max-width:36%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary)}
.vsc-run-row-sep{flex:none;color:var(--dsw-alias-label-tertiary);opacity:.7}
.vsc-run-row-cmd{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
.vsc-run-row-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-row-tail{display:flex;align-items:center;gap:8px;flex:none}
.vsc-run-type{display:inline-flex;align-items:center;flex:none;height:18px;padding:0 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:18px;font-weight:500;letter-spacing:.02em;white-space:nowrap}
.vsc-run-type.is-task{color:var(--dsw-alias-label-secondary)}
.vsc-run-row-play{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);transition:background .12s ease,color .12s ease,border-color .12s ease}
.vsc-run-row.is-cursor .vsc-run-row-play{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.vsc-run-row:hover:not(:disabled) .vsc-run-row-play,.vsc-run-row:focus-visible .vsc-run-row-play{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-brand-primary)}
.vsc-run-running{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-state-success-primary);font-size:11px;line-height:17px;font-weight:500;white-space:nowrap}
.vsc-run-running.is-pending{color:var(--dsw-alias-brand-primary)}
.vsc-run-pulse{display:inline-block;flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent);animation:vsc-run-pulse 1.8s ease-out infinite}
@keyframes vsc-run-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent)}70%{box-shadow:0 0 0 5px color-mix(in srgb,var(--dsw-alias-state-success-primary) 0%,transparent)}100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-success-primary) 0%,transparent)}}
.vsc-run-row-arrow{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
.vsc-run-spinner{display:inline-block;flex:none;width:12px;height:12px;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:vsc-run-spin .7s linear infinite}
@keyframes vsc-run-spin{to{transform:rotate(360deg)}}
.vsc-run-mark{padding:0 1px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);color:inherit}
.vsc-run-device-view{display:flex;flex-direction:column;gap:10px;padding:4px 8px 8px;min-height:0}
.vsc-run-back{box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;align-self:flex-start;height:26px;padding:0 8px 0 5px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.vsc-run-back:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.vsc-run-back:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.vsc-run-back-chevron{display:inline-flex;transform:rotate(90deg)}
.vsc-run-device-head{display:flex;flex-direction:column;gap:2px;padding:2px 4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:2px;min-width:0}
.vsc-run-device-head-title{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}
.vsc-run-device-item-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.vsc-run-device-hint{color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:17px}
.vsc-run-device-status{display:flex;align-items:center;gap:8px;padding:16px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.vsc-run-device-error-box{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;word-break:break-word}
.vsc-run-device-retry{align-self:flex-start;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:underline}
.vsc-run-device-empty{padding:20px 10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;text-align:center}
.vsc-run-device-options{display:flex;flex-direction:column;gap:6px}
.vsc-run-device-card{box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;transition:background .12s ease,border-color .12s ease}
.vsc-run-device-card:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.vsc-run-device-card:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.vsc-run-device-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.vsc-run-device-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.vsc-run-device-card-name{font-size:13px;line-height:19px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-device-card-meta{color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:17px}
.vsc-run-device-pick{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-tertiary)}
.vsc-run-skeleton{display:flex;flex-direction:column;gap:2px;padding:4px 2px}
.vsc-run-skeleton-row{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px}
.vsc-run-skeleton-icon{display:inline-block;flex:none;width:30px;height:30px;border-radius:8px;background:var(--dsw-alias-bg-layer-3);animation:vsc-run-shimmer 1.6s ease-in-out infinite}
.vsc-run-skeleton-lines{display:flex;flex-direction:column;gap:7px;flex:1;min-width:0}
.vsc-run-skeleton-line{display:block;height:9px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);animation:vsc-run-shimmer 1.6s ease-in-out infinite}
.vsc-run-skeleton-line.is-short{height:8px;opacity:.72}
@keyframes vsc-run-shimmer{0%,100%{opacity:.5}50%{opacity:1}}
.vsc-run-dialog-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:220px;padding:42px 24px;text-align:center}
.vsc-run-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;margin-bottom:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.vsc-run-empty-icon.is-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);color:var(--dsw-alias-state-error-primary)}
.vsc-run-dialog-empty-title{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}
.vsc-run-dialog-empty-body{max-width:440px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.vsc-run-dialog-empty-action{box-sizing:border-box;height:28px;margin-top:8px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.vsc-run-dialog-empty-action:hover{background:var(--dsw-alias-bg-layer-2)}
.vsc-run-dialog-empty-action:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.vsc-run-dialog-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;padding:10px 20px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.vsc-run-foot-info{min-width:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:17px}
.vsc-run-foot-count{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsc-run-foot-actions{display:flex;align-items:center;gap:10px;flex:none}
.vsc-run-hint{color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:17px;white-space:nowrap}
.vsc-run-open-panel{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;white-space:nowrap;cursor:pointer;transition:background .12s ease,border-color .12s ease}
.vsc-run-open-panel:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.vsc-run-open-panel:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
@media (max-width:640px){.vsc-run-modal.vsc-run-modal{width:100%;max-height:100%;border-radius:14px}.vsc-run-dialog-head{padding:14px 16px 10px}.vsc-run-dialog-icon{width:30px;height:30px;border-radius:9px}.vsc-run-dialog-title{font-size:15px;line-height:22px}.vsc-run-dialog-workspace{max-width:200px}.vsc-run-dialog-toolbar{padding:0 16px 10px}.vsc-run-search{flex:1 1 100%;min-width:0}.vsc-run-tabs{width:100%}.vsc-run-tab{flex:1;justify-content:center}.vsc-run-dialog-body{padding:0 8px 8px}.vsc-run-dialog-foot{padding:8px 14px}.vsc-run-hint{display:none}.vsc-run-dgroup-path{display:none}.vsc-run-type{display:none}.vsc-run-dialog-empty{min-height:180px;padding:32px 12px}.vsc-run-row{gap:8px;padding:8px}.vsc-run-row-project{max-width:48%}}
@media (max-height:560px){.vsc-run-dialog-head{padding:12px 18px 10px}.vsc-run-dialog-empty{min-height:150px;padding:24px 16px}.vsc-run-dialog-body{padding-bottom:6px}}
@media (prefers-reduced-motion:reduce){.vsc-run-pulse,.vsc-run-skeleton-line,.vsc-run-skeleton-icon{animation:none}.vsc-run-spinner{animation:none}.vsc-run-row,.vsc-run-row-icon,.vsc-run-row-play,.vsc-run-icon-btn,.vsc-run-search,.vsc-run-tab,.vsc-run-search-clear,.vsc-run-body-fade{transition:none}}

`

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'vscode-runner: dictionaries')
        ctx.effect(() => {
          for (const node of document.querySelectorAll('style[data-vscode-runner]')) node.remove()
          const style = document.createElement('style')
          style.setAttribute('data-vscode-runner', 'styles')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'vscode-runner: styles')
        translate = ctx.locale.bind(NS)
        const layout = ctx.get('layout')
        openFullPanel = () => {
          try {
            layout?.selectPanel(PANEL_ID)
          } catch {
            // The panel is normally registered; a missing one is a no-op.
          }
        }

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              label: () => translate('title'),
            },
            PanelIcon,
          ),
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
            },
            RunnerPage,
          ),
        )

        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.actions',
              id: 'vscode-runner',
              order: 30,
              locale: NS,
              label: () => translate('sessionAction'),
            },
            SessionRunAction,
          ),
        )
      },
    }
  },
})
