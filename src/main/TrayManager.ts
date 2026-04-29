import { Tray, Menu, app, nativeImage, Notification } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { ConfigStore } from './ConfigStore'

export class TrayManager {
  private tray: Tray | null = null
  private configStore: ConfigStore
  private onOpenSettings: () => void

  constructor(configStore: ConfigStore, onOpenSettings: () => void) {
    this.configStore = configStore
    this.onOpenSettings = onOpenSettings
  }

  create(): void {
    const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.svg'
    const iconPath = is.dev
      ? join(process.cwd(), 'resources/logo', iconFile)
      : join(process.resourcesPath, 'logo', iconFile)

    let icon: Electron.NativeImage
    try {
      icon = nativeImage.createFromPath(iconPath)
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty()
      } else if (process.platform === 'win32') {
        // Resize to 16×16 with high-quality resampling so Windows tray
        // doesn't produce stair-step aliasing from a large ICO frame.
        icon = icon.resize({ width: 16, height: 16, quality: 'best' })
      }
    } catch {
      icon = nativeImage.createEmpty()
    }

    this.tray = new Tray(icon)
    this.tray.setToolTip('Action Ring')
    this.tray.on('double-click', () => this.onOpenSettings())
    this.updateMenu()
  }

  updateMenu(): void {
    if (!this.tray) return
    const config = this.configStore.get()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Action Ring',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open Settings',
        click: () => this.onOpenSettings()
      },
      {
        label: config.enabled ? 'Disable' : 'Enable',
        click: () => {
          this.configStore.toggleEnabled()
          this.updateMenu()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  showNotification(title: string, body: string): void {
    if (!this.tray) return
    if (process.platform === 'win32') {
      // On Windows the header icon comes from the Start Menu shortcut registered
      // with the matching AppUserModelId (created in index.ts at startup).
      // Passing `icon` here would insert a large thumbnail image in the toast body,
      // not the small header icon — so we omit it on Windows.
      new Notification({ title, body }).show()
    } else {
      const iconPath = is.dev
        ? join(process.cwd(), 'resources/logo', 'icon.svg')
        : join(process.resourcesPath, 'logo', 'icon.svg')
      new Notification({ title, body, icon: iconPath }).show()
    }
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
