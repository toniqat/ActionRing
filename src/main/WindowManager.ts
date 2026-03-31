import { BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

function getAppIcon(): Electron.NativeImage {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.svg'
  const iconPath = is.dev
    ? join(process.cwd(), 'resources/icons', iconFile)
    : join(process.resourcesPath, 'icons', iconFile)
  try {
    const img = nativeImage.createFromPath(iconPath)
    return img.isEmpty() ? nativeImage.createEmpty() : img
  } catch {
    return nativeImage.createEmpty()
  }
}

export class WindowManager {
  private ringWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private appearanceWindow: BrowserWindow | null = null
  private settingsHideCallback: (() => void) | null = null
  private quitting = false

  setSettingsHideCallback(cb: () => void): void {
    this.settingsHideCallback = cb
  }

  setQuitting(): void {
    this.quitting = true
  }

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
      minWidth: 900,
      minHeight: 500,
      frame: false,
      resizable: true,
      show: false,
      icon: getAppIcon(),
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

    win.on('close', (e) => {
      if (!this.quitting) {
        e.preventDefault()
        win.hide()
        this.settingsHideCallback?.()
      }
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

  createAppearanceWindow(theme: 'light' | 'dark' = 'dark', parent?: BrowserWindow): BrowserWindow {
    if (this.appearanceWindow && !this.appearanceWindow.isDestroyed()) {
      this.appearanceWindow.focus()
      return this.appearanceWindow
    }

    const bgColor = theme === 'light' ? '#ffffff' : '#21262d'

    const win = new BrowserWindow({
      width: 720,
      height: 400,
      minWidth: 560,
      minHeight: 340,
      frame: false,
      resizable: true,
      show: false,
      modal: false,
      parent: parent,
      icon: getAppIcon(),
      backgroundColor: bgColor,
      webPreferences: {
        preload: join(__dirname, '../preload/appearance.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    win.on('closed', () => {
      this.appearanceWindow = null
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/appearance/index.html?theme=${theme}`)
      win.webContents.openDevTools({ mode: 'detach' })
    } else {
      win.loadFile(join(__dirname, '../renderer/appearance.html'), { query: { theme } })
    }

    this.appearanceWindow = win
    return win
  }

  showSettings(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) this.settingsWindow.restore()
      if (!this.settingsWindow.isVisible()) this.settingsWindow.show()
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

  getAppearanceWindow(): BrowserWindow | null {
    return this.appearanceWindow
  }

  hideRing(): void {
    if (this.ringWindow && !this.ringWindow.isDestroyed()) {
      this.ringWindow.hide()
    }
  }
}
