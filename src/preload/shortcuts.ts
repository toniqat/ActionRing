import { contextBridge, ipcRenderer } from 'electron'
import type { SlotConfig, ActionConfig } from '@shared/config.types'
import type { ShortcutsSlotData, PlayNodeResult, ResourceIconEntry } from '@shared/ipc.types'
import {
  IPC_SHORTCUTS_GET_DATA,
  IPC_SHORTCUTS_UPDATE,
  IPC_SHORTCUTS_DATA_REFRESH,
  IPC_SHORTCUTS_CLOSE,
  IPC_SHORTCUTS_PLAY,
  IPC_WINDOW_MINIMIZE,
  IPC_WINDOW_MAXIMIZE,
  IPC_PRESET_EXPORT,
  IPC_PRESET_IMPORT,
  IPC_FILE_PICK_EXE,
  IPC_ICONS_GET_RESOURCE,
  IPC_ICONS_ADD_RECENT,
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('shortcutsAPI', {
  getSlotData: (): Promise<ShortcutsSlotData> =>
    ipcRenderer.invoke(IPC_SHORTCUTS_GET_DATA),

  updateSlot: (slot: SlotConfig): void => {
    ipcRenderer.send(IPC_SHORTCUTS_UPDATE, slot)
  },

  closeWindow: (): void => {
    ipcRenderer.send(IPC_SHORTCUTS_CLOSE)
  },

  minimizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MINIMIZE),

  maximizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MAXIMIZE),

  playActions: (actions: ActionConfig[]): Promise<PlayNodeResult[]> =>
    ipcRenderer.invoke(IPC_SHORTCUTS_PLAY, actions),

  pickExe: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_FILE_PICK_EXE),

  exportPreset: (slot: SlotConfig): Promise<void> =>
    ipcRenderer.invoke(IPC_PRESET_EXPORT, slot),

  importPreset: (): Promise<SlotConfig | null> =>
    ipcRenderer.invoke(IPC_PRESET_IMPORT),

  onDataRefresh: (callback: (data: ShortcutsSlotData) => void): void => {
    ipcRenderer.on(IPC_SHORTCUTS_DATA_REFRESH, (_event, data) => callback(data))
  },

  getResourceIcons: (): Promise<ResourceIconEntry[]> =>
    ipcRenderer.invoke(IPC_ICONS_GET_RESOURCE),

  addRecentIcon: (iconRef: string): void => {
    ipcRenderer.send(IPC_ICONS_ADD_RECENT, iconRef)
  },
})
