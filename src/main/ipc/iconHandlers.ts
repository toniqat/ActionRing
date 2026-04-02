import { app, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readdirSync, readFileSync } from 'fs'
import type { IconStore } from '../IconStore'
import {
  IPC_ICONS_GET_CUSTOM,
  IPC_ICONS_ADD_CUSTOM,
  IPC_ICONS_REMOVE_CUSTOM,
  IPC_ICONS_GET_RECENT,
  IPC_ICONS_ADD_RECENT,
  IPC_ICONS_GET_RESOURCE,
  IPC_ICONS_READ_SVG,
} from '@shared/ipc.types'
import type { ResourceIconEntry } from '@shared/ipc.types'

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

  ipcMain.handle(IPC_ICONS_GET_RESOURCE, (): ResourceIconEntry[] => {
    const iconsDir = app.isPackaged
      ? join(process.resourcesPath, 'icons')
      : join(app.getAppPath(), 'resources', 'icons')
    let files: string[]
    try {
      files = readdirSync(iconsDir)
    } catch {
      return []
    }
    const skip = new Set(['icon.svg', 'icon.ico', 'tray-icon.svg', 'README.md', 'github-logo.svg'])
    return files
      .filter((f) => f.endsWith('.svg') && !skip.has(f))
      .map((filename) => {
        const absPath = join(iconsDir, filename)
        let svgContent = ''
        try {
          svgContent = readFileSync(absPath, 'utf-8')
        } catch {
          // ignore read errors
        }
        return {
          name: filename
            .replace(/\.svg$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          filename,
          absPath,
          svgContent,
        }
      })
  })

  ipcMain.handle(IPC_ICONS_READ_SVG, (_event, absPath: string): string => {
    if (typeof absPath !== 'string' || !absPath.endsWith('.svg')) return ''
    try {
      return readFileSync(absPath, 'utf-8')
    } catch {
      return ''
    }
  })
}
