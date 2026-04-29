# src/preload/

Preload scripts that bridge the main process and renderer processes via Electron's `contextBridge`. Each renderer window has its own dedicated preload script.

## Files

| File | Renderer | Exposed API |
|---|---|---|
| `ring.ts` | Ring overlay window | `window.ringAPI` — receives `ring:show` / `ring:hide` / `ring:cursor-move`, sends `ring:execute` / `ring:dismiss` / `ring:idle` |
| `settings.ts` | Settings window | `window.settingsAPI` — config CRUD, file pickers, appearance editor open, app profile management, preset import/export, trigger mouse capture |
| `appearance.ts` | Appearance editor window | `window.appearanceAPI` — slot data fetch, slot update relay, custom icon management, panel size persistence, window controls |
| `shortcuts.ts` | Shortcuts editor window | `window.shortcutsAPI` — slot data fetch, action sequence editing, test-play actions, preset import/export, popup menus |
| `progress.ts` | Progress overlay window | `window.progressAPI` — receives progress show/update/hide events from main process |
| `popupMenu.ts` | Popup menu windows | `window.popupMenuAPI` — receives menu items, sends selected item back to main |

## Rules

- Preload scripts run with Node.js integration **disabled** in the renderer. All IPC must go through `contextBridge`.
- Each script wraps raw `ipcRenderer` calls and exposes a typed, minimal API surface — renderers never call `ipcRenderer` directly.
- The IPC channel constants used here are imported from `@shared/ipc.types` to keep channel names in sync with main process handlers.
