import { ipcMain, BrowserWindow } from 'electron'
import type { ConfigStore } from '../ConfigStore'
import type { ActionExecutor } from '../ActionExecutor'
import type { WindowManager } from '../WindowManager'
import {
  IPC_RING_EXECUTE,
  IPC_RING_DISMISS,
  type RingExecutePayload
} from '@shared/ipc.types'

export function registerRingHandlers(
  configStore: ConfigStore,
  actionExecutor: ActionExecutor,
  windowManager: WindowManager
): void {
  ipcMain.on(IPC_RING_EXECUTE, (_event, payload: RingExecutePayload) => {
    windowManager.hideRing()
    actionExecutor.execute(payload.slot.action).catch(console.error)
  })

  ipcMain.on(IPC_RING_DISMISS, () => {
    windowManager.hideRing()
  })
}
