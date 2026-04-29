# Progress Renderer

React 18 + TypeScript transparent overlay window that displays action sequence execution progress (320x80).

## Structure

```
src/
├── ProgressOverlay.tsx  # Root component: renders progress bar and step label
└── main.tsx             # Entry point
```

## Window Lifecycle

1. `SequenceManager` begins executing a multi-step action sequence.
2. Main process sends `progress:show` to display the overlay near the cursor.
3. Each step completion sends `progress:update` with current step index and label.
4. On sequence completion, main sends `progress:hide` to dismiss the overlay.

## API Surface (`window.progressAPI`)

Exposed by `src/preload/progress.ts`:
- `onShow(cb)` — called when a sequence starts (shows the overlay)
- `onUpdate(cb)` — called on each step to update the progress bar
- `onHide(cb)` — called when the sequence finishes (hides the overlay)
