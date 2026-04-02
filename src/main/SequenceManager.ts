import type { BrowserWindow } from 'electron'
import type { SequenceProgress, ProgressState } from '@shared/ipc.types'
import { IPC_PROGRESS_UPDATE } from '@shared/ipc.types'

/**
 * Tracks active parallel sequences and broadcasts progress to the overlay window.
 * Lazily creates the overlay on first sequence; auto-hides when all complete.
 */
export class SequenceManager {
  private sequences = new Map<string, SequenceProgress>()

  constructor(
    private getProgressWindow: () => BrowserWindow | null,
    private createProgressWindow: () => BrowserWindow,
  ) {}

  register(id: string, name: string, totalSteps: number): void {
    this.sequences.set(id, { id, name, currentStep: 0, totalSteps, startedAt: Date.now() })
    this.broadcast()
  }

  updateStep(id: string, step: number): void {
    const seq = this.sequences.get(id)
    if (seq) {
      seq.currentStep = step
      this.broadcast()
    }
  }

  unregister(id: string): void {
    this.sequences.delete(id)
    this.broadcast()
  }

  private broadcast(): void {
    const state: ProgressState = { sequences: Array.from(this.sequences.values()) }

    if (state.sequences.length > 0) {
      let win = this.getProgressWindow()
      if (!win || win.isDestroyed()) {
        win = this.createProgressWindow()
      }
      win.webContents.send(IPC_PROGRESS_UPDATE, state)
      if (!win.isVisible()) win.showInactive()
    } else {
      const win = this.getProgressWindow()
      if (win && !win.isDestroyed() && win.isVisible()) {
        win.hide()
      }
    }
  }
}
