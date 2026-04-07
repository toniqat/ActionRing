import { ipcMain, dialog, BrowserWindow, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import type { ConfigStore } from '../ConfigStore'
import type { WindowManager } from '../WindowManager'
import type { LoginStartup } from '../LoginStartup'
import type { AppConfig } from '@shared/config.types'
import {
  IPC_CONFIG_GET,
  IPC_CONFIG_SAVE,
  IPC_CONFIG_UPDATED,
  IPC_FILE_PICK_EXE,
  IPC_FILE_PICK_ICON,
  IPC_CONFIG_RESET,
  IPC_CONFIG_EXPORT_GLOBAL,
  IPC_CONFIG_IMPORT_GLOBAL,
  IPC_SHORTCUTS_THEME_UPDATE,
  type ConfigSavePayload
} from '@shared/ipc.types'

function sendThemeToShortcuts(windowManager: WindowManager, config: AppConfig): void {
  const shortcutsWin = windowManager.getShortcutsWindow()
  if (shortcutsWin && !shortcutsWin.isDestroyed()) {
    const pref = config.theme ?? 'dark'
    const resolved: 'light' | 'dark' =
      pref === 'system'
        ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
        : pref
    shortcutsWin.webContents.send(IPC_SHORTCUTS_THEME_UPDATE, resolved)
  }
}

export function registerSettingsHandlers(
  configStore: ConfigStore,
  windowManager: WindowManager,
  loginStartup: LoginStartup
): void {
  ipcMain.handle(IPC_CONFIG_GET, () => {
    return configStore.get()
  })

  ipcMain.handle(IPC_CONFIG_SAVE, (_event, payload: ConfigSavePayload) => {
    configStore.save(payload.config)
    loginStartup.sync(payload.config.startOnLogin)

    // Push updated config to settings window
    const settingsWin = windowManager.getSettingsWindow()
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send(IPC_CONFIG_UPDATED, payload.config)
    }

    // Push resolved theme to shortcuts editor window
    sendThemeToShortcuts(windowManager, payload.config)
  })

  ipcMain.handle(IPC_FILE_PICK_EXE, async (_event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [
              { name: 'Executables', extensions: ['exe', 'bat', 'cmd'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          : [
              { name: 'Applications', extensions: ['app', 'sh', ''] },
              { name: 'All Files', extensions: ['*'] }
            ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_FILE_PICK_ICON, async (_event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'svg', 'ico', 'jpg', 'jpeg'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Reset all settings to factory defaults ────────────────────────────────
  // Confirmation is handled in the renderer UI — this handler just performs the reset.

  ipcMain.handle(IPC_CONFIG_RESET, async (): Promise<AppConfig> => {
    const newConfig = configStore.reset()
    loginStartup.sync(newConfig.startOnLogin)
    const settingsWin = windowManager.getSettingsWindow()
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send(IPC_CONFIG_UPDATED, newConfig)
    }
    sendThemeToShortcuts(windowManager, newConfig)
    return newConfig
  })

  // ── Global backup export ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CONFIG_EXPORT_GLOBAL, async (event): Promise<boolean> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const saveOptions = {
      title: 'Export All Profiles',
      defaultPath: 'actionring_backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    }
    const result = win
      ? await dialog.showSaveDialog(win, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (result.canceled || !result.filePath) return false

    const data = {
      __type: 'actionring-global-backup',
      version: 1,
      config: configStore.get(),
    }
    try {
      writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('[ActionRing] Export write failed:', err)
      throw err
    }
  })

  // ── Global backup import ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CONFIG_IMPORT_GLOBAL, async (event): Promise<boolean> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const openOptions = {
      title: 'Import All Profiles',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'] as const,
    }
    const result = win
      ? await dialog.showOpenDialog(win, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (result.canceled || result.filePaths.length === 0) return false  // user canceled — no error

    try {
      const raw = readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(raw)

      if (data.__type !== 'actionring-global-backup' || !data.config || !Array.isArray(data.config.apps)) {
        throw new Error('Invalid backup file format')
      }

      const importedConfig: AppConfig = JSON.parse(JSON.stringify(data.config))
      configStore.save(importedConfig)
      loginStartup.sync(importedConfig.startOnLogin)
      const settingsWin = windowManager.getSettingsWindow()
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.webContents.send(IPC_CONFIG_UPDATED, importedConfig)
      }
      sendThemeToShortcuts(windowManager, importedConfig)
      return true
    } catch (err) {
      console.error('[ActionRing] Import failed:', err)
      throw err  // re-throw so renderer shows error toast
    }
  })
}
