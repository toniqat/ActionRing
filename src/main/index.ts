import { app, ipcMain, systemPreferences } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
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
import {
  IPC_TRIGGER_START_MOUSE_CAPTURE,
  IPC_TRIGGER_CANCEL_MOUSE_CAPTURE,
  IPC_TRIGGER_MOUSE_CAPTURED,
} from '@shared/ipc.types'
import { IconStore } from './IconStore'
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
  const iconStore = new IconStore()
  const windowManager = new WindowManager()
  const actionExecutor = new ActionExecutor(configStore)
  const loginStartup = new LoginStartup()
  const windowTracker = new WindowTracker()

  // Wire up parallel sequence manager
  const sequenceManager = new SequenceManager(
    () => windowManager.getProgressWindow(),
    () => windowManager.createProgressWindow(),
  )
  actionExecutor.setSequenceManager(sequenceManager)

  // Sync login startup state
  loginStartup.sync(configStore.get().startOnLogin)

  // Create persistent ring window (hidden at startup)
  windowManager.createRingWindow()

  // Register IPC handlers
  registerRingHandlers(configStore, actionExecutor, windowManager)
  registerSettingsHandlers(configStore, windowManager, loginStartup)
  registerAppearanceHandlers(windowManager, configStore)
  registerIconHandlers(iconStore)
  registerProfileHandlers(configStore, windowManager)
  registerProcessHandlers(configStore, windowManager)
  registerShortcutsHandlers(windowManager, configStore, actionExecutor)
  registerUpdateHandlers(windowManager)

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

  // Show settings window on first launch so user can configure triggers/actions
  windowManager.showSettings()

  // Start active-window tracker (Windows only)
  windowTracker.start()

  // Start global mouse/keyboard hook
  const hookManager = new HookManager(configStore, windowTracker, () => windowManager.getRingWindow())
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

  // Dev tools shortcut
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('second-instance', () => {
    windowManager.showSettings()
  })

  app.on('before-quit', () => {
    windowManager.setQuitting()
    hookManager.stop()
    windowTracker.stop()
    trayManager.destroy()
  })

  // macOS: re-open settings on dock click
  app.on('activate', () => {
    windowManager.showSettings()
  })
}

main().catch(console.error)
