# ActionRing — Project Command Center

## Project Overview
Standalone overlay app replicating the Logitech MX Master 4 "Action Rings" feature.
**Stack**: Electron + TypeScript + React 18 + electron-vite

## Feature → Folder Map

| Feature | Folder |
|---|---|
| Main process entry point | `src/main/index.ts` |
| Global input hook (mouse/keyboard) | `src/main/HookManager.ts` |
| Action execution (launch/keyboard/shell/system/mouse) | `src/main/ActionExecutor.ts` |
| Config persistence (JSON) | `src/main/ConfigStore.ts` |
| Icon library management | `src/main/IconStore.ts` |
| Active window tracking | `src/main/WindowTracker.ts` |
| System tray | `src/main/TrayManager.ts` |
| Window lifecycle | `src/main/WindowManager.ts` |
| Login startup toggle | `src/main/LoginStartup.ts` |
| IPC handler modules | `src/main/ipc/` |
| Ring overlay renderer | `src/renderer/ring/` |
| Settings window renderer | `src/renderer/settings/` |
| Appearance editor renderer | `src/renderer/appearance/` |
| Preload scripts (IPC bridge) | `src/preload/` |
| Shared types and constants | `shared/` |
| Static assets (icons) | `resources/` |
| Build config | `electron.vite.config.ts`, `package.json` build section |

## Architecture Notes
- Three renderer processes: `ring` (transparent overlay), `settings`, and `appearance` (slot appearance editor)
- Ring window: `transparent:true`, `focusable:false`, `alwaysOnTop:'screen-saver'`, `showInactive()`
- uiohook-napi MUST be in main process only (native Node addon)
- asarUnpack required for uiohook-napi in electron-builder config
- Config owned by main/ConfigStore; renderers get snapshots via IPC
- Escape key detected in main via uiohook-napi (ring window is not focusable)
- Active window tracked by WindowTracker (Windows only) to switch app profiles
- Appearance editor opens as a child window of settings; slot changes relayed back via IPC

## Dev Commands
```bash
npm install
npm run dev        # Start in development mode
npm run build      # Build for production
npm run build:win  # Package as Windows portable .exe
npm run build:mac  # Package as macOS .dmg
```

## IPC Channel Names (see shared/ipc.types.ts)

### Ring overlay
- `ring:show` — main → ring (payload: slots, appearance, cursor position)
- `ring:hide` — main → ring (trigger released, fire action)
- `ring:idle` — main → ring (no action pending)
- `ring:execute` — ring → main (execute a slot's action)
- `ring:dismiss` — ring → main (dismiss without action)
- `ring:cursor-move` — ring → main (cursor position update)

### Config / settings
- `config:get` — settings → main (fetch AppConfig)
- `config:save` — settings → main (persist AppConfig)
- `config:updated` — main → settings (push updated config)
- `config:reset` — settings → main (reset to defaults)
- `config:export-global` — settings → main (export full config)
- `config:import-global` — settings → main (import full config)

### Appearance editor
- `appearance:open` — settings → main (open/focus appearance editor with slot data)
- `appearance:get-data` — appearance → main (fetch initial slot data)
- `appearance:update` — appearance → main (slot changed, relay to settings)
- `appearance:updated` — main → settings (relayed slot update)
- `appearance:data-refresh` — main → appearance (push new slot data to open window)
- `appearance:panel-sizes` — appearance → main (persist resizer sizes)
- `appearance:close` — appearance → main (close and persist final slot)

### App profiles
- `app:add` / `app:remove` — settings → main
- `app:profile:add` / `app:profile:remove` / `app:profile:rename` / `app:profile:set-active` — settings → main
- `app:profile:duplicate` / `app:profile:export` — settings → main
- `app:update-target` / `app:export-all-profiles` / `app:import-all-profiles` — settings → main
- `app:get-icon` — settings → main (fetch extracted app icon)
- `app:get-processes` — settings → main (list running processes)
- `app:import-profile` — settings → main

### Icons
- `icons:get-custom` / `icons:add-custom` / `icons:remove-custom` — settings/appearance → main
- `icons:get-recent` / `icons:add-recent` — settings/appearance → main

### Misc
- `file:pick-exe` / `file:pick-icon` — settings → main (open file picker)
- `shortcut:test` — settings → main (validate shortcut string)
- `preset:export` / `preset:import` — settings → main (button preset files)
- `trigger:start-mouse-capture` / `trigger:cancel-mouse-capture` — settings → main
- `trigger:mouse-captured` — main → settings (captured button result)
- `window:minimize` / `window:maximize` — settings/appearance → main

## Terminology
For all UI, IPC, and domain terminology, see [PROMPT.md](./PROMPT.md). Always use the canonical names defined there when communicating about the project.
