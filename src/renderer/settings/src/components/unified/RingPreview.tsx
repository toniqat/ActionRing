import { motion } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { BUILTIN_ICONS } from '@shared/icons'
import type { SlotConfig } from '@shared/config.types'

const VIEWBOX_HALF = 230

const ANIM_SPRING = {
  slow:   { type: 'spring' as const, stiffness: 80,  damping: 18 },
  normal: { type: 'spring' as const, stiffness: 280, damping: 22 },
  fast:   { type: 'spring' as const, stiffness: 600, damping: 30 },
}

const FOCUS_DIM_OPACITY = 0.30
const FOCUS_TRANSITION = 'opacity 0.2s ease-out'

function getIconSvg(name: string): string {
  return BUILTIN_ICONS.find((i) => i.name === name)?.svg ?? ''
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Angles for sub-slots using arc-length-preserving spacing (matches primary ring density).
 * Arc width is dynamic — not capped at 180°.
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
  const arcGap = (2 * Math.PI * radius) / numPrimarySlots
  const step = arcGap / subRadius
  const totalArc = (numSubs - 1) * step
  return folderAngle - totalArc / 2 + subIndex * step
}

interface SlotButtonProps {
  slot: SlotConfig
  cx: number
  cy: number
  buttonR: number
  iconRenderSize: number
  labelFontSize: number
  showText: boolean
  foW: number
  foH: number
  isSelected: boolean
  dimmed: boolean
  onClick: () => void
  badge?: React.ReactNode
}

function SlotButton({
  slot, cx, cy, buttonR, iconRenderSize, labelFontSize, showText,
  foW, foH, isSelected, dimmed, onClick, badge
}: SlotButtonProps): JSX.Element {
  const iconSvg = slot.iconIsCustom ? null : getIconSvg(slot.icon)

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <g
        style={{
          cursor: 'pointer',
          transform: `scale(${isSelected ? 1.12 : 1})`,
          transformOrigin: '0px 0px',
          transition: `transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), ${FOCUS_TRANSITION}`,
          opacity: dimmed ? FOCUS_DIM_OPACITY : (slot.enabled ? 1 : 0.32),
          pointerEvents: 'all',
        }}
        onClick={onClick}
      >
        <circle
          cx={0} cy={0} r={buttonR}
          style={{
            fill: isSelected ? 'var(--ring-seg-bg-active)' : 'var(--ring-seg-bg)',
            stroke: isSelected ? 'var(--ring-accent)' : 'var(--ring-seg-border)',
            strokeWidth: isSelected ? 2 : 1,
            transition: 'fill 0.15s ease, stroke 0.15s ease',
          }}
        />
        <foreignObject
          x={-(foW / 2)} y={-(foH / 2)}
          width={foW} height={foH}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            width: foW, height: foH, gap: 2,
          }}>
            {iconSvg ? (
              // eslint-disable-next-line react/no-danger
              <div
                dangerouslySetInnerHTML={{ __html: iconSvg.replace('width="24" height="24"', `width="${iconRenderSize}" height="${iconRenderSize}"`) }}
                style={{
                  width: iconRenderSize, height: iconRenderSize,
                  flexShrink: 0, display: 'flex',
                  opacity: isSelected ? 1 : 0.7,
                  color: 'var(--ring-icon-color)',
                }}
              />
            ) : slot.iconIsCustom ? (
              <img
                src={`file://${slot.icon}`}
                style={{ width: iconRenderSize, height: iconRenderSize, objectFit: 'contain', flexShrink: 0 }}
              />
            ) : null}
            {showText && (
              <span style={{
                color: isSelected ? 'var(--ring-text-active)' : 'var(--ring-text)',
                fontSize: labelFontSize,
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
                lineHeight: 1.1,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease',
              }}>
                {slot.label}
              </span>
            )}
          </div>
        </foreignObject>
      </g>
      {badge}
    </g>
  )
}

export function RingPreview(): JSX.Element {
  const {
    draft, updateDraft, previewDraft, selectedSlotIndex, setSelectedSlotIndex,
    editingFolderIndex, setEditingFolderIndex,
    selectedSubSlotIndex, setSelectedSubSlotIndex,
    animPreviewKey,
  } = useSettings()

  const { slots } = draft
  const { slots: previewSlots, appearance } = previewDraft
  const radius = appearance.ringRadius
  const subMultiplier = appearance.folderSubRadiusMultiplier ?? 2.0
  const subRadius = radius * subMultiplier
  const buttonR = appearance.buttonSize ?? 32
  const labelFontSize = appearance.fontSize ?? 8
  const showText = appearance.showText ?? false

  const bScale = buttonR / 32
  const iconRenderSize = appearance.iconSize ?? 18
  const foW = Math.round(28 * bScale)
  const foH = showText ? iconRenderSize + 3 + labelFontSize + 4 : iconRenderSize + 4

  // Effective viewbox — expand when showing sub-ring
  const effectiveRadius = editingFolderIndex !== null ? subRadius : radius
  const viewHalf = Math.max(VIEWBOX_HALF, effectiveRadius + buttonR + 20)

  const addSlot = () => {
    if (slots.length >= 12) return
    const newSlot: SlotConfig = {
      id: generateId(),
      label: 'New Action',
      icon: 'star',
      iconIsCustom: false,
      action: { type: 'shell', command: '' },
      enabled: true,
    }
    const newSlots = [...slots, newSlot]
    updateDraft({ ...draft, slots: newSlots })
    setSelectedSlotIndex(newSlots.length - 1)
  }

  const addSubSlot = () => {
    if (editingFolderIndex === null) return
    const folder = slots[editingFolderIndex]
    const subSlots = folder.subSlots ?? []
    if (subSlots.length >= 8) return
    const newSub: SlotConfig = {
      id: generateId(),
      label: 'New Action',
      icon: 'star',
      iconIsCustom: false,
      action: { type: 'shell', command: '' },
      enabled: true,
    }
    const newSubSlots = [...subSlots, newSub]
    const newSlots = slots.map((s, i) =>
      i === editingFolderIndex ? { ...s, subSlots: newSubSlots } : s
    )
    updateDraft({ ...draft, slots: newSlots })
    setSelectedSubSlotIndex(newSubSlots.length - 1)
  }

  const handlePrimaryClick = (slotIndex: number) => {
    const slot = previewSlots[slotIndex]

    if (editingFolderIndex !== null) {
      if (editingFolderIndex === slotIndex) {
        // Toggle: clicking the active folder button returns to primary view
        setEditingFolderIndex(null)
        setSelectedSubSlotIndex(null)
        setSelectedSlotIndex(slotIndex)
      } else {
        // Direct switch: close folder mode and switch to the clicked slot
        setEditingFolderIndex(null)
        setSelectedSubSlotIndex(null)
        if (slot.action.type === 'folder') {
          setEditingFolderIndex(slotIndex)
          setSelectedSlotIndex(slotIndex)
        } else {
          setSelectedSlotIndex(slotIndex)
        }
      }
      return
    }

    if (slot.action.type === 'folder') {
      // Open folder AND show its edit panel in the right panel
      setEditingFolderIndex(slotIndex)
      setSelectedSlotIndex(slotIndex)
      setSelectedSubSlotIndex(null)
    } else {
      setSelectedSlotIndex(slotIndex === selectedSlotIndex ? null : slotIndex)
    }
  }

  const handleSubSlotClick = (subIdx: number) => {
    const newSubIndex = subIdx === selectedSubSlotIndex ? null : subIdx
    setSelectedSubSlotIndex(newSubIndex)
    // When deselecting a sub-slot, restore the folder's own edit panel
    setSelectedSlotIndex(newSubIndex === null ? editingFolderIndex : null)
  }

  const folderSlot = editingFolderIndex !== null ? previewSlots[editingFolderIndex] : null
  const activeSubSlots = folderSlot?.subSlots ?? []

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-3"
      style={{ background: 'var(--ring-preview-bg)' }}
    >
      {/* Breadcrumb when editing a folder */}
      {editingFolderIndex !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-text-dim)' }}>
          <button
            onClick={() => { setSelectedSlotIndex(editingFolderIndex); setEditingFolderIndex(null); setSelectedSubSlotIndex(null) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-accent)', fontSize: 12, padding: '2px 6px',
              borderRadius: 4, fontFamily: 'inherit',
            }}
          >
            ← Ring
          </button>
          <span>/</span>
          <span style={{ color: 'var(--c-text)' }}>{folderSlot?.label ?? 'Folder'}</span>
        </div>
      )}

      {/* Ring SVG */}
      <motion.div
        key={animPreviewKey}
        initial={{ scale: 0.35, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={ANIM_SPRING[appearance.animationSpeed ?? 'normal']}
        className="flex items-center justify-center"
      >
        <svg
          width={viewHalf * 2}
          height={viewHalf * 2}
          viewBox={`${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '380px', opacity: appearance.opacity }}
        >
          {/* Faint primary radius guide */}
          <circle
            cx={0} cy={0} r={radius}
            fill="none"
            style={{ stroke: 'var(--ring-guide)', strokeDasharray: '4 4' }}
            strokeWidth={1}
          />

          {/* Sub-ring radius guide when editing a folder */}
          {editingFolderIndex !== null && (
            <circle
              cx={0} cy={0} r={subRadius}
              fill="none"
              style={{ stroke: 'var(--ring-accent)', strokeDasharray: '3 6', opacity: 0.3 }}
              strokeWidth={1}
            />
          )}

          {/* Primary ring slots */}
          {previewSlots.map((slot, slotIndex) => {
            const total = previewSlots.length
            const angle = slotIndex * ((2 * Math.PI) / total) - Math.PI / 2
            const bx = Math.cos(angle) * radius
            const by = Math.sin(angle) * radius
            const isSelected = slotIndex === selectedSlotIndex
            const isFolder = slot.action.type === 'folder'
            const isFolderOpen = editingFolderIndex === slotIndex
            // In focus mode: dim all primary slots except the active folder
            const dimmed = editingFolderIndex !== null && !isFolderOpen

            return (
              <SlotButton
                key={slot.id}
                slot={slot}
                cx={bx}
                cy={by}
                buttonR={buttonR}
                iconRenderSize={iconRenderSize}
                labelFontSize={labelFontSize}
                showText={showText}
                foW={foW}
                foH={foH}
                isSelected={isSelected || isFolderOpen}
                dimmed={dimmed}
                onClick={() => handlePrimaryClick(slotIndex)}
                badge={
                  isFolder ? (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Small chevron badge indicating this is a folder */}
                      <circle
                        cx={buttonR * 0.7}
                        cy={-buttonR * 0.7}
                        r={7}
                        style={{ fill: isFolderOpen ? 'var(--ring-accent)' : 'var(--ring-seg-bg)', stroke: 'var(--ring-seg-border)', strokeWidth: 1 }}
                      />
                      <text
                        x={buttonR * 0.7}
                        y={-buttonR * 0.7 + 4}
                        textAnchor="middle"
                        style={{ fontSize: 8, fill: isFolderOpen ? 'white' : 'var(--c-text-dim)', fontFamily: 'system-ui', pointerEvents: 'none' }}
                      >▸</text>
                    </g>
                  ) : undefined
                }
              />
            )
          })}

          {/* Sub-ring slots for the currently edited folder */}
          {editingFolderIndex !== null && activeSubSlots.map((sub, subIdx) => {
            const folderAngle = editingFolderIndex * ((2 * Math.PI) / previewSlots.length) - Math.PI / 2
            const angle = getSubSlotAngle(folderAngle, subIdx, activeSubSlots.length, previewSlots.length, radius, subRadius)
            const bx = Math.cos(angle) * subRadius
            const by = Math.sin(angle) * subRadius
            const isSelected = subIdx === selectedSubSlotIndex

            return (
              <SlotButton
                key={sub.id}
                slot={sub}
                cx={bx}
                cy={by}
                buttonR={buttonR}
                iconRenderSize={iconRenderSize}
                labelFontSize={labelFontSize}
                showText={showText}
                foW={foW}
                foH={foH}
                isSelected={isSelected}
                dimmed={false}
                onClick={() => handleSubSlotClick(subIdx)}
              />
            )
          })}

          {/* Center cursor dot */}
          <circle cx={0} cy={0} r={6} style={{ fill: 'var(--ring-center-dot)', pointerEvents: 'none' }} />
          <circle cx={0} cy={0} r={2} style={{ fill: 'var(--ring-center-core)', pointerEvents: 'none' }} />
        </svg>
      </motion.div>

      {/* Footer */}
      <div className="flex items-center gap-3">
        {editingFolderIndex === null ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--c-text-dim)' }}>
              {slots.length}/12 slots
            </span>
            <button
              onClick={addSlot}
              disabled={slots.length >= 12}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                cursor: slots.length >= 12 ? 'not-allowed' : 'pointer',
                background: slots.length >= 12 ? 'var(--c-btn-bg)' : 'var(--c-btn-active)',
                color: slots.length >= 12 ? 'var(--c-text-dim)' : 'var(--c-text)',
                fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s ease',
              }}
            >
              + Add Slot
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: 'var(--c-text-dim)' }}>
              {activeSubSlots.length}/8 sub-slots
            </span>
            <button
              onClick={addSubSlot}
              disabled={activeSubSlots.length >= 8}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                cursor: activeSubSlots.length >= 8 ? 'not-allowed' : 'pointer',
                background: activeSubSlots.length >= 8 ? 'var(--c-btn-bg)' : 'var(--c-btn-active)',
                color: activeSubSlots.length >= 8 ? 'var(--c-text-dim)' : 'var(--c-text)',
                fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s ease',
              }}
            >
              + Add Sub-Slot
            </button>
          </>
        )}
      </div>
    </div>
  )
}
