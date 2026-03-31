import type { SlotConfig, AppConfig, AppearanceConfig, AppEntry, AppProfile, Language } from './config.types'

// ── Custom icon library ────────────────────────────────────────────────────
export interface CustomIconEntry {
  id: string
  absPath: string   // absolute path inside userData/custom-icons/
  name: string      // display name (original filename without extension)
}

// IPC channels for icon management
export const IPC_ICONS_GET_CUSTOM    = 'icons:get-custom'
export const IPC_ICONS_ADD_CUSTOM    = 'icons:add-custom'
export const IPC_ICONS_REMOVE_CUSTOM = 'icons:remove-custom'
export const IPC_ICONS_GET_RECENT    = 'icons:get-recent'
export const IPC_ICONS_ADD_RECENT    = 'icons:add-recent'

// Appearance editor window
export const IPC_APPEARANCE_OPEN = 'appearance:open'
export const IPC_APPEARANCE_GET_DATA = 'appearance:get-data'
export const IPC_APPEARANCE_UPDATE = 'appearance:update'
export const IPC_APPEARANCE_UPDATED = 'appearance:updated'
export const IPC_APPEARANCE_DATA_REFRESH = 'appearance:data-refresh'

// Settings window controls (frame:false)
export const IPC_WINDOW_MINIMIZE = 'window:minimize'
export const IPC_WINDOW_MAXIMIZE = 'window:maximize'

// Appearance editor panel sizes
export const IPC_APPEARANCE_PANEL_SIZES = 'appearance:panel-sizes'

// ── Trigger mouse capture (settings UI) ──────────────────────────────────────
export const IPC_TRIGGER_START_MOUSE_CAPTURE  = 'trigger:start-mouse-capture'
export const IPC_TRIGGER_CANCEL_MOUSE_CAPTURE = 'trigger:cancel-mouse-capture'
export const IPC_TRIGGER_MOUSE_CAPTURED       = 'trigger:mouse-captured'

export const IPC_RING_SHOW = 'ring:show'
export const IPC_RING_HIDE = 'ring:hide'
export const IPC_RING_IDLE = 'ring:idle'
export const IPC_RING_EXECUTE = 'ring:execute'
export const IPC_RING_DISMISS = 'ring:dismiss'
export const IPC_RING_CURSOR_MOVE = 'ring:cursor-move'

export const IPC_CONFIG_UPDATED = 'config:updated'
export const IPC_CONFIG_GET = 'config:get'
export const IPC_CONFIG_SAVE = 'config:save'
export const IPC_FILE_PICK_EXE = 'file:pick-exe'
export const IPC_FILE_PICK_ICON = 'file:pick-icon'
export const IPC_SHORTCUT_TEST = 'shortcut:test'

// ── App management (v7+) ──────────────────────────────────────────────────────
export const IPC_APP_ADD                 = 'app:add'
export const IPC_APP_REMOVE              = 'app:remove'
export const IPC_APP_PROFILE_ADD         = 'app:profile:add'
export const IPC_APP_PROFILE_REMOVE      = 'app:profile:remove'
export const IPC_APP_PROFILE_RENAME      = 'app:profile:rename'
export const IPC_APP_PROFILE_SET_ACTIVE  = 'app:profile:set-active'
export const IPC_APP_GET_ICON            = 'app:get-icon'

// ── Running process discovery + app profile import ────────────────────────────
export const IPC_APP_GET_PROCESSES  = 'app:get-processes'
export const IPC_APP_IMPORT_PROFILE = 'app:import-profile'

// ── Button preset import/export ───────────────────────────────────────────────
export const IPC_PRESET_EXPORT = 'preset:export'
export const IPC_PRESET_IMPORT = 'preset:import'

// ── Extended profile operations (v7.1+) ──────────────────────────────────────
export const IPC_APP_PROFILE_DUPLICATE    = 'app:profile:duplicate'
export const IPC_APP_PROFILE_EXPORT       = 'app:profile:export'
export const IPC_APP_UPDATE_TARGET        = 'app:update-target'
export const IPC_APP_EXPORT_ALL_PROFILES  = 'app:export-all-profiles'
export const IPC_APP_IMPORT_ALL_PROFILES  = 'app:import-all-profiles'

// ── Global config backup/restore + reset ─────────────────────────────────────
export const IPC_CONFIG_RESET         = 'config:reset'
export const IPC_CONFIG_EXPORT_GLOBAL = 'config:export-global'
export const IPC_CONFIG_IMPORT_GLOBAL = 'config:import-global'

export interface RingShowPayload {
  slots: SlotConfig[]
  appearance: AppearanceConfig
  cursorX: number
  cursorY: number
  resolvedTheme: 'light' | 'dark'
}

export interface RingExecutePayload {
  slot: SlotConfig
}

export interface RingCursorMovePayload {
  x: number // CSS px relative to ring window top-left
  y: number
}

export interface ConfigSavePayload {
  config: AppConfig
}

export interface AppearanceSlotData {
  slot: SlotConfig
  slotIndex: number
  isSubSlot: boolean
  folderIndex: number | null
  subSlotIndex: number | null
  theme: 'light' | 'dark'
  panelSizes?: [number, number, number]
  language?: Language
}

/** A discovered running process with optional icon and exe path. */
export interface RunningProcess {
  exeName: string       // e.g. 'chrome.exe'
  displayName: string   // friendly name (process Name without extension)
  exePath: string | null
  iconDataUrl?: string
}

// Re-export for convenience
export type { AppEntry, AppProfile }
