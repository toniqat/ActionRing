/**
 * IconColorPopup — Reusable icon & color picker popup.
 * Portal-rendered context menu for picking icons and background colors.
 * Used by SlotEditPanel, ShortcutsApp, and any future appearance-editing surfaces.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HexColorPicker } from 'react-colorful'
import { BUILTIN_ICONS, ICON_GROUPS, GROUPED_ICON_IDS } from './icons'
import { SVGIcon } from './SVGIcon'
import { UIIcon } from './UIIcon'
import type { ResourceIconEntry } from './ipc.types'

// ── Constants ────────────────────────────────────────────────────────────────
export const PRESET_BG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]
export const PICKER_BTN = 36
export const PICKER_GAP = 6
export const PICKER_COLS = 5

const POPUP_WIDTH = 268
const PADDING = 12

// ── Recent-items helpers ─────────────────────────────────────────────────────
const RECENT_COLORS_KEY = 'actionring-recent-bgcolors'
const RECENT_ICONS_KEY = 'actionring-recent-icons'
const MAX_RECENT_COLORS = 10
const MAX_RECENT_ICONS = 20

function loadRecent(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[] } catch { return [] }
}

function pushRecent(key: string, value: string, max: number): string[] {
  const prev = loadRecent(key)
  const next = [value, ...prev.filter((v) => v !== value)].slice(0, max)
  localStorage.setItem(key, JSON.stringify(next))
  return next
}

// ── Viewport clamping ────────────────────────────────────────────────────────
function clampToViewport(
  el: HTMLElement,
  pos: { top: number; left: number },
): { top: number; left: number } {
  const rect = el.getBoundingClientRect()
  let { top, left } = pos
  if (rect.bottom > window.innerHeight) top = Math.max(4, window.innerHeight - rect.height - 4)
  if (rect.right > window.innerWidth) left = Math.max(4, window.innerWidth - rect.width - 4)
  return { top, left }
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface IconColorPopupProps {
  /** Current icon name (builtin) or absPath (resource/custom) */
  icon: string
  /** Whether current icon is a custom/resource icon */
  iconIsCustom: boolean
  /** Current background color (undefined = theme default) */
  bgColor: string | undefined
  /** Anchor element to position below, OR explicit {top, left} position */
  anchor: HTMLElement | { top: number; left: number }
  /** Available resource icons (pass [] if not yet loaded) */
  resourceIcons: ResourceIconEntry[]
  /** Called when icon is selected */
  onSelectIcon: (icon: string, isCustom: boolean) => void
  /** Called when background color changes */
  onSelectBgColor: (color: string | undefined) => void
  /** Called to close the popup */
  onClose: () => void
  /** Initial tab to show */
  initialTab?: 'icon' | 'color'
  /** z-index override (default 9999) */
  zIndex?: number
}

// ── Component ────────────────────────────────────────────────────────────────
export function IconColorPopup({
  icon,
  iconIsCustom,
  bgColor,
  anchor,
  resourceIcons,
  onSelectIcon,
  onSelectBgColor,
  onClose,
  initialTab = 'icon',
  zIndex = 9999,
}: IconColorPopupProps): JSX.Element {
  const popupRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'icon' | 'color'>(initialTab)
  const [search, setSearch] = useState('')
  const [customColorOpen, setCustomColorOpen] = useState(false)
  const [customColor, setCustomColor] = useState(bgColor ?? '#3a3f4b')
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecent(RECENT_COLORS_KEY))
  const [recentIcons, setRecentIcons] = useState<string[]>(() => loadRecent(RECENT_ICONS_KEY))
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Compute initial position from anchor
  useEffect(() => {
    if (anchor instanceof HTMLElement) {
      try {
        const rect = anchor.getBoundingClientRect()
        setPos({ top: rect.bottom + 4, left: rect.left })
      } catch { /* anchor may be unmounted */ }
    } else {
      setPos(anchor)
    }
  }, [anchor])

  // Clamp popup within viewport after initial render
  useLayoutEffect(() => {
    if (!popupRef.current || !pos) return
    const clamped = clampToViewport(popupRef.current, pos)
    if (clamped.top !== pos.top || clamped.left !== pos.left) setPos(clamped)
  }, [pos])

  // Click-outside to close (deferred so opening click doesn't immediately close)
  useEffect(() => {
    const anchorEl = anchor instanceof HTMLElement ? anchor : null
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        !(anchorEl && anchorEl.contains(e.target as Node))
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose, anchor])

  const trackRecentColor = useCallback((color: string | undefined) => {
    if (color) setRecentColors(pushRecent(RECENT_COLORS_KEY, color, MAX_RECENT_COLORS))
  }, [])

  const trackRecentIcon = useCallback((iconRef: string) => {
    setRecentIcons(pushRecent(RECENT_ICONS_KEY, iconRef, MAX_RECENT_ICONS))
    window.settingsAPI?.addRecentIcon?.(iconRef)
  }, [])

  const handleSelectBgColor = useCallback((color: string | undefined) => {
    trackRecentColor(color)
    onSelectBgColor(color)
  }, [onSelectBgColor, trackRecentColor])

  const handleSelectBuiltinIcon = useCallback((name: string) => {
    trackRecentIcon(name)
    onSelectIcon(name, false)
  }, [onSelectIcon, trackRecentIcon])

  const handleSelectResourceIcon = useCallback((entry: ResourceIconEntry) => {
    trackRecentIcon(entry.absPath)
    onSelectIcon(entry.absPath, true)
  }, [onSelectIcon, trackRecentIcon])

  if (!pos) return <></>

  // Filter icons by search
  const q = search.trim().toLowerCase()
  const filteredBuiltin = q ? BUILTIN_ICONS.filter((ic) => ic.label.toLowerCase().includes(q)) : BUILTIN_ICONS
  const filteredResource = q ? resourceIcons.filter((ic) => ic.name.toLowerCase().includes(q)) : resourceIcons

  // Resolve recent icons to display data
  const recentBuiltinIcons = recentIcons
    .map((ref) => BUILTIN_ICONS.find((ic) => ic.name === ref))
    .filter((ic): ic is NonNullable<typeof ic> => Boolean(ic))
  const recentResourceIcons = recentIcons
    .map((ref) => resourceIcons.find((e) => e.absPath === ref))
    .filter((e): e is ResourceIconEntry => Boolean(e))

  return createPortal(
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPUP_WIDTH,
        maxHeight: '80vh',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex,
        fontFamily: 'inherit',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'auto',
      } as React.CSSProperties}
    >
      {/* ── Tab bar: Icon | Color ── */}
      <div style={{ display: 'flex', padding: '8px 10px 6px', flexShrink: 0, gap: 4 }}>
        {(['icon', 'color'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6,
              border: tab === m ? '1px solid var(--c-accent-border)' : '1px solid transparent',
              background: tab === m ? 'var(--c-accent-bg)' : 'var(--c-elevated)',
              color: tab === m ? 'var(--c-accent)' : 'var(--c-text-muted)',
              fontSize: 11, fontWeight: tab === m ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}
          >
            {m === 'icon' ? 'Icon' : 'Color'}
          </button>
        ))}
      </div>

      {tab === 'color' ? (
        /* ── Color Section ── */
        <div style={{ padding: `4px ${PADDING}px ${PADDING}px`, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PICKER_COLS}, ${PICKER_BTN}px)`, gap: PICKER_GAP, justifyContent: 'center', marginBottom: 8 }}>
            {/* Auto/None swatch */}
            <button
              onClick={() => handleSelectBgColor(undefined)}
              title="Auto (theme default)"
              style={{
                width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${bgColor === undefined ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: 'var(--c-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, color: 'var(--c-text-dim)', fontSize: 9, fontWeight: 600,
              }}
            >auto</button>

            {/* Preset color swatches */}
            {PRESET_BG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleSelectBgColor(color)}
                title={color}
                style={{
                  width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                  border: '2px solid transparent',
                  outline: bgColor === color ? `2px solid ${color}` : 'none',
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
                width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
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
                onChange={(c) => { setCustomColor(c); handleSelectBgColor(c) }}
                style={{ width: '100%', height: 150 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input
                  value={customColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setCustomColor(v)
                      if (v.length === 7) handleSelectBgColor(v)
                    }
                  }}
                  style={{
                    flex: 1, background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)', borderRadius: 5,
                    color: 'var(--c-text)', padding: '4px 8px',
                    fontSize: 11, fontFamily: 'monospace', outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                />
                {bgColor && (
                  <button
                    onClick={() => handleSelectBgColor(undefined)}
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
              <div style={{ display: 'flex', gap: PICKER_GAP, flexWrap: 'wrap' }}>
                {recentColors.slice(0, PICKER_COLS * 2).map((color) => (
                  <button
                    key={color}
                    onClick={() => handleSelectBgColor(color)}
                    title={color}
                    style={{
                      width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                      border: '2px solid transparent',
                      outline: bgColor === color ? `2px solid ${color}` : 'none',
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
        /* ── Icon Section ── */
        <>
          <div style={{ padding: `0 ${PADDING}px 6px`, flexShrink: 0 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons…"
              style={{
                width: '100%', background: 'var(--c-surface)',
                border: '1px solid var(--c-border)', borderRadius: 6,
                color: 'var(--c-text)', padding: '4px 8px',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Scrollable grouped icon grid */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `0 ${PADDING}px ${PADDING}px` }}>
            {(() => {
              // Helper to render an icon button
              const btnStyle = (selected: boolean): React.CSSProperties => ({
                width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${selected ? 'var(--c-accent)' : 'transparent'}`,
                background: selected ? 'var(--c-btn-active)' : 'var(--c-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--c-text)', padding: 0,
              })
              const groupHeader = (label: string): JSX.Element => (
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', fontWeight: 600, marginBottom: 6, marginTop: 10 }}>
                  {label}
                </div>
              )
              const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${PICKER_BTN}px)`, gap: PICKER_GAP, justifyContent: 'center' }

              // When searching, show flat filtered results
              if (q) {
                return (
                  <div style={gridStyle}>
                    {filteredBuiltin.map((ic) => (
                      <button key={ic.name} onClick={() => handleSelectBuiltinIcon(ic.name)} title={ic.label} style={btnStyle(!iconIsCustom && icon === ic.name)}>
                        <SVGIcon svgString={ic.svg} size={18} />
                      </button>
                    ))}
                    {filteredResource.map((entry) => (
                      <button key={entry.filename} onClick={() => handleSelectResourceIcon(entry)} title={entry.name} style={btnStyle(iconIsCustom && icon === entry.absPath)}>
                        <SVGIcon svgString={entry.svgContent} size={18} />
                      </button>
                    ))}
                  </div>
                )
              }

              // Build grouped sections
              const sections: JSX.Element[] = []

              // ── Recent group ──
              if (recentBuiltinIcons.length > 0 || recentResourceIcons.length > 0) {
                sections.push(
                  <div key="group-recent">
                    {groupHeader('Recent')}
                    <div style={gridStyle}>
                      {recentBuiltinIcons.map((ic) => (
                        <button key={`recent-b-${ic.name}`} onClick={() => handleSelectBuiltinIcon(ic.name)} title={ic.label} style={btnStyle(!iconIsCustom && icon === ic.name)}>
                          <SVGIcon svgString={ic.svg} size={18} />
                        </button>
                      ))}
                      {recentResourceIcons.map((entry) => (
                        <button key={`recent-r-${entry.filename}`} onClick={() => handleSelectResourceIcon(entry)} title={entry.name} style={btnStyle(iconIsCustom && icon === entry.absPath)}>
                          <SVGIcon svgString={entry.svgContent} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>,
                )
              }

              // Track which icons have been rendered in a group
              const rendered = new Set<string>()

              // ── Named groups ──
              for (const group of ICON_GROUPS) {
                const builtinInGroup = BUILTIN_ICONS.filter((ic) => group.members.includes(ic.name))
                const resourceInGroup = resourceIcons.filter((e) => group.members.includes(e.filename.replace(/\.svg$/i, '')))
                if (builtinInGroup.length === 0 && resourceInGroup.length === 0) continue

                builtinInGroup.forEach((ic) => rendered.add(ic.name))
                resourceInGroup.forEach((e) => rendered.add(e.filename))

                sections.push(
                  <div key={`group-${group.id}`}>
                    {groupHeader(group.label)}
                    <div style={gridStyle}>
                      {builtinInGroup.map((ic) => (
                        <button key={ic.name} onClick={() => handleSelectBuiltinIcon(ic.name)} title={ic.label} style={btnStyle(!iconIsCustom && icon === ic.name)}>
                          <SVGIcon svgString={ic.svg} size={18} />
                        </button>
                      ))}
                      {resourceInGroup.map((entry) => (
                        <button key={entry.filename} onClick={() => handleSelectResourceIcon(entry)} title={entry.name} style={btnStyle(iconIsCustom && icon === entry.absPath)}>
                          <SVGIcon svgString={entry.svgContent} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>,
                )
              }

              // ── Misc (ungrouped) ──
              const miscBuiltin = BUILTIN_ICONS.filter((ic) => !rendered.has(ic.name))
              const miscResource = resourceIcons.filter((e) => !rendered.has(e.filename))
              if (miscBuiltin.length > 0 || miscResource.length > 0) {
                sections.push(
                  <div key="group-misc">
                    {groupHeader('Misc')}
                    <div style={gridStyle}>
                      {miscBuiltin.map((ic) => (
                        <button key={ic.name} onClick={() => handleSelectBuiltinIcon(ic.name)} title={ic.label} style={btnStyle(!iconIsCustom && icon === ic.name)}>
                          <SVGIcon svgString={ic.svg} size={18} />
                        </button>
                      ))}
                      {miscResource.map((entry) => (
                        <button key={entry.filename} onClick={() => handleSelectResourceIcon(entry)} title={entry.name} style={btnStyle(iconIsCustom && icon === entry.absPath)}>
                          <SVGIcon svgString={entry.svgContent} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>,
                )
              }

              return sections
            })()}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
