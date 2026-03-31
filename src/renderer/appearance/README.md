# Appearance Renderer

React 18 + TypeScript window for editing the full visual appearance of a single ring slot. Opens as a child window of the settings window.

## Structure

```
src/
├── AppearanceApp.tsx    # Root component: fetches slot data, renders AppearanceEditor + WinControls
└── main.tsx             # Entry point
```

## Shared Components

`AppearanceApp` reuses components from the settings renderer:
- `@settings/components/unified/AppearanceEditor` — the full appearance editor UI
- `@settings/components/WinControls` — custom frameless title bar controls
- `@settings/i18n/I18nContext` — translation context

This avoids duplicating UI code across two renderer bundles.

## Window Lifecycle

1. User clicks "Edit Appearance" on a slot in settings → settings calls `appearance:open` with `AppearanceSlotData`.
2. Main process opens (or focuses + refreshes) the appearance window via `WindowManager.createAppearanceWindow`.
3. Appearance renderer calls `appearance:get-data` on load to retrieve the initial slot data.
4. Each slot change fires `appearance:update` → main relays to settings via `appearance:updated`.
5. User closes the window → `appearance:close` fired → main persists the final slot state to `ConfigStore`.

## API surface (`window.appearanceAPI`)

Exposed by `src/preload/appearance.ts`:
- `getSlotData()` — fetch initial `AppearanceSlotData`
- `updateSlot(slot)` — push a slot change to main (relayed to settings)
- `closeWindow()` — close and persist
- `savePanelSizes(sizes)` — persist three-panel resizer sizes
- `minimizeWindow()` / `maximizeWindow()` — frameless window controls
- `onDataRefresh(cb)` — called when settings opens the editor for a different slot while window is open
- `getCustomIcons()` / `addCustomIcon()` / `removeCustomIcon(id)` — custom icon library
- `getRecentIcons()` / `addRecentIcon(iconRef)` — recently used icons
