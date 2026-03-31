export type ActionType = 'launch' | 'shortcut' | 'shell' | 'system' | 'folder'

export type SystemActionId =
  | 'volume-up'
  | 'volume-down'
  | 'play-pause'
  | 'screenshot'
  | 'lock-screen'
  | 'show-desktop'
  | 'mute'

export interface LaunchAction {
  type: 'launch'
  target: string
}

export interface ShortcutAction {
  type: 'shortcut'
  keys: string
}

export interface ShellAction {
  type: 'shell'
  command: string
}

export interface SystemAction {
  type: 'system'
  action: SystemActionId
}

export interface FolderAction {
  type: 'folder'
}

export type ActionConfig = LaunchAction | ShortcutAction | ShellAction | SystemAction | FolderAction

export interface SlotConfig {
  id: string
  label: string
  icon: string
  iconIsCustom: boolean
  actions: ActionConfig[]  // ordered sequence; actions[0].type === 'folder' means folder slot
  enabled: boolean
  subSlots?: SlotConfig[]  // only populated when actions[0].type === 'folder'
  bgColor?: string         // overrides global ring theme when set
  iconColor?: string       // overrides icon SVG fill color when set
  textColor?: string       // overrides label text color when set
}

export type ModifierKey = 'alt' | 'ctrl' | 'shift' | 'meta'

export interface TriggerConfig {
  button: number
  modifiers: ModifierKey[]   // kept in sync with triggerKeys for HookManager
  triggerKeys?: string       // display-format string e.g. "Ctrl+Alt" — source of truth when present
}

export interface AppearanceConfig {
  ringRadius: number
  buttonSize?: number
  iconSize?: number
  fontSize?: number
  showText?: boolean
  opacity: number
  animationSpeed: 'slow' | 'normal' | 'fast'
  folderSubRadiusMultiplier?: number  // default 2.0, range 1.5–3.0
}

export type ThemePreference = 'light' | 'dark' | 'system'

export type Language = 'en' | 'ko'

// ── App-Profile system (v7+) ──────────────────────────────────────────────────

/** A named profile with its own slots and appearance, belonging to an AppEntry. */
export interface AppProfile {
  id: string
  name: string
  slots: SlotConfig[]
  appearance: AppearanceConfig
}

/**
 * An entry in the App Carousel.
 * id === 'default' means the Default System entry (always pinned first).
 * Other entries correspond to a specific executable.
 */
export interface AppEntry {
  id: string            // 'default' for Default System; generated id for app entries
  exeName?: string      // e.g. 'chrome.exe'; undefined for Default System
  displayName: string   // friendly label shown under the icon
  iconDataUrl?: string  // exe icon cached as data URL; undefined = show initials fallback
  profiles: AppProfile[]
  activeProfileId: string
}

/** Export/import format for a single button slot (button preset). */
export interface ButtonPreset {
  version: 1
  name: string
  slot: SlotConfig
}

// ── AppConfig ─────────────────────────────────────────────────────────────────

export interface AppConfig {
  version: number
  enabled: boolean
  trigger: TriggerConfig
  /**
   * Resolved slots for the Default System's active profile.
   * Always kept in sync with apps[0 (default)].activeProfile.slots.
   * Used by the ring renderer for backward compatibility.
   */
  slots: SlotConfig[]
  /**
   * Resolved appearance for the Default System's active profile.
   * Always kept in sync with apps[0 (default)].activeProfile.appearance.
   */
  appearance: AppearanceConfig
  startOnLogin: boolean
  theme: ThemePreference
  language?: Language
  appearancePanelSizes?: [number, number, number]
  // App-profile system (v7+)
  apps: AppEntry[]
}

// ── Legacy types — kept only for v6→v7 migration ─────────────────────────────

/** @deprecated Use AppProfile instead */
export interface AppOverride {
  exeName: string
  displayName: string
  slots: SlotConfig[]
}

/** @deprecated Use AppEntry / AppProfile instead */
export interface Profile {
  id: string
  name: string
  defaultSlots: SlotConfig[]
  appearance: AppearanceConfig
  appOverrides: AppOverride[]
}
