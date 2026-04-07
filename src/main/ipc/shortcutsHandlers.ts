import { ipcMain } from 'electron'
import type { WindowManager } from '../WindowManager'
import type { ConfigStore } from '../ConfigStore'
import type { ActionExecutor } from '../ActionExecutor'
import type { ShortcutsSlotData } from '@shared/ipc.types'
import type { SlotConfig, ActionConfig } from '@shared/config.types'
import {
  IPC_SHORTCUTS_OPEN,
  IPC_SHORTCUTS_GET_DATA,
  IPC_SHORTCUTS_UPDATE,
  IPC_SHORTCUTS_UPDATED,
  IPC_SHORTCUTS_DATA_REFRESH,
  IPC_SHORTCUTS_CLOSE,
  IPC_SHORTCUTS_COMMITTED,
  IPC_SHORTCUTS_PLAY,
  IPC_CONFIG_UPDATED,
} from '@shared/ipc.types'

let pendingShortcutsData: ShortcutsSlotData | null = null

export function registerShortcutsHandlers(
  windowManager: WindowManager,
  configStore: ConfigStore,
  actionExecutor: ActionExecutor,
): void {
  // Settings → main: open or focus+refresh the shortcuts editor window
  ipcMain.handle(IPC_SHORTCUTS_OPEN, async (_event, data: ShortcutsSlotData) => {
    const config = configStore.get()
    const language = config.language ?? 'en'
    // Prefer caller-supplied library (avoids race conditions when a new entry is created
    // and the editor opens before the async save completes).
    const shortcutsLibrary = data.shortcutsLibrary ?? config.shortcutsLibrary ?? []
    const shortcutGroups = data.shortcutGroups ?? config.shortcutGroups ?? []
    pendingShortcutsData = { ...data, language, shortcutsLibrary, shortcutGroups }

    const existing = windowManager.getShortcutsWindow()
    if (existing && !existing.isDestroyed()) {
      existing.webContents.send(IPC_SHORTCUTS_DATA_REFRESH, pendingShortcutsData)
      existing.focus()
    } else {
      windowManager.createShortcutsWindow(pendingShortcutsData.theme)
    }
  })

  // Shortcuts → main: fetch initial slot data
  ipcMain.handle(IPC_SHORTCUTS_GET_DATA, async () => {
    return pendingShortcutsData
  })

  // Shortcuts → main: slot updated — relay to settings window
  ipcMain.on(IPC_SHORTCUTS_UPDATE, (_event, updatedSlot: SlotConfig) => {
    if (!pendingShortcutsData) return
    pendingShortcutsData = { ...pendingShortcutsData, slot: updatedSlot }
    const settingsWin = windowManager.getSettingsWindow()
    settingsWin?.webContents.send(IPC_SHORTCUTS_UPDATED, pendingShortcutsData)
  })

  // Shortcuts → main: close window — persist final state to disk
  ipcMain.on(IPC_SHORTCUTS_CLOSE, (_event) => {
    if (pendingShortcutsData) {
      if (pendingShortcutsData.libraryEntryId) {
        // Library entry session: persist via library CRUD and notify settings
        configStore.updateLibraryEntry(
          pendingShortcutsData.libraryEntryId,
          pendingShortcutsData.slot.actions,
          pendingShortcutsData.slot.label,
          pendingShortcutsData.slot.icon,
          pendingShortcutsData.slot.iconIsCustom,
          pendingShortcutsData.slot.bgColor,
        )
        const settingsWin = windowManager.getSettingsWindow()
        settingsWin?.webContents.send(IPC_SHORTCUTS_COMMITTED)
        settingsWin?.webContents.send(IPC_CONFIG_UPDATED, configStore.get())
      } else {
        // Regular slot session: write the slot back into the config
        const config = configStore.get()
        const newSlots = [...config.slots]
        if (
          pendingShortcutsData.isSubSlot &&
          pendingShortcutsData.folderIndex !== null &&
          pendingShortcutsData.subSlotIndex !== null
        ) {
          const folder = { ...newSlots[pendingShortcutsData.folderIndex] }
          const newSubSlots = [...(folder.subSlots ?? [])]
          newSubSlots[pendingShortcutsData.subSlotIndex] = pendingShortcutsData.slot
          folder.subSlots = newSubSlots
          newSlots[pendingShortcutsData.folderIndex] = folder
        } else {
          newSlots[pendingShortcutsData.slotIndex] = pendingShortcutsData.slot
        }
        configStore.update({ slots: newSlots })
      }
    }
    const win = windowManager.getShortcutsWindow()
    win?.close()
  })

  // Shortcuts → main: execute the current actions (Play button) — returns per-node results
  ipcMain.handle(IPC_SHORTCUTS_PLAY, async (_event, actions: ActionConfig[]) => {
    return actionExecutor.executeAll(actions)
  })
}
