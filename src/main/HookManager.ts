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

  // ── Mouse capture mode (settings UI) ────────────────────────────────────────
  private capturingMouse = false
  private mouseCaptureReady = false   // becomes true after 150ms grace period
  private mouseCaptureCallback: ((button: number) => void) | null = null
  private mouseCaptureTimer: ReturnType<typeof setTimeout> | null = null

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
            // Resolve SVG content for any custom/resource .svg icons
            const resolvedSvgIcons: Record<string, string> = {}
            const collectSvgIcons = (slots: SlotConfig[]): void => {
              for (const slot of slots) {
                if (slot.iconIsCustom && typeof slot.icon === 'string' && slot.icon.endsWith('.svg')) {
                  if (!resolvedSvgIcons[slot.icon]) {
                    try {
                      resolvedSvgIcons[slot.icon] = readFileSync(slot.icon, 'utf-8')
                    } catch { /* icon file unreadable, fall back to img */ }
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
        const ringWin = this.getRingWindow()
        if (!ringWin) return
        const cursor = screen.getCursorScreenPoint()
        const [winX, winY] = ringWin.getPosition()
        ringWin.webContents.send(IPC_RING_CURSOR_MOVE, {
          x: cursor.x - winX,
          y: cursor.y - winY
        })
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
      console.log('[HookManager] uiohook-napi started')
    } catch (err) {
      console.error('[HookManager] Failed to start uiohook-napi:', err)
    }
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

  stop(): void {
    if (this.uiohook) {
      this.uiohook.stop()
    }
  }
}
