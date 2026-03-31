import { useEffect, useState, useCallback } from 'react'
import { RingOverlay } from './components/RingOverlay'
import type { RingShowPayload, RingCursorMovePayload } from '@shared/ipc.types'
import type { AppearanceConfig, SlotConfig } from '@shared/config.types'

declare global {
  interface Window {
    ringAPI: {
      onShow: (cb: (payload: RingShowPayload) => void) => void
      onHide: (cb: () => void) => void
      onCursorMove: (cb: (payload: RingCursorMovePayload) => void) => void
      execute: (payload: { slot: SlotConfig }) => void
      dismiss: () => void
      notifyIdle: () => void
    }
  }
}

export function App(): JSX.Element {
  const [visible, setVisible] = useState(false)
  const [slots, setSlots] = useState<SlotConfig[]>([])
  const [appearance, setAppearance] = useState<AppearanceConfig>({
    ringRadius: 120,
    opacity: 0.92,
    animationSpeed: 'normal'
  })
  const [center, setCenter] = useState({ x: 180, y: 180 })

  useEffect(() => {
    window.ringAPI.onShow((payload) => {
      setSlots(payload.slots)
      setAppearance(payload.appearance)
      // Apply theme from payload
      document.documentElement.dataset.theme = payload.resolvedTheme
      // Ring window is positioned so cursor is at center
      // Use the same halfSize formula as HookManager so center aligns with cursor
      const hasFolders = payload.slots.some((s) => s.actions[0]?.type === 'folder')
      const subMultiplier = hasFolders ? (payload.appearance.folderSubRadiusMultiplier ?? 2.0) : 1.0
      const halfSize = Math.round(payload.appearance.ringRadius * subMultiplier + 60)
      setCenter({ x: halfSize, y: halfSize })
      setVisible(true)
    })

    window.ringAPI.onHide(() => {
      // Dispatch first so RingCanvas captures the highlighted segment before unmount
      window.dispatchEvent(new Event('ring:trigger-released'))
      setVisible(false)
    })
  }, [])

  const handleExecute = useCallback((slot: SlotConfig) => {
    setVisible(false)
    window.ringAPI.execute({ slot })
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    window.ringAPI.dismiss()
  }, [])

  return (
    <RingOverlay
      visible={visible}
      slots={slots}
      appearance={appearance}
      center={center}
      onExecute={handleExecute}
      onDismiss={handleDismiss}
      onIdle={() => window.ringAPI.notifyIdle()}
    />
  )
}
