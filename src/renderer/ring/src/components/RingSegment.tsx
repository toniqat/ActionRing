import { SegmentIcon } from './SegmentIcon'
import { getSlotButtonColors } from '@shared/colorUtils'
import type { SlotConfig } from '@shared/config.types'

const DEFAULT_BUTTON_RADIUS = 32

interface RingSegmentProps {
  slot: SlotConfig
  index: number
  total: number
  radius: number
  buttonSize?: number
  iconSize?: number
  fontSize?: number
  showText?: boolean
  isHighlighted: boolean
  isFolderOpen?: boolean
}

export function RingSegment({
  slot,
  index,
  total,
  radius,
  buttonSize = DEFAULT_BUTTON_RADIUS,
  iconSize = 18,
  fontSize = 8,
  showText = false,
  isHighlighted,
  isFolderOpen = false
}: RingSegmentProps): JSX.Element {
  const BUTTON_RADIUS = buttonSize
  const angle = index * ((2 * Math.PI) / total) - Math.PI / 2 // 0 = top, clockwise
  const bx = Math.cos(angle) * radius
  const by = Math.sin(angle) * radius
  const scale = isHighlighted ? 1.12 : 1

  const colors = getSlotButtonColors(
    slot,
    { iconColor: 'var(--ring-icon-color)', bg: 'var(--ring-seg-bg)', bgActive: 'var(--ring-seg-bg-active)' },
    isHighlighted
  )

  return (
    <g
      transform={`translate(${bx}, ${by}) scale(${scale})`}
      style={{ transition: 'transform 0.1s ease' }}
    >
      {/* Button circle */}
      <circle
        cx={0}
        cy={0}
        r={BUTTON_RADIUS}
        opacity={0.93}
        style={{
          fill: colors.bg,
          stroke: isFolderOpen ? 'var(--ring-accent, #6060ff)' : isHighlighted ? 'var(--ring-seg-border-active)' : 'var(--ring-seg-border)',
          strokeWidth: isFolderOpen ? 2 : isHighlighted ? 1.5 : 1,
          transition: 'fill 0.1s ease, stroke 0.1s ease',
        }}
      />
      {/* Outer glow ring when folder sub-menu is open */}
      {isFolderOpen && (
        <circle
          cx={0}
          cy={0}
          r={BUTTON_RADIUS + 5}
          fill="none"
          style={{ stroke: 'var(--ring-accent, #6060ff)', strokeWidth: 1.5, opacity: 0.6, strokeDasharray: '4 3' }}
        />
      )}

      {/* Icon + label via foreignObject */}
      {(() => {
        const foW = Math.round(buttonSize * 0.875)
        const foH = showText ? iconSize + 3 + fontSize + 4 : iconSize + 4
        const foX = -(foW / 2)
        const foY = -(foH / 2)
        return (
          <foreignObject
            x={foX}
            y={foY}
            width={foW}
            height={foH}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: foW,
                height: foH,
                gap: 3,
              }}
            >
              <SegmentIcon icon={slot.icon} iconIsCustom={slot.iconIsCustom} size={iconSize} color={colors.iconColor} />
              {showText && (
                <span
                  style={{
                    color: slot.textColor ?? (isHighlighted ? 'var(--ring-text-active)' : 'var(--ring-text)'),
                    fontSize: `${fontSize}px`,
                    fontFamily: 'system-ui, sans-serif',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    lineHeight: 1,
                    transition: 'color 0.1s ease'
                  }}
                >
                  {slot.label}
                </span>
              )}
            </div>
          </foreignObject>
        )
      })()}
    </g>
  )
}
