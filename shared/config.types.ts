export type ActionType = 'launch' | 'keyboard' | 'shell' | 'system' | 'folder' | 'link'
  | 'if-else' | 'loop' | 'sequence' | 'wait' | 'set-var' | 'list' | 'dict' | 'toast' | 'run-shortcut'
  | 'escape' | 'stop' | 'calculate' | 'comment'
  | 'mouse-move' | 'mouse-click'
  | 'clipboard' | 'text' | 'transform'
  | 'ask-input' | 'choose-from-list' | 'show-alert'
  | 'http-request' | 'file'
  | 'date-time' | 'try-catch'
  | 'registry' | 'environment' | 'service'

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
  /** Variable name to store the spawned PID, enabling wait(app-exit) to reference it. */
  pidVar?: string
}

export interface KeyboardAction {
  type: 'keyboard'
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

export interface LinkAction {
  type: 'link'
  url: string
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

/** A single case branch in a switch-style condition. */
export interface SwitchCase {
  /** Value to match against the switch expression (exact equality) */
  value: string
  actions: ActionConfig[]
}

export type ConditionMode = 'if-else' | 'switch'

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
  /** Condition mode: 'if-else' (default) or 'switch' */
  conditionMode?: ConditionMode
  /** Switch mode: the expression to evaluate (e.g. '$status') */
  switchValue?: string
  /** Switch mode: ordered list of case branches */
  switchCases?: SwitchCase[]
  /** Switch mode: optional default branch actions */
  switchDefault?: ActionConfig[]
}

export type LoopMode = 'repeat' | 'for' | 'foreach'

export interface LoopAction {
  type: 'loop'
  /** Iteration mode: 'repeat' (default), 'for' (index-based), 'foreach' (list-based) */
  mode?: LoopMode
  /** Repeat mode: number of times to repeat the body (1–1000), or a variable reference like "$myVar" */
  count: number | string
  /** For mode: index variable name (e.g. "i") */
  iterVar?: string
  /** For mode: inclusive start value, or a variable reference */
  start?: number | string
  /** For mode: exclusive end value, or a variable reference */
  end?: number | string
  /** For mode: step value (default 1), or a variable reference */
  step?: number | string
  /** ForEach mode: variable name for the current item (or dict value) */
  itemVar?: string
  /** ForEach mode: variable name for the current dict key */
  keyVar?: string
  /** ForEach mode: name of the List/Dict variable to iterate */
  listVar?: string
  body: ActionConfig[]
}

export type WaitMode = 'manual' | 'variable' | 'app-exit' | 'key-input'

export interface WaitAction {
  type: 'wait'
  /** Delay in milliseconds (used when mode is 'manual' or absent) */
  ms: number
  /** Wait mode: 'manual' (default), 'variable', 'app-exit', 'key-input' */
  mode?: WaitMode
  /** Variable name containing ms value (mode: 'variable') */
  variable?: string
  /** Launch target path whose spawned PID to wait for (mode: 'app-exit') */
  launchRef?: string
  /** Recorded key/mouse combination to wait for (mode: 'key-input'), e.g. "Ctrl+Shift+D", "Alt+Mouse4" */
  waitKeys?: string
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

export type VarDataType = 'single' | 'list' | 'dict'
export type VarOperation = 'set' | 'get' | 'push' | 'remove'
export type VarMode = 'define' | 'edit'

export interface DictEntry {
  key: string
  value: string
}

export interface SetVarAction {
  type: 'set-var'
  name: string
  /** Literal value or expression: "$other + 1", "hello $name" */
  value: string
  scope?: VarScope
}

export interface ListAction {
  type: 'list'
  name: string
  scope?: VarScope
  /** Mode: 'define' (initial values) or 'edit' (CRUD operations) */
  mode?: VarMode
  /** CRUD operation (edit mode): 'set' | 'get' | 'push' | 'remove' */
  operation?: VarOperation
  /** Value for set/push operations */
  value?: string
  /** Index (as string) — used by get/remove */
  key?: string
  /** Variable name to store the retrieved value (get operation) */
  resultVar?: string
  /** Define mode: initial list items */
  listItems?: string[]
}

export interface DictAction {
  type: 'dict'
  name: string
  scope?: VarScope
  /** Mode: 'define' (initial values) or 'edit' (CRUD operations) */
  mode?: VarMode
  /** CRUD operation (edit mode): 'set' | 'get' | 'remove' */
  operation?: VarOperation
  /** Value for set operation */
  value?: string
  /** Key name — used by set/get/remove */
  key?: string
  /** Variable name to store the retrieved value (get operation) */
  resultVar?: string
  /** Define mode: initial key-value entries */
  dictItems?: DictEntry[]
}

export interface ToastAction {
  type: 'toast'
  /** Notification title — supports $var interpolation (defaults to 'Action Ring') */
  title?: string
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

// ── Mouse actions ────────────────────────────────────────────────────────────

export type MouseMoveMode = 'set' | 'offset'

export interface MouseMoveAction {
  type: 'mouse-move'
  mode: MouseMoveMode
  x: string
  y: string
}

export type MouseButton = 'left' | 'right' | 'middle' | 'side1' | 'side2' | 'wheel-up' | 'wheel-down'

export interface MouseClickAction {
  type: 'mouse-click'
  button: MouseButton
}

// ── Phase 1: Data processing actions ─────────────────────────────────────────

export type ClipboardMode = 'get' | 'set'

export interface ClipboardAction {
  type: 'clipboard'
  mode: ClipboardMode
  resultVar?: string
  value?: string
}

export type TextMode = 'replace' | 'split' | 'combine' | 'case' | 'match' | 'substring' | 'length' | 'trim' | 'pad'

export type TextCaseMode = 'upper' | 'lower' | 'capitalize' | 'camel' | 'snake' | 'kebab'

export interface TextAction {
  type: 'text'
  mode: TextMode
  input: string
  resultVar: string
  // replace
  find?: string
  replaceWith?: string
  useRegex?: boolean
  // split / combine
  separator?: string
  listVar?: string
  // case
  caseMode?: TextCaseMode
  // match
  pattern?: string
  matchAll?: boolean
  // substring
  start?: number | string
  length?: number | string
  // pad
  padLength?: number | string
  padChar?: string
  padSide?: 'start' | 'end'
}

export type TransformMode = 'json-parse' | 'json-stringify' | 'url-encode' | 'url-decode' | 'base64-encode' | 'base64-decode' | 'hash'

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

export interface TransformAction {
  type: 'transform'
  mode: TransformMode
  input: string
  resultVar: string
  algorithm?: HashAlgorithm
}

// ── Phase 2: User interaction actions ────────────────────────────────────────

export type AskInputType = 'text' | 'number' | 'password'

export interface AskInputAction {
  type: 'ask-input'
  title?: string
  prompt?: string
  defaultValue?: string
  inputType?: AskInputType
  resultVar: string
}

export interface ChooseFromListAction {
  type: 'choose-from-list'
  title?: string
  items?: string[]
  listVar?: string
  multiple?: boolean
  resultVar: string
}

export interface ShowAlertAction {
  type: 'show-alert'
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  resultVar?: string
}

// ── Phase 3: External integration actions ───────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'

export interface HttpRequestAction {
  type: 'http-request'
  url: string
  method: HttpMethod
  headers?: string
  body?: string
  timeout?: number
  resultVar?: string
  statusVar?: string
}

export type FileMode = 'read' | 'write' | 'exists' | 'list' | 'pick' | 'info' | 'delete' | 'rename' | 'copy'

export type FileInfoField = 'size' | 'modified' | 'created' | 'extension' | 'name' | 'directory'

export interface FileAction {
  type: 'file'
  mode: FileMode
  path?: string
  resultVar?: string
  // read
  encoding?: string
  // write
  content?: string
  writeMode?: 'overwrite' | 'append'
  // list
  pattern?: string
  // pick
  title?: string
  filters?: string
  pickMode?: 'file' | 'directory'
  // rename / copy
  destination?: string
  // info
  infoField?: FileInfoField
}

// ── Phase 4: Time & error handling actions ─────────────────────────────────

export type DateTimeMode = 'now' | 'format' | 'math' | 'diff' | 'parse'

export type DateTimeUnit = 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds'

export interface DateTimeAction {
  type: 'date-time'
  mode: DateTimeMode
  resultVar: string
  format?: string          // 'iso'(default) | 'locale' | 'timestamp' | custom
  input?: string
  amount?: number | string // math: amount to add/subtract
  unit?: DateTimeUnit
  date1?: string           // diff
  date2?: string           // diff
}

export interface TryCatchAction {
  type: 'try-catch'
  tryActions: ActionConfig[]
  catchActions: ActionConfig[]
  errorVar?: string        // variable name to store error message
}

// ── Phase 5: Windows-specific actions ──────────────────────────────────────

export type RegistryMode = 'read' | 'write' | 'delete' | 'exists'

export type RegistryHive = 'HKLM' | 'HKCU' | 'HKCR' | 'HKU' | 'HKCC'

export type RegistryDataType = 'REG_SZ' | 'REG_DWORD' | 'REG_QWORD' | 'REG_EXPAND_SZ' | 'REG_MULTI_SZ'

export interface RegistryAction {
  type: 'registry'
  mode: RegistryMode
  hive: RegistryHive
  keyPath: string
  valueName?: string
  data?: string
  dataType?: RegistryDataType
  resultVar?: string
}

export type EnvironmentMode = 'get' | 'set' | 'list'

export interface EnvironmentAction {
  type: 'environment'
  mode: EnvironmentMode
  name?: string
  value?: string
  resultVar?: string
}

export type ServiceMode = 'status' | 'start' | 'stop' | 'restart'

export interface ServiceAction {
  type: 'service'
  mode: ServiceMode
  serviceName: string
  resultVar?: string
}

export type ActionConfig = LaunchAction | KeyboardAction | ShellAction | SystemAction | FolderAction | LinkAction
  | IfElseAction | LoopAction | SequenceAction | WaitAction | SetVarAction | ListAction | DictAction | ToastAction | RunShortcutAction
  | EscapeAction | StopAction | CalculateAction | CommentAction
  | MouseMoveAction | MouseClickAction
  | ClipboardAction | TextAction | TransformAction
  | AskInputAction | ChooseFromListAction | ShowAlertAction
  | HttpRequestAction | FileAction
  | DateTimeAction | TryCatchAction
  | RegistryAction | EnvironmentAction | ServiceAction

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
  /** Whether the MCP API server is enabled (v13+). Defaults to true. */
  mcpEnabled?: boolean
  /** Cached set of MCP client IDs confirmed as installed locally. */
  mcpInstalledClients?: string[]
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
