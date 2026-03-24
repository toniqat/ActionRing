import { ipcMain, dialog } from 'electron'
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
  type ConfigSavePayload
} from '@shared/ipc.types'

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
  })

  ipcMain.handle(IPC_FILE_PICK_EXE, async (_event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }]
          : [{ name: 'Applications', extensions: ['app', 'sh', ''] }]
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
}
