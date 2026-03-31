import { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useT } from '../../i18n/I18nContext'

export function LeftPanel(): JSX.Element {
  const t = useT()
  const { draft, updateDraft, setPreviewDraft, triggerAnimPreview } = useSettings()
  const ap = draft.appearance

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

  function handleShowTextToggle(): void {
    const next = !showText
    const newDraft = { ...draft, appearance: { ...ap, showText: next } }
    updateDraft(newDraft)
    setPreviewDraft(newDraft)
  }

  const sliderStyle: React.CSSProperties = { width: '100%', accentColor: 'var(--c-accent)' }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--c-text-dim)',
    fontWeight: 600,
  }

  const controlLabel: React.CSSProperties = { fontSize: 13, color: 'var(--c-text-muted)' }
  const valueLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--c-accent)' }
  const rangeMinMax: React.CSSProperties = { fontSize: 10, color: 'var(--c-text-dim)' }

  return (
    <div
      className="flex-none flex flex-col gap-6 overflow-y-auto"
      style={{ width: '100%', padding: '24px 20px' }}
    >
      {/* Ring Layout */}
      <section className="flex flex-col gap-4">
        <h3 style={sectionLabel}>{t('panel.ringLayout')}</h3>

        {/* Distance from Cursor */}
        <label className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span style={controlLabel}>{t('panel.distance')}</span>
            <span style={valueLabel}>{localRadius}px</span>
          </div>
          <input
            type="range" min={40} max={200} step={2}
            value={localRadius}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setLocalRadius(val)
              setPreviewDraft({ ...draft, appearance: { ...ap, ringRadius: val } })
            }}
            onPointerUp={() => {
              if (localRadius !== ap.ringRadius)
                updateDraft({ ...draft, appearance: { ...ap, ringRadius: localRadius } })
            }}
            style={sliderStyle}
          />
          <div className="flex justify-between" style={rangeMinMax}>
            <span>40px</span><span>200px</span>
          </div>
        </label>

        {/* Button Size */}
        <label className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span style={controlLabel}>{t('panel.buttonSize')}</span>
            <span style={valueLabel}>{localSize}px</span>
          </div>
          <input
            type="range" min={16} max={48} step={2}
            value={localSize}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setLocalSize(val)
              setPreviewDraft({ ...draft, appearance: { ...ap, buttonSize: val } })
            }}
            onPointerUp={() => {
              if (localSize !== (ap.buttonSize ?? 32))
                updateDraft({ ...draft, appearance: { ...ap, buttonSize: localSize } })
            }}
            style={sliderStyle}
          />
          <div className="flex justify-between" style={rangeMinMax}>
            <span>{t('panel.small')}</span><span>{t('panel.large')}</span>
          </div>
        </label>

        {/* Icon Size */}
        <label className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span style={controlLabel}>{t('panel.iconSize')}</span>
            <span style={valueLabel}>{localIconSize}px</span>
          </div>
          <input
            type="range" min={10} max={28} step={1}
            value={localIconSize}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setLocalIconSize(val)
              setPreviewDraft({ ...draft, appearance: { ...ap, iconSize: val } })
            }}
            onPointerUp={() => {
              if (localIconSize !== (ap.iconSize ?? 18))
                updateDraft({ ...draft, appearance: { ...ap, iconSize: localIconSize } })
            }}
            style={sliderStyle}
          />
          <div className="flex justify-between" style={rangeMinMax}>
            <span>{t('panel.small')}</span><span>{t('panel.large')}</span>
          </div>
        </label>

        {/* Font Size */}
        <label className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span style={controlLabel}>{t('panel.textSize')}</span>
            <span style={valueLabel}>{localFontSize}px</span>
          </div>
          <input
            type="range" min={6} max={14} step={1}
            value={localFontSize}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setLocalFontSize(val)
              setPreviewDraft({ ...draft, appearance: { ...ap, fontSize: val } })
            }}
            onPointerUp={() => {
              if (localFontSize !== (ap.fontSize ?? 8))
                updateDraft({ ...draft, appearance: { ...ap, fontSize: localFontSize } })
            }}
            style={sliderStyle}
          />
          <div className="flex justify-between" style={rangeMinMax}>
            <span>6px</span><span>14px</span>
          </div>
        </label>

        {/* Show Text */}
        <div className="flex justify-between items-center">
          <span style={controlLabel}>{t('panel.showText')}</span>
          <button
            onClick={handleShowTextToggle}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: showText ? 'var(--c-toggle-active)' : 'var(--c-toggle-track)',
              position: 'relative', transition: 'background 0.15s ease', flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3,
                left: showText ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: 'white',
                transition: 'left 0.15s ease',
              }}
            />
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section className="flex flex-col gap-4">
        <h3 style={sectionLabel}>{t('panel.appearance')}</h3>

        {/* Opacity */}
        <label className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span style={controlLabel}>{t('panel.opacity')}</span>
            <span style={valueLabel}>{localOpacity}%</span>
          </div>
          <input
            type="range" min={1} max={100}
            value={localOpacity}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setLocalOpacity(val)
              setPreviewDraft({ ...draft, appearance: { ...ap, opacity: val / 100 } })
            }}
            onPointerUp={() => {
              const newOpacity = localOpacity / 100
              if (newOpacity !== ap.opacity)
                updateDraft({ ...draft, appearance: { ...ap, opacity: newOpacity } })
            }}
            style={sliderStyle}
          />
          <div className="flex justify-between" style={rangeMinMax}>
            <span>1%</span><span>100%</span>
          </div>
        </label>

        {/* Animation Speed */}
        <div className="flex flex-col gap-2">
          <span style={controlLabel}>{t('panel.animSpeed')}</span>
          <div className="flex gap-1.5">
            {(['slow', 'normal', 'fast'] as const).map((speed) => {
              const active = ap.animationSpeed === speed
              const speedLabel = t(`panel.${speed}` as 'panel.slow' | 'panel.normal' | 'panel.fast')
              return (
                <button
                  key={speed}
                  onClick={() => updateDraft({ ...draft, appearance: { ...ap, animationSpeed: speed } })}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--c-btn-active)' : 'var(--c-elevated)',
                    color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
                    fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                >
                  {speedLabel}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Animation Preview */}
      <div style={{ marginTop: 'auto' }}>
        <button
          onClick={triggerAnimPreview}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 6, cursor: 'pointer',
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
          {t('panel.animPreview')}
        </button>
      </div>
    </div>
  )
}
