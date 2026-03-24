import { app, systemPreferences } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { ConfigStore } from './ConfigStore'
import { WindowManager } from './WindowManager'
import { HookManager } from './HookManager'
import { TrayManager } from './TrayManager'
import { ActionExecutor } from './ActionExecutor'
import { LoginStartup } from './LoginStartup'
import { registerRingHandlers } from './ipc/ringHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'

async function main(): Promise<void> {
  // Prevent multiple instances
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  await app.whenReady()

  electronApp.setAppUserModelId('com.actionring')

  // Check macOS accessibility permissions
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false)
    if (!trusted) {
      // Prompt user — this opens System Preferences
      systemPreferences.isTrustedAccessibilityClient(true)
    }
  }

  // Initialize core services
  const configStore = new ConfigStore()
  const windowManager = new WindowManager()
  const actionExecutor = new ActionExecutor()
  const loginStartup = new LoginStartup()

  // Sync login startup state
  loginStartup.sync(configStore.get().startOnLogin)

  // Create persistent ring window (hidden at startup)
  windowManager.createRingWindow()

  // Register IPC handlers
  registerRingHandlers(configStore, actionExecutor, windowManager)
  registerSettingsHandlers(configStore, windowManager, loginStartup)

  // Create system tray
  const trayManager = new TrayManager(configStore, () => {
    windowManager.showSettings()
  })
  trayManager.create()

  // Show settings window on first launch so user can configure triggers/actions
  windowManager.showSettings()

  // Start global mouse/keyboard hook
  const hookManager = new HookManager(configStore, () => windowManager.getRingWindow())
  await hookManager.start()

  // Dev tools shortcut
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('second-instance', () => {
    windowManager.showSettings()
  })

  app.on('before-quit', () => {
    hookManager.stop()
    trayManager.destroy()
  })

  // macOS: re-open settings on dock click
  app.on('activate', () => {
    windowManager.showSettings()
  })
}

main().catch(console.error)
