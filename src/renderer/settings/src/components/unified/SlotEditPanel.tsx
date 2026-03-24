import { motion } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { BUILTIN_ICONS } from '@shared/icons'
import type { SlotConfig, ActionConfig } from '@shared/config.types'

const ACTION_TYPES = ['launch', 'shortcut', 'shell', 'system', 'folder'] as const
const SYSTEM_ACTIONS = [
  'volume-up', 'volume-down', 'mute', 'play-pause',
  'screenshot', 'lock-screen', 'show-desktop',
] as const

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--c-text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 6,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--c-input-bg)',
  border: '1px solid var(--c-border)',
  borderRadius: 6,
  color: 'var(--c-text)',
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  width: '100%',
  outline: 'none',
}

export function SlotEditPanel(): JSX.Element {
  const {
    draft, updateDraft,
    selectedSlotIndex, setSelectedSlotIndex,
    editingFolderIndex, setEditingFolderIndex,
    selectedSubSlotIndex, setSelectedSubSlotIndex,
  } = useSettings()
  const { slots } = draft

  // Determine if we're editing a sub-slot or a primary slot
  const isEditingSubSlot = editingFolderIndex !== null && selectedSubSlotIndex !== null
  const isEditingPrimarySlot = !isEditingSubSlot && selectedSlotIndex !== null

  // Resolve the slot being edited
  const slot: SlotConfig | undefined = isEditingSubSlot
    ? slots[editingFolderIndex!]?.subSlots?.[selectedSubSlotIndex!]
    : isEditingPrimarySlot
      ? slots[selectedSlotIndex!]
      : undefined

  if (!slot) return <></>

  const updateSlot = (updated: SlotConfig) => {
    if (isEditingSubSlot) {
      const folder = slots[editingFolderIndex!]
      const newSubSlots = [...(folder.subSlots ?? [])]
      newSubSlots[selectedSubSlotIndex!] = updated
      const newSlots = slots.map((s, i) =>
        i === editingFolderIndex ? { ...s, subSlots: newSubSlots } : s
      )
      updateDraft({ ...draft, slots: newSlots })
    } else {
      const newSlots = [...slots]
      newSlots[selectedSlotIndex!] = updated
      updateDraft({ ...draft, slots: newSlots })
    }
  }

  const removeSlot = () => {
    if (isEditingSubSlot) {
      const folder = slots[editingFolderIndex!]
      const subSlots = folder.subSlots ?? []
      if (subSlots.length === 0) return
      const newSubSlots = subSlots.filter((_, i) => i !== selectedSubSlotIndex)
      const newSlots = slots.map((s, i) =>
        i === editingFolderIndex ? { ...s, subSlots: newSubSlots } : s
      )
      updateDraft({ ...draft, slots: newSlots })
      setSelectedSubSlotIndex(null)
    } else {
      if (slots.length <= 4) return
      const newSlots = slots.filter((_, i) => i !== selectedSlotIndex)
      updateDraft({ ...draft, slots: newSlots })
      setSelectedSlotIndex(null)
    }
  }

  const moveSlot = (direction: -1 | 1) => {
    if (isEditingSubSlot) {
      const folder = slots[editingFolderIndex!]
      const subSlots = [...(folder.subSlots ?? [])]
      const to = selectedSubSlotIndex! + direction
      if (to < 0 || to >= subSlots.length) return
      const [item] = subSlots.splice(selectedSubSlotIndex!, 1)
      subSlots.splice(to, 0, item)
      const newSlots = slots.map((s, i) =>
        i === editingFolderIndex ? { ...s, subSlots } : s
      )
      updateDraft({ ...draft, slots: newSlots })
      setSelectedSubSlotIndex(to)
    } else {
      const to = selectedSlotIndex! + direction
      if (to < 0 || to >= slots.length) return
      const newSlots = [...slots]
      const [item] = newSlots.splice(selectedSlotIndex!, 1)
      newSlots.splice(to, 0, item)
      updateDraft({ ...draft, slots: newSlots })
      setSelectedSlotIndex(to)
    }
  }

  const changeActionType = (type: typeof ACTION_TYPES[number]) => {
    let action: ActionConfig
    if (type === 'launch') action = { type: 'launch', target: '' }
    else if (type === 'shortcut') action = { type: 'shortcut', keys: '' }
    else if (type === 'shell') action = { type: 'shell', command: '' }
    else if (type === 'folder') {
      action = { type: 'folder' }
      // Initialize subSlots if switching to folder
      if (!isEditingSubSlot) {
        const currentSubSlots = slots[selectedSlotIndex!]?.subSlots ?? []
        updateSlot({ ...slot, action, subSlots: currentSubSlots })
        return
      }
    } else {
      action = { type: 'system', action: 'volume-up' }
    }
    updateSlot({ ...slot, action })
  }

  const slotNumber = isEditingSubSlot ? selectedSubSlotIndex! + 1 : selectedSlotIndex! + 1
  const slotLabel = isEditingSubSlot ? `Sub-Slot ${slotNumber}` : `Slot ${slotNumber}`
  const totalCount = isEditingSubSlot
    ? (slots[editingFolderIndex!]?.subSlots?.length ?? 0)
    : slots.length
  const canDelete = isEditingSubSlot ? totalCount > 0 : slots.length > 4
  const canMoveUp = isEditingSubSlot ? selectedSubSlotIndex! > 0 : selectedSlotIndex! > 0
  const canMoveDown = isEditingSubSlot
    ? selectedSubSlotIndex! < totalCount - 1
    : selectedSlotIndex! < slots.length - 1

  // Sub-slots cannot themselves be folders (1-level deep only)
  const availableActionTypes = isEditingSubSlot
    ? ACTION_TYPES.filter((t) => t !== 'folder')
    : ACTION_TYPES

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        width: 288,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--c-border)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--c-border-sub)',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: 'var(--c-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {isEditingSubSlot
              ? `${slots[editingFolderIndex!]?.label ?? 'Folder'} › Sub-Slot ${slotNumber}`
              : `Slot ${slotNumber}`}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginTop: 2 }}>
            {slot.label || 'Unnamed'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => moveSlot(-1)}
            disabled={!canMoveUp}
            title="Move up"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'none', cursor: !canMoveUp ? 'not-allowed' : 'pointer',
              color: !canMoveUp ? 'var(--c-text-dim)' : 'var(--c-text-muted)',
              fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >▲</button>
          <button
            onClick={() => moveSlot(1)}
            disabled={!canMoveDown}
            title="Move down"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'none', cursor: !canMoveDown ? 'not-allowed' : 'pointer',
              color: !canMoveDown ? 'var(--c-text-dim)' : 'var(--c-text-muted)',
              fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >▼</button>
          <button
            onClick={removeSlot}
            disabled={!canDelete}
            title="Delete slot"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'none', cursor: !canDelete ? 'not-allowed' : 'pointer',
              color: !canDelete ? 'var(--c-text-dim)' : 'var(--c-danger)',
              fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      </div>

      {/* Edit fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '18px 18px', overflowY: 'auto', flex: 1 }}>
        {/* Label */}
        <div>
          <label style={fieldLabel}>Label</label>
          <input
            value={slot.label}
            onChange={(e) => updateSlot({ ...slot, label: e.target.value })}
            style={inputStyle}
          />
        </div>

        {/* Icon picker */}
        <div>
          <label style={fieldLabel}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {BUILTIN_ICONS.map((ic) => (
              <button
                key={ic.name}
                onClick={() => updateSlot({ ...slot, icon: ic.name, iconIsCustom: false })}
                title={ic.label}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  border: `2px solid ${slot.icon === ic.name && !slot.iconIsCustom ? 'var(--c-accent)' : 'transparent'}`,
                  background: 'var(--c-elevated)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: ic.svg }}
              />
            ))}
            <button
              onClick={async () => {
                const path = await window.settingsAPI.pickIcon()
                if (path) updateSlot({ ...slot, icon: path, iconIsCustom: true })
              }}
              title="Custom icon…"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: '1px dashed var(--c-border)',
                background: 'none', cursor: 'pointer',
                color: 'var(--c-text-dim)', fontSize: 18,
              }}
            >+</button>
          </div>
        </div>

        {/* Action Type */}
        <div>
          <label style={fieldLabel}>Action Type</label>
          <select
            value={slot.action.type}
            onChange={(e) => changeActionType(e.target.value as typeof ACTION_TYPES[number])}
            style={inputStyle}
          >
            {availableActionTypes.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Action-specific fields */}
        {slot.action.type === 'launch' && (
          <div>
            <label style={fieldLabel}>Application Path</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={slot.action.target}
                onChange={(e) => updateSlot({ ...slot, action: { type: 'launch', target: e.target.value } })}
                placeholder="e.g. chrome.exe"
                style={{ ...inputStyle, width: 'auto', flex: 1 }}
              />
              <button
                onClick={async () => {
                  const path = await window.settingsAPI.pickExe()
                  if (path) updateSlot({ ...slot, action: { type: 'launch', target: path } })
                }}
                style={{
                  background: 'var(--c-elevated)', border: '1px solid var(--c-border)',
                  borderRadius: 6, color: 'var(--c-text-muted)',
                  padding: '0 10px', cursor: 'pointer', fontSize: 13,
                }}
              >Browse</button>
            </div>
          </div>
        )}

        {slot.action.type === 'shortcut' && (
          <div>
            <label style={fieldLabel}>Key Combo</label>
            <input
              value={slot.action.keys}
              onChange={(e) => updateSlot({ ...slot, action: { type: 'shortcut', keys: e.target.value } })}
              placeholder="e.g. ctrl+c"
              style={inputStyle}
            />
          </div>
        )}

        {slot.action.type === 'shell' && (
          <div>
            <label style={fieldLabel}>Command</label>
            <input
              value={slot.action.command}
              onChange={(e) => updateSlot({ ...slot, action: { type: 'shell', command: e.target.value } })}
              placeholder="e.g. notepad.exe"
              style={inputStyle}
            />
          </div>
        )}

        {slot.action.type === 'system' && (
          <div>
            <label style={fieldLabel}>System Action</label>
            <select
              value={slot.action.action}
              onChange={(e) =>
                updateSlot({ ...slot, action: { type: 'system', action: e.target.value as typeof SYSTEM_ACTIONS[number] } })
              }
              style={inputStyle}
            >
              {SYSTEM_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        {slot.action.type === 'folder' && !isEditingSubSlot && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--c-elevated)',
              border: '1px solid var(--c-border)',
              fontSize: 12,
              color: 'var(--c-text-dim)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--c-text)', marginBottom: 4 }}>Folder</div>
            {editingFolderIndex !== null ? (
              // Already in sub-slot editing mode for this folder
              <>
                {(slot.subSlots?.length ?? 0) > 0
                  ? `${slot.subSlots!.length} sub-slot${slot.subSlots!.length !== 1 ? 's' : ''} configured — click a sub-slot to edit it.`
                  : 'No sub-slots yet — use "+ Add Sub-Slot" to add one.'}
              </>
            ) : (
              // Folder selected but sub-slot editing mode not yet open
              <>
                Click the folder button in the preview to expand and edit its sub-slots.
                {(slot.subSlots?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 6, color: 'var(--c-text-muted)' }}>
                    {slot.subSlots!.length} sub-slot{slot.subSlots!.length !== 1 ? 's' : ''} configured
                  </div>
                )}
                <button
                  onClick={() => {
                    setEditingFolderIndex(selectedSlotIndex)
                    setSelectedSubSlotIndex(null)
                    // Keep selectedSlotIndex so the folder edit panel stays visible
                  }}
                  style={{
                    marginTop: 10, width: '100%', padding: '7px 0',
                    borderRadius: 6, border: '1px solid var(--c-accent)',
                    background: 'none', cursor: 'pointer',
                    color: 'var(--c-accent)', fontSize: 12, fontFamily: 'inherit',
                  }}
                >
                  Edit Sub-Slots →
                </button>
              </>
            )}
          </div>
        )}

        {/* Enabled toggle */}
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: 14, color: 'var(--c-text-muted)' }}>Enabled</span>
          <input
            type="checkbox"
            checked={slot.enabled}
            onChange={(e) => updateSlot({ ...slot, enabled: e.target.checked })}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--c-accent)' }}
          />
        </label>
      </div>
    </motion.div>
  )
}
