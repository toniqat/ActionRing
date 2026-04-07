import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, AppEntry, AppProfile, SlotConfig } from '@shared/config.types'
import type { ConfigSavePayload, AppearanceSlotData, ShortcutsSlotData } from '@shared/ipc.types'
import {
  IPC_CONFIG_GET,
  IPC_CONFIG_SAVE,
  IPC_CONFIG_UPDATED,
  IPC_FILE_PICK_EXE,
  IPC_FILE_PICK_ICON,
  IPC_APPEARANCE_OPEN,
  IPC_APPEARANCE_UPDATED,
  IPC_SHORTCUTS_OPEN,
  IPC_SHORTCUTS_UPDATED,
  IPC_SHORTCUTS_COMMITTED,
  IPC_WINDOW_MINIMIZE,
  IPC_WINDOW_MAXIMIZE,
  IPC_APP_ADD,
  IPC_APP_REMOVE,
  IPC_APP_PROFILE_ADD,
  IPC_APP_PROFILE_REMOVE,
  IPC_APP_PROFILE_RENAME,
  IPC_APP_PROFILE_SET_ACTIVE,
  IPC_APP_GET_ICON,
  IPC_APP_GET_PROCESSES,
  IPC_APP_IMPORT_PROFILE,
  IPC_PRESET_EXPORT,
  IPC_PRESET_IMPORT,
  IPC_APP_PROFILE_DUPLICATE,
  IPC_APP_PROFILE_EXPORT,
  IPC_APP_UPDATE_TARGET,
  IPC_APP_EXPORT_ALL_PROFILES,
  IPC_APP_IMPORT_ALL_PROFILES,
  IPC_TRIGGER_START_MOUSE_CAPTURE,
  IPC_TRIGGER_CANCEL_MOUSE_CAPTURE,
  IPC_TRIGGER_MOUSE_CAPTURED,
  IPC_CONFIG_RESET,
  IPC_CONFIG_EXPORT_GLOBAL,
  IPC_CONFIG_IMPORT_GLOBAL,
  IPC_APP_GET_VERSION,
  IPC_UPDATE_CHECK,
  IPC_SHELL_OPEN_EXTERNAL,
  IPC_ICONS_READ_SVG,
  IPC_ICONS_GET_RESOURCE,
  IPC_ICONS_ADD_RECENT,
  IPC_WINDOW_CLOSE,
  type UpdateStatus,
  type ResourceIconEntry,
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('settingsAPI', {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CONFIG_GET),
  saveConfig: (payload: ConfigSavePayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CONFIG_SAVE, payload),
  onConfigUpdated: (callback: (config: AppConfig) => void) => {
    ipcRenderer.on(IPC_CONFIG_UPDATED, (_event, config) => callback(config))
  },
  pickExe: (): Promise<string | null> => ipcRenderer.invoke(IPC_FILE_PICK_EXE),
  pickIcon: (): Promise<string | null> => ipcRenderer.invoke(IPC_FILE_PICK_ICON),

  openAppearanceEditor: (data: AppearanceSlotData): Promise<void> =>
    ipcRenderer.invoke(IPC_APPEARANCE_OPEN, data),
  onAppearanceUpdated: (callback: (data: AppearanceSlotData) => void) => {
    ipcRenderer.on(IPC_APPEARANCE_UPDATED, (_event, data) => callback(data))
  },

  openShortcutsEditor: (data: ShortcutsSlotData): Promise<void> =>
    ipcRenderer.invoke(IPC_SHORTCUTS_OPEN, data),
  onShortcutsUpdated: (callback: (data: ShortcutsSlotData) => void): void => {
    ipcRenderer.on(IPC_SHORTCUTS_UPDATED, (_event, data) => callback(data))
  },
  onShortcutsCommitted: (callback: () => void): void => {
    ipcRenderer.on(IPC_SHORTCUTS_COMMITTED, () => callback())
  },

  minimizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MINIMIZE),
  maximizeWindow: (): void => ipcRenderer.send(IPC_WINDOW_MAXIMIZE),
  closeWindow: (): void => ipcRenderer.send(IPC_WINDOW_CLOSE),

  // ── App management ────────────────────────────────────────────────────────
  addApp: (exeName: string, displayName: string, iconDataUrl?: string): Promise<AppEntry> =>
    ipcRenderer.invoke(IPC_APP_ADD, exeName, displayName, iconDataUrl),
  removeApp: (appId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_REMOVE, appId),

  // ── Profile management within an app ─────────────────────────────────────
  addProfileToApp: (appId: string, name: string): Promise<AppProfile> =>
    ipcRenderer.invoke(IPC_APP_PROFILE_ADD, appId, name),
  removeProfileFromApp: (appId: string, profileId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_PROFILE_REMOVE, appId, profileId),
  renameProfileInApp: (appId: string, profileId: string, name: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_PROFILE_RENAME, appId, profileId, name),
  setActiveProfileForApp: (appId: string, profileId: string): Promise<AppConfig> =>
    ipcRenderer.invoke(IPC_APP_PROFILE_SET_ACTIVE, appId, profileId),

  // ── App icon extraction ───────────────────────────────────────────────────
  getAppIcon: (exePath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_APP_GET_ICON, exePath),

  // ── Running process discovery ─────────────────────────────────────────────
  getRunningProcesses: (): Promise<import('@shared/ipc.types').RunningProcess[]> =>
    ipcRenderer.invoke(IPC_APP_GET_PROCESSES),

  // ── App profile import ────────────────────────────────────────────────────
  importAppProfile: (): Promise<AppEntry | null> =>
    ipcRenderer.invoke(IPC_APP_IMPORT_PROFILE),

  // ── Button preset import/export ───────────────────────────────────────────
  exportPreset: (slot: SlotConfig): Promise<void> =>
    ipcRenderer.invoke(IPC_PRESET_EXPORT, slot),
  importPreset: (): Promise<SlotConfig | null> =>
    ipcRenderer.invoke(IPC_PRESET_IMPORT),

  // ── Extended profile operations ───────────────────────────────────────────
  duplicateProfileInApp: (appId: string, profileId: string): Promise<AppProfile> =>
    ipcRenderer.invoke(IPC_APP_PROFILE_DUPLICATE, appId, profileId),
  exportProfile: (appId: string, profileId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_PROFILE_EXPORT, appId, profileId),
  updateAppTarget: (appId: string, exeName: string, displayName: string, iconDataUrl?: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_UPDATE_TARGET, appId, exeName, displayName, iconDataUrl),

  // ── App-level export/import (all profiles) ───────────────────────────────
  exportAppProfiles: (appId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_EXPORT_ALL_PROFILES, appId),
  importAppProfiles: (appId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_APP_IMPORT_ALL_PROFILES, appId),

  // ── Global backup / restore / reset ──────────────────────────────────────
  resetConfig: (): Promise<import('@shared/config.types').AppConfig> =>
    ipcRenderer.invoke(IPC_CONFIG_RESET),
  exportAllData: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CONFIG_EXPORT_GLOBAL),
  importAllData: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CONFIG_IMPORT_GLOBAL),

  // ── Trigger mouse capture ─────────────────────────────────────────────────
  startMouseCapture: (cb: (button: number) => void): void => {
    ipcRenderer.once(IPC_TRIGGER_MOUSE_CAPTURED, (_event, button: number) => cb(button))
    ipcRenderer.send(IPC_TRIGGER_START_MOUSE_CAPTURE)
  },
  cancelMouseCapture: (): void => {
    ipcRenderer.send(IPC_TRIGGER_CANCEL_MOUSE_CAPTURE)
  },

  // ── Update check ──────────────────────────────────────────────────────────
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC_APP_GET_VERSION),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC_UPDATE_CHECK),

  // ── Shell utilities ───────────────────────────────────────────────────────
  openExternalUrl: (url: string): Promise<void> => ipcRenderer.invoke(IPC_SHELL_OPEN_EXTERNAL, url),

  /** Read raw SVG text for an absolute .svg file path. Returns empty string on error. */
  readSvgContent: (absPath: string): Promise<string> =>
    ipcRenderer.invoke(IPC_ICONS_READ_SVG, absPath),

  /** Fetch bundled resource SVG icons (resources/icons/). */
  getResourceIcons: (): Promise<ResourceIconEntry[]> =>
    ipcRenderer.invoke(IPC_ICONS_GET_RESOURCE),

  /** Record a recently used icon ref (builtin name or abs path). */
  addRecentIcon: (iconRef: string): void => {
    ipcRenderer.send(IPC_ICONS_ADD_RECENT, iconRef)
  },
})
