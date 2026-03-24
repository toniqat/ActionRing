# resources/icons/

This directory must contain the following icon files before building or running the app.
They are NOT included in the repository and must be created or sourced manually.

## Required Files

| File | Used For | Format | Recommended Size |
|---|---|---|---|
| `tray-icon.png` | System tray icon (all platforms, dev mode) | PNG, transparent background | 16x16 or 22x22 px |
| `tray-icon@2x.png` | System tray icon (macOS Retina) | PNG, transparent background | 32x32 or 44x44 px |
| `app-icon.ico` | Windows app icon (taskbar, installer) | ICO (multi-size: 16/32/48/256) | Multi-size ICO |
| `app-icon.icns` | macOS app icon (Dock, Finder) | ICNS | 1024x1024 source |

## Notes

- The tray icon will gracefully fall back to an empty (invisible) icon if the file is missing at runtime.
- The build will fail for `build:win` if `app-icon.ico` is missing.
- The build will fail for `build:mac` if `app-icon.icns` is missing.
- You can generate `.ico` and `.icns` from a high-resolution PNG using tools such as:
  - `electron-icon-builder` (npm)
  - `png2icons` (npm)
  - Online converters (e.g. https://cloudconvert.com)
