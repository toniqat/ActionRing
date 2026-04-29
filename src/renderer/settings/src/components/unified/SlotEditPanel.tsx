import React, { useCallback, useEffect, useRef, useState, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { BUILTIN_ICONS } from '@shared/icons'
import { SVGIcon } from '@shared/SVGIcon'
import { UIIcon } from '@shared/UIIcon'
import { IconColorPopup } from '@shared/IconColorPopup'
import { useT } from '../../i18n/I18nContext'
import { ShortcutNodeCard } from './ShortcutSidebar'
import type { SlotConfig, ShortcutEntry } from '@shared/config.types'
import type { ResourceIconEntry } from '@shared/ipc.types'

// ── Popup Error Boundary ─────────────────────────────────────────────────────
class PopupErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): { hasError: boolean } { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SlotAppearancePopup] Render error:', error, info)
    this.props.onError()
  }
  render(): ReactNode { return this.state.hasError ? null : this.props.children }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function makeEmptySubSlot(label: string): SlotConfig {
  return {
    id: generateId(),
    label,
    icon: 'star',
    iconIsCustom: false,
    actions: [{ type: 'shell', command: '' }],
    enabled: true,
  }
}

// ── SortableShortcutCard — wraps ShortcutNodeCard with dnd-kit sortable ──────

function SortableShortcutCard({
  id,
  entry,
  onEdit,
  onDelete,
  resourceIcons,
}: {
  id: string
  entry: ShortcutEntry
  onEdit: () => void
  onDelete: () => void
  resourceIcons: ResourceIconEntry[]
}): JSX.Element {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id, data: { entry } })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <ShortcutNodeCard
        entry={entry}
        onEdit={() => onEdit()}
        showDeleteButton
        onDelete={onDelete}
        isDragging={isDragging}
        dragAttributes={attributes as React.HTMLAttributes<HTMLDivElement>}
        dragListeners={listeners as React.HTMLAttributes<HTMLDivElement>}
        resourceIcons={resourceIcons}
      />
    </div>
  )
}

// ── Insertion placeholder shown when dragging a sidebar item over the list ────

function InsertionPlaceholder(): JSX.Element {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 36, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        borderRadius: 7,
        border: '1px dashed var(--c-accent)',
        background: 'var(--c-accent-bg)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--c-accent)',
        fontSize: 11,
      }}
    >
      <UIIcon name="download" size={12} />
    </motion.div>
  )
}

// ── SlotEditPanel ─────────────────────────────────────────────────────────────

export function SlotEditPanel({
  width = 288,
  insertionIndex = null,
  isDraggingExternal = false,
}: {
  width?: number
  insertionIndex?: number | null
  isDraggingExternal?: boolean
}): JSX.Element {
  const t = useT()
  const {
    draft, updateDraft,
    selectedSlotIndex,
    editingFolderIndex, setEditingFolderIndex,
    selectedSubSlotIndex, setSelectedSubSlotIndex,
  } = useSettings()
  const { slots } = draft
  const library = draft.shortcutsLibrary ?? []

  const isEditingSubSlot = editingFolderIndex !== null && selectedSubSlotIndex !== null
  const isEditingPrimarySlot = !isEditingSubSlot && selectedSlotIndex !== null

  const slot: SlotConfig | undefined = isEditingSubSlot
    ? slots[editingFolderIndex!]?.subSlots?.[selectedSubSlotIndex!]
    : isEditingPrimarySlot
      ? slots[selectedSlotIndex!]
      : undefined

  // Appearance popup state
  const [popupOpen, setPopupOpen] = useState(false)
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const [resourceIcons2, setResourceIcons2] = useState<ResourceIconEntry[]>([])

  // Load resource icons when popup opens
  useEffect(() => {
    if (popupOpen) window.settingsAPI?.getResourceIcons?.().then(setResourceIcons2).catch(() => {})
  }, [popupOpen])

  // Close popup when selected slot changes
  useEffect(() => { setPopupOpen(false) }, [selectedSlotIndex, selectedSubSlotIndex])

  const updateSlot = (updated: SlotConfig) => {
    if (isEditingSubSlot) {
      const folder = slots[editingFolderIndex!]
      const newSubSlots = [...(folder.subSlots ?? [])]
      newSubSlots[selectedSubSlotIndex!] = updated
      const newSlots = slots.map((s, i) =>
        i === editingFolderIndex ? { ...s, subSlots: newSubSlots } : s
      )
      updateDraft({ ...draft, slots: newSlots })
    } else {
      const newSlots = [...slots]
      newSlots[selectedSlotIndex!] = updated
      updateDraft({ ...draft, slots: newSlots })
    }
  }

  const openShortcutEditor = useCallback((entry: ShortcutEntry) => {
    if (!slot) return
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    window.settingsAPI.openShortcutsEditor({
      slot: { ...slot, actions: [...entry.actions], label: entry.name },
      slotIndex: isEditingSubSlot ? editingFolderIndex! : selectedSlotIndex!,
      isSubSlot: isEditingSubSlot,
      folderIndex: isEditingSubSlot ? editingFolderIndex : null,
      subSlotIndex: isEditingSubSlot ? selectedSubSlotIndex : null,
      theme,
      libraryEntryId: entry.id,
      shortcutsLibrary: draft.shortcutsLibrary,
      shortcutGroups: draft.shortcutGroups,
    })
  }, [slot, isEditingSubSlot, editingFolderIndex, selectedSlotIndex, selectedSubSlotIndex, draft])

  const removeShortcut = useCallback((index: number) => {
    if (!slot) return
    const newIds = [...(slot.shortcutIds ?? [])]
    newIds.splice(index, 1)
    updateSlot({ ...slot, shortcutIds: newIds })
  }, [slot, updateSlot]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFolder = slot?.actions[0]?.type === 'folder'
  // Slot buttons always use circular background to distinguish from shortcuts (rounded square)
  const iconBtnRadius = '50%'

  const { setNodeRef: setShortcutDropRef, isOver: isShortcutDropOver } = useDroppable({
    id: 'slot-panel-shortcuts',
    disabled: !slot || isFolder,
  })

  // Resolve assigned shortcuts from library
  const assignedShortcuts: ShortcutEntry[] = (slot?.shortcutIds ?? [])
    .map((id) => library.find((e) => e.id === id))
    .filter((e): e is ShortcutEntry => Boolean(e))

  // Load resource icons for inline SVG rendering in shortcut cards
  const [resourceIcons, setResourceIcons] = useState<ResourceIconEntry[]>([])
  useEffect(() => {
    window.settingsAPI?.getResourceIcons?.().then(setResourceIcons).catch(() => {})
  }, [])

  // Load SVG content for custom .svg icons (resource icons or user-uploaded SVGs)
  const [customSvgContent, setCustomSvgContent] = useState<string | null>(null)
  useEffect(() => {
    if (!slot?.iconIsCustom || !slot.icon.endsWith('.svg')) {
      setCustomSvgContent(null)
      return
    }
    window.settingsAPI.readSvgContent(slot.icon).then((svg) => setCustomSvgContent(svg || null))
  }, [slot?.icon, slot?.iconIsCustom])

  const smallIconBtnStyle: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 6,
    border: '1px solid var(--c-border)',
    background: 'none', cursor: 'pointer',
    color: 'var(--c-text-muted)', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'border-color 0.15s, color 0.15s',
  }

  return (
    <>
      <div
        style={{
          width,
          height: '100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* When slot is null (e.g. during profile-switch exit animation) render nothing */}
        {slot && <>
        {/* ─── Integrated name + icon row ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--c-border-sub)',
            flexShrink: 0,
          }}
        >
          {/* Icon button — opens appearance popup (styled like gallery card badge) */}
          <button
            ref={iconBtnRef}
            onClick={() => setPopupOpen((o) => !o)}
            title={t('slot.editAppearance')}
            style={{
              width: 36,
              height: 36,
              borderRadius: iconBtnRadius,
              background: (slot.bgColor ?? '#8b5cf6') + '33',
              border: popupOpen
                ? '1px solid var(--c-accent)'
                : `1px solid ${(slot.bgColor ?? '#8b5cf6')}55`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'border-color 0.15s, background 0.15s',
              padding: 0,
              color: slot.iconColor ?? (slot.bgColor ?? '#8b5cf6'),
            }}
            onMouseEnter={(e) => { if (!popupOpen) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-accent)' }}
            onMouseLeave={(e) => { if (!popupOpen) (e.currentTarget as HTMLButtonElement).style.borderColor = (slot.bgColor ?? '#8b5cf6') + '55' }}
          >
            {slot.iconIsCustom ? (
              customSvgContent ? (
                <SVGIcon svgString={customSvgContent} size={18} color={slot.iconColor ?? (slot.bgColor ?? '#8b5cf6')} />
              ) : (
                <img src={`file://${slot.icon}`} style={{ width: 18, height: 18, objectFit: 'contain' }} />
              )
            ) : (
              <SVGIcon svgString={BUILTIN_ICONS.find((ic) => ic.name === slot.icon)?.svg ?? ''} size={18} color={slot.iconColor ?? (slot.bgColor ?? '#8b5cf6')} />
            )}
          </button>

          {/* Label input — always editable */}
          <input
            value={slot.label}
            onChange={(e) => updateSlot({ ...slot, label: e.target.value })}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              color: 'var(--c-text)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              outline: 'none',
              padding: '2px 0',
              minWidth: 0,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderBottomColor = 'var(--c-accent)' }}
            onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderBottomColor = 'transparent' }}
          />

          {/* Import preset — icon only */}
          <button
            onClick={async () => {
              const imported = await window.settingsAPI.importPreset()
              if (!imported) return
              updateSlot({ ...imported, id: slot.id })
            }}
            title={t('slot.importPreset')}
            style={smallIconBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--c-accent)'
              e.currentTarget.style.color = 'var(--c-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--c-border)'
              e.currentTarget.style.color = 'var(--c-text-muted)'
            }}
          >
            <UIIcon name="download" size={14} />
          </button>

          {/* Export preset — icon only */}
          <button
            onClick={() => window.settingsAPI.exportPreset(slot)}
            title={t('slot.exportPreset')}
            style={smallIconBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--c-accent)'
              e.currentTarget.style.color = 'var(--c-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--c-border)'
              e.currentTarget.style.color = 'var(--c-text-muted)'
            }}
          >
            <UIIcon name="upload" size={14} />
          </button>

          {/* Enabled toggle */}
          <input
            type="checkbox"
            checked={slot.enabled}
            onChange={(e) => updateSlot({ ...slot, enabled: e.target.checked })}
            title={slot.enabled ? 'Disable button' : 'Enable button'}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--c-accent)', flexShrink: 0 }}
          />
        </div>

        {/* ─── Body ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Shortcut / Folder segmented control (hidden for sub-slots) ── */}
          {!isEditingSubSlot && (
          <div className="flex items-center gap-0.5 p-1 rounded-full border border-[var(--c-border)] bg-[var(--c-btn-bg)]">
            {(['shortcut', 'folder'] as const).map((mode) => {
              const active = isFolder ? mode === 'folder' : mode === 'shortcut'
              const label = mode === 'shortcut' ? t('slot.typeShortcut') : t('slot.typeFolder')
              return (
                <button
                  key={mode}
                  onClick={() => {
                    if (mode === 'folder' && !isFolder) {
                      // Auto-generate 3 empty sub-slots if none exist
                      const existingSubSlots = slot.subSlots?.length ? slot.subSlots : undefined
                      const subSlots = existingSubSlots ?? [
                        makeEmptySubSlot(t('ring.newAction')),
                        makeEmptySubSlot(t('ring.newAction')),
                        makeEmptySubSlot(t('ring.newAction')),
                      ]
                      updateSlot({ ...slot, actions: [{ type: 'folder' }], shortcutIds: [], subSlots })
                      // Auto-enter folder edit mode
                      setEditingFolderIndex(selectedSlotIndex)
                      setSelectedSubSlotIndex(null)
                    } else if (mode === 'shortcut' && isFolder) {
                      // Preserve subSlots data for later restoration
                      updateSlot({ ...slot, actions: [] })
                      setEditingFolderIndex(null)
                      setSelectedSubSlotIndex(null)
                    }
                  }}
                  className={[
                    'flex-1 py-1 rounded-full text-[13px] transition-all duration-150 cursor-pointer',
                    active
                      ? 'bg-[var(--c-accent-bg)] border border-[var(--c-accent-border)] text-[var(--c-accent-text)] font-semibold'
                      : 'border border-transparent text-[var(--c-text-muted)] font-normal hover:text-[var(--c-text)]'
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </div>
          )}

          {isFolder ? (
            /* ── Folder slot — sub-slot management ── */
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--c-elevated)',
                border: '1px solid var(--c-border)',
                fontSize: 12,
                color: 'var(--c-text-dim)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--c-text)', marginBottom: 4 }}>{t('slot.folder')}</div>
              {editingFolderIndex !== null ? (
                <>
                  {(slot.subSlots?.length ?? 0) > 0
                    ? t('slot.subSlotsConfigured').replace('{n}', String(slot.subSlots!.length))
                    : t('slot.noSubSlots')}
                </>
              ) : (
                <>
                  {t('slot.clickFolderHint')}
                  {(slot.subSlots?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 6, color: 'var(--c-text-muted)' }}>
                      {t('slot.subSlotsCount').replace('{n}', String(slot.subSlots!.length))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setEditingFolderIndex(selectedSlotIndex)
                      setSelectedSubSlotIndex(null)
                    }}
                    style={{
                      marginTop: 10, width: '100%', padding: '7px 0',
                      borderRadius: 6, border: '1px solid var(--c-accent)',
                      background: 'none', cursor: 'pointer',
                      color: 'var(--c-accent)', fontSize: 12, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {t('slot.editSubSlots')}
                    <UIIcon name="play_arrow" size={12} />
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ── Shortcuts section (sortable + drop target) ── */
            <div
              ref={setShortcutDropRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                borderRadius: 8,
                outline: (isShortcutDropOver && !isDraggingExternal) ? '2px solid var(--c-accent)' : '2px solid transparent',
                outlineOffset: 2,
                transition: 'outline-color 0.12s',
              }}
            >
              {/* Section header */}
              <span
                style={{
                  fontSize: 10,
                  color: (isShortcutDropOver || isDraggingExternal) ? 'var(--c-accent)' : 'var(--c-text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'color 0.12s',
                }}
              >
                {t('slot.shortcuts')}
              </span>

              {/* Assigned shortcuts list — sortable for reorder, with insertion placeholder */}
              {assignedShortcuts.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: (isShortcutDropOver || isDraggingExternal) ? 'var(--c-accent)' : 'var(--c-text-dim)',
                    fontSize: 12,
                    padding: '16px 10px',
                    borderRadius: 8,
                    border: `1px dashed ${(isShortcutDropOver || isDraggingExternal) ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    background: (isShortcutDropOver || isDraggingExternal) ? 'var(--c-accent-bg)' : 'transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  {(isShortcutDropOver || isDraggingExternal) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <UIIcon name="download" size={12} /> Drop to assign
                    </span>
                  ) : t('slot.noActions')}
                </div>
              ) : (
                <SortableContext
                  items={assignedShortcuts.map((_, i) => `assigned-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {assignedShortcuts.map((entry, i) => (
                      <React.Fragment key={`${entry.id}-${i}`}>
                        <AnimatePresence>
                          {isDraggingExternal && insertionIndex === i && (
                            <InsertionPlaceholder key="insert-placeholder" />
                          )}
                        </AnimatePresence>
                        <SortableShortcutCard
                          id={`assigned-${i}`}
                          entry={entry}
                          onEdit={() => openShortcutEditor(entry)}
                          onDelete={() => removeShortcut(i)}
                          resourceIcons={resourceIcons}
                        />
                      </React.Fragment>
                    ))}
                    {/* Placeholder at the end of list */}
                    <AnimatePresence>
                      {isDraggingExternal && insertionIndex === assignedShortcuts.length && (
                        <InsertionPlaceholder key="insert-placeholder-end" />
                      )}
                    </AnimatePresence>
                  </div>
                </SortableContext>
              )}
            </div>
          )}
        </div>
        </>}
      </div>

      {/* Appearance popup — rendered via portal outside overflow containers */}
      {popupOpen && slot && iconBtnRef.current && (
        <PopupErrorBoundary onError={() => setPopupOpen(false)}>
          <IconColorPopup
            icon={slot.icon}
            iconIsCustom={slot.iconIsCustom}
            bgColor={slot.bgColor}
            anchor={iconBtnRef.current}
            resourceIcons={resourceIcons2}
            onSelectIcon={(ic, isCustom) => updateSlot({ ...slot, icon: ic, iconIsCustom: isCustom })}
            onSelectBgColor={(color) => updateSlot({ ...slot, bgColor: color })}
            onClose={() => setPopupOpen(false)}
          />
        </PopupErrorBoundary>
      )}
    </>
  )
}
