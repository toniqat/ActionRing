# resources/icons/

SVG icon assets used for ring slot icons and UI elements.

## Files

| File | Used For | Format |
|---|---|---|
| `tray-icon.svg` | Alternative tray icon (not currently referenced in code) | SVG |
| `*.svg` | Ring slot icons loaded by `iconHandlers.ts` | SVG |

## Notes

- App logo files (`icon.ico`, `icon.svg`, `github-logo.svg`) have been moved to `resources/logo/`.
- `iconHandlers.ts` reads this folder to list available slot icons, skipping `tray-icon.svg` and `README.md`.
