import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { useT } from '../../i18n/I18nContext'
import { UIIcon } from '@shared/UIIcon'

// ── Click-to-edit numeric value display ────────────────────────────────────────

interface NumericInputProps {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onPreview: (v: number) => void
  onCommit: (v: number) => void
}

function NumericInput({ value, min, max, step = 1, unit = 'px', onPreview, onCommit }: NumericInputProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  const beginEdit = () => {
    setRaw(String(value))
    setEditing(true)
  }

  const commitEdit = (rawVal: string) => {
    const n = parseInt(rawVal, 10)
    if (!isNaN(n)) {
      const clamped = Math.min(max, Math.max(min, n))
      onPreview(clamped)
      onCommit(clamped)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={raw}
        min={min}
        max={max}
        step={step}
        autoFocus
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => commitEdit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit(e.currentTarget.value)
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{
          width: 56,
          background: 'var(--c-input-bg)',
          border: '1px solid var(--c-accent)',
          borderRadius: 4,
          color: 'var(--c-text)',
          fontSize: 12,
          fontWeight: 700,
          padding: '1px 4px',
          outline: 'none',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'inherit',
        }}
      />
    )
  }

  return (
    <span
      onClick={beginEdit}
      title="Click to edit"
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--c-accent)',
        cursor: 'text',
        minWidth: 44,
        display: 'inline-block',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        userSelect: 'none',
      }}
    >
      {value}{unit}
    </span>
  )
}

// ── Section divider ────────────────────────────────────────────────────────────

function SectionDivider(): JSX.Element {
  return <div style={{ height: 1, background: 'var(--c-border-sub)', margin: '2px 0' }} />
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FloatingRingLayoutPanel(): JSX.Element {
  const t = useT()
  const { draft, updateDraft, setPreviewDraft, triggerAnimPreview } = useSettings()
  const ap = draft.appearance

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [localRadius, setLocalRadius] = useState(ap.ringRadius)
  const [localSize, setLocalSize] = useState(ap.buttonSize ?? 32)
  const [localIconSize, setLocalIconSize] = useState(ap.iconSize ?? 18)
  const [localFontSize, setLocalFontSize] = useState(ap.fontSize ?? 8)
  const [localOpacity, setLocalOpacity] = useState(Math.round(ap.opacity * 100))
  const showText = ap.showText ?? false

  useEffect(() => setLocalRadius(ap.ringRadius), [ap.ringRadius])
  useEffect(() => setLocalSize(ap.buttonSize ?? 32), [ap.buttonSize])
  useEffect(() => setLocalIconSize(ap.iconSize ?? 18), [ap.iconSize])
  useEffect(() => setLocalFontSize(ap.fontSize ?? 8), [ap.fontSize])
  useEffect(() => setLocalOpacity(Math.round(ap.opacity * 100)), [ap.opacity])

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    accentColor: 'var(--c-accent)',
    cursor: 'pointer',
    margin: 0,
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'var(--c-text-dim)',
    fontWeight: 700,
  }

  const controlLabel: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--c-text-muted)',
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 10, left: 10, zIndex: 25, pointerEvents: 'auto' }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={t('panel.ringLayout')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 8px',
          borderRadius: 7,
          border: `1px solid ${open ? 'var(--c-accent-border)' : 'var(--c-border)'}`,
          background: open ? 'var(--c-accent-bg)' : 'var(--c-elevated)',
          color: open ? 'var(--c-accent-text)' : 'var(--c-text-muted)',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap' as const,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as React.CSSProperties}
      >
        {/* Ring icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
        </svg>
        <span style={{ fontSize: 8, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Floating dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: 252,
              background: 'var(--c-elevated)',
              border: '1px solid var(--c-border)',
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            } as React.CSSProperties}
          >

            {/* ── LAYOUT ──────────────────────────────────────── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={sectionLabel}>{t('panel.categoryLayout')}</h3>

              {/* Distance */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={controlLabel}>{t('panel.distance')}</span>
                  <NumericInput
                    value={localRadius} min={40} max={200} step={2}
                    onPreview={(v) => { setLocalRadius(v); setPreviewDraft({ ...draft, appearance: { ...ap, ringRadius: v } }) }}
                    onCommit={(v) => { if (v !== ap.ringRadius) updateDraft({ ...draft, appearance: { ...ap, ringRadius: v } }) }}
                  />
                </div>
                <input
                  type="range" min={40} max={200} step={2} value={localRadius}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setLocalRadius(v)
                    setPreviewDraft({ ...draft, appearance: { ...ap, ringRadius: v } })
                  }}
                  onPointerUp={() => {
                    if (localRadius !== ap.ringRadius)
                      updateDraft({ ...draft, appearance: { ...ap, ringRadius: localRadius } })
                  }}
                  style={sliderStyle}
                />
              </label>

              {/* Button Size */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={controlLabel}>{t('panel.buttonSize')}</span>
                  <NumericInput
                    value={localSize} min={16} max={48} step={2}
                    onPreview={(v) => { setLocalSize(v); setPreviewDraft({ ...draft, appearance: { ...ap, buttonSize: v } }) }}
                    onCommit={(v) => { if (v !== (ap.buttonSize ?? 32)) updateDraft({ ...draft, appearance: { ...ap, buttonSize: v } }) }}
                  />
                </div>
                <input
                  type="range" min={16} max={48} step={2} value={localSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setLocalSize(v)
                    setPreviewDraft({ ...draft, appearance: { ...ap, buttonSize: v } })
                  }}
                  onPointerUp={() => {
                    if (localSize !== (ap.buttonSize ?? 32))
                      updateDraft({ ...draft, appearance: { ...ap, buttonSize: localSize } })
                  }}
                  style={sliderStyle}
                />
              </label>

              {/* Icon Size */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={controlLabel}>{t('panel.iconSize')}</span>
                  <NumericInput
                    value={localIconSize} min={10} max={28} step={1}
                    onPreview={(v) => { setLocalIconSize(v); setPreviewDraft({ ...draft, appearance: { ...ap, iconSize: v } }) }}
                    onCommit={(v) => { if (v !== (ap.iconSize ?? 18)) updateDraft({ ...draft, appearance: { ...ap, iconSize: v } }) }}
                  />
                </div>
                <input
                  type="range" min={10} max={28} step={1} value={localIconSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setLocalIconSize(v)
                    setPreviewDraft({ ...draft, appearance: { ...ap, iconSize: v } })
                  }}
                  onPointerUp={() => {
                    if (localIconSize !== (ap.iconSize ?? 18))
                      updateDraft({ ...draft, appearance: { ...ap, iconSize: localIconSize } })
                  }}
                  style={sliderStyle}
                />
              </label>

              {/* Opacity */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={controlLabel}>{t('panel.opacity')}</span>
                  <NumericInput
                    value={localOpacity} min={1} max={100} step={1} unit="%"
                    onPreview={(v) => { setLocalOpacity(v); setPreviewDraft({ ...draft, appearance: { ...ap, opacity: v / 100 } }) }}
                    onCommit={(v) => { const o = v / 100; if (o !== ap.opacity) updateDraft({ ...draft, appearance: { ...ap, opacity: o } }) }}
                  />
                </div>
                <input
                  type="range" min={1} max={100} value={localOpacity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setLocalOpacity(v)
                    setPreviewDraft({ ...draft, appearance: { ...ap, opacity: v / 100 } })
                  }}
                  onPointerUp={() => {
                    const newOpacity = localOpacity / 100
                    if (newOpacity !== ap.opacity)
                      updateDraft({ ...draft, appearance: { ...ap, opacity: newOpacity } })
                  }}
                  style={sliderStyle}
                />
              </label>
            </section>

            <SectionDivider />

            {/* ── TEXT ──────────────────────────────────────────── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={sectionLabel}>{t('panel.categoryText')}</h3>

              {/* Show Text toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={controlLabel}>{t('panel.showText')}</span>
                <button
                  onClick={() => {
                    const next = !showText
                    const newDraft = { ...draft, appearance: { ...ap, showText: next } }
                    updateDraft(newDraft)
                    setPreviewDraft(newDraft)
                  }}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: showText ? 'var(--c-toggle-active)' : 'var(--c-toggle-track)',
                    position: 'relative', transition: 'background 0.15s ease', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: showText ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'white',
                    transition: 'left 0.15s ease',
                  }} />
                </button>
              </div>

              {/* Text Size — disabled when Show Text is off */}
              <label style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                opacity: showText ? 1 : 0.4,
                pointerEvents: showText ? 'auto' : 'none',
                transition: 'opacity 0.15s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={controlLabel}>{t('panel.textSize')}</span>
                  <NumericInput
                    value={localFontSize} min={6} max={14} step={1}
                    onPreview={(v) => { setLocalFontSize(v); setPreviewDraft({ ...draft, appearance: { ...ap, fontSize: v } }) }}
                    onCommit={(v) => { if (v !== (ap.fontSize ?? 8)) updateDraft({ ...draft, appearance: { ...ap, fontSize: v } }) }}
                  />
                </div>
                <input
                  type="range" min={6} max={14} step={1} value={localFontSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setLocalFontSize(v)
                    setPreviewDraft({ ...draft, appearance: { ...ap, fontSize: v } })
                  }}
                  onPointerUp={() => {
                    if (localFontSize !== (ap.fontSize ?? 8))
                      updateDraft({ ...draft, appearance: { ...ap, fontSize: localFontSize } })
                  }}
                  style={sliderStyle}
                />
              </label>
            </section>

            <SectionDivider />

            {/* ── ANIMATION ─────────────────────────────────────── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={sectionLabel}>{t('panel.categoryAnimation')}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={controlLabel}>{t('panel.animSpeed')}</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['slow', 'normal', 'fast'] as const).map((speed) => {
                    const active = ap.animationSpeed === speed
                    const label = t(`panel.${speed}` as 'panel.slow' | 'panel.normal' | 'panel.fast')
                    return (
                      <button
                        key={speed}
                        onClick={() => updateDraft({ ...draft, appearance: { ...ap, animationSpeed: speed } })}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: active ? 'var(--c-btn-active)' : 'var(--c-surface)',
                          color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
                          fontSize: 11, fontFamily: 'inherit', transition: 'all 0.15s ease',
                        }}
                      >{label}</button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={triggerAnimPreview}
                style={{
                  width: '100%', padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                  background: 'none', border: '1px solid var(--c-border)',
                  color: 'var(--c-text-muted)', fontSize: 12, fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--c-accent-bg)'
                  e.currentTarget.style.color = 'var(--c-accent)'
                  e.currentTarget.style.borderColor = 'var(--c-accent-border)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = 'var(--c-text-muted)'
                  e.currentTarget.style.borderColor = 'var(--c-border)'
                }}
              >
                <UIIcon name="play_arrow" size={12} />
                {t('panel.animPreview')}
              </button>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
