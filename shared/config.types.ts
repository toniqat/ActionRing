export type ActionType = 'launch' | 'shortcut' | 'shell' | 'system' | 'folder'
  | 'if-else' | 'loop' | 'sequence' | 'wait' | 'set-var' | 'toast' | 'run-shortcut'
  | 'escape' | 'stop' | 'calculate' | 'comment'

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

// ── Script / Logic actions (v9+) ──────────────────────────────────────────────

export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'contains' | 'not-contains'
  | 'is-empty' | 'is-not-empty'

export type ConditionMatchLogic = 'all' | 'any'

export interface ConditionCriteria {
  variable: string
  operator: ConditionOperator
  value: string
}

export interface IfElseAction {
  type: 'if-else'
  /** @deprecated Use matchLogic + criteria instead */
  condition: string
  /** Match logic for structured criteria: 'all' (AND) or 'any' (OR) */
  matchLogic?: ConditionMatchLogic
  /** Structured condition criteria list */
  criteria?: ConditionCriteria[]
  thenActions: ActionConfig[]
  elseActions: ActionConfig[]
}

export type LoopMode = 'repeat' | 'for' | 'foreach'

export interface LoopAction {
  type: 'loop'
  /** Iteration mode: 'repeat' (default), 'for' (index-based), 'foreach' (list-based) */
  mode?: LoopMode
  /** Repeat mode: number of times to repeat the body (1–1000) */
  count: number
  /** For mode: index variable name (e.g. "i") */
  iterVar?: string
  /** For mode: inclusive start value */
  start?: number
  /** For mode: exclusive end value */
  end?: number
  /** For mode: step value (default 1) */
  step?: number
  /** ForEach mode: variable name for the current item */
  itemVar?: string
  /** ForEach mode: name of the List variable to iterate */
  listVar?: string
  body: ActionConfig[]
}

export type WaitMode = 'manual' | 'variable' | 'app-exit'

export interface WaitAction {
  type: 'wait'
  /** Delay in milliseconds (used when mode is 'manual' or absent) */
  ms: number
  /** Wait mode: 'manual' (default), 'variable', 'app-exit' */
  mode?: WaitMode
  /** Variable name containing ms value (mode: 'variable') */
  variable?: string
  /** Launch target path whose spawned PID to wait for (mode: 'app-exit') */
  launchRef?: string
}

/** Runs body actions as an independent parallel task. Main flow continues immediately. */
export interface SequenceAction {
  type: 'sequence'
  /** Display name for the progress overlay */
  name: string
  /** Actions to run concurrently as an independent async task */
  body: ActionConfig[]
  /** Show progress overlay for this sequence (default true) */
  showProgress: boolean
}

export type VarScope = 'local'

export type VarDataType = 'string' | 'list' | 'dict'
export type VarOperation = 'set' | 'get' | 'push' | 'remove'

export interface SetVarAction {
  type: 'set-var'
  name: string
  /** Literal value or expression: "$other + 1", "hello $name" */
  value: string
  scope?: VarScope
  /** Data type for the variable (v11+): 'string' (default), 'list', 'dict' */
  dataType?: VarDataType
  /** CRUD operation (v11+): 'set' (default), 'get', 'push', 'remove' */
  operation?: VarOperation
  /** For dict: key name; for list: index (as string) — used by get/remove */
  key?: string
  /** For 'get' operation: variable name to store the retrieved value */
  resultVar?: string
}

export interface ToastAction {
  type: 'toast'
  /** Notification body — supports $var interpolation */
  message: string
}

export interface RunShortcutAction {
  type: 'run-shortcut'
  shortcutId: string
  /** Map parent vars to child input params: { childParamName: '$parentVar' or 'literal' } */
  inputs?: Record<string, string>
  /** Variable name to store child's return value in parent's local scope */
  outputVar?: string
}

/** Breaks out of the innermost enclosing Loop, like a 'break' statement. */
export interface EscapeAction {
  type: 'escape'
}

/** Halts the entire shortcut sequence immediately. Optionally sets a variable before stopping. */
export interface StopAction {
  type: 'stop'
  /** Optional variable to set before stopping */
  returnVar?: string
  /** Value to store in returnVar */
  returnValue?: string
}

export type CalcOperation = 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'floordiv' | 'pow' | 'sqrt'

export interface CalculateAction {
  type: 'calculate'
  operation: CalcOperation
  /** First operand: variable name ($x) or numeric literal */
  operandA: string
  /** Second operand (not used for sqrt) */
  operandB?: string
  /** Variable name to store the result */
  resultVar: string
  scope?: VarScope
}

/** Documentation-only node — has no effect on execution. */
export interface CommentAction {
  type: 'comment'
  text: string
}

export type ActionConfig = LaunchAction | ShortcutAction | ShellAction | SystemAction | FolderAction
  | IfElseAction | LoopAction | SequenceAction | WaitAction | SetVarAction | ToastAction | RunShortcutAction
  | EscapeAction | StopAction | CalculateAction | CommentAction

/** A named group for organizing shortcuts in the library. */
export interface ShortcutGroup {
  id: string
  name: string
}

/** A named, reusable shortcut stored in the global Shortcuts Library. */
export interface ShortcutEntry {
  id: string
  name: string
  actions: ActionConfig[]
  isFavorite: boolean
  createdAt: number
  lastUsed?: number
  /** Optional display icon (emoji or icon name). Falls back to first action type icon. */
  icon?: string
  /** Whether icon is a custom icon path (true) or a builtin icon name (false). */
  iconIsCustom?: boolean
  /** Optional background color hex for the shortcut node. */
  bgColor?: string
  /** References a ShortcutGroup.id. Undefined means the entry lives in the root gallery. */
  groupId?: string
}

export interface SlotConfig {
  id: string
  label: string
  icon: string
  iconIsCustom: boolean
  /** Only used for folder slots (actions[0].type === 'folder'). Non-folder slots keep this empty. */
  actions: ActionConfig[]
  /** Ordered list of ShortcutEntry IDs to execute sequentially (v9+). */
  shortcutIds?: string[]
  enabled: boolean
  subSlots?: SlotConfig[]  // only populated when actions[0].type === 'folder'
  bgColor?: string         // overrides global ring theme when set
  iconColor?: string       // overrides icon SVG fill color when set
  textColor?: string       // overrides label text color when set
  /** @deprecated Use shortcutIds instead (kept for v8→v9 migration). */
  shortcutId?: string
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
  trayNotificationsEnabled: boolean
  theme: ThemePreference
  language?: Language
  appearancePanelSizes?: [number, number, number]
  // App-profile system (v7+)
  apps: AppEntry[]
  /** Global shortcuts library (v8+). Entries are referenced by SlotConfig.shortcutId. */
  shortcutsLibrary?: ShortcutEntry[]
  /** Named groups for organizing the shortcuts library (v10+). */
  shortcutGroups?: ShortcutGroup[]
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
