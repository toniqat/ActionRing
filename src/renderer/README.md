# src/renderer/

Six renderer processes, each running in its own BrowserWindow with a dedicated HTML entry point.

## Processes

| Folder | Window | Description |
|---|---|---|
| `ring/` | Transparent overlay | Radial ring UI drawn on a full-screen transparent canvas. Not focusable; always on top. |
| `settings/` | Settings window | Main configuration UI with tabbed panels (slots, radius, shortcuts, unified editor). |
| `appearance/` | Appearance editor | Child window of settings for editing slot icon, color, and label. |
| `shortcuts/` | Shortcuts editor | Visual node-based action sequence editor with drag-and-drop. |
| `progress/` | Progress overlay | Transparent overlay showing action execution progress bar. |
| `popup-menu/` | Context menu | Pooled popup windows for custom right-click context menus. |

## Notes

- All renderers communicate with the main process exclusively through preload-exposed IPC bridges (`src/preload/`).
- Each folder contains its own `src/` directory with React components, plus an `index.html` entry point.
- The ring renderer uses HTML Canvas for drawing; other renderers use standard React DOM.
