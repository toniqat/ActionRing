import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useSettings } from '../../context/SettingsContext'
import { RingPreview } from './RingPreview'
import { SlotEditPanel } from './SlotEditPanel'
import { AppCarousel } from './AppCarousel'
import { FloatingRingLayoutPanel } from './FloatingRingLayoutPanel'
import { ShortcutSidebar, ShortcutNodeCard } from './ShortcutSidebar'
import type { ShortcutEntry, SlotConfig } from '@shared/config.types'

const SLOT_PANEL_WIDTH = 288
const SIDEBAR_WIDTH = 228
const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 400

// ── Drag overlay ghost — uses ShortcutNodeCard for visual consistency ─────────

function DragGhost({ entry }: { entry: ShortcutEntry }): JSX.Element {
  return (
    <div style={{
      pointerEvents: 'none',
      width: 220,
      opacity: 0.92,
      filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.35))',
      transform: 'rotate(1.5deg)',
    }}>
      <ShortcutNodeCard entry={entry} onEdit={() => {}} />
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
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // Assign shortcut to slot, optionally at a specific index
  const doAssign = useCallback((entry: ShortcutEntry, slotIndex: number, isSubSlot: boolean, insertAt?: number) => {
    const { slots } = draft
    const patch = (s: SlotConfig): SlotConfig => {
      const ids = [...(s.shortcutIds ?? [])]
      if (insertAt !== undefined && insertAt >= 0 && insertAt <= ids.length) {
        ids.splice(insertAt, 0, entry.id)
      } else {
        ids.push(entry.id)
      }
      return { ...s, label: s.label || entry.name, shortcutIds: ids }
    }

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
      setSelectedSlotIndex(slotIndex)
    }

    updateDraft({ ...draft, slots: newSlots })
  }, [draft, updateDraft, editingFolderIndex, setSelectedSlotIndex])

  // Reorder shortcutIds within the current slot
  const reorderShortcuts = useCallback((oldIndex: number, newIndex: number) => {
    const { slots } = draft
    const isEditingSubSlot = editingFolderIndex !== null && selectedSubSlotIndex !== null
    const patchReorder = (s: SlotConfig): SlotConfig => ({
      ...s,
      shortcutIds: arrayMove(s.shortcutIds ?? [], oldIndex, newIndex),
    })

    let newSlots: SlotConfig[]
    if (isEditingSubSlot) {
      const folder = slots[editingFolderIndex!]
      if (!folder) return
      const newSubSlots = (folder.subSlots ?? []).map((sub, i) =>
        i === selectedSubSlotIndex! ? patchReorder(sub) : sub
      )
      newSlots = slots.map((s, i) =>
        i === editingFolderIndex! ? { ...s, subSlots: newSubSlots } : s
      )
    } else if (selectedSlotIndex !== null) {
      newSlots = slots.map((s, i) => i === selectedSlotIndex ? patchReorder(s) : s)
    } else {
      return
    }
    updateDraft({ ...draft, slots: newSlots })
  }, [draft, updateDraft, editingFolderIndex, selectedSlotIndex, selectedSubSlotIndex])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.entry) {
      setActiveEntry(data.entry as ShortcutEntry)
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) { setInsertionIndex(null); return }

    const activeId = String(active.id)
    // Only track insertion index for external items from the sidebar
    if (!activeId.startsWith('sidebar-entry-')) return

    const overId = String(over.id)
    if (overId.startsWith('assigned-')) {
      const idx = parseInt(overId.replace('assigned-', ''), 10)
      if (!isNaN(idx)) {
        // Determine insert-before vs insert-after by comparing positions
        const translated = active.rect.current.translated
        if (translated) {
          const activeCenter = translated.top + translated.height / 2
          const overCenter = over.rect.top + over.rect.height / 2
          setInsertionIndex(activeCenter < overCenter ? idx : idx + 1)
        } else {
          setInsertionIndex(idx)
        }
      }
    } else if (overId === 'slot-panel-shortcuts') {
      // Over the container — resolve current count to append at end
      const isSubSlot = editingFolderIndex !== null && selectedSubSlotIndex !== null
      const slot = isSubSlot
        ? draft.slots[editingFolderIndex!]?.subSlots?.[selectedSubSlotIndex!]
        : selectedSlotIndex !== null ? draft.slots[selectedSlotIndex] : undefined
      setInsertionIndex(slot?.shortcutIds?.length ?? 0)
    } else {
      setInsertionIndex(null)
    }
  }, [draft, editingFolderIndex, selectedSlotIndex, selectedSubSlotIndex])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const savedInsertionIndex = insertionIndex
    setActiveEntry(null)
    setInsertionIndex(null)

    const { over, active } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Case 1: Reordering assigned shortcuts within the panel
    if (activeId.startsWith('assigned-') && overId.startsWith('assigned-')) {
      const oldIdx = parseInt(activeId.replace('assigned-', ''), 10)
      const newIdx = parseInt(overId.replace('assigned-', ''), 10)
      if (!isNaN(oldIdx) && !isNaN(newIdx) && oldIdx !== newIdx) {
        reorderShortcuts(oldIdx, newIdx)
      }
      return
    }

    // Case 2: Dropping from sidebar
    const entry = active.data.current?.entry as ShortcutEntry | undefined
    if (!entry) return

    if (overId.startsWith('ring-slot-')) {
      const slotIndex = parseInt(overId.replace('ring-slot-', ''), 10)
      if (!isNaN(slotIndex)) doAssign(entry, slotIndex, false)
    } else if (overId.startsWith('ring-subslot-')) {
      const subSlotIndex = parseInt(overId.replace('ring-subslot-', ''), 10)
      if (!isNaN(subSlotIndex)) doAssign(entry, subSlotIndex, true)
    } else if (overId === 'slot-panel-shortcuts' || overId.startsWith('assigned-')) {
      const insertAt = savedInsertionIndex ?? undefined
      if (editingFolderIndex !== null && selectedSubSlotIndex !== null) {
        doAssign(entry, selectedSubSlotIndex, true, insertAt)
      } else if (selectedSlotIndex !== null) {
        doAssign(entry, selectedSlotIndex, false, insertAt)
      }
    }
  }, [doAssign, reorderShortcuts, insertionIndex, editingFolderIndex, selectedSlotIndex, selectedSubSlotIndex])

  const handleDragCancel = useCallback(() => {
    setActiveEntry(null)
    setInsertionIndex(null)
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
                <SlotEditPanel
                  width={SLOT_PANEL_WIDTH}
                  insertionIndex={insertionIndex}
                  isDraggingExternal={activeEntry !== null && insertionIndex !== null}
                />
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
