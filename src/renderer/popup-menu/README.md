# Popup Menu Renderer

React 18 + TypeScript renderer for dynamically created context menu windows. Managed by `PopupMenuManager` in the main process, which maintains a pool of reusable BrowserWindow instances.

## Structure

```
src/
├── PopupMenu.tsx  # Root component: renders menu items, handles click and submenu navigation
└── main.tsx       # Entry point
```

## Window Lifecycle

1. A renderer calls `popup-menu:show` with menu items and screen position.
2. `PopupMenuManager` picks an idle window from the pool (or creates a new one), positions it, and sends menu data.
3. User clicks an item → renderer sends the selected item ID back to main.
4. Main resolves the original IPC call with the selected ID (or `null` if dismissed).
5. The window is hidden and returned to the pool for reuse.

## API Surface (`window.popupMenuAPI`)

Exposed by `src/preload/popupMenu.ts`:
- `onShow(cb)` — receives menu items and display options
- `selectItem(id)` — report the selected menu item back to main
- `dismiss()` — close without selection
