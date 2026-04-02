import { contextBridge, ipcRenderer } from 'electron'
import type { ProgressState } from '@shared/ipc.types'
import { IPC_PROGRESS_UPDATE } from '@shared/ipc.types'

contextBridge.exposeInMainWorld('progressAPI', {
  onUpdate: (callback: (state: ProgressState) => void): void => {
    ipcRenderer.removeAllListeners(IPC_PROGRESS_UPDATE)
    ipcRenderer.on(IPC_PROGRESS_UPDATE, (_event, state) => callback(state))
  },
})
