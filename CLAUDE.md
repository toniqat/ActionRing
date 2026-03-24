# ActionRing — Project Command Center

## Project Overview
Standalone overlay app replicating the Logitech MX Master 4 "Action Rings" feature.
**Stack**: Electron + TypeScript + React 18 + electron-vite

## Feature → Folder Map

| Feature | Folder |
|---|---|
| Main process, hooks, IPC, tray | `src/main/` |
| Global input hook (mouse/keyboard) | `src/main/HookManager.ts` |
| Action execution (launch/shortcut/shell/system) | `src/main/ActionExecutor.ts` |
| Config persistence (JSON) | `src/main/ConfigStore.ts` |
| Ring overlay renderer | `src/renderer/ring/` |
| Settings window renderer | `src/renderer/settings/` |
| Preload scripts (IPC bridge) | `src/preload/` |
| Shared types and constants | `shared/` |
| Static assets (icons) | `resources/` |
| Build config | `electron.vite.config.ts`, `package.json` build section |

## Architecture Notes
- Two renderer processes: `ring` (transparent overlay) and `settings`
- Ring window: `transparent:true`, `focusable:false`, `alwaysOnTop:'screen-saver'`, `showInactive()`
- uiohook-napi MUST be in main process only (native Node addon)
- asarUnpack required for uiohook-napi in electron-builder config
- Config owned by main/ConfigStore; renderers get snapshots via IPC
- Escape key detected in main via uiohook-napi (ring window is not focusable)

## Dev Commands
```bash
npm install
npm run dev        # Start in development mode
npm run build      # Build for production
npm run build:win  # Package as Windows portable .exe
npm run build:mac  # Package as macOS .dmg
```

## IPC Channel Names (see shared/ipc.types.ts)
- `ring:show` — main → ring renderer (payload: slots, appearance, cursor position)
- `ring:hide` — main → ring renderer (trigger released, fire action)
- `ring:execute` — ring → main (execute a slot's action)
- `ring:dismiss` — ring → main (dismiss without action)
- `config:get` — settings → main (fetch AppConfig)
- `config:save` — settings → main (persist AppConfig)
- `config:updated` — main → settings (push updated config)
