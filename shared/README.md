# shared/

Shared TypeScript types, constants, and utility modules used by all processes (main, renderer, preload).

## Files

| File | Purpose |
|---|---|
| `config.types.ts` | AppConfig, SlotConfig, ActionConfig type definitions |
| `ipc.types.ts` | IPC channel name constants and payload type definitions |
| `icons.ts` | Built-in SVG icon registry (20 icons bundled) |
| `uiIcons.ts` | UI icon definitions for settings and editor interfaces |
| `colorUtils.ts` | Color manipulation utilities (hex/RGB conversion, contrast calculation) |
| `svgUtils.ts` | SVG parsing and transformation helpers |
| `ringGeometry.ts` | Ring and sub-ring angle/position calculation utilities |
| `mainI18n.ts` | Internationalization strings for the main process |
| `SVGIcon.tsx` | Shared React component for rendering SVG icons |
| `UIIcon.tsx` | Shared React component for rendering UI icons |
| `IconColorPopup.tsx` | Reusable icon & color picker popup (portal-rendered, used by SlotEditPanel and ShortcutsApp) |
