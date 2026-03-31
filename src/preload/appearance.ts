import { contextBridge, ipcRenderer } from 'electron'
import type { SlotConfig } from '@shared/config.types'
import type { AppearanceSlotData, CustomIconEntry } from '@shared/ipc.types'
import {
  IPC_APPEARANCE_GET_DATA,
  IPC_APPEARANCE_UPDATE,
  IPC_APPEARANCE_DATA_REFRESH,
  IPC_APPEARANCE_PANEL_SIZES,
  IPC_WINDOW_MINIMIZE,
  IPC_WINDOW_MAXIMIZE,
  IPC_ICONS_GET_CUSTOM,
  IPC_ICONS_ADD_CUSTOM,
  IPC_ICONS_REMOVE_CUSTOM,
  IPC_ICONS_GET_RECENT,
  IPC_ICONS_ADD_RECENT,
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('appearanceAPI', {
  getSlotData: (): Promise<AppearanceSlotData> =>
    ipcRenderer.invoke(IPC_APPEARANCE_GET_DATA),

  updateSlot: (slot: SlotConfig): void => {
    ipcRenderer.send(IPC_APPEARANCE_UPDATE, slot)
  },

  closeWindow: (): void => {
    ipcRenderer.send('appearance:close')
  },

  savePanelSizes: (sizes: [number, number, number]): void => {
    ipcRenderer.send(IPC_APPEARANCE_PANEL_SIZES, sizes)
  },

  minimizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MINIMIZE),

  maximizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MAXIMIZE),

  onDataRefresh: (callback: (data: AppearanceSlotData) => void): void => {
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
})
