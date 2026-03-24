import type { SlotConfig, AppConfig, AppearanceConfig } from './config.types'

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
