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
  action: ActionConfig
  enabled: boolean
  subSlots?: SlotConfig[]  // only populated when action.type === 'folder'
}

export type ModifierKey = 'alt' | 'ctrl' | 'shift' | 'meta'

export interface TriggerConfig {
  button: number
  modifiers: ModifierKey[]
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

export interface AppConfig {
  version: number
  enabled: boolean
  trigger: TriggerConfig
  slots: SlotConfig[]
  appearance: AppearanceConfig
  startOnLogin: boolean
  theme: ThemePreference
}
