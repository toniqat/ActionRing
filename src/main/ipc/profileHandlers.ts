import { app, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import type { ConfigStore } from '../ConfigStore'
import type { WindowManager } from '../WindowManager'
import type { AppEntry, AppProfile, ButtonPreset, SlotConfig } from '@shared/config.types'
import {
  IPC_CONFIG_UPDATED,
  IPC_APP_ADD,
  IPC_APP_REMOVE,
  IPC_APP_PROFILE_ADD,
  IPC_APP_PROFILE_REMOVE,
  IPC_APP_PROFILE_RENAME,
  IPC_APP_PROFILE_SET_ACTIVE,
  IPC_APP_GET_ICON,
  IPC_PRESET_EXPORT,
  IPC_PRESET_IMPORT,
  IPC_APP_PROFILE_DUPLICATE,
  IPC_APP_PROFILE_EXPORT,
  IPC_APP_UPDATE_TARGET,
  IPC_APP_EXPORT_ALL_PROFILES,
  IPC_APP_IMPORT_ALL_PROFILES,
} from '@shared/ipc.types'

function uniqueProfileName(existingNames: string[], baseName: string): string {
  if (!existingNames.includes(baseName)) return baseName
  let i = 1
  while (existingNames.includes(`${baseName} (${i})`)) i++
  return `${baseName} (${i})`
}

function pushConfigUpdate(windowManager: WindowManager, configStore: ConfigStore): void {
  const settingsWin = windowManager.getSettingsWindow()
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send(IPC_CONFIG_UPDATED, configStore.get())
  }
}

export function registerProfileHandlers(
  configStore: ConfigStore,
  windowManager: WindowManager
): void {
  // ── App CRUD ───────────────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_APP_ADD,
    (_event, exeName: string, displayName: string, iconDataUrl?: string): AppEntry => {
      const entry = configStore.addApp(exeName, displayName, iconDataUrl)
      pushConfigUpdate(windowManager, configStore)
      return entry
    }
  )

  ipcMain.handle(IPC_APP_REMOVE, (_event, appId: string): void => {
    configStore.removeApp(appId)
    pushConfigUpdate(windowManager, configStore)
  })

  // ── Profile CRUD within an app ─────────────────────────────────────────────

  ipcMain.handle(
    IPC_APP_PROFILE_ADD,
    (_event, appId: string, name: string): AppProfile => {
      const profile = configStore.addProfileToApp(appId, name)
      pushConfigUpdate(windowManager, configStore)
      return profile
    }
  )

  ipcMain.handle(
    IPC_APP_PROFILE_REMOVE,
    (_event, appId: string, profileId: string): void => {
      configStore.removeProfileFromApp(appId, profileId)
      pushConfigUpdate(windowManager, configStore)
    }
  )

  ipcMain.handle(
    IPC_APP_PROFILE_RENAME,
    (_event, appId: string, profileId: string, name: string): void => {
      configStore.renameProfileInApp(appId, profileId, name)
      pushConfigUpdate(windowManager, configStore)
    }
  )

  ipcMain.handle(
    IPC_APP_PROFILE_DUPLICATE,
    (_event, appId: string, profileId: string): AppProfile => {
      const profile = configStore.duplicateProfileInApp(appId, profileId)
      pushConfigUpdate(windowManager, configStore)
      return profile
    }
  )

  ipcMain.handle(
    IPC_APP_PROFILE_EXPORT,
    async (_event, appId: string, profileId: string): Promise<void> => {
      const appEntry = configStore.getAppById(appId)
      if (!appEntry) return
      const profile = appEntry.profiles.find((p) => p.id === profileId)
      if (!profile) return

      const result = await dialog.showSaveDialog({
        title: 'Export Profile',
        defaultPath: `${profile.name.replace(/[^a-z0-9_\-]/gi, '_')}_profile.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return

      const data = {
        version: 1,
        exeName: appEntry.exeName,
        displayName: appEntry.displayName,
        iconDataUrl: appEntry.iconDataUrl,
        profile,
      }
      writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    }
  )

  // ── App-level export/import (all profiles) ────────────────────────────────

  ipcMain.handle(
    IPC_APP_EXPORT_ALL_PROFILES,
    async (_event, appId: string): Promise<void> => {
      const appEntry = configStore.getAppById(appId)
      if (!appEntry) return

      const safeName = appEntry.displayName.replace(/[^a-z0-9_\-]/gi, '_')
      const result = await dialog.showSaveDialog({
        title: 'Export App Profiles',
        defaultPath: `${safeName}_profiles.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return

      const data = {
        __type: 'actionring-app-export',
        version: 1,
        exeName: appEntry.exeName,
        displayName: appEntry.displayName,
        iconDataUrl: appEntry.iconDataUrl,
        profiles: appEntry.profiles,
      }
      writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    }
  )

  ipcMain.handle(
    IPC_APP_IMPORT_ALL_PROFILES,
    async (_event, appId: string): Promise<boolean> => {
      const appEntry = configStore.getAppById(appId)
      if (!appEntry) return false

      const result = await dialog.showOpenDialog({
        title: 'Import App Profiles',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return false

      try {
        const raw = readFileSync(result.filePaths[0], 'utf-8')
        const data = JSON.parse(raw)

        let profilesToImport: AppProfile[] = []

        if (data.__type === 'actionring-app-export' && data.version === 1 && Array.isArray(data.profiles)) {
          // App-level export format
          profilesToImport = data.profiles as AppProfile[]
        } else if (data.version === 1 && data.profile && Array.isArray((data.profile as AppProfile).slots)) {
          // Individual profile export format
          profilesToImport = [data.profile as AppProfile]
        } else {
          return false
        }

        const cfg = configStore.get()
        const appIdx = cfg.apps.findIndex((a) => a.id === appId)
        if (appIdx < 0) return false

        const generateId = () => Math.random().toString(36).slice(2, 10)
        const namesSoFar = cfg.apps[appIdx].profiles.map((p) => p.name)
        const newProfiles: AppProfile[] = []
        for (const p of profilesToImport) {
          const name = uniqueProfileName(namesSoFar, p.name)
          namesSoFar.push(name)
          newProfiles.push({ ...p, id: generateId(), name })
        }

        const updatedApp = { ...cfg.apps[appIdx] }
        updatedApp.profiles = [...updatedApp.profiles, ...newProfiles]
        if (newProfiles.length > 0) {
          updatedApp.activeProfileId = newProfiles[newProfiles.length - 1].id
        }

        const newApps = [...cfg.apps]
        newApps[appIdx] = updatedApp
        configStore.save({ ...cfg, apps: newApps })
        pushConfigUpdate(windowManager, configStore)
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle(
    IPC_APP_UPDATE_TARGET,
    (_event, appId: string, exeName: string, displayName: string, iconDataUrl?: string): void => {
      configStore.updateAppTarget(appId, exeName, displayName, iconDataUrl)
      pushConfigUpdate(windowManager, configStore)
    }
  )

  ipcMain.handle(
    IPC_APP_PROFILE_SET_ACTIVE,
    (_event, appId: string, profileId: string) => {
      const updated = configStore.setActiveProfileForApp(appId, profileId)
      pushConfigUpdate(windowManager, configStore)
      return updated
    }
  )

  // ── App icon extraction ────────────────────────────────────────────────────

  ipcMain.handle(IPC_APP_GET_ICON, async (_event, exePath: string): Promise<string | null> => {
    try {
      const icon = await app.getFileIcon(exePath, { size: 'normal' })
      return icon.toDataURL()
    } catch {
      return null
    }
  })

  // ── Button preset export/import ────────────────────────────────────────────

  ipcMain.handle(IPC_PRESET_EXPORT, async (_event, slot: SlotConfig): Promise<void> => {
    const result = await dialog.showSaveDialog({
      title: 'Export Button Preset',
      defaultPath: `${slot.label.replace(/[^a-z0-9_\-]/gi, '_')}_preset.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return

    const preset: ButtonPreset = { version: 1, name: slot.label, slot }
    writeFileSync(result.filePath, JSON.stringify(preset, null, 2), 'utf-8')
  })

  ipcMain.handle(IPC_PRESET_IMPORT, async (): Promise<SlotConfig | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Import Button Preset',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    try {
      const raw = readFileSync(result.filePaths[0], 'utf-8')
      const preset = JSON.parse(raw) as ButtonPreset
      if (preset.version !== 1 || !preset.slot) return null
      return { ...preset.slot, id: Math.random().toString(36).slice(2, 10) }
    } catch {
      return null
    }
  })
}
