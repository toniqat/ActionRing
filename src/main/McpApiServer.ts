import { createServer, IncomingMessage, ServerResponse } from 'http'
import type { Server } from 'http'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ConfigStore } from './ConfigStore'
import type { ActionExecutor } from './ActionExecutor'
import type { WindowManager } from './WindowManager'
import type { ActionConfig, ShortcutEntry, ShortcutGroup } from '@shared/config.types'
import { IPC_CONFIG_UPDATED } from '@shared/ipc.types'

/**
 * Local HTTP API server that exposes ActionRing internals for the MCP stdio server to consume.
 * Listens on a random port on 127.0.0.1 only (never exposed to network).
 * Writes its port number to <userData>/.mcp-port so the MCP server can discover it.
 */
/** MCP tool names exposed by the stdio server. */
const MCP_TOOL_NAMES = [
  'get_status', 'toggle_enabled',
  'get_config', 'save_config', 'reset_config',
  'list_shortcuts', 'get_shortcut', 'create_shortcut', 'update_shortcut', 'delete_shortcut',
  'execute_shortcut',
  'list_shortcut_groups', 'create_shortcut_group', 'delete_shortcut_group',
  'list_apps', 'add_app', 'remove_app',
  'list_profiles', 'add_profile', 'remove_profile', 'rename_profile', 'set_active_profile',
  'get_slots', 'update_slots',
  'execute_actions', 'get_action_types',
]

export interface McpStatusInfo {
  running: boolean
  port: number | null
  requestCount: number
  lastRequestAt: number | null   // epoch ms, null if no requests yet
  lastHeartbeat: number | null   // epoch ms of last /ping from MCP stdio client
  tools: string[]
}

export class McpApiServer {
  private server: Server | null = null
  private portFilePath: string
  private requestCount = 0
  private lastRequestAt: number | null = null
  private lastHeartbeat: number | null = null

  constructor(
    private configStore: ConfigStore,
    private actionExecutor: ActionExecutor,
    private windowManager: WindowManager,
  ) {
    this.portFilePath = join(app.getPath('userData'), '.mcp-port')
  }

  /** Returns current MCP server status info for the Settings UI. */
  getInfo(): McpStatusInfo {
    const addr = this.server?.address() as { port: number } | null
    return {
      running: this.server !== null,
      port: addr?.port ?? null,
      requestCount: this.requestCount,
      lastRequestAt: this.lastRequestAt,
      lastHeartbeat: this.lastHeartbeat,
      tools: MCP_TOOL_NAMES,
    }
  }

  async start(): Promise<number> {
    if (this.server) return (this.server.address() as any).port

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => this.handleRequest(req, res))
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any
        const port = addr.port as number
        console.log(`[MCP API] Listening on 127.0.0.1:${port}`)
        writeFileSync(this.portFilePath, String(port), 'utf-8')
        this.server = server
        resolve(port)
      })
      server.on('error', reject)
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
      try { unlinkSync(this.portFilePath) } catch { /* ignore */ }
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const path = url.pathname
    const method = req.method ?? 'GET'

    // Only allow requests from localhost
    const remoteAddr = req.socket.remoteAddress
    if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && remoteAddr !== '::ffff:127.0.0.1') {
      this.json(res, 403, { error: 'Forbidden' })
      return
    }

    // ── Heartbeat (lightweight, not counted as a real request) ────────────
    if (method === 'POST' && path === '/ping') {
      this.lastHeartbeat = Date.now()
      return this.json(res, 200, { pong: true })
    }

    // Track request metrics
    this.requestCount++
    this.lastRequestAt = Date.now()

    try {
      const body = method !== 'GET' ? await this.readBody(req) : null

      // ── Status ──────────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/status') {
        const config = this.configStore.get()
        return this.json(res, 200, {
          enabled: config.enabled,
          version: config.version,
          trigger: config.trigger,
          theme: config.theme,
          language: config.language,
        })
      }

      // ── Config ──────────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/config') {
        return this.json(res, 200, this.configStore.get())
      }

      if (method === 'PUT' && path === '/config') {
        this.configStore.save(body)
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      if (method === 'POST' && path === '/config/reset') {
        const newConfig = this.configStore.reset()
        this.pushConfigUpdate()
        return this.json(res, 200, newConfig)
      }

      // ── Shortcuts Library ──────────────────────────────────────────────────
      if (method === 'GET' && path === '/shortcuts') {
        const config = this.configStore.get()
        return this.json(res, 200, config.shortcutsLibrary ?? [])
      }

      if (method === 'GET' && path.startsWith('/shortcuts/') && !path.includes('/execute')) {
        const id = path.split('/')[2]
        const config = this.configStore.get()
        const entry = (config.shortcutsLibrary ?? []).find((e) => e.id === id)
        if (!entry) return this.json(res, 404, { error: 'Shortcut not found' })
        return this.json(res, 200, entry)
      }

      if (method === 'POST' && path === '/shortcuts') {
        const config = this.configStore.get()
        const library = config.shortcutsLibrary ?? []
        const id = this.generateId()
        const entry: ShortcutEntry = {
          id,
          name: body.name ?? 'Untitled',
          actions: body.actions ?? [],
          isFavorite: body.isFavorite ?? false,
          createdAt: Date.now(),
          icon: body.icon,
          iconIsCustom: body.iconIsCustom ?? false,
          bgColor: body.bgColor,
          groupId: body.groupId,
        }
        this.configStore.save({ ...config, shortcutsLibrary: [...library, entry] })
        this.pushConfigUpdate()
        return this.json(res, 201, entry)
      }

      if (method === 'PUT' && path.startsWith('/shortcuts/') && !path.includes('/execute')) {
        const id = path.split('/')[2]
        this.configStore.updateLibraryEntry(
          id,
          body.actions,
          body.name,
          body.icon,
          body.iconIsCustom,
          body.bgColor,
        )
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      if (method === 'DELETE' && path.startsWith('/shortcuts/')) {
        const id = path.split('/')[2]
        this.configStore.deleteLibraryEntry(id)
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      if (method === 'POST' && path.match(/^\/shortcuts\/[^/]+\/execute$/)) {
        const id = path.split('/')[2]
        const config = this.configStore.get()
        const entry = (config.shortcutsLibrary ?? []).find((e) => e.id === id)
        if (!entry) return this.json(res, 404, { error: 'Shortcut not found' })
        const results = await this.actionExecutor.executeAll(entry.actions)
        return this.json(res, 200, results)
      }

      // ── Shortcut Groups ───────────────────────────────────────────────────
      if (method === 'GET' && path === '/shortcut-groups') {
        const config = this.configStore.get()
        return this.json(res, 200, config.shortcutGroups ?? [])
      }

      if (method === 'POST' && path === '/shortcut-groups') {
        const config = this.configStore.get()
        const groups = config.shortcutGroups ?? []
        const group: ShortcutGroup = { id: this.generateId(), name: body.name ?? 'Untitled' }
        this.configStore.save({ ...config, shortcutGroups: [...groups, group] })
        this.pushConfigUpdate()
        return this.json(res, 201, group)
      }

      if (method === 'DELETE' && path.startsWith('/shortcut-groups/')) {
        const id = path.split('/')[2]
        const config = this.configStore.get()
        const groups = (config.shortcutGroups ?? []).filter((g) => g.id !== id)
        // Ungroup shortcuts that were in this group
        const library = (config.shortcutsLibrary ?? []).map((e) =>
          e.groupId === id ? { ...e, groupId: undefined } : e
        )
        this.configStore.save({ ...config, shortcutGroups: groups, shortcutsLibrary: library })
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      // ── Apps ───────────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/apps') {
        const config = this.configStore.get()
        return this.json(res, 200, config.apps)
      }

      if (method === 'POST' && path === '/apps') {
        const entry = this.configStore.addApp(body.exeName, body.displayName, body.iconDataUrl)
        this.pushConfigUpdate()
        return this.json(res, 201, entry)
      }

      if (method === 'DELETE' && path.startsWith('/apps/') && !path.includes('/profiles')) {
        const id = path.split('/')[2]
        this.configStore.removeApp(id)
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      // ── Profiles ──────────────────────────────────────────────────────────
      if (method === 'GET' && path.match(/^\/apps\/[^/]+\/profiles$/)) {
        const appId = path.split('/')[2]
        const appEntry = this.configStore.getAppById(appId)
        if (!appEntry) return this.json(res, 404, { error: 'App not found' })
        return this.json(res, 200, appEntry.profiles)
      }

      if (method === 'POST' && path.match(/^\/apps\/[^/]+\/profiles$/)) {
        const appId = path.split('/')[2]
        const profile = this.configStore.addProfileToApp(appId, body.name ?? 'New Profile')
        this.pushConfigUpdate()
        return this.json(res, 201, profile)
      }

      if (method === 'DELETE' && path.match(/^\/apps\/[^/]+\/profiles\/[^/]+$/)) {
        const parts = path.split('/')
        const appId = parts[2]
        const profileId = parts[4]
        this.configStore.removeProfileFromApp(appId, profileId)
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      if (method === 'PUT' && path.match(/^\/apps\/[^/]+\/profiles\/[^/]+\/rename$/)) {
        const parts = path.split('/')
        const appId = parts[2]
        const profileId = parts[4]
        this.configStore.renameProfileInApp(appId, profileId, body.name)
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      if (method === 'PUT' && path.match(/^\/apps\/[^/]+\/active-profile$/)) {
        const appId = path.split('/')[2]
        this.configStore.setActiveProfileForApp(appId, body.profileId)
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      // ── Slots ─────────────────────────────────────────────────────────────
      if (method === 'GET' && path.match(/^\/apps\/[^/]+\/profiles\/[^/]+\/slots$/)) {
        const parts = path.split('/')
        const appId = parts[2]
        const profileId = parts[4]
        const appEntry = this.configStore.getAppById(appId)
        if (!appEntry) return this.json(res, 404, { error: 'App not found' })
        const profile = appEntry.profiles.find((p) => p.id === profileId)
        if (!profile) return this.json(res, 404, { error: 'Profile not found' })
        return this.json(res, 200, profile.slots)
      }

      if (method === 'PUT' && path.match(/^\/apps\/[^/]+\/profiles\/[^/]+\/slots$/)) {
        const parts = path.split('/')
        const appId = parts[2]
        const profileId = parts[4]
        const config = this.configStore.get()
        const newApps = config.apps.map((a) => {
          if (a.id !== appId) return a
          return {
            ...a,
            profiles: a.profiles.map((p) => {
              if (p.id !== profileId) return p
              return { ...p, slots: body.slots }
            }),
          }
        })
        this.configStore.save({ ...config, apps: newApps })
        this.pushConfigUpdate()
        return this.json(res, 200, { ok: true })
      }

      // ── Actions ───────────────────────────────────────────────────────────
      if (method === 'POST' && path === '/actions/execute') {
        const actions: ActionConfig[] = body.actions ?? body
        const results = await this.actionExecutor.executeAll(actions)
        return this.json(res, 200, results)
      }

      // ── Action types schema ───────────────────────────────────────────────
      if (method === 'GET' && path === '/action-types') {
        return this.json(res, 200, ACTION_TYPE_SCHEMAS)
      }

      // ── Toggle enabled ────────────────────────────────────────────────────
      if (method === 'POST' && path === '/toggle-enabled') {
        this.configStore.toggleEnabled()
        this.pushConfigUpdate()
        return this.json(res, 200, { enabled: this.configStore.get().enabled })
      }

      this.json(res, 404, { error: 'Not found' })
    } catch (err: any) {
      console.error('[MCP API] Error:', err)
      this.json(res, 500, { error: err.message ?? 'Internal error' })
    }
  }

  private pushConfigUpdate(): void {
    const settingsWin = this.windowManager.getSettingsWindow()
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send(IPC_CONFIG_UPDATED, this.configStore.get())
    }
  }

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  private readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {})
        } catch (e) {
          reject(new Error('Invalid JSON body'))
        }
      })
      req.on('error', reject)
    })
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 10)
  }
}

/**
 * Schema descriptions for all action types — returned by GET /action-types.
 * This helps the AI understand what actions are available and how to construct them.
 */
const ACTION_TYPE_SCHEMAS = [
  {
    type: 'launch',
    description: 'Launch an application or file',
    fields: { target: 'string — path to executable or file' },
  },
  {
    type: 'keyboard',
    description: 'Send keyboard shortcut/keys',
    fields: { keys: 'string — e.g. "Ctrl+C", "Alt+Tab"' },
  },
  {
    type: 'shell',
    description: 'Execute a shell command',
    fields: { command: 'string — shell command to run' },
  },
  {
    type: 'system',
    description: 'Perform a system action',
    fields: { action: 'SystemActionId — one of: volume-up, volume-down, play-pause, screenshot, lock-screen, show-desktop, mute' },
  },
  {
    type: 'folder',
    description: 'Creates a folder slot containing sub-slots (used in ring UI)',
    fields: {},
  },
  {
    type: 'link',
    description: 'Open a URL in the default browser',
    fields: { url: 'string — URL to open' },
  },
  {
    type: 'if-else',
    description: 'Conditional branching (if/else or switch)',
    fields: {
      matchLogic: '"all" | "any" — how criteria are combined',
      criteria: 'ConditionCriteria[] — { variable, operator, value }',
      thenActions: 'ActionConfig[] — actions if true',
      elseActions: 'ActionConfig[] — actions if false',
      conditionMode: '"if-else" | "switch"',
      switchValue: 'string — expression for switch mode',
      switchCases: '{ value: string, actions: ActionConfig[] }[]',
      switchDefault: 'ActionConfig[]',
    },
  },
  {
    type: 'loop',
    description: 'Loop/repeat actions',
    fields: {
      mode: '"repeat" | "for" | "foreach"',
      count: 'number | string — repeat count or variable ref',
      body: 'ActionConfig[] — actions to repeat',
      iterVar: 'string — for-loop index variable',
      start: 'number | string', end: 'number | string', step: 'number | string',
      itemVar: 'string — foreach item variable',
      keyVar: 'string — foreach dict key variable',
      listVar: 'string — foreach list/dict variable name',
    },
  },
  {
    type: 'sequence',
    description: 'Run actions as an independent parallel task',
    fields: {
      name: 'string — display name',
      body: 'ActionConfig[] — actions to run in parallel',
      showProgress: 'boolean — show progress overlay (default true)',
    },
  },
  {
    type: 'wait',
    description: 'Wait/delay execution',
    fields: {
      ms: 'number — delay in milliseconds',
      mode: '"manual" | "variable" | "app-exit" | "key-input"',
      variable: 'string — variable containing ms (mode: variable)',
    },
  },
  {
    type: 'set-var',
    description: 'Set a variable value',
    fields: { name: 'string — variable name', value: 'string — value or expression' },
  },
  {
    type: 'list',
    description: 'Create or manipulate a list variable',
    fields: {
      name: 'string', mode: '"define" | "edit"',
      operation: '"set" | "get" | "push" | "remove"',
      value: 'string', key: 'string', resultVar: 'string', listItems: 'string[]',
    },
  },
  {
    type: 'dict',
    description: 'Create or manipulate a dictionary variable',
    fields: {
      name: 'string', mode: '"define" | "edit"',
      operation: '"set" | "get" | "remove"',
      value: 'string', key: 'string', resultVar: 'string',
      dictItems: '{ key: string, value: string }[]',
    },
  },
  {
    type: 'toast',
    description: 'Show a desktop notification/toast',
    fields: { title: 'string? — notification title (defaults to "Action Ring"), supports $var interpolation', message: 'string — notification body, supports $var interpolation' },
  },
  {
    type: 'run-shortcut',
    description: 'Execute another shortcut by ID',
    fields: {
      shortcutId: 'string — ID of the shortcut to run',
      inputs: 'Record<string, string> — parameter mapping',
      outputVar: 'string — variable to store return value',
    },
  },
  {
    type: 'escape',
    description: 'Break out of the innermost loop',
    fields: {},
  },
  {
    type: 'stop',
    description: 'Halt the entire shortcut execution',
    fields: { returnVar: 'string', returnValue: 'string' },
  },
  {
    type: 'calculate',
    description: 'Perform arithmetic calculation',
    fields: {
      operation: '"add" | "sub" | "mul" | "div" | "mod" | "floordiv" | "pow" | "sqrt"',
      operandA: 'string', operandB: 'string', resultVar: 'string',
    },
  },
  {
    type: 'comment',
    description: 'Documentation-only node — no effect on execution',
    fields: { text: 'string' },
  },
  {
    type: 'mouse-move',
    description: 'Move the mouse cursor',
    fields: { mode: '"set" | "offset"', x: 'string', y: 'string' },
  },
  {
    type: 'mouse-click',
    description: 'Click a mouse button',
    fields: { button: '"left" | "right" | "middle" | "side1" | "side2" | "wheel-up" | "wheel-down"' },
  },
  {
    type: 'clipboard',
    description: 'Get or set clipboard content',
    fields: { mode: '"get" | "set"', resultVar: 'string', value: 'string' },
  },
  {
    type: 'text',
    description: 'Text manipulation (replace, split, combine, case, match, substring, length, trim, pad)',
    fields: {
      mode: 'TextMode', input: 'string', resultVar: 'string',
      find: 'string', replaceWith: 'string', useRegex: 'boolean',
      separator: 'string', listVar: 'string', caseMode: 'TextCaseMode',
      pattern: 'string', matchAll: 'boolean',
      start: 'number|string', length: 'number|string',
    },
  },
  {
    type: 'transform',
    description: 'Data transformation (JSON parse/stringify, URL encode/decode, Base64, hash)',
    fields: {
      mode: '"json-parse" | "json-stringify" | "url-encode" | "url-decode" | "base64-encode" | "base64-decode" | "hash"',
      input: 'string', resultVar: 'string', algorithm: '"md5" | "sha1" | "sha256" | "sha512"',
    },
  },
  {
    type: 'ask-input',
    description: 'Show a dialog asking for user text input',
    fields: { title: 'string', prompt: 'string', defaultValue: 'string', inputType: '"text" | "number" | "password"', resultVar: 'string' },
  },
  {
    type: 'choose-from-list',
    description: 'Show a dialog with a list of choices',
    fields: { title: 'string', items: 'string[]', listVar: 'string', multiple: 'boolean', resultVar: 'string' },
  },
  {
    type: 'show-alert',
    description: 'Show an alert dialog with OK/Cancel',
    fields: { title: 'string', message: 'string', confirmText: 'string', cancelText: 'string', resultVar: 'string' },
  },
  {
    type: 'http-request',
    description: 'Make an HTTP request',
    fields: {
      url: 'string', method: '"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD"',
      headers: 'string (JSON)', body: 'string', timeout: 'number',
      resultVar: 'string', statusVar: 'string',
    },
  },
  {
    type: 'file',
    description: 'File operations (read, write, exists, list, pick, info, delete, rename, copy)',
    fields: {
      mode: 'FileMode', path: 'string', resultVar: 'string',
      content: 'string', writeMode: '"overwrite" | "append"',
      pattern: 'string', destination: 'string', infoField: 'FileInfoField',
    },
  },
  {
    type: 'date-time',
    description: 'Date/time operations (now, format, math, diff, parse)',
    fields: {
      mode: 'DateTimeMode', resultVar: 'string', format: 'string',
      input: 'string', amount: 'number|string', unit: 'DateTimeUnit',
      date1: 'string', date2: 'string',
    },
  },
  {
    type: 'try-catch',
    description: 'Error handling — try/catch block',
    fields: { tryActions: 'ActionConfig[]', catchActions: 'ActionConfig[]', errorVar: 'string' },
  },
  {
    type: 'registry',
    description: 'Windows Registry operations (read, write, delete, exists)',
    fields: {
      mode: 'RegistryMode', hive: 'RegistryHive', keyPath: 'string',
      valueName: 'string', data: 'string', dataType: 'RegistryDataType', resultVar: 'string',
    },
  },
  {
    type: 'environment',
    description: 'Environment variable operations (get, set, list)',
    fields: { mode: '"get" | "set" | "list"', name: 'string', value: 'string', resultVar: 'string' },
  },
  {
    type: 'service',
    description: 'Windows service management (status, start, stop, restart)',
    fields: { mode: '"status" | "start" | "stop" | "restart"', serviceName: 'string', resultVar: 'string' },
  },
]
