import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig } from '@shared/config.types'
import type { ConfigSavePayload } from '@shared/ipc.types'
import {
  IPC_CONFIG_GET,
  IPC_CONFIG_SAVE,
  IPC_CONFIG_UPDATED,
  IPC_FILE_PICK_EXE,
  IPC_FILE_PICK_ICON
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('settingsAPI', {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CONFIG_GET),
  saveConfig: (payload: ConfigSavePayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CONFIG_SAVE, payload),
  onConfigUpdated: (callback: (config: AppConfig) => void) => {
    ipcRenderer.on(IPC_CONFIG_UPDATED, (_event, config) => callback(config))
  },
  pickExe: (): Promise<string | null> => ipcRenderer.invoke(IPC_FILE_PICK_EXE),
  pickIcon: (): Promise<string | null> => ipcRenderer.invoke(IPC_FILE_PICK_ICON)
})
