import { ipcMain, dialog, app as electronApp } from 'electron'
import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import { promisify } from 'util'
import type { ConfigStore } from '../ConfigStore'
import type { WindowManager } from '../WindowManager'
import type { AppProfile } from '@shared/config.types'
import {
  IPC_APP_GET_PROCESSES,
  IPC_APP_IMPORT_PROFILE,
  IPC_CONFIG_UPDATED,
  type RunningProcess,
} from '@shared/ipc.types'

const execFileAsync = promisify(execFile)

function uniqueProfileName(existingNames: string[], baseName: string): string {
  if (!existingNames.includes(baseName)) return baseName
  let i = 1
  while (existingNames.includes(`${baseName} (${i})`)) i++
  return `${baseName} (${i})`
}

function pushConfigUpdate(windowManager: WindowManager, configStore: ConfigStore): void {
  const win = windowManager.getSettingsWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CONFIG_UPDATED, configStore.get())
  }
}

/** Query visible windows on Windows via PowerShell, dedup by name, extract icons. */
async function getWindowsProcesses(): Promise<RunningProcess[]> {
  const script = [
    'Get-Process',
    '| Where-Object {$_.MainWindowHandle -ne 0}',
    '| Select-Object Name, @{N="Path";E={try{$_.Path}catch{$null}}}',
    '| Sort-Object Name',
    '| ConvertTo-Json -Compress',
  ].join(' ')

  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { timeout: 8000 }
  )

  const raw = JSON.parse(stdout.trim())
  const procs: Array<{ Name: string; Path: string | null }> = Array.isArray(raw) ? raw : [raw]

  // Deduplicate by lowercase name
  const seen = new Set<string>()
  const unique: typeof procs = []
  for (const p of procs) {
    const key = p.Name.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(p)
    }
  }

  // Extract icons in parallel
  const results: RunningProcess[] = await Promise.all(
    unique.map(async (p): Promise<RunningProcess> => {
      let iconDataUrl: string | undefined
      if (p.Path) {
        try {
          const icon = await electronApp.getFileIcon(p.Path, { size: 'normal' })
          iconDataUrl = icon.toDataURL()
        } catch { /* ignore — icon is optional */ }
      }
      return {
        exeName: `${p.Name}.exe`,
        displayName: p.Name,
        exePath: p.Path,
        iconDataUrl,
      }
    })
  )

  return results
}

export function registerProcessHandlers(
  configStore: ConfigStore,
  windowManager: WindowManager
): void {
  // ── Get running processes ────────────────────────────────────────────────────

  ipcMain.handle(IPC_APP_GET_PROCESSES, async (): Promise<RunningProcess[]> => {
    try {
      if (process.platform === 'win32') {
        return await getWindowsProcesses()
      }
      // macOS / Linux — not implemented yet
      return []
    } catch (err) {
      console.error('[processHandlers] get-processes failed:', err)
      return []
    }
  })

  // ── Import App Profile from JSON ─────────────────────────────────────────────

  ipcMain.handle(IPC_APP_IMPORT_PROFILE, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import App Profile',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    try {
      const raw = readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(raw)

      if (data.version !== 1 || !data.exeName) return null

      const exeNameLower = (data.exeName as string).toLowerCase()
      const displayName: string = data.displayName ?? (data.exeName as string).replace(/\.exe$/i, '')
      const generateId = () => Math.random().toString(36).slice(2, 10)

      // App-level export (all profiles): __type === 'actionring-app-export', has profiles[]
      if (data.__type === 'actionring-app-export' && Array.isArray(data.profiles)) {
        const cfg = configStore.get()
        const existingApp = cfg.apps.find((a) => a.exeName?.toLowerCase() === exeNameLower)

        if (existingApp) {
          // Merge into existing app with unique name resolution
          const namesSoFar = existingApp.profiles.map((p) => p.name)
          const resolvedProfiles: AppProfile[] = []
          for (const p of data.profiles as AppProfile[]) {
            const name = uniqueProfileName(namesSoFar, p.name)
            namesSoFar.push(name)
            resolvedProfiles.push({ ...p, id: generateId(), name })
          }
          const lastId = resolvedProfiles[resolvedProfiles.length - 1]?.id ?? existingApp.activeProfileId
          const newApps = cfg.apps.map((a) =>
            a.id !== existingApp.id ? a : {
              ...a,
              profiles: [...a.profiles, ...resolvedProfiles],
              activeProfileId: lastId,
            }
          )
          configStore.save({ ...cfg, apps: newApps })
          pushConfigUpdate(windowManager, configStore)
          return configStore.getAppById(existingApp.id) ?? null
        }

        // Create new app and replace its seeded profile with all imported profiles
        const entry = configStore.addApp(data.exeName as string, displayName, data.iconDataUrl)
        const importedProfiles = (data.profiles as AppProfile[]).map((p) => ({
          ...p,
          id: generateId(),
        }))
        const cfg2 = configStore.get()
        const lastId = importedProfiles[importedProfiles.length - 1]?.id
        const newApps = cfg2.apps.map((a) => {
          if (a.id !== entry.id) return a
          return { ...a, profiles: importedProfiles, activeProfileId: lastId ?? a.activeProfileId }
        })
        configStore.save({ ...cfg2, apps: newApps })
        pushConfigUpdate(windowManager, configStore)
        return configStore.getAppById(entry.id) ?? null
      }

      // Individual profile export: has profile{}
      if (!data.profile) return null
      const profile = data.profile as AppProfile
      if (!Array.isArray(profile.slots)) return null

      const cfg = configStore.get()
      const existingApp = cfg.apps.find((a) => a.exeName?.toLowerCase() === exeNameLower)

      if (existingApp) {
        // Append to existing app with unique name resolution
        const existingNames = existingApp.profiles.map((p) => p.name)
        const newProfile: AppProfile = {
          ...profile,
          id: generateId(),
          name: uniqueProfileName(existingNames, profile.name || 'Imported Profile'),
        }
        const newApps = cfg.apps.map((a) =>
          a.id !== existingApp.id ? a : {
            ...a,
            profiles: [...a.profiles, newProfile],
            activeProfileId: newProfile.id,
          }
        )
        configStore.save({ ...cfg, apps: newApps })
        pushConfigUpdate(windowManager, configStore)
        return configStore.getAppById(existingApp.id) ?? null
      }

      // Create new app and overwrite its seeded default profile
      const entry = configStore.addApp(data.exeName as string, displayName, data.iconDataUrl)
      const cfg2 = configStore.get()
      const newApps = cfg2.apps.map((a) => {
        if (a.id !== entry.id) return a
        const newProfiles = a.profiles.map((p) =>
          p.id === a.activeProfileId
            ? { ...p, name: profile.name || p.name, slots: profile.slots, appearance: profile.appearance ?? p.appearance }
            : p
        )
        return { ...a, profiles: newProfiles }
      })
      configStore.save({ ...cfg2, apps: newApps })
      pushConfigUpdate(windowManager, configStore)
      return configStore.getAppById(entry.id) ?? null
    } catch (err) {
      console.error('[processHandlers] import-profile failed:', err)
      return null
    }
  })
}
