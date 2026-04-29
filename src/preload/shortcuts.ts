import { contextBridge, ipcRenderer } from 'electron'
import type { SlotConfig, ActionConfig } from '@shared/config.types'
import type { ShortcutsSlotData, PlayNodeResult, ResourceIconEntry, PopupMenuItem, PopupMenuShowRequest } from '@shared/ipc.types'
import {
  IPC_SHORTCUTS_GET_DATA,
  IPC_SHORTCUTS_UPDATE,
  IPC_SHORTCUTS_DATA_REFRESH,
  IPC_SHORTCUTS_CLOSE,
  IPC_SHORTCUTS_PLAY,
  IPC_SHORTCUTS_THEME_UPDATE,
  IPC_WINDOW_MINIMIZE,
  IPC_WINDOW_MAXIMIZE,
  IPC_PRESET_EXPORT,
  IPC_PRESET_IMPORT,
  IPC_FILE_PICK_EXE,
  IPC_ICONS_GET_RESOURCE,
  IPC_ICONS_ADD_RECENT,
  IPC_POPUP_MENU_SHOW,
  IPC_APP_SHOW_ERROR_LOG,
  IPC_APP_RESTART,
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
    ipcRenderer.removeAllListeners(IPC_SHORTCUTS_DATA_REFRESH)
    ipcRenderer.on(IPC_SHORTCUTS_DATA_REFRESH, (_event, data) => callback(data))
  },

  getResourceIcons: (): Promise<ResourceIconEntry[]> =>
    ipcRenderer.invoke(IPC_ICONS_GET_RESOURCE),

  addRecentIcon: (iconRef: string): void => {
    ipcRenderer.send(IPC_ICONS_ADD_RECENT, iconRef)
  },

  showPopupMenu: (request: PopupMenuShowRequest): Promise<string | null> =>
    ipcRenderer.invoke(IPC_POPUP_MENU_SHOW, request),

  onThemeChanged: (callback: (theme: 'light' | 'dark') => void): void => {
    ipcRenderer.removeAllListeners(IPC_SHORTCUTS_THEME_UPDATE)
    ipcRenderer.on(IPC_SHORTCUTS_THEME_UPDATE, (_event, theme) => callback(theme))
  },

  // ── Error recovery ───────────────────────────────────────────────────────
  showErrorLog: (logData: { message: string; stack: string; componentStack?: string }): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_SHOW_ERROR_LOG, logData),
  restartApp: (): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_RESTART),
})
