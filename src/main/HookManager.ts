import { BrowserWindow, ipcMain, screen, nativeTheme } from 'electron'
import { readFileSync } from 'fs'
import type { ConfigStore } from './ConfigStore'
import type { WindowTracker } from './WindowTracker'
import type { SlotConfig } from '@shared/config.types'
import {
  IPC_RING_SHOW,
  IPC_RING_HIDE,
  IPC_RING_IDLE,
  IPC_RING_CURSOR_MOVE,
  type RingShowPayload
} from '@shared/ipc.types'

// uiohook-napi keycodes for modifier keys (left + right variants)
const MODIFIER_KEYCODES: Record<string, number[]> = {
  alt: [56, 3640],
  ctrl: [29, 3613],
  shift: [42, 54],
  meta: [3675, 3676]
}

const MIN_DISPLAY_MS = 250        // ring stays visible for at least this long
const POST_IDLE_COOLDOWN_MS = 100 // ignore triggers for this long after exit animation completes

// ── uiohook keycode ↔ display name mapping ────────────────────────────────────
const KEYCODE_TO_NAME: Record<number, string> = {
  // Letters
  16: 'Q', 17: 'W', 18: 'E', 19: 'R', 20: 'T', 21: 'Y', 22: 'U', 23: 'I', 24: 'O', 25: 'P',
  30: 'A', 31: 'S', 32: 'D', 33: 'F', 34: 'G', 35: 'H', 36: 'J', 37: 'K', 38: 'L',
  44: 'Z', 45: 'X', 46: 'C', 47: 'V', 48: 'B', 49: 'N', 50: 'M',
  // Digits
  2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
  // F-keys
  59: 'F1', 60: 'F2', 61: 'F3', 62: 'F4', 63: 'F5', 64: 'F6',
  65: 'F7', 66: 'F8', 67: 'F9', 68: 'F10', 87: 'F11', 88: 'F12',
  // Special
  1: 'Esc', 14: 'Backspace', 15: 'Tab', 28: 'Enter', 57: 'Space',
  3639: 'PrintScreen', 70: 'ScrollLock', 3653: 'Pause',
  3666: 'Insert', 3667: 'Delete', 3655: 'Home', 3663: 'End', 3657: 'PageUp', 3665: 'PageDown',
  // Arrow keys
  57416: 'Up', 57424: 'Down', 57419: 'Left', 57421: 'Right',
  // Punctuation / misc
  12: 'Minus', 13: 'Equal', 26: 'BracketLeft', 27: 'BracketRight', 43: 'Backslash',
  39: 'Semicolon', 40: 'Quote', 41: 'Backquote', 51: 'Comma', 52: 'Period', 53: 'Slash',
  // Numpad
  3637: 'NumDivide', 55: 'NumMultiply', 74: 'NumMinus', 78: 'NumPlus', 3612: 'NumEnter',
  82: 'Num0', 79: 'Num1', 80: 'Num2', 81: 'Num3', 75: 'Num4',
  76: 'Num5', 77: 'Num6', 71: 'Num7', 72: 'Num8', 73: 'Num9', 83: 'NumDecimal',
}

// Reverse lookup: name → keycode
const NAME_TO_KEYCODE: Record<string, number> = {}
for (const [code, name] of Object.entries(KEYCODE_TO_NAME)) {
  NAME_TO_KEYCODE[name.toLowerCase()] = Number(code)
}

// Aliases for browser KeyboardEvent.key names → uiohook keycodes
// buildKeyCombo() in the renderer uses e.key, which differs from KEYCODE_TO_NAME.
const BROWSER_KEY_ALIASES: Record<string, number> = {
  arrowup: 57416, arrowdown: 57424, arrowleft: 57419, arrowright: 57421,
  escape: 1, backspace: 14, tab: 15, enter: 28, ' ': 57,
  insert: 3666, delete: 3667, home: 3655, end: 3663, pageup: 3657, pagedown: 3665,
  printscreen: 3639, scrolllock: 70, pause: 3653,
  capslock: 58, numlock: 69,
}
// Merge aliases into NAME_TO_KEYCODE (lower priority — don't overwrite existing)
for (const [alias, code] of Object.entries(BROWSER_KEY_ALIASES)) {
  if (!(alias in NAME_TO_KEYCODE)) NAME_TO_KEYCODE[alias] = code
}

// Mouse button number ↔ display name
const MOUSE_BUTTON_NAMES: Record<number, string> = {
  1: 'Mouse1', 2: 'Mouse2', 3: 'Mouse3', 4: 'Mouse4', 5: 'Mouse5',
}
const MOUSE_NAME_TO_BUTTON: Record<string, number> = {}
for (const [btn, name] of Object.entries(MOUSE_BUTTON_NAMES)) {
  MOUSE_NAME_TO_BUTTON[name.toLowerCase()] = Number(btn)
}

/** Modifier display names in canonical order. */
const MODIFIER_DISPLAY: Record<string, string> = {
  ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta',
}

/** Parse a waitKeys string like "Ctrl+Shift+D" or "Alt+Mouse4" into modifiers + trigger. */
export function parseWaitKeys(keys: string): {
  modifiers: string[]  // ['ctrl','shift'] etc.
  keycode?: number     // uiohook keycode for keyboard trigger
  mouseButton?: number // mouse button number
} | null {
  if (!keys) return null
  const parts = keys.split('+')
  const modifiers: string[] = []
  let keycode: number | undefined
  let mouseButton: number | undefined

  for (const part of parts) {
    const lower = part.trim().toLowerCase()
    // Handle "Win" as alias for "meta"
    const normalized = lower === 'win' ? 'meta' : lower
    if (normalized === 'ctrl' || normalized === 'alt' || normalized === 'shift' || normalized === 'meta') {
      modifiers.push(normalized)
    } else if (MOUSE_NAME_TO_BUTTON[lower] !== undefined) {
      mouseButton = MOUSE_NAME_TO_BUTTON[lower]
    } else if (NAME_TO_KEYCODE[lower] !== undefined) {
      keycode = NAME_TO_KEYCODE[lower]
    }
  }

  if (keycode === undefined && mouseButton === undefined) return null
  return { modifiers, keycode, mouseButton }
}

export class HookManager {
  private configStore: ConfigStore
  private windowTracker: WindowTracker
  private getRingWindow: () => BrowserWindow | null
  private triggerActive = false
  private activeModifiers = new Set<string>()
  private rendererIdle = true     // true once dismissal animation has fully completed
  private showTime = 0            // timestamp when ring was shown (for min-display lock)
  private pendingHide = false     // mouseup arrived during min-display window
  private lastIdleTime = 0        // timestamp when rendererIdle last became true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private uiohook: any = null

  // ── SVG icon cache (persists across ring shows, max 200 entries) ────────────
  private static readonly SVG_CACHE_MAX = 200
  private svgIconCache = new Map<string, string>()

  // ── Cursor-move throttle (~60 FPS) ──────────────────────────────────────────
  private lastCursorSendTime = 0
  private pendingCursorTimer: ReturnType<typeof setTimeout> | null = null

  // ── Mouse capture mode (settings UI) ────────────────────────────────────────
  private capturingMouse = false
  private mouseCaptureReady = false   // becomes true after 150ms grace period
  private mouseCaptureCallback: ((button: number) => void) | null = null
  private mouseCaptureTimer: ReturnType<typeof setTimeout> | null = null

  // ── Key-input wait (ActionExecutor: runtime wait-for-input) ───────────────
  private keyInputWaitResolvers: Array<{
    modifiers: string[]
    keycode?: number
    mouseButton?: number
    resolve: () => void
  }> = []

  constructor(configStore: ConfigStore, windowTracker: WindowTracker, getRingWindow: () => BrowserWindow | null) {
    this.configStore = configStore
    this.windowTracker = windowTracker
    this.getRingWindow = getRingWindow
  }

  async start(): Promise<void> {
    try {
      const { uIOhook } = await import('uiohook-napi')
      this.uiohook = uIOhook

      uIOhook.on('mousedown', (e) => {
        // Mouse capture mode: intercept the very next click for the settings UI
        if (this.capturingMouse && this.mouseCaptureReady && this.mouseCaptureCallback) {
          const cb = this.mouseCaptureCallback
          this.cancelMouseCapture()
          cb(e.button)
          return
        }

        // Runtime key-input wait: check if any waiters match this mouse event
        this.checkKeyInputWaiters(undefined, e.button)

        const config = this.configStore.get()
        if (!config.enabled) return
        // Prevent double-trigger if ring is already showing (hardware bounce / rapid clicks)
        if (this.triggerActive) return
        // Block re-activation while summoning or dismissal animation is in progress
        if (!this.rendererIdle) return
        // Debounce: ignore triggers within POST_IDLE_COOLDOWN_MS after exit animation completes.
        // This prevents a rapid second click (or hardware bounce) from re-showing the ring
        // immediately after the exit animation finishes, which causes the "double trigger" stutter.
        if (Date.now() - this.lastIdleTime < POST_IDLE_COOLDOWN_MS) return
        const { button: triggerButton, modifiers: requiredModifiers } = config.trigger

        if (e.button === triggerButton) {
          // All required modifiers must be active
          const allActive = requiredModifiers.every((m) => this.activeModifiers.has(m))
          if (!allActive) return

          // Suppress the native click so it doesn't reach other apps
          // (important for left click; harmless for middle/side buttons)
          if (typeof e.preventDefault === 'function') {
            e.preventDefault()
          }

          this.triggerActive = true
          this.pendingHide = false
          this.showTime = Date.now()
          this.rendererIdle = false
          const ringWin = this.getRingWindow()
          if (ringWin) {
            const cursor = screen.getCursorScreenPoint()
            // Resolve slots: use app-specific override if available, else active profile defaults
            const activeExeName = this.windowTracker.getActiveExeName()
            const enabledSlots = this.configStore.resolveSlots(activeExeName).filter((s) => s.enabled)
            const hasFolders = enabledSlots.some((s) => s.actions[0]?.type === 'folder')
            const subMultiplier = hasFolders ? (config.appearance.folderSubRadiusMultiplier ?? 2.0) : 1.0
            const halfSize = Math.round(config.appearance.ringRadius * subMultiplier + 60)
            const winSize = halfSize * 2
            ringWin.setSize(winSize, winSize)
            const resolvedTheme: 'light' | 'dark' =
              config.theme === 'system'
                ? nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
                : (config.theme ?? 'dark')
            // Resolve SVG content for any custom/resource .svg icons (cached across ring shows)
            const resolvedSvgIcons: Record<string, string> = {}
            const collectSvgIcons = (slots: SlotConfig[]): void => {
              for (const slot of slots) {
                if (slot.iconIsCustom && typeof slot.icon === 'string' && slot.icon.endsWith('.svg')) {
                  if (!resolvedSvgIcons[slot.icon]) {
                    const cached = this.svgIconCache.get(slot.icon)
                    if (cached !== undefined) {
                      resolvedSvgIcons[slot.icon] = cached
                    } else {
                      try {
                        const content = readFileSync(slot.icon, 'utf-8')
                        if (this.svgIconCache.size >= HookManager.SVG_CACHE_MAX) {
                          // Evict oldest entry (first key in insertion order)
                          const oldest = this.svgIconCache.keys().next().value
                          if (oldest !== undefined) this.svgIconCache.delete(oldest)
                        }
                        this.svgIconCache.set(slot.icon, content)
                        resolvedSvgIcons[slot.icon] = content
                      } catch { /* icon file unreadable, fall back to img */ }
                    }
                  }
                }
                if (slot.subSlots?.length) collectSvgIcons(slot.subSlots)
              }
            }
            collectSvgIcons(enabledSlots)

            const payload: RingShowPayload = {
              slots: enabledSlots,
              appearance: config.appearance,
              cursorX: cursor.x,
              cursorY: cursor.y,
              resolvedTheme,
              ...(Object.keys(resolvedSvgIcons).length > 0 && { resolvedSvgIcons }),
            }
            ringWin.setPosition(cursor.x - halfSize, cursor.y - halfSize)
            ringWin.showInactive()
            ringWin.webContents.send(IPC_RING_SHOW, payload)
          }
        }
      })

      uIOhook.on('mousemove', (_e) => {
        if (!this.triggerActive) return
        const now = Date.now()
        const elapsed = now - this.lastCursorSendTime
        if (elapsed >= 16) {
          // 16ms = ~60 FPS — send immediately
          this.lastCursorSendTime = now
          if (this.pendingCursorTimer) {
            clearTimeout(this.pendingCursorTimer)
            this.pendingCursorTimer = null
          }
          this.sendCursorMove()
        } else if (!this.pendingCursorTimer) {
          // Schedule a trailing send so the final position is never lost
          this.pendingCursorTimer = setTimeout(() => {
            this.pendingCursorTimer = null
            if (this.triggerActive) {
              this.lastCursorSendTime = Date.now()
              this.sendCursorMove()
            }
          }, 16 - elapsed)
        }
      })

      uIOhook.on('mouseup', (e) => {
        const config = this.configStore.get()
        if (e.button === config.trigger.button && this.triggerActive) {
          // Suppress the corresponding mouseup so no stray click reaches the OS
          if (typeof e.preventDefault === 'function') {
            e.preventDefault()
          }
          const elapsed = Date.now() - this.showTime
          if (elapsed < MIN_DISPLAY_MS) {
            // Too soon — defer hide until min-display window has passed.
            // Guard against scheduling a duplicate timeout if mouseup fires twice
            // (e.g. hardware bounce or OS double-click) for the same trigger session.
            if (!this.pendingHide) {
              this.pendingHide = true
              setTimeout(() => {
                if (this.pendingHide && this.triggerActive) {
                  this.dismissRing()
                }
              }, MIN_DISPLAY_MS - elapsed)
            }
          } else {
            this.dismissRing()
          }
        }
      })

      uIOhook.on('keydown', (e) => {
        // Track which modifier keys are currently held
        for (const [mod, codes] of Object.entries(MODIFIER_KEYCODES)) {
          if (codes.includes(e.keycode)) {
            this.activeModifiers.add(mod)
          }
        }

        // Runtime key-input wait: check if any waiters match this key event
        const isModifier = Object.values(MODIFIER_KEYCODES).some((codes) => codes.includes(e.keycode))
        if (!isModifier) {
          this.checkKeyInputWaiters(e.keycode, undefined)
        }

        // Escape dismisses ring — plays exit animation, rendererIdle unlocked via ring:idle
        if (e.keycode === 1 && this.triggerActive) {
          this.dismissRing()
        }
      })

      uIOhook.on('keyup', (e) => {
        for (const [mod, codes] of Object.entries(MODIFIER_KEYCODES)) {
          if (codes.includes(e.keycode)) {
            this.activeModifiers.delete(mod)
          }
        }
      })

      // Renderer signals that the exit animation has completed and the ring is fully gone.
      // This is the authoritative unlock for re-triggering.
      ipcMain.on(IPC_RING_IDLE, () => {
        this.rendererIdle = true
        this.lastIdleTime = Date.now()
        const ringWin = this.getRingWindow()
        if (ringWin) {
          ringWin.hide()
        }
      })

      uIOhook.start()
    } catch {
      // uiohook-napi start failed — input hooks will be unavailable
    }
  }

  private sendCursorMove(): void {
    const ringWin = this.getRingWindow()
    if (!ringWin) return
    const cursor = screen.getCursorScreenPoint()
    const [winX, winY] = ringWin.getPosition()
    ringWin.webContents.send(IPC_RING_CURSOR_MOVE, {
      x: cursor.x - winX,
      y: cursor.y - winY
    })
  }

  private dismissRing(): void {
    this.pendingHide = false
    this.triggerActive = false
    // rendererIdle stays false until ring:idle arrives from renderer after exit animation
    const ringWin = this.getRingWindow()
    if (ringWin) {
      ringWin.webContents.send(IPC_RING_HIDE)
    }
  }

  startMouseCapture(cb: (button: number) => void): void {
    this.cancelMouseCapture()
    this.capturingMouse = true
    this.mouseCaptureReady = false
    this.mouseCaptureCallback = cb
    // 150ms grace period so the click that initiated capture isn't registered
    this.mouseCaptureTimer = setTimeout(() => {
      this.mouseCaptureReady = true
    }, 150)
  }

  cancelMouseCapture(): void {
    this.capturingMouse = false
    this.mouseCaptureReady = false
    this.mouseCaptureCallback = null
    if (this.mouseCaptureTimer !== null) {
      clearTimeout(this.mouseCaptureTimer)
      this.mouseCaptureTimer = null
    }
  }

  // ── Key-input wait (runtime: ActionExecutor) ──────────────────────────────

  /** Returns a Promise that resolves when the specified key combination is pressed. */
  waitForKeyInput(keys: string): Promise<void> {
    const parsed = parseWaitKeys(keys)
    if (!parsed) return Promise.resolve()
    return new Promise<void>((resolve) => {
      this.keyInputWaitResolvers.push({
        modifiers: parsed.modifiers,
        keycode: parsed.keycode,
        mouseButton: parsed.mouseButton,
        resolve,
      })
    })
  }

  /** Check pending key-input waiters against the current event. */
  private checkKeyInputWaiters(keycode: number | undefined, mouseButton: number | undefined): void {
    const resolved: number[] = []
    for (let i = 0; i < this.keyInputWaitResolvers.length; i++) {
      const w = this.keyInputWaitResolvers[i]
      // Check trigger match
      const triggerMatch =
        (w.keycode !== undefined && w.keycode === keycode) ||
        (w.mouseButton !== undefined && w.mouseButton === mouseButton)
      if (!triggerMatch) continue
      // Check all required modifiers are active
      const modsMatch = w.modifiers.every((m) => this.activeModifiers.has(m))
      if (!modsMatch) continue
      w.resolve()
      resolved.push(i)
    }
    // Remove resolved waiters in reverse order
    for (let i = resolved.length - 1; i >= 0; i--) {
      this.keyInputWaitResolvers.splice(resolved[i], 1)
    }
  }

  /** Clear the SVG icon cache (call when config/icons change). */
  clearSvgCache(): void {
    this.svgIconCache.clear()
  }

  stop(): void {
    if (this.uiohook) {
      this.uiohook.removeAllListeners()
      this.uiohook.stop()
    }
    ipcMain.removeAllListeners(IPC_RING_IDLE)
    if (this.pendingCursorTimer) {
      clearTimeout(this.pendingCursorTimer)
      this.pendingCursorTimer = null
    }
    if (this.mouseCaptureTimer) {
      clearTimeout(this.mouseCaptureTimer)
      this.mouseCaptureTimer = null
    }
  }
}
