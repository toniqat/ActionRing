import { BrowserWindow, ipcMain, screen, nativeTheme } from 'electron'
import type { ConfigStore } from './ConfigStore'
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

export class HookManager {
  private configStore: ConfigStore
  private getRingWindow: () => BrowserWindow | null
  private triggerActive = false
  private activeModifiers = new Set<string>()
  private rendererIdle = true     // true once dismissal animation has fully completed
  private showTime = 0            // timestamp when ring was shown (for min-display lock)
  private pendingHide = false     // mouseup arrived during min-display window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private uiohook: any = null

  constructor(configStore: ConfigStore, getRingWindow: () => BrowserWindow | null) {
    this.configStore = configStore
    this.getRingWindow = getRingWindow
  }

  async start(): Promise<void> {
    try {
      const { uIOhook } = await import('uiohook-napi')
      this.uiohook = uIOhook

      uIOhook.on('mousedown', (e) => {
        const config = this.configStore.get()
        if (!config.enabled) return
        // Prevent double-trigger if ring is already showing (hardware bounce / rapid clicks)
        if (this.triggerActive) return
        // Block re-activation while summoning or dismissal animation is in progress
        if (!this.rendererIdle) return
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
            const enabledSlots = config.slots.filter((s) => s.enabled)
            const hasFolders = enabledSlots.some((s) => s.action.type === 'folder')
            const subMultiplier = hasFolders ? (config.appearance.folderSubRadiusMultiplier ?? 2.0) : 1.0
            const halfSize = Math.round(config.appearance.ringRadius * subMultiplier + 60)
            const winSize = halfSize * 2
            ringWin.setSize(winSize, winSize)
            const resolvedTheme: 'light' | 'dark' =
              config.theme === 'system'
                ? nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
                : (config.theme ?? 'dark')
            const payload: RingShowPayload = {
              slots: enabledSlots,
              appearance: config.appearance,
              cursorX: cursor.x,
              cursorY: cursor.y,
              resolvedTheme
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
            // Too soon — defer hide until min-display window has passed
            this.pendingHide = true
            setTimeout(() => {
              if (this.pendingHide && this.triggerActive) {
                this.dismissRing()
              }
            }, MIN_DISPLAY_MS - elapsed)
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

  stop(): void {
    if (this.uiohook) {
      this.uiohook.stop()
    }
  }
}
