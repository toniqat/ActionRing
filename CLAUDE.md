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
| Action sequence execution | `src/main/SequenceManager.ts` |
| Popup menu window pool | `src/main/PopupMenuManager.ts` |
| Action dialog modals (ask-input, choose-from-list, show-alert) | `src/main/DialogManager.ts` |
| IPC handler modules | `src/main/ipc/` |
| Ring overlay renderer | `src/renderer/ring/` |
| Settings window renderer | `src/renderer/settings/` |
| Appearance editor renderer | `src/renderer/appearance/` |
| Shortcuts editor renderer | `src/renderer/shortcuts/` |
| Progress overlay renderer | `src/renderer/progress/` |
| Popup menu renderer | `src/renderer/popup-menu/` |
| Preload scripts (IPC bridge) | `src/preload/` |
| Shared types and constants | `shared/` |
| Static assets (icons) | `resources/` |
| MCP API server (local HTTP bridge) | `src/main/McpApiServer.ts` |
| MCP stdio server (standalone) | `mcp-server/` |
| Build config | `electron.vite.config.ts`, `package.json` build section |

## Architecture Notes
- Six renderer processes: `ring` (transparent overlay), `settings`, `appearance` (slot appearance editor), `shortcuts` (action sequence editor), `progress` (execution progress overlay), `popup-menu` (context menus)
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

### Shortcuts editor
- `shortcuts:open` — settings → main (open/focus shortcuts editor with slot data)
- `shortcuts:get-data` — shortcuts → main (fetch initial slot data)
- `shortcuts:update` — shortcuts → main (slot changed, relay to settings)
- `shortcuts:updated` — main → settings (relayed slot update)
- `shortcuts:data-refresh` — main → shortcuts (push new slot data to open window)
- `shortcuts:close` — shortcuts → main (close and persist final slot)
- `shortcuts:play` — shortcuts → main (test-play action sequence)
- `shortcuts:committed` — main → settings (final slot committed on close)

### Progress overlay
- `progress:show` — main → progress (show progress bar)
- `progress:update` — main → progress (update progress state)
- `progress:hide` — main → progress (hide overlay)

### Popup menu
- `popup-menu:show` — renderer → main (show context menu at position)
- `popup-menu:result` — main → renderer (selected menu item)

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
- `window:minimize` / `window:maximize` / `window:close` — settings/appearance → main

### Update / system
- `app:get-version` — renderer → main (get app version string)
- `update:check` — renderer → main (check GitHub for new release)
- `shell:open-external` — renderer → main (open URL in default browser)
- `app:show-error-log` — renderer → main (display error log dialog)
- `app:restart` — renderer → main (restart the app)
- `mcp:setup-claude` — settings → main (auto-register MCP server with Claude Code/Desktop)

## MCP Server

ActionRing exposes all its features via a local MCP (Model Context Protocol) server,
allowing AI assistants like Claude to read/write config, create shortcuts, execute actions, and more.

### Architecture
1. **McpApiServer** (`src/main/McpApiServer.ts`) — HTTP API server running on `127.0.0.1:<random-port>` inside the Electron main process. Writes port to `<userData>/.mcp-port`.
2. **MCP stdio server** (`mcp-server/`) — Standalone Node.js process implementing MCP over stdin/stdout. Reads the port file to discover the HTTP API.

### Setup for Claude Desktop / Claude Code
```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "actionring": {
      "command": "node",
      "args": ["<absolute-path-to>/ActionRing/mcp-server/dist/index.js"]
    }
  }
}
```

### Available MCP Tools
| Tool | Description |
|---|---|
| `get_status` | Get ActionRing status |
| `toggle_enabled` | Toggle on/off |
| `get_config` / `save_config` / `reset_config` | Full config CRUD |
| `list_shortcuts` / `get_shortcut` / `create_shortcut` / `update_shortcut` / `delete_shortcut` | Shortcuts library CRUD |
| `execute_shortcut` | Run a shortcut by ID |
| `list_shortcut_groups` / `create_shortcut_group` / `delete_shortcut_group` | Shortcut groups |
| `list_apps` / `add_app` / `remove_app` | App entries |
| `list_profiles` / `add_profile` / `remove_profile` / `rename_profile` / `set_active_profile` | Profiles |
| `get_slots` / `update_slots` | Ring button slots |
| `execute_actions` | Execute actions directly |
| `get_action_types` | Action type reference/schema |

### Dev Commands
```bash
npm run build:mcp   # Build the MCP server (cd mcp-server && npm install && npm run build)
```

## Terminology
For all UI, IPC, and domain terminology, see [PROMPT.md](./PROMPT.md). Always use the canonical names defined there when communicating about the project.
