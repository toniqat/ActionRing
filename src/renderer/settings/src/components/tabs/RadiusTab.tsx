import { useState } from 'react'
import type { AppConfig } from '@shared/config.types'
import { BUILTIN_ICONS } from '@shared/icons'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
}

const BUTTON_R = 28        // preview button circle radius (px, in SVG coords)
const VIEWBOX_HALF = 210   // half-size of the fixed SVG viewBox

/** Finds the SVG string for a built-in icon name, falls back to a generic circle. */
function getIconSvg(name: string): string {
  return BUILTIN_ICONS.find((i) => i.name === name)?.svg ?? ''
}

export function RadiusTab({ config, onSave }: Props): JSX.Element {
  const ap = config.appearance
  // Local-only state while dragging — committed to config on pointer-up
  const [previewRadius, setPreviewRadius] = useState(ap.ringRadius)

  const activeSlots = config.slots.filter((s) => s.enabled)

  function commitRadius(): void {
    if (previewRadius !== ap.ringRadius) {
      onSave({ ...config, appearance: { ...ap, ringRadius: previewRadius } })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
        Ring Radius
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: -16 }}>
        Controls how far the action buttons appear from the cursor.
      </p>

      {/* Slider */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14 }}>Distance from cursor</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#a0a0ff', fontVariantNumeric: 'tabular-nums' }}>
            {previewRadius}px
          </span>
        </div>
        <input
          type="range"
          min={40}
          max={200}
          step={2}
          value={previewRadius}
          onChange={(e) => setPreviewRadius(parseInt(e.target.value))}
          onPointerUp={commitRadius}
          style={{ width: '100%', accentColor: '#6060ff', height: 6 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          <span>40px — compact</span>
          <span>200px — wide</span>
        </div>
      </label>

      {/* Live preview */}
      <div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Preview
        </div>
        <div
          style={{
            background: '#08081a',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 0'
          }}
        >
          <svg
            width="100%"
            viewBox={`${-VIEWBOX_HALF} ${-VIEWBOX_HALF} ${VIEWBOX_HALF * 2} ${VIEWBOX_HALF * 2}`}
            style={{ maxHeight: 280, display: 'block' }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Faint radius guide circle */}
            <circle
              cx={0}
              cy={0}
              r={previewRadius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />

            {/* Action buttons */}
            {activeSlots.map((slot, i) => {
              const total = activeSlots.length
              const angle = i * ((2 * Math.PI) / total) - Math.PI / 2
              const bx = Math.cos(angle) * previewRadius
              const by = Math.sin(angle) * previewRadius
              const iconSvg = getIconSvg(slot.icon)

              return (
                <g key={slot.id} transform={`translate(${bx}, ${by})`}>
                  {/* Button circle */}
                  <circle
                    cx={0}
                    cy={0}
                    r={BUTTON_R}
                    fill="#1e1e2e"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={1}
                  />
                  {/* Icon via foreignObject */}
                  {iconSvg ? (
                    <foreignObject
                      x={-10}
                      y={-18}
                      width={20}
                      height={20}
                      style={{ overflow: 'visible', pointerEvents: 'none' }}
                    >
                      <div
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: iconSvg }}
                        style={{ width: 20, height: 20, transform: 'scale(0.83)', transformOrigin: 'top left', opacity: 0.7 }}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="rgba(255,255,255,0.6)"
                    >
                      {slot.label.slice(0, 3)}
                    </text>
                  )}
                  {/* Label below button */}
                  <text
                    x={0}
                    y={BUTTON_R + 10}
                    textAnchor="middle"
                    fontSize={8}
                    fill="rgba(255,255,255,0.45)"
                  >
                    {slot.label.length > 8 ? slot.label.slice(0, 7) + '…' : slot.label}
                  </text>
                </g>
              )
            })}

            {/* Cursor indicator at center */}
            <circle cx={0} cy={0} r={5} fill="rgba(255,255,255,0.18)" />
            <circle cx={0} cy={0} r={2} fill="rgba(255,255,255,0.55)" />

            {/* Radius dimension line (top slot direction) */}
            {activeSlots.length > 0 && (
              <g opacity={0.4}>
                <line x1={0} y1={0} x2={0} y2={-previewRadius + BUTTON_R + 4} stroke="rgba(160,160,255,0.6)" strokeWidth={0.8} />
                <text x={6} y={-previewRadius / 2} fontSize={9} fill="rgba(160,160,255,0.8)">{previewRadius}px</text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  )
}
