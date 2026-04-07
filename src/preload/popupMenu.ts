import { contextBridge, ipcRenderer } from 'electron'
import type { PopupMenuItem } from '@shared/ipc.types'
import {
  IPC_POPUP_MENU_INIT,
  IPC_POPUP_MENU_ITEM_CLICK,
  IPC_POPUP_MENU_SHOW_SUBMENU,
  IPC_POPUP_MENU_CLOSE_SUBMENU,
  IPC_POPUP_MENU_RESIZE,
  IPC_POPUP_MENU_DISMISS,
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('popupMenuAPI', {
  onInit: (cb: (data: { items: PopupMenuItem[]; theme: string }) => void): void => {
    ipcRenderer.on(IPC_POPUP_MENU_INIT, (_event, data) => cb(data))
  },

  selectItem: (itemId: string): void => {
    ipcRenderer.send(IPC_POPUP_MENU_ITEM_CLICK, itemId)
  },

  dismiss: (): void => {
    ipcRenderer.send(IPC_POPUP_MENU_DISMISS)
  },

  resize: (width: number, height: number): void => {
    ipcRenderer.send(IPC_POPUP_MENU_RESIZE, width, height)
  },

  showSubmenu: (items: PopupMenuItem[], screenX: number, screenY: number): void => {
    ipcRenderer.send(IPC_POPUP_MENU_SHOW_SUBMENU, items, screenX, screenY)
  },

  closeSubmenu: (): void => {
    ipcRenderer.send(IPC_POPUP_MENU_CLOSE_SUBMENU)
  },
})
