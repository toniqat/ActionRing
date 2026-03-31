import { useState, useEffect, useRef, useCallback } from 'react'
import { useT } from '../../i18n/I18nContext'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Layout } from 'react-resizable-panels'
import { HexColorPicker } from 'react-colorful'
import { BUILTIN_ICONS } from '@shared/icons'
import type { SlotConfig } from '@shared/config.types'
import type { CustomIconEntry } from '@shared/ipc.types'

interface Props {
  slot: SlotConfig
  onUpdate: (updated: SlotConfig) => void
  defaultSizes?: [number, number, number]
  onSizesChange?: (sizes: [number, number, number]) => void
  onSave?: () => void
  onReset?: () => void
}

// Panel IDs for layout persistence
const ICON_ID = 'ae-icon'
const PREVIEW_ID = 'ae-preview'
const COLORS_ID = 'ae-colors'

const DEFAULT_SIZES: [number, number, number] = [22, 49, 29]

const ICON_BTN = 36
const ICON_GAP = 6

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--c-text-dim)',
  fontWeight: 600,
}

type ColorField = 'bg' | 'icon' | 'text'

/** Number of columns that fit given a measured panel content width. */
function calcCols(width: number): number {
  return Math.max(2, Math.floor((width + ICON_GAP) / (ICON_BTN + ICON_GAP)))
}

/** True when iconRef looks like an absolute file path rather than a builtin name. */
function isPathRef(iconRef: string): boolean {
  return iconRef.startsWith('/') || /^[A-Za-z]:[\\/]/.test(iconRef)
}

// ── Small reusable icon button ───────────────────────────────────────────────

interface IconBtnProps {
  iconName?: string       // builtin name (renders SVG)
  iconAbsPath?: string    // absolute path (renders <img>)
  isSelected: boolean
  label: string
  onClick: () => void
}

function IconBtn({ iconName, iconAbsPath, isSelected, label, onClick }: IconBtnProps): JSX.Element {
  const svg = iconName ? BUILTIN_ICONS.find((i) => i.name === iconName)?.svg ?? null : null
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: ICON_BTN, height: ICON_BTN, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
        border: `2px solid ${isSelected ? 'var(--c-accent)' : 'transparent'}`,
        background: isSelected ? 'var(--c-btn-active)' : 'var(--c-elevated)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-text)', padding: 0,
      }}
    >
      {svg ? (
        // eslint-disable-next-line react/no-danger
        <span dangerouslySetInnerHTML={{ __html: svg.replace('width="24" height="24"', 'width="18" height="18"') }} />
      ) : iconAbsPath ? (
        <img src={`file://${iconAbsPath}`} style={{ width: 18, height: 18, objectFit: 'contain' }} />
      ) : null}
    </button>
  )
}

// ── Expand/collapse [...] button ─────────────────────────────────────────────

function ToggleBtn({ expanded, onClick, showLess, showMore }: { expanded: boolean; onClick: () => void; showLess: string; showMore: string }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={expanded ? showLess : showMore}
      style={{
        width: ICON_BTN, height: ICON_BTN, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
        border: '1px solid var(--c-border)',
        background: 'var(--c-elevated)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-text-dim)', fontSize: 12, fontWeight: 700, padding: 0,
      }}
    >
      {expanded ? '↑' : '···'}
    </button>
  )
}

// ── Section label row ────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }): JSX.Element {
  return (
    <div style={{ ...sectionLabel, marginBottom: 5, marginTop: 10 }}>
      {label}
    </div>
  )
}

// ── Icon grid ────────────────────────────────────────────────────────────────

function IconGrid({ cols, children }: { cols: number; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${ICON_BTN}px)`,
        gap: ICON_GAP,
        paddingBottom: 4,
      }}
    >
      {children}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function AppearanceEditor({ slot, onUpdate, defaultSizes, onSizesChange, onSave, onReset }: Props): JSX.Element {
  const t = useT()
  const [search, setSearch] = useState('')
  const [activePicker, setActivePicker] = useState<ColorField | null>(null)

  // Icon library state
  const [customIcons, setCustomIcons] = useState<CustomIconEntry[]>([])
  const [recentIcons, setRecentIcons] = useState<string[]>([])
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [customExpanded, setCustomExpanded] = useState(false)

  // Dynamic column count via ResizeObserver
  const iconPanelRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(3)

  useEffect(() => {
    const el = iconPanelRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setCols(calcCols(entries[0].contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load icon data on mount
  useEffect(() => {
    window.appearanceAPI.getCustomIcons().then(setCustomIcons)
    window.appearanceAPI.getRecentIcons().then(setRecentIcons)
  }, [])

  // ── Icon selection handlers ────────────────────────────────────────────────

  const handleSelectBuiltin = useCallback(
    (ic: (typeof BUILTIN_ICONS)[0]) => {
      onUpdate({ ...slot, icon: ic.name, iconIsCustom: false })
      window.appearanceAPI.addRecentIcon(ic.name)
      setRecentIcons((prev) => [ic.name, ...prev.filter((r) => r !== ic.name)].slice(0, 30))
    },
    [slot, onUpdate]
  )

  const handleSelectCustom = useCallback(
    (entry: CustomIconEntry) => {
      onUpdate({ ...slot, icon: entry.absPath, iconIsCustom: true })
      window.appearanceAPI.addRecentIcon(entry.absPath)
      setRecentIcons((prev) => [entry.absPath, ...prev.filter((r) => r !== entry.absPath)].slice(0, 30))
    },
    [slot, onUpdate]
  )

  const handleSelectFromRecent = useCallback(
    (iconRef: string) => {
      if (isPathRef(iconRef)) {
        const entry = customIcons.find((e) => e.absPath === iconRef)
        if (entry) handleSelectCustom(entry)
        else {
          // Fallback: icon was deleted from library but still in recent
          onUpdate({ ...slot, icon: iconRef, iconIsCustom: true })
        }
      } else {
        const ic = BUILTIN_ICONS.find((i) => i.name === iconRef)
        if (ic) handleSelectBuiltin(ic)
      }
    },
    [customIcons, slot, onUpdate, handleSelectBuiltin, handleSelectCustom]
  )

  const handleAddCustom = useCallback(async () => {
    const entry = await window.appearanceAPI.addCustomIcon()
    if (!entry) return
    setCustomIcons((prev) => [...prev, entry])
    handleSelectCustom(entry)
  }, [handleSelectCustom])

  const handleRemoveCustom = useCallback(
    async (e: React.MouseEvent, entry: CustomIconEntry) => {
      e.stopPropagation()
      await window.appearanceAPI.removeCustomIcon(entry.id)
      setCustomIcons((prev) => prev.filter((c) => c.id !== entry.id))
      // If this was the selected icon, clear it
      if (slot.icon === entry.absPath) {
        onUpdate({ ...slot, icon: '', iconIsCustom: false })
      }
    },
    [slot, onUpdate]
  )

  // ── Panel sizes ───────────────────────────────────────────────────────────

  const sizes = defaultSizes ?? DEFAULT_SIZES

  const handleLayoutChanged = (layout: Layout) => {
    const s: [number, number, number] = [
      layout[ICON_ID] ?? DEFAULT_SIZES[0],
      layout[PREVIEW_ID] ?? DEFAULT_SIZES[1],
      layout[COLORS_ID] ?? DEFAULT_SIZES[2],
    ]
    onSizesChange?.(s)
  }

  // ── Color picker renderer ─────────────────────────────────────────────────

  const renderColorPicker = (key: ColorField, label: string) => {
    const colorMap: Record<ColorField, string | undefined> = {
      bg: slot.bgColor,
      icon: slot.iconColor,
      text: slot.textColor,
    }
    const fieldMap: Record<ColorField, keyof SlotConfig> = {
      bg: 'bgColor',
      icon: 'iconColor',
      text: 'textColor',
    }
    const color = colorMap[key]
    const field = fieldMap[key]
    const isActive = activePicker === key

    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setActivePicker(isActive ? null : key)}
              title={color ?? t('appearance.themeDefault')}
              style={{
                width: 44, height: 20, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                border: isActive ? '2px solid var(--c-accent)' : '1px solid var(--c-border)',
                background: color ?? 'var(--c-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {!color && (
                <span style={{ fontSize: 8, color: 'var(--c-text-dim)', pointerEvents: 'none' }}>auto</span>
              )}
            </button>
            {color && (
              <button
                onClick={() => {
                  onUpdate({ ...slot, [field]: undefined })
                  if (isActive) setActivePicker(null)
                }}
                title={t('appearance.resetToTheme')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--c-text-dim)', fontSize: 14, padding: 0, lineHeight: 1,
                }}
              >×</button>
            )}
          </div>
        </div>
        {isActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <HexColorPicker
              color={color ?? '#3a3f4b'}
              onChange={(c) => onUpdate({ ...slot, [field]: c })}
              style={{ width: '100%', height: 130 }}
            />
            <input
              value={color ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(val))
                  onUpdate({ ...slot, [field]: val || undefined })
              }}
              placeholder="#3a3f4b"
              style={{
                width: '100%', background: 'var(--c-input-bg)',
                border: '1px solid var(--c-border)', borderRadius: 5,
                color: 'var(--c-text)', padding: '5px 8px',
                fontSize: 12, fontFamily: 'monospace', outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Icon panel content ────────────────────────────────────────────────────

  const filteredIcons = search.trim()
    ? BUILTIN_ICONS.filter((ic) => ic.label.toLowerCase().includes(search.toLowerCase()))
    : BUILTIN_ICONS

  // Capacity calculations
  const recentDefaultCount = cols                    // 1 row
  const customDefaultCount = cols * 2 - 1           // 2 rows minus 1 slot for "Add" button

  const visibleRecent = recentExpanded ? recentIcons : recentIcons.slice(0, recentDefaultCount)
  const needsRecentToggle = recentIcons.length > recentDefaultCount

  const visibleCustom = customExpanded ? customIcons : customIcons.slice(0, customDefaultCount)
  const needsCustomToggle = customIcons.length > customDefaultCount

  const HEADER_H = 36

  const renderIconPanel = () => {
    // When searching: flat filtered list, no categories
    if (search.trim()) {
      return (
        <IconGrid cols={cols}>
          {filteredIcons.map((ic) => (
            <IconBtn
              key={ic.name}
              iconName={ic.name}
              isSelected={slot.icon === ic.name && !slot.iconIsCustom}
              label={ic.label}
              onClick={() => handleSelectBuiltin(ic)}
            />
          ))}
        </IconGrid>
      )
    }

    return (
      <>
        {/* ── A. Recently Used (hidden until first use) ── */}
        {recentIcons.length > 0 && (
          <>
            <SectionHeader label={t('appearance.recentlyUsed')} />
            <IconGrid cols={cols}>
              {visibleRecent.map((iconRef) => {
                const isPath = isPathRef(iconRef)
                const entry = isPath ? customIcons.find((e) => e.absPath === iconRef) : undefined
                const builtinIc = !isPath ? BUILTIN_ICONS.find((i) => i.name === iconRef) : undefined
                const label = entry?.name ?? builtinIc?.label ?? iconRef
                const isSelected = slot.icon === iconRef

                return (
                  <IconBtn
                    key={iconRef}
                    iconName={!isPath ? iconRef : undefined}
                    iconAbsPath={isPath ? iconRef : undefined}
                    isSelected={isSelected}
                    label={label}
                    onClick={() => handleSelectFromRecent(iconRef)}
                  />
                )
              })}
              {needsRecentToggle && (
                <ToggleBtn expanded={recentExpanded} onClick={() => setRecentExpanded((e) => !e)} showLess={t('appearance.showLess')} showMore={t('appearance.showMore')} />
              )}
            </IconGrid>
          </>
        )}

        {/* ── B. Custom Icons ── */}
        <SectionHeader label={t('appearance.custom')} />
        <IconGrid cols={cols}>
          {/* "Add New Icon" is always the first slot */}
          <button
            onClick={handleAddCustom}
            title={t('appearance.importIcon')}
            style={{
              width: ICON_BTN, height: ICON_BTN, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              border: '1px dashed var(--c-border)',
              background: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-dim)', fontSize: 20, padding: 0,
            }}
          >+</button>

          {visibleCustom.map((entry) => (
            <div key={entry.id} style={{ position: 'relative' }}>
              <IconBtn
                iconAbsPath={entry.absPath}
                isSelected={slot.icon === entry.absPath && slot.iconIsCustom}
                label={entry.name}
                onClick={() => handleSelectCustom(entry)}
              />
              {/* Remove button (×) shown on hover via CSS .icon-remove-btn */}
              <button
                className="icon-remove-btn"
                onClick={(e) => handleRemoveCustom(e, entry)}
                title={t('appearance.removeFromLibrary')}
                style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--c-danger, #e05c5c)', border: 'none', cursor: 'pointer',
                  display: 'none',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 9, fontWeight: 700, padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          ))}

          {needsCustomToggle && (
            <ToggleBtn expanded={customExpanded} onClick={() => setCustomExpanded((e) => !e)} showLess={t('appearance.showLess')} showMore={t('appearance.showMore')} />
          )}
        </IconGrid>

        {/* ── C. Default Icons ── */}
        <SectionHeader label={t('appearance.default')} />
        <IconGrid cols={cols}>
          {BUILTIN_ICONS.map((ic) => (
            <IconBtn
              key={ic.name}
              iconName={ic.name}
              isSelected={slot.icon === ic.name && !slot.iconIsCustom}
              label={ic.label}
              onClick={() => handleSelectBuiltin(ic)}
            />
          ))}
        </IconGrid>
      </>
    )
  }

  // ── Preview data ──────────────────────────────────────────────────────────

  const previewBg = slot.bgColor ?? undefined
  const previewIconColor = slot.iconColor ?? undefined
  const iconSvgForPreview = slot.iconIsCustom
    ? null
    : BUILTIN_ICONS.find((i) => i.name === slot.icon)?.svg ?? null

  return (
    <Group
      orientation="horizontal"
      style={{ height: '100%', width: '100%' }}
      onLayoutChanged={handleLayoutChanged}
    >
      {/* ── LEFT: Icon selection ── */}
      <Panel id={ICON_ID} defaultSize={`${sizes[0]}%`} minSize="18%">
        <div
          style={{
            height: '100%',
            display: 'flex', flexDirection: 'column',
            padding: '0 16px 14px',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', ...sectionLabel, marginTop: 0 }}>
            {t('appearance.icon')}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('appearance.search')}
            style={{
              background: 'var(--c-input-bg)', border: '1px solid var(--c-border)',
              borderRadius: 6, color: 'var(--c-text)', padding: '5px 9px',
              fontSize: 12, fontFamily: 'inherit', outline: 'none',
              marginBottom: 8, flexShrink: 0,
            }}
          />

          <div ref={iconPanelRef} className="icon-grid-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            {renderIconPanel()}
          </div>
        </div>
      </Panel>

      <Separator className="panel-resize-handle" />

      {/* ── CENTER: Live button preview ── */}
      <Panel id={PREVIEW_ID} defaultSize={`${sizes[1]}%`} minSize="28%">
        <div
          style={{
            height: '100%',
            display: 'flex', flexDirection: 'column',
            padding: '0 16px 14px',
          }}
        >
          <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sectionLabel }}>
            {t('appearance.preview')}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: previewBg ?? 'var(--ring-seg-bg)',
                border: '1.5px solid var(--ring-seg-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
              }}
            >
              {iconSvgForPreview ? (
                <div
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: iconSvgForPreview.replace('width="24" height="24"', 'width="26" height="26"') }}
                  style={{
                    color: previewIconColor ?? 'var(--ring-icon-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26,
                  }}
                />
              ) : slot.iconIsCustom ? (
                <img
                  src={`file://${slot.icon}`}
                  style={{ width: 26, height: 26, objectFit: 'contain' }}
                />
              ) : null}
            </div>

            <span
              style={{
                fontSize: 11,
                color: slot.textColor ?? 'var(--c-text-muted)',
                textAlign: 'center', lineHeight: 1.2,
                maxWidth: '100%', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {slot.label || t('appearance.unnamed')}
            </span>

            <div style={{ display: 'flex', gap: 6 }}>
              <div title={`BG: ${slot.bgColor ?? 'theme'}`} style={{ width: 12, height: 12, borderRadius: '50%', background: slot.bgColor ?? 'var(--ring-seg-bg)', border: '1px solid var(--c-border)' }} />
              <div title={`Icon: ${slot.iconColor ?? 'theme'}`} style={{ width: 12, height: 12, borderRadius: '50%', background: slot.iconColor ?? 'var(--ring-icon-color)', border: '1px solid var(--c-border)' }} />
              <div title={`Text: ${slot.textColor ?? 'theme'}`} style={{ width: 12, height: 12, borderRadius: '50%', background: slot.textColor ?? 'var(--ring-text)', border: '1px solid var(--c-border)' }} />
            </div>
          </div>
        </div>
      </Panel>

      <Separator className="panel-resize-handle" />

      {/* ── RIGHT: Color pickers ── */}
      <Panel id={COLORS_ID} defaultSize={`${sizes[2]}%`} minSize="24%">
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '0 16px', height: HEADER_H, flexShrink: 0, display: 'flex', alignItems: 'center', ...sectionLabel }}>
            {t('appearance.colors')}
          </div>

          {/* Scrollable color pickers */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px' }}>
            {renderColorPicker('bg', t('appearance.background'))}
            {renderColorPicker('icon', t('appearance.iconColor'))}
            {renderColorPicker('text', t('appearance.textColor'))}

            <div style={{ fontSize: 11, color: 'var(--c-text-dim)', marginTop: 4, marginBottom: 4, lineHeight: 1.5 }}>
              {t('appearance.themeHint')}
            </div>
          </div>

          {/* Save / Reset footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--c-border-sub)',
              display: 'flex',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onReset}
              disabled={!onReset}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 6, cursor: onReset ? 'pointer' : 'default',
                border: '1px solid var(--c-border)',
                background: 'none',
                color: onReset ? 'var(--c-text-muted)' : 'var(--c-text-dim)',
                fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (onReset) { e.currentTarget.style.borderColor = 'var(--c-accent-border)'; e.currentTarget.style.color = 'var(--c-accent)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = onReset ? 'var(--c-text-muted)' : 'var(--c-text-dim)' }}
            >
              {t('appearance.reset')}
            </button>
            <button
              onClick={onSave}
              disabled={!onSave}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 6, cursor: onSave ? 'pointer' : 'default',
                border: 'none',
                background: onSave ? 'var(--c-accent)' : 'var(--c-btn-bg)',
                color: onSave ? '#fff' : 'var(--c-text-dim)',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (onSave) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              {t('appearance.save')}
            </button>
          </div>
        </div>
      </Panel>
    </Group>
  )
}
