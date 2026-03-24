import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export class WindowManager {
  private ringWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null

  createRingWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 360,
      height: 360,
      transparent: true,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      resizable: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/ring.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setIgnoreMouseEvents(false)

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/ring/index.html`)
    } else {
      win.loadFile(join(__dirname, '../renderer/ring.html'))
    }

    this.ringWindow = win
    return win
  }

  createSettingsWindow(): BrowserWindow {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus()
      return this.settingsWindow
    }

    const win = new BrowserWindow({
      width: 1040,
      height: 600,
      frame: false,
      resizable: false,
      show: false,
      backgroundColor: '#161b22',
      webPreferences: {
        preload: join(__dirname, '../preload/settings.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    win.on('closed', () => {
      this.settingsWindow = null
    })

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[WindowManager] Settings window failed to load:', errorCode, errorDescription, validatedURL)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings/index.html`)
    } else {
      win.loadFile(join(__dirname, '../renderer/settings.html'))
    }

    this.settingsWindow = win
    return win
  }

  showSettings(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) this.settingsWindow.restore()
      this.settingsWindow.focus()
    } else {
      this.createSettingsWindow()
    }
  }

  getRingWindow(): BrowserWindow | null {
    return this.ringWindow
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow
  }

  hideRing(): void {
    if (this.ringWindow && !this.ringWindow.isDestroyed()) {
      this.ringWindow.hide()
    }
  }
}
