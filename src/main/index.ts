import { app, ipcMain, systemPreferences } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { execFile } from 'child_process'
import path from 'path'
import { ConfigStore } from './ConfigStore'
import { WindowManager } from './WindowManager'
import { HookManager } from './HookManager'
import { TrayManager } from './TrayManager'
import { ActionExecutor } from './ActionExecutor'
import { LoginStartup } from './LoginStartup'
import { registerRingHandlers } from './ipc/ringHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerAppearanceHandlers } from './ipc/appearanceHandlers'
import { registerIconHandlers } from './ipc/iconHandlers'
import { registerProfileHandlers } from './ipc/profileHandlers'
import { registerProcessHandlers } from './ipc/processHandlers'
import { registerShortcutsHandlers } from './ipc/shortcutsHandlers'
import { registerUpdateHandlers } from './ipc/updateHandlers'
import { SequenceManager } from './SequenceManager'
import { McpApiServer } from './McpApiServer'
import {
  IPC_TRIGGER_START_MOUSE_CAPTURE,
  IPC_TRIGGER_CANCEL_MOUSE_CAPTURE,
  IPC_TRIGGER_MOUSE_CAPTURED,
  IPC_MCP_SETUP,
  IPC_MCP_TOGGLE,
  IPC_MCP_GET_ENTRY_PATH,
  IPC_MCP_CHECK_CLIENTS,
} from '@shared/ipc.types'
import type { McpSetupResult, McpSetupTarget, McpClientStatus } from '@shared/ipc.types'
import { IconStore } from './IconStore'
import { PopupMenuManager } from './PopupMenuManager'
import { DialogManager } from './DialogManager'
import { WindowTracker } from './WindowTracker'
import { getNotificationStrings } from '@shared/mainI18n'

// Set app name and AppUserModelId before ready — affects Task Manager / Activity Monitor process name
// On Windows, AppUserModelId MUST be set before app.whenReady() to properly register taskbar identity.
// Using the product name ('ActionRing') directly so Windows Toast notifications display the friendly
// name in the sender header instead of the raw reverse-domain appId.
app.setName('ActionRing')
if (process.platform === 'win32') {
  app.setAppUserModelId('ActionRing')
}

async function main(): Promise<void> {
  // Prevent multiple instances
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  await app.whenReady()

  electronApp.setAppUserModelId('ActionRing')

  // Register AppUserModelId in registry for Windows toast notification headers
  if (process.platform === 'win32') {
    ensureToastIdentity()
  }

  // ── Phase 1: Critical path — show settings window ASAP ─────────────────────
  const configStore = new ConfigStore()
  const iconStore = new IconStore()
  const windowManager = new WindowManager()
  const actionExecutor = new ActionExecutor(configStore)
  const loginStartup = new LoginStartup()

  // Register IPC handlers (synchronous, needed before renderer loads)
  registerRingHandlers(configStore, actionExecutor, windowManager)
  registerSettingsHandlers(configStore, windowManager, loginStartup)
  registerAppearanceHandlers(windowManager, configStore)
  registerIconHandlers(iconStore)
  registerProfileHandlers(configStore, windowManager)
  registerProcessHandlers(configStore, windowManager)
  registerShortcutsHandlers(windowManager, configStore, actionExecutor)
  registerUpdateHandlers()

  // Show settings window ASAP — this is what the user sees first
  windowManager.showSettings()

  // Dev tools shortcut
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('second-instance', () => {
    windowManager.showSettings()
  })

  // macOS: re-open settings on dock click
  app.on('activate', () => {
    windowManager.showSettings()
  })

  // ── Phase 2: Deferred init — after settings window is on screen ───────────
  setImmediate(async () => {
    // Check macOS accessibility permissions
    if (process.platform === 'darwin') {
      const trusted = systemPreferences.isTrustedAccessibilityClient(false)
      if (!trusted) {
        systemPreferences.isTrustedAccessibilityClient(true)
      }
    }

    const windowTracker = new WindowTracker()
    const _popupMenuManager = new PopupMenuManager()
    const dialogManager = new DialogManager()

    // Wire up parallel sequence manager
    const sequenceManager = new SequenceManager(
      () => windowManager.getProgressWindow(),
      () => windowManager.createProgressWindow(),
    )
    actionExecutor.setSequenceManager(sequenceManager)
    actionExecutor.setDialogManager(dialogManager)

    // Sync login startup state
    loginStartup.sync(configStore.get().startOnLogin)

    // Create ring window (hidden — needed before first trigger)
    windowManager.createRingWindow()

    // Create system tray
    const trayManager = new TrayManager(configStore, () => {
      windowManager.showSettings()
    })
    trayManager.create()

    // Register tray notification callback for when settings window is hidden
    const BUTTON_LABELS: Record<number, string> = {
      1: 'Left Click', 2: 'Right Click', 3: 'Middle Click', 4: 'Side Button 1', 5: 'Side Button 2',
    }
    const MOD_LABELS: Record<string, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' }
    windowManager.setSettingsHideCallback(() => {
      const config = configStore.get()
      if (config.trayNotificationsEnabled === false) return
      const trigger = config.trigger
      const keys = trigger.triggerKeys ?? trigger.modifiers.map((m) => MOD_LABELS[m] ?? m).join('+')
      const button = BUTTON_LABELS[trigger.button] ?? `Button ${trigger.button}`
      const triggerDisplay = keys ? `${keys} + ${button}` : button
      const n = getNotificationStrings(config.language)
      trayManager.showNotification(n.title, n.body(triggerDisplay))
    })

    // Start active-window tracker (Windows only)
    windowTracker.start()

    // Start global mouse/keyboard hook
    const hookManager = new HookManager(configStore, windowTracker, () => windowManager.getRingWindow())
    actionExecutor.setHookManager(hookManager)
    await hookManager.start()

    // Trigger mouse capture — lets the settings UI capture any mouse button via uiohook
    ipcMain.on(IPC_TRIGGER_START_MOUSE_CAPTURE, () => {
      const settingsWin = windowManager.getSettingsWindow()
      if (!settingsWin || settingsWin.isDestroyed()) return
      hookManager.startMouseCapture((button) => {
        if (!settingsWin.isDestroyed()) {
          settingsWin.webContents.send(IPC_TRIGGER_MOUSE_CAPTURED, button)
        }
      })
    })

    ipcMain.on(IPC_TRIGGER_CANCEL_MOUSE_CAPTURE, () => {
      hookManager.cancelMouseCapture()
    })

    // ── MCP server (lowest priority) ──────────────────────────────────────────
    const mcpApiServer = new McpApiServer(configStore, actionExecutor, windowManager)
    if (configStore.get().mcpEnabled !== false) {
      mcpApiServer.start().catch((err) => {
        console.error('[MCP API] Failed to start:', err)
      })
    }

    // ── MCP IPC handlers ────────────────────────────────────────────────────────
    ipcMain.handle('mcp:get-status', () => mcpApiServer.getInfo())

    const resolveMcpEntry = async (): Promise<string> => {
      const path = await import('path')
      return app.isPackaged
        ? path.join(process.resourcesPath, 'mcp-server', 'dist', 'index.js')
        : path.join(app.getAppPath(), 'mcp-server', 'dist', 'index.js')
    }

    ipcMain.handle(IPC_MCP_GET_ENTRY_PATH, async () => resolveMcpEntry())

    const execAsync = async (cmd: string, timeout = 5000): Promise<string> => {
      const { exec } = await import('child_process')
      return new Promise((resolve, reject) => {
        const child = exec(cmd, { timeout }, (err, stdout) => {
          if (err) reject(err); else resolve(stdout)
        })
        child.stdin?.end()
      })
    }

    const checkCliInstalled = async (cmd: string): Promise<boolean> => {
      try { await execAsync(`${cmd} --version`); return true } catch { return false }
    }

    const checkJsonConfigRegistered = async (configDir: string, configFile: string): Promise<boolean> => {
      try {
        const fs = await import('fs/promises')
        const path = await import('path')
        const configPath = path.join(configDir, configFile)
        const data = await fs.readFile(configPath, 'utf-8')
        const cfg = JSON.parse(data)
        return !!(cfg?.mcpServers?.actionring)
      } catch { return false }
    }

    const isCachedInstalled = (target: McpSetupTarget): boolean => {
      const cached = configStore.get().mcpInstalledClients ?? []
      return cached.includes(target)
    }

    const cacheInstalled = (target: McpSetupTarget): void => {
      const cfg = configStore.get()
      const cached = new Set(cfg.mcpInstalledClients ?? [])
      if (!cached.has(target)) {
        cached.add(target)
        cfg.mcpInstalledClients = [...cached]
        configStore.save(cfg)
      }
    }

    ipcMain.handle(IPC_MCP_CHECK_CLIENTS, async (_e, target: McpSetupTarget): Promise<McpClientStatus> => {
      const path = await import('path')
      const os = await import('os')
      const home = os.homedir()

      let registered = false

      if (target === 'claude-desktop') {
        const configDir = process.platform === 'win32'
          ? path.join(home, 'AppData', 'Roaming', 'Claude')
          : process.platform === 'darwin'
            ? path.join(home, 'Library', 'Application Support', 'Claude')
            : path.join(home, '.config', 'Claude')

        if (isCachedInstalled(target)) {
          registered = await checkJsonConfigRegistered(configDir, 'claude_desktop_config.json')
          return { installed: true, registered }
        }
        const fs = await import('fs')
        const installed = fs.existsSync(configDir)
        if (installed) cacheInstalled(target)
        registered = await checkJsonConfigRegistered(configDir, 'claude_desktop_config.json')
        return { installed, registered }
      }

      if (target === 'claude-code') {
        if (isCachedInstalled(target)) {
          try {
            const out = await execAsync('claude mcp list', 8000)
            registered = out.includes('actionring')
          } catch { /* ignore */ }
          return { installed: true, registered }
        }
        const installed = await checkCliInstalled('claude')
        if (installed) {
          cacheInstalled(target)
          try {
            const out = await execAsync('claude mcp list', 8000)
            registered = out.includes('actionring')
          } catch { /* ignore */ }
        }
        return { installed, registered }
      }

      if (target === 'codex') {
        if (isCachedInstalled(target)) {
          registered = await checkJsonConfigRegistered(path.join(home, '.codex'), 'config.json')
          return { installed: true, registered }
        }
        const installed = await checkCliInstalled('codex')
        if (installed) cacheInstalled(target)
        registered = await checkJsonConfigRegistered(path.join(home, '.codex'), 'config.json')
        return { installed, registered }
      }

      if (target === 'gemini') {
        if (isCachedInstalled(target)) {
          registered = await checkJsonConfigRegistered(path.join(home, '.gemini'), 'settings.json')
          return { installed: true, registered }
        }
        const installed = await checkCliInstalled('gemini')
        if (installed) cacheInstalled(target)
        registered = await checkJsonConfigRegistered(path.join(home, '.gemini'), 'settings.json')
        return { installed, registered }
      }

      return { installed: false, registered: false }
    })

    ipcMain.handle(IPC_MCP_SETUP, async (_e, target: McpSetupTarget): Promise<McpSetupResult> => {
      const mcpEntry = await resolveMcpEntry()

      if (target === 'claude-code') {
        try {
          await execAsync('claude --version')
          const cmd = `claude mcp add actionring -s user -- node "${mcpEntry}"`
          await execAsync(cmd, 10000)
          return { ok: true, target: 'claude-code', detail: `Command:\n${cmd}` }
        } catch (err) {
          const msg = (err as Error).message ?? ''
          if (msg.toLowerCase().includes('already exists')) {
            return { ok: true, target: 'claude-code', detail: 'Already registered.' }
          }
          return { ok: false, error: msg, command: `claude mcp add actionring -s user -- node "${mcpEntry}"` }
        }
      }

      const writeJsonConfig = async (configDir: string, configFile: string): Promise<McpSetupResult> => {
        const fs = await import('fs')
        const path = await import('path')
        const configPath = path.join(configDir, configFile)
        let cfg: Record<string, unknown> = {}
        if (fs.existsSync(configPath)) {
          cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        } else {
          fs.mkdirSync(configDir, { recursive: true })
        }
        const servers = (cfg.mcpServers ?? {}) as Record<string, unknown>
        const entry = { command: 'node', args: [mcpEntry] }
        servers['actionring'] = entry
        cfg.mcpServers = servers
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
        return { ok: true, target, detail: `Config: ${configPath}\n\nmcpServers.actionring:\n${JSON.stringify(entry, null, 2)}` }
      }

      try {
        const path = await import('path')
        const os = await import('os')
        const home = os.homedir()

        if (target === 'claude-desktop') {
          const configDir = process.platform === 'win32'
            ? path.join(home, 'AppData', 'Roaming', 'Claude')
            : process.platform === 'darwin'
              ? path.join(home, 'Library', 'Application Support', 'Claude')
              : path.join(home, '.config', 'Claude')
          return await writeJsonConfig(configDir, 'claude_desktop_config.json')
        }

        if (target === 'codex') {
          if (!await checkCliInstalled('codex')) {
            return { ok: false, error: 'Codex CLI is not installed.\nInstall it first: npm install -g @openai/codex' }
          }
          return await writeJsonConfig(path.join(home, '.codex'), 'config.json')
        }

        if (target === 'gemini') {
          if (!await checkCliInstalled('gemini')) {
            return { ok: false, error: 'Gemini CLI is not installed.\nInstall it first: npm install -g @anthropic-ai/gemini-cli' }
          }
          return await writeJsonConfig(path.join(home, '.gemini'), 'settings.json')
        }

        return { ok: false, error: `Unknown target: ${target}` }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    })

    ipcMain.handle(IPC_MCP_TOGGLE, async (_e, enabled: boolean): Promise<boolean> => {
      const cfg = configStore.get()
      cfg.mcpEnabled = enabled
      configStore.save(cfg)
      if (enabled) {
        await mcpApiServer.start().catch((err) => {
          console.error('[MCP API] Failed to start:', err)
        })
      } else {
        mcpApiServer.stop()
      }
      return enabled
    })

    app.on('before-quit', () => {
      windowManager.setQuitting()
      hookManager.stop()
      windowTracker.stop()
      trayManager.destroy()
      mcpApiServer.stop()
    })
  })
}

main().catch(console.error)

// ── Windows Toast notification identity ─────────────────────────────────────
// Register AppUserModelId in the registry so Windows can resolve the app name
// and icon for toast notification headers. The built exe already embeds icon.ico,
// so a Start Menu shortcut is not required for production builds.

function ensureToastIdentity(): void {
  const iconPath = is.dev
    ? path.join(process.cwd(), 'resources/logo', 'icon.ico')
    : path.join(process.resourcesPath, 'logo', 'icon.ico')

  const regCmd = `
    $p = 'HKCU:\\Software\\Classes\\AppUserModelId\\ActionRing'
    if (!(Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
    Set-ItemProperty $p -Name DisplayName -Value 'ActionRing'
    Set-ItemProperty $p -Name IconUri -Value '${iconPath.replace(/'/g, "''")}'
  `
  execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', regCmd],
    (err) => { if (err) console.warn('Failed to register AUMID:', err.message) })
}
