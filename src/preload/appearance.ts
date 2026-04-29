import { contextBridge, ipcRenderer } from 'electron'
import type { SlotConfig } from '@shared/config.types'
import type { AppearanceSlotData, CustomIconEntry, ResourceIconEntry } from '@shared/ipc.types'
import {
  IPC_APPEARANCE_GET_DATA,
  IPC_APPEARANCE_UPDATE,
  IPC_APPEARANCE_CLOSE,
  IPC_APPEARANCE_DATA_REFRESH,
  IPC_APPEARANCE_PANEL_SIZES,
  IPC_WINDOW_MINIMIZE,
  IPC_WINDOW_MAXIMIZE,
  IPC_ICONS_GET_CUSTOM,
  IPC_ICONS_ADD_CUSTOM,
  IPC_ICONS_REMOVE_CUSTOM,
  IPC_ICONS_GET_RECENT,
  IPC_ICONS_ADD_RECENT,
  IPC_ICONS_GET_RESOURCE,
  IPC_ICONS_READ_SVG,
  IPC_APP_SHOW_ERROR_LOG,
  IPC_APP_RESTART,
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('appearanceAPI', {
  getSlotData: (): Promise<AppearanceSlotData> =>
    ipcRenderer.invoke(IPC_APPEARANCE_GET_DATA),

  updateSlot: (slot: SlotConfig): void => {
    ipcRenderer.send(IPC_APPEARANCE_UPDATE, slot)
  },

  closeWindow: (): void => {
    ipcRenderer.send(IPC_APPEARANCE_CLOSE)
  },

  savePanelSizes: (sizes: [number, number, number]): void => {
    ipcRenderer.send(IPC_APPEARANCE_PANEL_SIZES, sizes)
  },

  minimizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MINIMIZE),

  maximizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MAXIMIZE),

  onDataRefresh: (callback: (data: AppearanceSlotData) => void): void => {
    ipcRenderer.removeAllListeners(IPC_APPEARANCE_DATA_REFRESH)
    ipcRenderer.on(IPC_APPEARANCE_DATA_REFRESH, (_event, data) => callback(data))
  },

  // ── Icon library ──────────────────────────────────────────────────────────

  getCustomIcons: (): Promise<CustomIconEntry[]> =>
    ipcRenderer.invoke(IPC_ICONS_GET_CUSTOM),

  /** Opens a file picker, copies the selected image to userData, returns the entry. */
  addCustomIcon: (): Promise<CustomIconEntry | null> =>
    ipcRenderer.invoke(IPC_ICONS_ADD_CUSTOM),

  removeCustomIcon: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_ICONS_REMOVE_CUSTOM, id),

  getRecentIcons: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC_ICONS_GET_RECENT),

  addRecentIcon: (iconRef: string): void => {
    ipcRenderer.send(IPC_ICONS_ADD_RECENT, iconRef)
  },

  getResourceIcons: (): Promise<ResourceIconEntry[]> =>
    ipcRenderer.invoke(IPC_ICONS_GET_RESOURCE),

  /** Read raw SVG text for an absolute .svg file path. Returns empty string on error. */
  readSvgContent: (absPath: string): Promise<string> =>
    ipcRenderer.invoke(IPC_ICONS_READ_SVG, absPath),

  // ── Error recovery ───────────────────────────────────────────────────────
  showErrorLog: (logData: { message: string; stack: string; componentStack?: string }): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_SHOW_ERROR_LOG, logData),
  restartApp: (): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_RESTART),
})
