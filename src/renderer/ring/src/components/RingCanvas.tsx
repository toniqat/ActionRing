import { useRef, useEffect, useState } from 'react'
import { RingSegment } from './RingSegment'
import { SegmentIcon } from './SegmentIcon'
import { getSlotButtonColors } from '@shared/colorUtils'
import { useSegmentHitTest } from '../hooks/useSegmentHitTest'
import type { SlotConfig } from '@shared/config.types'

// ─── Debug flag ───────────────────────────────────────────────────────────────
// Set to true to render sector-boundary lines and dead-zone circle over the ring.
// Each wedge is colored and boundary lines show exact detection borders.
const DEBUG_SECTORS = false

/** Direct bounding-box hit test for primary ring slots (used while sub-slots are open).
 *  Returns the index of the first primary slot whose button circle contains (mouseX, mouseY),
 *  skipping excludeIndex (the currently active folder). */
function hitTestPrimarySlot(
  mouseX: number, mouseY: number,
  centerX: number, centerY: number,
  slots: SlotConfig[],
  radius: number,
  buttonSize: number,
  excludeIndex: number
): number | null {
  for (let i = 0; i < slots.length; i++) {
    if (i === excludeIndex) continue
    const angle = i * ((2 * Math.PI) / slots.length) - Math.PI / 2
    const bx = centerX + Math.cos(angle) * radius
    const by = centerY + Math.sin(angle) * radius
    const dx = mouseX - bx
    const dy = mouseY - by
    if (Math.sqrt(dx * dx + dy * dy) < buttonSize) return i
  }
  return null
}

interface RingCanvasProps {
  slots: SlotConfig[]
  radius: number
  buttonSize?: number
  iconSize?: number
  fontSize?: number
  showText?: boolean
  centerX: number
  centerY: number
  folderSubRadiusMultiplier?: number
  onSegmentRelease: (slot: SlotConfig | null) => void
}

/**
 * Angles (radians) for each sub-slot using arc-length-preserving spacing.
 * The gap between sub-slots matches the pixel gap between primary ring slots,
 * so the sub-ring feels equally dense regardless of its larger radius.
 * Arc width is dynamic (no hard cap).
 */
function getSubSlotAngle(
  folderAngle: number,
  subIndex: number,
  numSubs: number,
  numPrimarySlots: number,
  radius: number,
  subRadius: number
): number {
  if (numSubs === 1) return folderAngle
  const arcGap = (2 * Math.PI * radius) / numPrimarySlots  // pixel gap on primary ring
  const step = arcGap / subRadius                           // same pixel gap → smaller angle at larger radius
  const totalArc = (numSubs - 1) * step
  return folderAngle - totalArc / 2 + subIndex * step
}

/** x,y of a sub-slot button relative to ring center */
function getSubSlotPos(
  folderAngle: number,
  subIndex: number,
  numSubs: number,
  subRadius: number,
  numPrimarySlots: number,
  radius: number
): { x: number; y: number } {
  const angle = getSubSlotAngle(folderAngle, subIndex, numSubs, numPrimarySlots, radius, subRadius)
  return { x: Math.cos(angle) * subRadius, y: Math.sin(angle) * subRadius }
}

/** Index of the sub-button the cursor is within, or null */
function hitTestSubSlots(
  mouseX: number, mouseY: number,
  centerX: number, centerY: number,
  subSlots: SlotConfig[],
  folderAngle: number,
  subRadius: number,
  buttonSize: number,
  numPrimarySlots: number,
  radius: number
): number | null {
  for (let i = 0; i < subSlots.length; i++) {
    const pos = getSubSlotPos(folderAngle, i, subSlots.length, subRadius, numPrimarySlots, radius)
    const dx = mouseX - (centerX + pos.x)
    const dy = mouseY - (centerY + pos.y)
    if (Math.sqrt(dx * dx + dy * dy) < buttonSize) return i
  }
  return null
}

export function RingCanvas({
  slots,
  radius,
  buttonSize = 32,
  iconSize = 18,
  fontSize = 8,
  showText = false,
  centerX,
  centerY,
  folderSubRadiusMultiplier = 2.0,
  onSegmentRelease
}: RingCanvasProps): JSX.Element {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [activeFolderIndex, setActiveFolderIndex] = useState<number | null>(null)
  const [highlightedSubIndex, setHighlightedSubIndex] = useState<number | null>(null)

  // Ref mirror of activeFolderIndex so the cursor handler always reads the
  // latest value without needing to be re-registered on every folder change.
  const activeFolderIndexRef = useRef<number | null>(null)
  useEffect(() => { activeFolderIndexRef.current = activeFolderIndex }, [activeFolderIndex])

  const hitTest = useSegmentHitTest(slots.length, centerX, centerY, 30)
  const svgRef = useRef<SVGSVGElement>(null)

  const subRadius = radius * folderSubRadiusMultiplier
  const hasFolders = slots.some((s) => s.actions[0]?.type === 'folder')
  const maxRadius = hasFolders ? subRadius : radius
  const size = (maxRadius + 60) * 2

  useEffect(() => {
    window.ringAPI.onCursorMove(({ x, y }) => {
      const sectorIdx = hitTest(x, y)
      const currentFolderIdx = activeFolderIndexRef.current

      if (currentFolderIdx !== null) {
        // === Sub-slots are open: priority-based hit test ===
        const folderAngle = currentFolderIdx * ((2 * Math.PI) / slots.length) - Math.PI / 2
        const subSlots = slots[currentFolderIdx]?.subSlots ?? []

        // 1. Sub-slots have highest priority — direct bounding-box
        const subHit = subSlots.length > 0
          ? hitTestSubSlots(x, y, centerX, centerY, subSlots, folderAngle, subRadius, buttonSize, slots.length, radius)
          : null
        if (subHit !== null) {
          setHighlightedIndex(currentFolderIdx)
          setHighlightedSubIndex(subHit)
          return
        }

        // 2. Folder's own sector keeps sector-based selection
        if (sectorIdx === currentFolderIdx) {
          setHighlightedIndex(currentFolderIdx)
          setHighlightedSubIndex(null)
          return
        }

        // 3. Dead zone — dismiss sub-ring
        if (sectorIdx === null) {
          setActiveFolderIndex(null)
          setHighlightedIndex(null)
          setHighlightedSubIndex(null)
          return
        }

        // 4. Other primary slots: only direct bounding-box hover (sector disabled)
        const directHit = hitTestPrimarySlot(x, y, centerX, centerY, slots, radius, buttonSize, currentFolderIdx)
        if (directHit !== null) {
          setActiveFolderIndex(null)
          setHighlightedSubIndex(null)
          setHighlightedIndex(directHit)
          return
        }

        // 5. Cursor is in another sector but not directly over any button — keep folder open
        setHighlightedIndex(currentFolderIdx)
        setHighlightedSubIndex(null)
      } else {
        // === Normal mode: sector-based selection ===
        setHighlightedIndex(sectorIdx)

        if (sectorIdx !== null && slots[sectorIdx]?.actions[0]?.type === 'folder') {
          setActiveFolderIndex(sectorIdx)
          const folderAngle = sectorIdx * ((2 * Math.PI) / slots.length) - Math.PI / 2
          const subSlots = slots[sectorIdx].subSlots ?? []
          const subHit = subSlots.length > 0
            ? hitTestSubSlots(x, y, centerX, centerY, subSlots, folderAngle, subRadius, buttonSize, slots.length, radius)
            : null
          setHighlightedSubIndex(subHit)
        } else {
          setActiveFolderIndex(null)
          setHighlightedSubIndex(null)
        }
      }
    })
  }, [hitTest, slots, centerX, centerY, radius, subRadius, buttonSize])

  useEffect(() => {
    const handleRingHide = () => {
      if (activeFolderIndex !== null && highlightedSubIndex !== null) {
        const subSlot = slots[activeFolderIndex]?.subSlots?.[highlightedSubIndex] ?? null
        onSegmentRelease(subSlot)
      } else if (highlightedIndex !== null && slots[highlightedIndex]?.actions[0]?.type !== 'folder') {
        onSegmentRelease(slots[highlightedIndex])
      } else {
        onSegmentRelease(null)
      }
    }
    window.addEventListener('ring:trigger-released', handleRingHide)
    return () => window.removeEventListener('ring:trigger-released', handleRingHide)
  }, [highlightedIndex, activeFolderIndex, highlightedSubIndex, slots, onSegmentRelease])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      {/* Primary ring slots */}
      {slots.map((slot, i) => (
        <RingSegment
          key={slot.id}
          slot={slot}
          index={i}
          total={slots.length}
          radius={radius}
          buttonSize={buttonSize}
          iconSize={iconSize}
          fontSize={fontSize}
          showText={showText}
          isHighlighted={highlightedIndex === i}
          isFolderOpen={activeFolderIndex === i}
        />
      ))}

      {/* Sub-ring slots for each folder */}
      {slots.map((slot, folderIdx) => {
        if (slot.actions[0]?.type !== 'folder') return null
        const subSlots = slot.subSlots ?? []
        if (subSlots.length === 0) return null

        const isOpen = activeFolderIndex === folderIdx
        const folderAngle = folderIdx * ((2 * Math.PI) / slots.length) - Math.PI / 2

        return (
          <g key={`sub-${slot.id}`}>
            {subSlots.map((sub, subIdx) => {
              const pos = getSubSlotPos(folderAngle, subIdx, subSlots.length, subRadius, slots.length, radius)
              const isHighlighted = isOpen && highlightedSubIndex === subIdx
              const BUTTON_RADIUS = buttonSize

              const foW = Math.round(buttonSize * 0.875)
              const foH = showText ? iconSize + 3 + fontSize + 4 : iconSize + 4

              const subColors = getSlotButtonColors(
                sub,
                { iconColor: 'var(--ring-icon-color)', bg: 'var(--ring-seg-bg)', bgActive: 'var(--ring-seg-bg-active)' },
                isHighlighted
              )

              return (
                <g key={sub.id} transform={`translate(${pos.x}, ${pos.y})`}>
                <g
                  style={{
                    opacity: isOpen ? (sub.enabled ? 1 : 0.32) : 0,
                    transform: `scale(${isOpen ? 1 : 0.4})`,
                    transformOrigin: '0px 0px',
                    transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Button circle */}
                  <circle
                    cx={0}
                    cy={0}
                    r={BUTTON_RADIUS}
                    opacity={0.93}
                    style={{
                      fill: subColors.bg,
                      stroke: isHighlighted ? 'var(--ring-seg-border-active)' : 'var(--ring-seg-border)',
                      strokeWidth: isHighlighted ? 1.5 : 1,
                      transition: 'fill 0.1s ease, stroke 0.1s ease',
                    }}
                  />
                  {/* Scale indicator for highlighted sub-slot */}
                  {isHighlighted && (
                    <circle
                      cx={0}
                      cy={0}
                      r={BUTTON_RADIUS + 4}
                      fill="none"
                      style={{ stroke: 'var(--ring-seg-border-active)', strokeWidth: 1.5, opacity: 0.5 }}
                    />
                  )}
                  {/* Icon + label */}
                  <foreignObject
                    x={-(foW / 2)}
                    y={-(foH / 2)}
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
                      <SegmentIcon icon={sub.icon} iconIsCustom={sub.iconIsCustom} size={iconSize} color={subColors.iconColor} />
                      {showText && (
                        <span
                          style={{
                            color: sub.textColor ?? (isHighlighted ? 'var(--ring-text-active)' : 'var(--ring-text)'),
                            fontSize: `${fontSize}px`,
                            fontFamily: 'system-ui, sans-serif',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            lineHeight: 1,
                            transition: 'color 0.1s ease',
                          }}
                        >
                          {sub.label}
                        </span>
                      )}
                    </div>
                  </foreignObject>
                </g>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Debug: sector boundaries and dead-zone — enable with DEBUG_SECTORS */}
      {DEBUG_SECTORS && (() => {
        const n = slots.length
        const segAngle = (2 * Math.PI) / n
        const outerR = radius + buttonSize + 12
        const COLORS = ['#ff4444','#ff9900','#ffee00','#44ff44','#00ffee','#4488ff','#aa44ff','#ff44aa']
        return (
          <g>
            {/* Sector wedges */}
            {Array.from({ length: n }, (_, i) => {
              // Sector spans (i-0.5)·segAngle to (i+0.5)·segAngle in North-ref.
              // SVG uses East-ref (y-down), so subtract π/2.
              const a0 = (i - 0.5) * segAngle - Math.PI / 2
              const a1 = (i + 0.5) * segAngle - Math.PI / 2
              const x0 = Math.cos(a0) * outerR, y0 = Math.sin(a0) * outerR
              const x1 = Math.cos(a1) * outerR, y1 = Math.sin(a1) * outerR
              return (
                <path
                  key={`dbg-wedge-${i}`}
                  d={`M 0 0 L ${x0} ${y0} A ${outerR} ${outerR} 0 0 1 ${x1} ${y1} Z`}
                  fill={COLORS[i % COLORS.length]}
                  opacity={0.18}
                />
              )
            })}
            {/* Sector boundary lines */}
            {Array.from({ length: n }, (_, i) => {
              const a = (i + 0.5) * segAngle - Math.PI / 2
              return (
                <line
                  key={`dbg-line-${i}`}
                  x1={0} y1={0}
                  x2={Math.cos(a) * outerR} y2={Math.sin(a) * outerR}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              )
            })}
            {/* Inner dead-zone boundary */}
            <circle cx={0} cy={0} r={30}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
            {/* Ring radius reference */}
            <circle cx={0} cy={0} r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </g>
        )
      })()}

      {/* Center crosshair indicator */}
      <circle cx={0} cy={0} r={6} style={{ fill: 'var(--ring-center-dot)' }} />
      <circle cx={0} cy={0} r={2} style={{ fill: 'var(--ring-center-core)' }} />
    </svg>
  )
}
