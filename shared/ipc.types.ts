import type { SlotConfig, AppConfig, AppearanceConfig, AppEntry, AppProfile, Language, ShortcutEntry, ShortcutGroup } from './config.types'

// ── Custom icon library ────────────────────────────────────────────────────
export interface CustomIconEntry {
  id: string
  absPath: string   // absolute path inside userData/custom-icons/
  name: string      // display name (original filename without extension)
}

/** An SVG icon from the bundled resources/icons/ directory. */
export interface ResourceIconEntry {
  name: string       // human-readable label (e.g. "play arrow")
  filename: string   // file name (e.g. "play_arrow.svg")
  absPath: string    // absolute path resolved at runtime
  svgContent: string // raw SVG markup for inline rendering
}

// IPC channels for icon management
export const IPC_ICONS_GET_CUSTOM    = 'icons:get-custom'
export const IPC_ICONS_ADD_CUSTOM    = 'icons:add-custom'
export const IPC_ICONS_REMOVE_CUSTOM = 'icons:remove-custom'
export const IPC_ICONS_GET_RECENT    = 'icons:get-recent'
export const IPC_ICONS_ADD_RECENT    = 'icons:add-recent'
export const IPC_ICONS_GET_RESOURCE  = 'icons:get-resource'
export const IPC_ICONS_READ_SVG      = 'icons:read-svg'

// Appearance editor window
export const IPC_APPEARANCE_OPEN = 'appearance:open'
export const IPC_APPEARANCE_GET_DATA = 'appearance:get-data'
export const IPC_APPEARANCE_UPDATE = 'appearance:update'
export const IPC_APPEARANCE_UPDATED = 'appearance:updated'
export const IPC_APPEARANCE_DATA_REFRESH = 'appearance:data-refresh'

// Settings window controls (frame:false)
export const IPC_WINDOW_MINIMIZE = 'window:minimize'
export const IPC_WINDOW_MAXIMIZE = 'window:maximize'
export const IPC_WINDOW_CLOSE = 'window:close'

// Appearance editor panel sizes
export const IPC_APPEARANCE_PANEL_SIZES = 'appearance:panel-sizes'
export const IPC_APPEARANCE_CLOSE = 'appearance:close'

// Shortcuts editor window
export const IPC_SHORTCUTS_OPEN         = 'shortcuts:open'
export const IPC_SHORTCUTS_GET_DATA     = 'shortcuts:get-data'
export const IPC_SHORTCUTS_UPDATE       = 'shortcuts:update'
export const IPC_SHORTCUTS_UPDATED      = 'shortcuts:updated'
export const IPC_SHORTCUTS_DATA_REFRESH = 'shortcuts:data-refresh'
export const IPC_SHORTCUTS_CLOSE        = 'shortcuts:close'
export const IPC_SHORTCUTS_COMMITTED    = 'shortcuts:committed'
export const IPC_SHORTCUTS_PLAY         = 'shortcuts:play'
export const IPC_SHORTCUTS_THEME_UPDATE = 'shortcuts:theme-update'

// ── Popup context menu ───────────────────────────────────────────────────────
export const IPC_POPUP_MENU_SHOW         = 'popup-menu:show'
export const IPC_POPUP_MENU_INIT         = 'popup-menu:init'
export const IPC_POPUP_MENU_ITEM_CLICK   = 'popup-menu:item-click'
export const IPC_POPUP_MENU_SHOW_SUBMENU = 'popup-menu:show-submenu'
export const IPC_POPUP_MENU_CLOSE_SUBMENU = 'popup-menu:close-submenu'
export const IPC_POPUP_MENU_RESIZE       = 'popup-menu:resize'
export const IPC_POPUP_MENU_DISMISS      = 'popup-menu:dismiss'

export interface PopupMenuItem {
  id: string
  label: string
  icon?: string        // UIIcon name
  iconColor?: string   // color for the icon
  separator?: boolean  // renders a divider line instead of item
  submenu?: PopupMenuItem[]
}

export interface PopupMenuShowRequest {
  items: PopupMenuItem[]
  screenX: number
  screenY: number
}

// ── Progress overlay ─────────────────────────────────────────────────────────
export const IPC_PROGRESS_UPDATE = 'progress:update'

/** Describes one active sequence's progress state. */
export interface SequenceProgress {
  id: string
  name: string
  currentStep: number   // 1-based
  totalSteps: number
  startedAt: number     // Date.now()
}

/** Full progress state sent to the overlay. */
export interface ProgressState {
  sequences: SequenceProgress[]
}

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
  /** absPath → SVG content for any custom/resource .svg icons in the slots */
  resolvedSvgIcons?: Record<string, string>
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

export interface ShortcutsSlotData {
  slot: SlotConfig
  slotIndex: number
  isSubSlot: boolean
  folderIndex: number | null
  subSlotIndex: number | null
  theme: 'light' | 'dark'
  language?: Language
  /** Set when editing a library entry directly (not a real slot). */
  libraryEntryId?: string
  /** Snapshot of the global shortcuts library — used by the Shortcuts palette tab. */
  shortcutsLibrary?: ShortcutEntry[]
  /** Snapshot of shortcut groups — used by the group filter in the Shortcuts palette tab. */
  shortcutGroups?: ShortcutGroup[]
  /** When true, the editor should immediately focus the name/label input. */
  autoFocusName?: boolean
}

/** Per-node result returned from IPC_SHORTCUTS_PLAY */
export interface PlayNodeResult {
  index: number
  success: boolean
  error?: string
}

/** A discovered running process with optional icon and exe path. */
export interface RunningProcess {
  exeName: string       // e.g. 'chrome.exe'
  displayName: string   // friendly name (process Name without extension)
  exePath: string | null
  iconDataUrl?: string
}

// ── Action dialog windows (Phase 2) ─────────────────────────────────────────
export const IPC_DIALOG_ASK_INPUT       = 'dialog:ask-input'
export const IPC_DIALOG_CHOOSE_FROM_LIST = 'dialog:choose-from-list'
export const IPC_DIALOG_SUBMIT          = 'dialog:submit'

export interface DialogAskInputPayload {
  title: string
  prompt: string
  defaultValue: string
  inputType: 'text' | 'number' | 'password'
}

export interface DialogChooseFromListPayload {
  title: string
  items: string[]
  multiple: boolean
}

// ── MCP server status ────────────────────────────────────────────────────────
export const IPC_MCP_GET_STATUS = 'mcp:get-status'
export const IPC_MCP_SETUP = 'mcp:setup'
export const IPC_MCP_TOGGLE = 'mcp:toggle'
export const IPC_MCP_GET_ENTRY_PATH = 'mcp:get-entry-path'
export const IPC_MCP_CHECK_CLIENTS = 'mcp:check-clients'

export type McpSetupTarget = 'claude-code' | 'claude-desktop' | 'codex' | 'gemini'

/** Per-client install & registration check result */
export interface McpClientStatus {
  installed: boolean
  registered: boolean
}

export interface McpServerStatus {
  running: boolean
  port: number | null
  requestCount: number
  lastRequestAt: number | null
  lastHeartbeat: number | null
  tools: string[]
}

export type McpSetupResult =
  | { ok: true; target: McpSetupTarget; detail?: string }
  | { ok: false; error: string; command?: string }

// ── Error recovery ───────────────────────────────────────────────────────────
export const IPC_APP_SHOW_ERROR_LOG  = 'app:show-error-log'
export const IPC_APP_RESTART         = 'app:restart'

// ── Update check ─────────────────────────────────────────────────────────────
export const IPC_APP_GET_VERSION     = 'app:get-version'
export const IPC_UPDATE_CHECK        = 'update:check'
export const IPC_SHELL_OPEN_EXTERNAL = 'shell:open-external'

export type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error'

export interface UpdateStatus {
  state: UpdateState
  currentVersion?: string
  latestVersion?: string
  error?: string
}

// Re-export for convenience
export type { AppEntry, AppProfile }
