# Shortcuts Renderer

React 18 + TypeScript window for editing the action sequence of a single ring slot. Opens as a child window of the settings window (880x560).

## Structure

```
src/
├── ShortcutsApp.tsx    # Root component: fetches slot data, renders action sequence editor
├── CustomSelect.tsx    # Styled select dropdown component
├── VariableInput.tsx   # Input component with variable substitution support
└── main.tsx            # Entry point
```

## Window Lifecycle

1. User clicks "Edit Shortcuts" on a slot in settings → settings calls `shortcuts:open` with `ShortcutsSlotData`.
2. Main process opens (or focuses + refreshes) the shortcuts window via `WindowManager.createShortcutsWindow`.
3. Shortcuts renderer calls `shortcuts:get-data` on load to retrieve the initial slot data.
4. Each slot change fires `shortcuts:update` → main relays to settings via `shortcuts:updated`.
5. User closes the window → `shortcuts:close` fired → main persists the final slot state and emits `shortcuts:committed`.

## API Surface (`window.shortcutsAPI`)

Exposed by `src/preload/shortcuts.ts`:
- `getSlotData()` — fetch initial `ShortcutsSlotData`
- `updateSlot(slot)` — push a slot change to main (relayed to settings)
- `closeWindow()` — close and persist
- `playActions(actions)` — test-play an action sequence, returns per-node results
- `pickExe()` — open file picker for executable
- `exportPreset(slot)` / `importPreset()` — button preset file I/O
- `onDataRefresh(cb)` — called when settings opens the editor for a different slot while window is open
- `onThemeChanged(cb)` — receive theme changes from main
- `showPopupMenu(request)` — show a context menu via PopupMenuManager
- `minimizeWindow()` / `maximizeWindow()` — frameless window controls
