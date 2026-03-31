# Ring Renderer

React 18 + TypeScript transparent overlay window that renders the action ring.

## Structure

```
src/
├── App.tsx                    # Root: listens to ring:show / ring:hide, manages visibility state
├── main.tsx                   # Entry point
├── components/
│   ├── RingOverlay.tsx        # Wrapper that mounts/unmounts the ring with Framer Motion
│   ├── RingCanvas.tsx         # SVG canvas: lays out all segments in a circle
│   ├── RingSegment.tsx        # Individual pie-slice segment (label, icon, hover state)
│   └── SegmentIcon.tsx        # Renders built-in SVG icon or custom icon within a segment
├── hooks/
│   ├── useRingAnimation.ts    # Entrance animation logic (scale + opacity spring)
│   └── useSegmentHitTest.ts   # Determines which segment the cursor is over
└── styles/
    └── ring.css               # Base reset + CSS variables for theming
```

## Window Properties

Set in `src/main/WindowManager.ts`:
- `transparent: true` — no background, only the SVG ring is visible
- `focusable: false` — never steals focus from the active app
- `alwaysOnTop: 'screen-saver'` — renders above all other windows
- `skipTaskbar: true` — not shown in the taskbar
- Shown via `showInactive()` to avoid disturbing the active application

## Data Flow

1. User holds the trigger button → `HookManager` sends `ring:show` with slot config, appearance, and cursor position.
2. Main process repositions the ring window so the cursor is at its center.
3. Ring renderer receives `ring:show` via `window.ringAPI.onShow`, sets `visible = true`.
4. User moves cursor over a segment → `useSegmentHitTest` highlights it; cursor position relayed via `ring:cursor-move`.
5. User releases trigger → `ring:hide` fires → `RingCanvas` captures the highlighted segment → `ring:execute` sent to main.
6. User presses Escape → `ring:dismiss` (detected in main via uiohook-napi, not in this renderer).

## Theming

The ring supports `light` and `dark` themes, resolved by the main process from the system preference and sent in the `ring:show` payload. Theme is applied by setting `document.documentElement.dataset.theme`.
