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
import { ShortcutSidebar, ShortcutNodeCard, entryIcon } from './ShortcutSidebar'
import type { ShortcutEntry, SlotConfig } from '@shared/config.types'

const SLOT_PANEL_DEFAULT_WIDTH = 288
const SLOT_PANEL_MIN_WIDTH = 220
const SLOT_PANEL_MAX_WIDTH = 440
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

  const [slotPanelWidth, setSlotPanelWidth] = useState(SLOT_PANEL_DEFAULT_WIDTH)
  const [isResizingSlotPanel, setIsResizingSlotPanel] = useState(false)
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
      const updated: SlotConfig = { ...s, label: s.label || entry.name, shortcutIds: ids }
      // Auto-assign shortcut icon when slot has default icon and no prior shortcuts
      const isDefaultIcon = s.icon === 'star' && !s.iconIsCustom
      const hadNoShortcuts = !s.shortcutIds || s.shortcutIds.length === 0
      if (isDefaultIcon && hadNoShortcuts) {
        const resolved = entryIcon(entry)
        updated.icon = entry.icon ?? resolved.icon
        updated.iconIsCustom = entry.iconIsCustom ?? false
        if (entry.bgColor) updated.bgColor = entry.bgColor
      }
      return updated
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

  const handleLeftDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = slotPanelWidth
    setIsResizingSlotPanel(true)

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      setSlotPanelWidth(Math.max(SLOT_PANEL_MIN_WIDTH, Math.min(SLOT_PANEL_MAX_WIDTH, startWidth + delta)))
    }
    const onMouseUp = () => {
      setIsResizingSlotPanel(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [slotPanelWidth])

  const handleRightDividerMouseDown = useCallback((e: React.MouseEvent) => {
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
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

          {/* Slot Edit Panel — in flex flow, animates width to push preview right */}
          <AnimatePresence>
            {showPanel && (
              <>
                <motion.div
                  key="slot-panel"
                  initial={{ width: 0 }}
                  animate={{ width: slotPanelWidth }}
                  exit={{ width: 0 }}
                  transition={{ duration: isResizingSlotPanel ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--c-surface)',
                    boxShadow: '4px 0 20px rgba(0,0,0,0.25)',
                    zIndex: 10,
                  }}
                >
                  <SlotEditPanel
                    width={slotPanelWidth}
                    insertionIndex={insertionIndex}
                    isDraggingExternal={activeEntry !== null && insertionIndex !== null}
                  />
                </motion.div>
                {/* Left panel resize handle */}
                <motion.div
                  key="left-divider"
                  className="panel-resize-handle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onMouseDown={handleLeftDividerMouseDown}
                />
              </>
            )}
          </AnimatePresence>

          {/* Preview area — ring + floating layout toggle + app carousel */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <RingPreview />
            {/* Floating Ring Layout toggle + dropdown (top-left) */}
            <FloatingRingLayoutPanel />
            {/* App carousel — floating at top center, behind side panels */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 5,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ pointerEvents: 'auto' }}>
                <AppCarousel />
              </div>
            </div>
          </div>

          {/* Right sidebar resize handle */}
          <div
            className="panel-resize-handle"
            onMouseDown={handleRightDividerMouseDown}
          />

          {/* Right sidebar — shortcut library */}
          <ShortcutSidebar width={sidebarWidth} />
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay dropAnimation={null}>
        {activeEntry && <DragGhost entry={activeEntry} />}
      </DragOverlay>

    </DndContext>
  )
}
