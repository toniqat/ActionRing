import { ipcMain } from 'electron'
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
  _windowManager: WindowManager
): void {
  ipcMain.on(IPC_RING_EXECUTE, (_event, payload: RingExecutePayload) => {
    // Do NOT hide the window here. The ring renderer already called setVisible(false),
    // which plays the exit animation. The window is hidden by HookManager when it
    // receives IPC_RING_IDLE after the animation completes.
    const config = configStore.get()
    const library = config.shortcutsLibrary ?? []
    const shortcutIds = payload.slot.shortcutIds ?? []

    if (shortcutIds.length > 0) {
      actionExecutor.executeShortcutIds(shortcutIds, library).catch(console.error)
    } else if (payload.slot.actions.length > 0 && payload.slot.actions[0]?.type !== 'folder') {
      // Fallback for legacy un-migrated slots
      actionExecutor.executeAll(payload.slot.actions).catch(console.error)
    }
  })

  ipcMain.on(IPC_RING_DISMISS, () => {
    // Same as above — let the exit animation run to completion before the window hides.
  })
}
