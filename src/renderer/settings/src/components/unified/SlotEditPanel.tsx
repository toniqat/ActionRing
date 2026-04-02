import React, { useCallback, useEffect, useRef, useState, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import { HexColorPicker } from 'react-colorful'
import { useSettings } from '../../context/SettingsContext'
import { BUILTIN_ICONS } from '@shared/icons'
import { SVGIcon } from '@shared/SVGIcon'
import { UIIcon } from '@shared/UIIcon'
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

// ── Preset colors for the color picker ────────────────────────────────────────
const PRESET_BG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]
const POPUP_ICON_BTN = 26
const POPUP_GRID_COLS = 7

// ── SlotAppearancePopup ───────────────────────────────────────────────────────
// Context-menu-style popup for inline icon and color editing.
// Rendered via createPortal so it escapes overflow:hidden ancestors.

function SlotAppearancePopup({
  slot,
  onUpdate,
  onClose,
  anchorEl,
}: {
  slot: SlotConfig
  onUpdate: (updated: SlotConfig) => void
  onClose: () => void
  anchorEl: HTMLElement | null
}): JSX.Element | null {
  const [mode, setMode] = useState<'icon' | 'color'>('icon')
  const [search, setSearch] = useState('')
  const [resourceIcons, setResourceIcons] = useState<ResourceIconEntry[]>([])
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [customColorOpen, setCustomColorOpen] = useState(false)
  const [customColor, setCustomColor] = useState(slot.bgColor ?? '#3a3f4b')
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('actionring-recent-bgcolors') ?? '[]') as string[] } catch { return [] }
  })

  const trackRecentColor = (color: string | undefined) => {
    if (color) {
      setRecentColors((prev) => {
        const next = [color, ...prev.filter((c) => c !== color)].slice(0, 10)
        localStorage.setItem('actionring-recent-bgcolors', JSON.stringify(next))
        return next
      })
    }
  }

  // Position and load resource icons when anchor is provided
  useEffect(() => {
    if (!anchorEl) return
    try {
      const rect = anchorEl.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    } catch { /* anchorEl may have been unmounted */ }
    window.settingsAPI?.getResourceIcons?.().then(setResourceIcons).catch(() => {})
  }, [anchorEl])

  // Click-outside to close (deferred so the opening click doesn't immediately close)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose, anchorEl])

  if (!pos) return null

  const searchLower = search.trim().toLowerCase()
  const filteredBuiltin = searchLower
    ? BUILTIN_ICONS.filter((ic) => ic.label.toLowerCase().includes(searchLower))
    : BUILTIN_ICONS
  const filteredResource = searchLower
    ? resourceIcons.filter((ic) => ic.name.toLowerCase().includes(searchLower))
    : resourceIcons

  return createPortal(
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        width: 268,
        maxHeight: 400,
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'auto',
      } as React.CSSProperties}
    >
      {/* Mode toggle: Icon | Color */}
      <div style={{ display: 'flex', padding: '8px 10px 6px', flexShrink: 0, gap: 4, position: 'relative', zIndex: 1 }}>
        {(['icon', 'color'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6,
              border: mode === m ? '1px solid var(--c-accent-border)' : '1px solid transparent',
              background: mode === m ? 'var(--c-accent-bg)' : 'var(--c-elevated)',
              color: mode === m ? 'var(--c-accent)' : 'var(--c-text-muted)',
              fontSize: 11, fontWeight: mode === m ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}
          >
            {m === 'icon' ? 'Icon' : 'Color'}
          </button>
        ))}
      </div>

      {mode === 'color' ? (
        /* ── Color picker with preset swatches ── */
        <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, 36px)`, gap: 6, justifyContent: 'center', marginBottom: 8 }}>
            {/* Auto/None swatch */}
            <button
              onClick={() => { onUpdate({ ...slot, bgColor: undefined }) }}
              title="Auto (theme default)"
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${slot.bgColor === undefined ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: 'var(--c-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, color: 'var(--c-text-dim)', fontSize: 9, fontWeight: 600,
              }}
            >auto</button>

            {/* Preset color swatches */}
            {PRESET_BG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { trackRecentColor(color); onUpdate({ ...slot, bgColor: color }) }}
                title={color}
                style={{
                  width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                  border: '2px solid transparent',
                  outline: slot.bgColor === color ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                  background: color,
                  padding: 0,
                }}
              />
            ))}

            {/* Custom color picker trigger */}
            <button
              onClick={() => setCustomColorOpen((v) => !v)}
              title="Custom color…"
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${customColorOpen ? 'var(--c-accent)' : 'transparent'}`,
                background: 'conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #8b5cf6, #ec4899, #ef4444)',
                padding: 0,
              }}
            />
          </div>

          {/* Inline HexColorPicker */}
          {customColorOpen && (
            <div style={{ marginBottom: 8 }}>
              <HexColorPicker
                color={customColor}
                onChange={(c) => { setCustomColor(c); trackRecentColor(c); onUpdate({ ...slot, bgColor: c }) }}
                style={{ width: '100%', height: 150 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input
                  value={customColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setCustomColor(v)
                      if (v.length === 7) { trackRecentColor(v); onUpdate({ ...slot, bgColor: v }) }
                    }
                  }}
                  style={{
                    flex: 1, background: 'var(--c-input-bg)',
                    border: '1px solid var(--c-border)', borderRadius: 5,
                    color: 'var(--c-text)', padding: '4px 8px',
                    fontSize: 11, fontFamily: 'monospace', outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                />
                {slot.bgColor && (
                  <button
                    onClick={() => onUpdate({ ...slot, bgColor: undefined })}
                    title="Reset to theme default"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--c-text-dim)', padding: 2, borderRadius: 4,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <UIIcon name="close" size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recently used colors */}
          {recentColors.length > 0 && (
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', fontWeight: 600, marginBottom: 6 }}>
                Recent
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {recentColors.slice(0, 10).map((color) => (
                  <button
                    key={color}
                    onClick={() => onUpdate({ ...slot, bgColor: color })}
                    title={color}
                    style={{
                      width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                      border: '2px solid transparent',
                      outline: slot.bgColor === color ? `2px solid ${color}` : 'none',
                      outlineOffset: 2,
                      background: color,
                      padding: 0, flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Icon selection grid ── */
        <>
          <div style={{ padding: '0 10px 6px', flexShrink: 0 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons…"
              style={{
                width: '100%', background: 'var(--c-input-bg)',
                border: '1px solid var(--c-border)', borderRadius: 6,
                color: 'var(--c-text)', padding: '4px 8px',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '0 10px 10px',
              display: 'grid',
              gridTemplateColumns: `repeat(${POPUP_GRID_COLS}, ${POPUP_ICON_BTN}px)`,
              gap: 4, alignContent: 'start', justifyContent: 'center',
            }}
          >
            {filteredBuiltin.map((ic) => {
              const selected = slot.icon === ic.name && !slot.iconIsCustom
              return (
                <button
                  key={ic.name}
                  onClick={() => onUpdate({ ...slot, icon: ic.name, iconIsCustom: false })}
                  title={ic.label}
                  style={{
                    width: POPUP_ICON_BTN, height: POPUP_ICON_BTN, borderRadius: 5, cursor: 'pointer', padding: 0,
                    border: `2px solid ${selected ? 'var(--c-accent)' : 'transparent'}`,
                    background: selected ? 'var(--c-btn-active)' : 'var(--c-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text)',
                  }}
                >
                  <SVGIcon svgString={ic.svg} size={14} />
                </button>
              )
            })}
            {filteredResource.map((entry) => {
              const selected = slot.icon === entry.absPath && slot.iconIsCustom
              return (
                <button
                  key={entry.filename}
                  onClick={() => onUpdate({ ...slot, icon: entry.absPath, iconIsCustom: true })}
                  title={entry.name}
                  style={{
                    width: POPUP_ICON_BTN, height: POPUP_ICON_BTN, borderRadius: 5, cursor: 'pointer', padding: 0,
                    border: `2px solid ${selected ? 'var(--c-accent)' : 'transparent'}`,
                    background: selected ? 'var(--c-btn-active)' : 'var(--c-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text)',
                  }}
                >
                  <SVGIcon svgString={entry.svgContent} size={14} />
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>,
    document.body
  )
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

// ── SlotEditPanel ─────────────────────────────────────────────────────────────

export function SlotEditPanel({ width = 288 }: { width?: number }): JSX.Element {
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
                <SVGIcon svgString={customSvgContent} size={18} />
              ) : (
                <img src={`file://${slot.icon}`} style={{ width: 18, height: 18, objectFit: 'contain' }} />
              )
            ) : (
              <SVGIcon svgString={BUILTIN_ICONS.find((ic) => ic.name === slot.icon)?.svg ?? ''} size={18} />
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
            /* ── Shortcuts section ── */
            <div
              ref={setShortcutDropRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                borderRadius: 8,
                outline: isShortcutDropOver ? '2px solid var(--c-accent)' : '2px solid transparent',
                outlineOffset: 2,
                transition: 'outline-color 0.12s',
              }}
            >
              {/* Section header */}
              <span
                style={{
                  fontSize: 10,
                  color: isShortcutDropOver ? 'var(--c-accent)' : 'var(--c-text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'color 0.12s',
                }}
              >
                {t('slot.shortcuts')}
              </span>

              {/* Assigned shortcuts list */}
              {assignedShortcuts.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: isShortcutDropOver ? 'var(--c-accent)' : 'var(--c-text-dim)',
                    fontSize: 12,
                    padding: '16px 10px',
                    borderRadius: 8,
                    border: `1px dashed ${isShortcutDropOver ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    background: isShortcutDropOver ? 'var(--c-accent-bg)' : 'transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  {isShortcutDropOver ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <UIIcon name="download" size={12} /> Drop to assign
                    </span>
                  ) : t('slot.noActions')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assignedShortcuts.map((entry, i) => (
                    <ShortcutNodeCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => openShortcutEditor(entry)}
                      showDeleteButton
                      onDelete={() => removeShortcut(i)}
                    />
                  ))}
                  {/* Drop-to-add hint shown while dragging over */}
                  {isShortcutDropOver && (
                    <div style={{
                      textAlign: 'center',
                      color: 'var(--c-accent)',
                      fontSize: 12,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px dashed var(--c-accent)',
                      background: 'var(--c-accent-bg)',
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <UIIcon name="download" size={12} /> Drop to add
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </>}
      </div>

      {/* Appearance popup — rendered via portal outside overflow containers */}
      {popupOpen && slot && (
        <PopupErrorBoundary onError={() => setPopupOpen(false)}>
          <SlotAppearancePopup
            slot={slot}
            onUpdate={updateSlot}
            onClose={() => setPopupOpen(false)}
            anchorEl={iconBtnRef.current}
          />
        </PopupErrorBoundary>
      )}
    </>
  )
}
