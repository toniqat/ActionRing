# src/main/

Electron main process. Runs in Node.js and owns all native capabilities: global input hooks, config persistence, window management, system tray, and IPC routing.

## Files

| File | Purpose |
|---|---|
| `index.ts` | Entry point — initializes services, registers IPC handlers, starts hooks |
| `ActionExecutor.ts` | Dispatches slot actions: app launch, keyboard shortcut, shell command, system action |
| `ConfigStore.ts` | Reads/writes `config.json` in `userData`; owns the single source of truth for `AppConfig` |
| `HookManager.ts` | Global mouse/keyboard hook via `uiohook-napi`; detects trigger press/release and cursor position |
| `IconStore.ts` | Manages the custom icon library stored in `userData/custom-icons/` |
| `LoginStartup.ts` | Toggles login-at-startup via Electron's `app.setLoginItemSettings` |
| `TrayManager.ts` | Creates and manages the system tray icon and its context menu |
| `WindowManager.ts` | Creates and tracks all `BrowserWindow` instances (ring, settings, appearance) |
| `WindowTracker.ts` | Polls the active foreground window (Windows only) to drive per-app profile switching |

## ipc/ — IPC Handler Modules

Each module registers `ipcMain.handle` / `ipcMain.on` listeners for a domain of channels.

| File | Channels handled |
|---|---|
| `ringHandlers.ts` | `ring:execute`, `ring:dismiss`, `ring:idle`, `ring:cursor-move` |
| `settingsHandlers.ts` | `config:get`, `config:save`, `config:reset`, `config:export-global`, `config:import-global`, `file:pick-exe`, `file:pick-icon`, `shortcut:test`, `preset:export`, `preset:import` |
| `appearanceHandlers.ts` | `appearance:open`, `appearance:get-data`, `appearance:update`, `appearance:panel-sizes`, `appearance:close`, `window:minimize`, `window:maximize` |
| `iconHandlers.ts` | `icons:get-custom`, `icons:add-custom`, `icons:remove-custom`, `icons:get-recent`, `icons:add-recent` |
| `profileHandlers.ts` | `app:add`, `app:remove`, `app:profile:*`, `app:update-target`, `app:get-icon`, `app:export-all-profiles`, `app:import-all-profiles` |
| `processHandlers.ts` | `app:get-processes`, `app:import-profile` |

## Key Constraints

- `uiohook-napi` is a native Node addon — it **must** stay in the main process. Never import it from a renderer or preload.
- `ConfigStore` is the single owner of config state. Renderers always fetch a snapshot via IPC and never hold the authoritative copy.
- `WindowTracker` is Windows-only (`win32`). It is a no-op on other platforms.
