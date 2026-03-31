import { useCallback } from 'react'
import { RingCanvas } from './RingCanvas'
import { useRingAnimation } from '../hooks/useRingAnimation'
import type { AppearanceConfig, SlotConfig } from '@shared/config.types'

interface RingOverlayProps {
  visible: boolean
  slots: SlotConfig[]
  appearance: AppearanceConfig
  center: { x: number; y: number }
  onExecute: (slot: SlotConfig) => void
  onDismiss: () => void
  onIdle?: () => void
}

export function RingOverlay({
  visible,
  slots,
  appearance,
  center,
  onExecute,
  onDismiss,
  onIdle
}: RingOverlayProps): JSX.Element | null {
  const { phase, expandMs } = useRingAnimation(visible, appearance.animationSpeed, onIdle)

  const handleSegmentRelease = useCallback(
    (slot: SlotConfig | null) => {
      if (slot) {
        onExecute(slot)
      } else {
        onDismiss()
      }
    },
    [onExecute, onDismiss]
  )

  if (phase === 'gone') return null

  const hasFolders = slots.some((s) => s.actions[0]?.type === 'folder')
  const subMultiplier = hasFolders ? (appearance.folderSubRadiusMultiplier ?? 2.0) : 1.0
  const size = Math.round(appearance.ringRadius * subMultiplier + 60) * 2
  const animClass =
    phase === 'entering' ? 'ring-entering' :
    phase === 'exiting' ? 'ring-exiting' :
    'ring-visible'

  return (
    <div
      className={animClass}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: size,
        height: size,
        opacity: appearance.opacity,
        animationDuration: `${expandMs}ms`,
        pointerEvents: phase === 'exiting' ? 'none' : 'all'
      }}
    >
      <RingCanvas
        slots={slots}
        radius={appearance.ringRadius}
        buttonSize={appearance.buttonSize}
        iconSize={appearance.iconSize}
        fontSize={appearance.fontSize}
        showText={appearance.showText}
        centerX={center.x}
        centerY={center.y}
        folderSubRadiusMultiplier={appearance.folderSubRadiusMultiplier}
        onSegmentRelease={handleSegmentRelease}
      />
    </div>
  )
}
