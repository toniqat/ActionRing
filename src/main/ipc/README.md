# src/main/ipc/

IPC handler modules registered in the Electron main process. Each file exports a `register*Handlers()` function called from `src/main/index.ts`.

## Files

| File | Responsibility |
|---|---|
| `appearanceHandlers.ts` | Appearance editor open/close, slot data relay, panel size persistence |
| `iconHandlers.ts` | Built-in/custom/recent icon CRUD, SVG icon listing from `resources/icons/` |
| `processHandlers.ts` | Running process list, app icon extraction, file/icon picker dialogs |
| `profileHandlers.ts` | App profile add/remove/rename/duplicate/export/import, active profile switching |
| `ringHandlers.ts` | Ring overlay show/hide/execute, cursor-move forwarding, trigger mouse capture |
| `settingsHandlers.ts` | Config get/save/reset, global export/import, preset export/import, window controls |
| `shortcutsHandlers.ts` | Shortcuts editor open/close, slot data relay, test-play action sequence |
| `updateHandlers.ts` | App version, update check (GitHub releases), shell:open-external, error log, restart, MCP setup |
