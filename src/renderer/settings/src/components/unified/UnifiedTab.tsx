import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { LeftPanel } from './LeftPanel'
import { RingPreview } from './RingPreview'
import { SlotEditPanel } from './SlotEditPanel'
import { AppCarousel } from './AppCarousel'

const LEFT_MIN = 160
const LEFT_MAX = 360
const RIGHT_MIN = 220
const RIGHT_MAX = 480

function ResizeDivider({ onDrag }: { onDrag: (dx: number) => void }): JSX.Element {
  const [active, setActive] = useState(false)
  const startXRef = useRef<number | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    setActive(true)

    const onMove = (ev: MouseEvent) => {
      if (startXRef.current === null) return
      const dx = ev.clientX - startXRef.current
      startXRef.current = ev.clientX
      onDrag(dx)
    }
    const onUp = () => {
      startXRef.current = null
      setActive(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [onDrag])

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 4,
        flexShrink: 0,
        cursor: 'col-resize',
        background: active ? 'var(--c-accent)' : 'var(--c-border)',
        transition: 'background 0.15s ease',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-accent-border)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--c-border)' }}
    />
  )
}

export function UnifiedTab(): JSX.Element {
  const { selectedSlotIndex, selectedSubSlotIndex } = useSettings()
  const showPanel = selectedSlotIndex !== null || selectedSubSlotIndex !== null

  const [leftWidth, setLeftWidth] = useState(220)
  const [rightWidth, setRightWidth] = useState(288)

  const handleLeftDrag = useCallback((dx: number) => {
    setLeftWidth((w) => Math.max(LEFT_MIN, Math.min(LEFT_MAX, w + dx)))
  }, [])

  const handleRightDrag = useCallback((dx: number) => {
    setRightWidth((w) => Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, w - dx)))
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: leftWidth, flexShrink: 0, overflow: 'hidden' }}>
        <LeftPanel />
      </div>
      <ResizeDivider onDrag={handleLeftDrag} />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* App Carousel — sits above the Ring Preview */}
        <AppCarousel />
        <RingPreview />
      </div>
      <AnimatePresence mode="popLayout">
        {showPanel && (
          <motion.div
            key="right-panel-group"
            initial={{ x: rightWidth + 4 }}
            animate={{ x: 0 }}
            exit={{ x: rightWidth + 4 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: 'flex', flexShrink: 0 }}
          >
            <ResizeDivider onDrag={handleRightDrag} />
            <SlotEditPanel width={rightWidth} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
