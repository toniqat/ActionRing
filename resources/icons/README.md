# resources/icons/

Icon assets used for the application window, taskbar, and system tray.

## Files

| File | Used For | Format |
|---|---|---|
| `icon.ico` | Windows app icon (taskbar, window frame) + tray icon | ICO (multi-size: 16/32/48/256) |
| `icon.svg` | macOS/Linux app icon (Dock, Finder) + tray icon | SVG |
| `tray-icon.svg` | Alternative tray icon (not currently referenced in code) | SVG |

## How icons are loaded

`WindowManager.ts` and `TrayManager.ts` select the icon at runtime:
```ts
const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.svg'
```

`package.json` electron-builder config also references:
- `resources/icons/icon.ico` — Windows build
- `resources/icons/icon.svg` — macOS build

## Build requirements

- `build:win` requires `icon.ico` to be present — the build will fail without it.
- `build:mac` requires `icon.svg` (or an `.icns`) to be present.
- To regenerate icons from a high-resolution PNG, use tools such as:
  - `electron-icon-builder` (npm)
  - `png2icons` (npm)
  - Online converters (e.g. cloudconvert.com)
