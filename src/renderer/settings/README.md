# Settings Renderer

React 18 + TypeScript settings window for ActionRing.

## Structure

```
src/
├── App.tsx                       # Root: tab bar (General | Configure | About)
├── main.tsx                      # Entry point, imports Tailwind CSS
├── context/
│   └── SettingsContext.tsx       # Global draft config state + slot selection + anim preview trigger
├── components/
│   ├── tabs/
│   │   ├── GeneralTab.tsx        # Trigger config, startup toggle
│   │   └── AboutTab.tsx          # Branding / version
│   └── unified/
│       ├── UnifiedTab.tsx        # 3-panel layout wrapper (Configure tab)
│       ├── LeftPanel.tsx         # Global settings: radius, button size, opacity, animation speed
│       ├── RingPreview.tsx       # Interactive SVG ring preview (center panel)
│       └── SlotEditPanel.tsx     # Slot editor (right panel, slides in on slot click)
└── styles/
    └── settings.css              # Tailwind directives + scrollbar / base overrides
```

## Configure Tab Layout

```
┌──────────────────┬──────────────────────────────┬────────────────────┐
│   LEFT PANEL     │     CENTER (PREVIEW)          │  RIGHT PANEL       │
│   (220px)        │     (flex-1, #08081a)         │  (288px, slide-in) │
│                  │                               │                    │
│ ─ Ring Layout ─  │   [Interactive SVG Ring]      │  Slot N — Label    │
│  Distance        │                               │  ────────────────  │
│  Button Size     │   8/12 slots  [+ Add Slot]    │  Label / Icon /    │
│                  │                               │  Action / Enabled  │
│ ─ Appearance ─   │                               │  ▲ ▼ ×            │
│  Opacity         │                               │                    │
│  Anim Speed      │                               │                    │
│                  │                               │                    │
│ [▶ Anim Preview] │                               │                    │
└──────────────────┴──────────────────────────────┴────────────────────┘
```

## State Management

`SettingsContext` holds:
- `draft: AppConfig` — live config, auto-saved to main process via IPC on every change
- `selectedSlotIndex: number | null` — which slot is being edited (drives right panel visibility)
- `animPreviewKey: number` — incrementing key that re-triggers the ring entrance animation
- `updateDraft(config)` — updates state + saves
- `triggerAnimPreview()` — fires animation preview

## Styling

- **Tailwind CSS** (utility classes for layout/flex/gap/overflow)
- **Inline styles** for custom theme colors (`#0f0f1a`, `#1a1a2e`, `#6060ff`, etc.)
- **Framer Motion** for: ring entrance animation, right panel slide-in/out

## Window Size

`1040 × 600px` (set in `src/main/WindowManager.ts`)
