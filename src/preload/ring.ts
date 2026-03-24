import { contextBridge, ipcRenderer } from 'electron'
import type { RingShowPayload, RingExecutePayload, RingCursorMovePayload } from '@shared/ipc.types'
import {
  IPC_RING_SHOW,
  IPC_RING_HIDE,
  IPC_RING_IDLE,
  IPC_RING_EXECUTE,
  IPC_RING_DISMISS,
  IPC_RING_CURSOR_MOVE
} from '@shared/ipc.types'

contextBridge.exposeInMainWorld('ringAPI', {
  onShow: (callback: (payload: RingShowPayload) => void) => {
    // Remove any previously-registered listeners before adding a new one.
    // Without this, hot-module-reloads in dev mode accumulate listeners on the
    // same ipcRenderer channel, causing the animation to fire multiple times.
    ipcRenderer.removeAllListeners(IPC_RING_SHOW)
    ipcRenderer.on(IPC_RING_SHOW, (_event, payload) => callback(payload))
  },
  onHide: (callback: () => void) => {
    ipcRenderer.removeAllListeners(IPC_RING_HIDE)
    ipcRenderer.on(IPC_RING_HIDE, () => callback())
  },
  onCursorMove: (callback: (payload: RingCursorMovePayload) => void) => {
    ipcRenderer.removeAllListeners(IPC_RING_CURSOR_MOVE)
    ipcRenderer.on(IPC_RING_CURSOR_MOVE, (_event, payload) => callback(payload))
  },
  execute: (payload: RingExecutePayload) => {
    ipcRenderer.send(IPC_RING_EXECUTE, payload)
  },
  dismiss: () => {
    ipcRenderer.send(IPC_RING_DISMISS)
  },
  notifyIdle: () => {
    ipcRenderer.send(IPC_RING_IDLE)
  }
})
