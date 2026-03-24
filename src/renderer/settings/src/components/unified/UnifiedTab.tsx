import { AnimatePresence } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { LeftPanel } from './LeftPanel'
import { RingPreview } from './RingPreview'
import { SlotEditPanel } from './SlotEditPanel'

export function UnifiedTab(): JSX.Element {
  const { selectedSlotIndex, selectedSubSlotIndex } = useSettings()
  const showPanel = selectedSlotIndex !== null || selectedSubSlotIndex !== null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <LeftPanel />
      <RingPreview />
      <AnimatePresence>
        {showPanel && <SlotEditPanel key="slot-editor" />}
      </AnimatePresence>
    </div>
  )
}
