import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSettings } from '../../context/SettingsContext'
import { RingPreview } from './RingPreview'
import { SlotEditPanel } from './SlotEditPanel'
import { AppCarousel } from './AppCarousel'
import { FloatingRingLayoutPanel } from './FloatingRingLayoutPanel'
import { ShortcutSidebar } from './ShortcutSidebar'
import type { ShortcutEntry, SlotConfig } from '@shared/config.types'

const SLOT_PANEL_WIDTH = 288
const SIDEBAR_WIDTH = 228
const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 400

// ── Drag overlay ghost ────────────────────────────────────────────────────────

function DragGhost({ entry }: { entry: ShortcutEntry }): JSX.Element {
  return (
    <div style={{
      background: 'var(--c-elevated)',
      border: '1px solid var(--c-accent)',
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 12,
      color: 'var(--c-text)',
      fontFamily: 'inherit',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      opacity: 0.92,
      maxWidth: 180,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      pointerEvents: 'none',
    }}>
      {entry.name || '(unnamed)'}
    </div>
  )
}

// ── Main UnifiedTab ───────────────────────────────────────────────────────────

export function UnifiedTab(): JSX.Element {
  const {
    selectedSlotIndex, setSelectedSlotIndex,
    selectedSubSlotIndex,
    editingFolderIndex,
    draft,
    updateDraft,
  } = useSettings()

  const showPanel = selectedSlotIndex !== null || selectedSubSlotIndex !== null

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH)
  const [activeEntry, setActiveEntry] = useState<ShortcutEntry | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // Append the shortcut to the slot's shortcutIds (additive, not replacement)
  const doAssign = useCallback((entry: ShortcutEntry, slotIndex: number, isSubSlot: boolean) => {
    const { slots } = draft
    const patch = (s: SlotConfig): SlotConfig => ({
      ...s,
      label: s.label || entry.name,
      shortcutIds: [...(s.shortcutIds ?? []), entry.id],
    })

    let newSlots: SlotConfig[]
    if (isSubSlot && editingFolderIndex !== null) {
      const folder = slots[editingFolderIndex]
      if (!folder) return
      const newSubSlots = (folder.subSlots ?? []).map((sub, i) =>
        i === slotIndex ? patch(sub) : sub
      )
      newSlots = slots.map((s, i) =>
        i === editingFolderIndex ? { ...s, subSlots: newSubSlots } : s
      )
    } else {
      newSlots = slots.map((s, i) => i === slotIndex ? patch(s) : s)
      // Auto-open the left config panel for the target slot
      setSelectedSlotIndex(slotIndex)
    }

    updateDraft({ ...draft, slots: newSlots })
  }, [draft, updateDraft, editingFolderIndex, setSelectedSlotIndex])

  const tryAssign = useCallback((entry: ShortcutEntry, slotIndex: number, isSubSlot: boolean) => {
    doAssign(entry, slotIndex, isSubSlot)
  }, [doAssign])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active.data.current?.entry) {
      setActiveEntry(event.active.data.current.entry as ShortcutEntry)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveEntry(null)
    const { over, active } = event
    if (!over || !active.data.current?.entry) return

    const entry = active.data.current.entry as ShortcutEntry
    const overId = String(over.id)

    if (overId.startsWith('ring-slot-')) {
      const slotIndex = parseInt(overId.replace('ring-slot-', ''), 10)
      if (!isNaN(slotIndex)) tryAssign(entry, slotIndex, false)
    } else if (overId.startsWith('ring-subslot-')) {
      const subSlotIndex = parseInt(overId.replace('ring-subslot-', ''), 10)
      if (!isNaN(subSlotIndex)) tryAssign(entry, subSlotIndex, true)
    } else if (overId === 'slot-panel-shortcuts') {
      if (editingFolderIndex !== null && selectedSubSlotIndex !== null) {
        tryAssign(entry, selectedSubSlotIndex, true)
      } else if (selectedSlotIndex !== null) {
        tryAssign(entry, selectedSlotIndex, false)
      }
    }
  }, [tryAssign, editingFolderIndex, selectedSlotIndex, selectedSubSlotIndex])

  const handleDragCancel = useCallback(() => {
    setActiveEntry(null)
  }, [])

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, startWidth + delta)))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <AppCarousel />

        {/* Main content row: [slot panel] [preview] [resize handle] [sidebar] */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

          {/* Slot Edit Panel — in flex flow, animates width to push preview right */}
          <AnimatePresence>
            {showPanel && (
              <motion.div
                key="slot-panel"
                initial={{ width: 0 }}
                animate={{ width: SLOT_PANEL_WIDTH }}
                exit={{ width: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  flexShrink: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--c-surface)',
                  borderRight: '1px solid var(--c-border)',
                  boxShadow: '4px 0 20px rgba(0,0,0,0.25)',
                  zIndex: 10,
                }}
              >
                <SlotEditPanel width={SLOT_PANEL_WIDTH} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview area — ring + floating layout toggle */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <RingPreview />
            {/* Floating Ring Layout toggle + dropdown (top-left) */}
            <FloatingRingLayoutPanel />
          </div>

          {/* Draggable resize handle */}
          <div
            onMouseDown={handleDividerMouseDown}
            style={{
              width: 4,
              flexShrink: 0,
              cursor: 'col-resize',
              background: 'var(--c-border)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-border)' }}
          />

          {/* Right sidebar — shortcut library */}
          <ShortcutSidebar width={sidebarWidth} />
        </div>
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay dropAnimation={null}>
        {activeEntry && <DragGhost entry={activeEntry} />}
      </DragOverlay>

    </DndContext>
  )
}
