import { ipcMain, BrowserWindow } from 'electron'
import type { WindowManager } from '../WindowManager'
import type { ConfigStore } from '../ConfigStore'
import type { AppearanceSlotData } from '@shared/ipc.types'
import type { SlotConfig } from '@shared/config.types'
import {
  IPC_APPEARANCE_OPEN,
  IPC_APPEARANCE_GET_DATA,
  IPC_APPEARANCE_UPDATE,
  IPC_APPEARANCE_DATA_REFRESH,
  IPC_APPEARANCE_UPDATED,
  IPC_APPEARANCE_PANEL_SIZES,
  IPC_APPEARANCE_CLOSE,
  IPC_WINDOW_MINIMIZE,
  IPC_WINDOW_MAXIMIZE,
  IPC_WINDOW_CLOSE,
} from '@shared/ipc.types'

let pendingSlotData: AppearanceSlotData | null = null

export function registerAppearanceHandlers(windowManager: WindowManager, configStore: ConfigStore): void {
  // Settings → main: open (or focus+refresh) the appearance editor window
  ipcMain.handle(IPC_APPEARANCE_OPEN, async (_event, data: AppearanceSlotData) => {
    const config = configStore.get()
    const panelSizes = config.appearancePanelSizes
    const language = config.language ?? 'en'
    pendingSlotData = { ...data, language, ...(panelSizes ? { panelSizes } : {}) }

    const existing = windowManager.getAppearanceWindow()
    if (existing && !existing.isDestroyed()) {
      // Push fresh slot data to the already-open window
      existing.webContents.send(IPC_APPEARANCE_DATA_REFRESH, pendingSlotData)
      existing.focus()
    } else {
      const settingsWin = windowManager.getSettingsWindow()
      windowManager.createAppearanceWindow(pendingSlotData.theme, settingsWin ?? undefined)
    }
  })

  // Appearance → main: fetch initial slot data
  ipcMain.handle(IPC_APPEARANCE_GET_DATA, async () => {
    return pendingSlotData
  })

  // Appearance → main: slot updated — relay to settings window
  ipcMain.on(IPC_APPEARANCE_UPDATE, (_event, updatedSlot: SlotConfig) => {
    if (!pendingSlotData) return
    pendingSlotData = { ...pendingSlotData, slot: updatedSlot }
    const settingsWin = windowManager.getSettingsWindow()
    settingsWin?.webContents.send(IPC_APPEARANCE_UPDATED, pendingSlotData)
  })

  // Appearance → main: save panel sizes to config
  ipcMain.on(IPC_APPEARANCE_PANEL_SIZES, (_event, sizes: [number, number, number]) => {
    configStore.update({ appearancePanelSizes: sizes })
  })

  // Appearance → main: close window — persist the final slot state to disk
  ipcMain.on(IPC_APPEARANCE_CLOSE, (_event) => {
    if (pendingSlotData) {
      const config = configStore.get()
      const newSlots = [...config.slots]
      if (pendingSlotData.isSubSlot && pendingSlotData.folderIndex !== null && pendingSlotData.subSlotIndex !== null) {
        const folder = { ...newSlots[pendingSlotData.folderIndex] }
        const newSubSlots = [...(folder.subSlots ?? [])]
        newSubSlots[pendingSlotData.subSlotIndex] = pendingSlotData.slot
        folder.subSlots = newSubSlots
        newSlots[pendingSlotData.folderIndex] = folder
      } else {
        newSlots[pendingSlotData.slotIndex] = pendingSlotData.slot
      }
      configStore.update({ slots: newSlots })
    }
    const win = windowManager.getAppearanceWindow()
    win?.close()
  })

  // Window controls — use event.sender so they work for both settings and appearance windows
  ipcMain.on(IPC_WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IPC_WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on(IPC_WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })
}
