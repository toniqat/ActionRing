import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { PopupMenuItem } from '@shared/ipc.types'
import {
  IPC_POPUP_MENU_SHOW,
  IPC_POPUP_MENU_INIT,
  IPC_POPUP_MENU_ITEM_CLICK,
  IPC_POPUP_MENU_SHOW_SUBMENU,
  IPC_POPUP_MENU_CLOSE_SUBMENU,
  IPC_POPUP_MENU_RESIZE,
  IPC_POPUP_MENU_DISMISS,
} from '@shared/ipc.types'

/** Estimated item height for initial window sizing. */
const ITEM_HEIGHT = 30
const SEPARATOR_HEIGHT = 9
const MENU_PADDING = 8
const MENU_MIN_WIDTH = 168

export class PopupMenuManager {
  private popups: BrowserWindow[] = []
  private resolveCallback: ((id: string | null) => void) | null = null
  private creatingPopup = false

  constructor() {
    this.registerIPC()
  }

  private registerIPC(): void {
    // Invoked from shortcuts renderer to show a popup menu
    ipcMain.handle(IPC_POPUP_MENU_SHOW, async (event, request: { items: PopupMenuItem[]; screenX: number; screenY: number; theme?: string }) => {
      // Resolve the sender window to use as parent (keeps popup above it on Windows)
      const senderWin = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return new Promise<string | null>((resolve) => {
        this.closeAll(false)
        this.resolveCallback = resolve
        this.createPopup(request.items, request.screenX, request.screenY, request.theme ?? 'dark', senderWin)
      })
    })

    // Item clicked in popup window
    ipcMain.on(IPC_POPUP_MENU_ITEM_CLICK, (_event, itemId: string) => {
      const cb = this.resolveCallback
      this.resolveCallback = null
      this.closeAll(false)
      cb?.(itemId)
    })

    // Popup requests to show a submenu
    ipcMain.on(IPC_POPUP_MENU_SHOW_SUBMENU, (_event, items: PopupMenuItem[], screenX: number, screenY: number) => {
      // Close existing submenus (keep the first/root popup)
      this.closeSubmenus()
      const theme = this.popups[0] ? this.getThemeFromPopup(this.popups[0]) : 'dark'
      const parent = this.popups[0]?.getParentWindow() ?? undefined
      this.createPopup(items, screenX, screenY, theme, parent)
    })

    // Popup requests to close submenu
    ipcMain.on(IPC_POPUP_MENU_CLOSE_SUBMENU, () => {
      this.closeSubmenus()
    })

    // Popup requests resize
    ipcMain.on(IPC_POPUP_MENU_RESIZE, (event, width: number, height: number) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && !win.isDestroyed()) {
        win.setSize(Math.ceil(width), Math.ceil(height))
        // Re-clamp position after resize to ensure it stays on screen
        this.clampToScreen(win)
      }
    })

    // Popup dismissed (Escape key)
    ipcMain.on(IPC_POPUP_MENU_DISMISS, () => {
      const cb = this.resolveCallback
      this.resolveCallback = null
      this.closeAll(false)
      cb?.(null)
    })
  }

  private getThemeFromPopup(win: BrowserWindow): string {
    try {
      const url = win.webContents.getURL()
      const params = new URL(url).searchParams
      return params.get('theme') ?? 'dark'
    } catch {
      return 'dark'
    }
  }

  private estimateSize(items: PopupMenuItem[]): { width: number; height: number } {
    let height = MENU_PADDING
    for (const item of items) {
      height += item.separator ? SEPARATOR_HEIGHT : ITEM_HEIGHT
    }
    return { width: MENU_MIN_WIDTH, height }
  }

  private createPopup(items: PopupMenuItem[], screenX: number, screenY: number, theme: string, parent?: BrowserWindow): void {
    this.creatingPopup = true

    const { width, height } = this.estimateSize(items)

    const win = new BrowserWindow({
      width,
      height,
      x: Math.round(screenX),
      y: Math.round(screenY),
      transparent: true,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      resizable: false,
      show: false,
      hasShadow: false,
      // Set parent so the popup stays above the calling window on Windows
      parent,
      webPreferences: {
        preload: join(__dirname, '../preload/popupMenu.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    win.setAlwaysOnTop(true, 'screen-saver')

    // Clamp to screen bounds
    this.clampToScreen(win)

    win.once('ready-to-show', () => {
      // Send menu items to popup renderer
      win.webContents.send(IPC_POPUP_MENU_INIT, { items, theme })
      // Show and focus in one step to avoid z-order race on Windows
      win.show()
      this.creatingPopup = false
    })

    // When popup loses focus, check if we should dismiss
    win.on('blur', () => {
      setTimeout(() => {
        if (this.creatingPopup) return
        const anyFocused = this.popups.some(p => !p.isDestroyed() && p.isFocused())
        if (!anyFocused) {
          const cb = this.resolveCallback
          this.resolveCallback = null
          this.closeAll(false)
          cb?.(null)
        }
      }, 150)
    })

    win.on('closed', () => {
      const idx = this.popups.indexOf(win)
      if (idx >= 0) this.popups.splice(idx, 1)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup-menu/index.html?theme=${theme}`)
    } else {
      win.loadFile(join(__dirname, '../renderer/popup-menu/index.html'), { query: { theme } })
    }

    this.popups.push(win)
  }

  private clampToScreen(win: BrowserWindow): void {
    const bounds = win.getBounds()
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const workArea = display.workArea

    let { x, y } = bounds
    if (x + bounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - bounds.width - 4
    }
    if (y + bounds.height > workArea.y + workArea.height) {
      y = workArea.y + workArea.height - bounds.height - 4
    }
    if (x < workArea.x) x = workArea.x + 4
    if (y < workArea.y) y = workArea.y + 4

    if (x !== bounds.x || y !== bounds.y) {
      win.setPosition(Math.round(x), Math.round(y))
    }
  }

  private closeSubmenus(): void {
    // Keep the first (root) popup, close the rest
    while (this.popups.length > 1) {
      const sub = this.popups.pop()
      if (sub && !sub.isDestroyed()) sub.close()
    }
  }

  private closeAll(resolveNull: boolean): void {
    for (const p of this.popups) {
      if (!p.isDestroyed()) p.close()
    }
    this.popups = []
    if (resolveNull && this.resolveCallback) {
      const cb = this.resolveCallback
      this.resolveCallback = null
      cb(null)
    }
  }

  destroy(): void {
    this.closeAll(true)
    ipcMain.removeHandler(IPC_POPUP_MENU_SHOW)
    ipcMain.removeAllListeners(IPC_POPUP_MENU_ITEM_CLICK)
    ipcMain.removeAllListeners(IPC_POPUP_MENU_SHOW_SUBMENU)
    ipcMain.removeAllListeners(IPC_POPUP_MENU_CLOSE_SUBMENU)
    ipcMain.removeAllListeners(IPC_POPUP_MENU_RESIZE)
    ipcMain.removeAllListeners(IPC_POPUP_MENU_DISMISS)
  }
}
