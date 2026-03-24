import { Tray, Menu, app, nativeImage } from 'electron'
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
    const iconPath = is.dev
      ? join(process.cwd(), 'resources/icons/tray-icon.png')
      : join(process.resourcesPath, 'icons/tray-icon.png')

    let icon: Electron.NativeImage
    try {
      icon = nativeImage.createFromPath(iconPath)
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty()
      }
    } catch {
      icon = nativeImage.createEmpty()
    }

    this.tray = new Tray(icon)
    this.tray.setToolTip('ActionRing')
    this.updateMenu()
  }

  updateMenu(): void {
    if (!this.tray) return
    const config = this.configStore.get()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'ActionRing',
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

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
