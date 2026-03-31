import { ipcMain, dialog } from 'electron'
import type { IconStore } from '../IconStore'
import {
  IPC_ICONS_GET_CUSTOM,
  IPC_ICONS_ADD_CUSTOM,
  IPC_ICONS_REMOVE_CUSTOM,
  IPC_ICONS_GET_RECENT,
  IPC_ICONS_ADD_RECENT,
} from '@shared/ipc.types'

export function registerIconHandlers(iconStore: IconStore): void {
  ipcMain.handle(IPC_ICONS_GET_CUSTOM, () => iconStore.getCustomIcons())

  ipcMain.handle(IPC_ICONS_ADD_CUSTOM, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'svg', 'ico', 'jpg', 'jpeg'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return iconStore.addCustomIcon(result.filePaths[0])
  })

  ipcMain.handle(IPC_ICONS_REMOVE_CUSTOM, (_event, id: string) => {
    iconStore.removeCustomIcon(id)
  })

  ipcMain.handle(IPC_ICONS_GET_RECENT, () => iconStore.getRecentIcons())

  ipcMain.on(IPC_ICONS_ADD_RECENT, (_event, iconRef: string) => {
    iconStore.addRecentIcon(iconRef)
  })
}
