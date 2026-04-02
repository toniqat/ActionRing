import { useState } from 'react'
import type { AppConfig, SlotConfig, ActionConfig } from '@shared/config.types'
import { BUILTIN_ICONS } from '@shared/icons'
import { UIIcon } from '@shared/UIIcon'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function SlotsTab({ config, onSave }: Props): JSX.Element {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const slots = config.slots

  const updateSlot = (index: number, updated: SlotConfig) => {
    const newSlots = [...slots]
    newSlots[index] = updated
    onSave({ ...config, slots: newSlots })
  }

  const removeSlot = (index: number) => {
    if (slots.length <= 4) return
    const newSlots = slots.filter((_, i) => i !== index)
    onSave({ ...config, slots: newSlots })
    if (editingIndex === index) setEditingIndex(null)
  }

  const addSlot = () => {
    if (slots.length >= 12) return
    const newSlot: SlotConfig = {
      id: generateId(),
      label: 'New Action',
      icon: 'star',
      iconIsCustom: false,
      actions: [{ type: 'shell', command: '' }],
      enabled: true
    }
    onSave({ ...config, slots: [...slots, newSlot] })
    setEditingIndex(slots.length)
  }

  const moveSlot = (from: number, to: number) => {
    const newSlots = [...slots]
    const [item] = newSlots.splice(from, 1)
    newSlots.splice(to, 0, item)
    onSave({ ...config, slots: newSlots })
    setEditingIndex(to)
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Slot list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Action Slots ({slots.length}/12)
          </h2>
          <button
            onClick={addSlot}
            disabled={slots.length >= 12}
            style={{
              background: '#4040aa',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              padding: '6px 14px',
              fontSize: 13,
              cursor: slots.length >= 12 ? 'not-allowed' : 'pointer',
              opacity: slots.length >= 12 ? 0.5 : 1
            }}
          >
            + Add Slot
          </button>
        </div>

        {slots.map((slot, i) => (
          <div
            key={slot.id}
            onClick={() => setEditingIndex(i === editingIndex ? null : i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: editingIndex === i ? '#2a2a4e' : '#1a1a2e',
              borderRadius: 8,
              border: `1px solid ${editingIndex === i ? '#6060ff' : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', width: 20 }}>{i + 1}</span>
            <div
              style={{ width: 32, height: 32, borderRadius: 8, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{
                __html: slot.iconIsCustom
                  ? `<img src="file://${slot.icon}" style="width:24px;height:24px;object-fit:contain"/>`
                  : (BUILTIN_ICONS.find((ic) => ic.name === slot.icon)?.svg ?? '')
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{slot.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {slot.actions[0]?.type === 'system' ? `System: ${(slot.actions[0] as import('@shared/config.types').SystemAction).action}` : (slot.actions[0]?.type ?? 'none')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {i > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlot(i, i - 1) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                ><UIIcon name="upload" size={16} /></button>
              )}
              {i < slots.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlot(i, i + 1) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                ><UIIcon name="download" size={16} /></button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeSlot(i) }}
                disabled={slots.length <= 4}
                style={{
                  background: 'none', border: 'none',
                  color: slots.length <= 4 ? 'rgba(255,255,255,0.2)' : '#ff6060',
                  cursor: slots.length <= 4 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              ><UIIcon name="close" size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Slot editor */}
      {editingIndex !== null && slots[editingIndex] && (
        <SlotEditor
          slot={slots[editingIndex]}
          onChange={(updated) => updateSlot(editingIndex, updated)}
        />
      )}
    </div>
  )
}

function SlotEditor({ slot, onChange }: { slot: SlotConfig; onChange: (s: SlotConfig) => void }): JSX.Element {
  const actionTypes = ['launch', 'shortcut', 'shell', 'system'] as const
  const systemActions = [
    'volume-up', 'volume-down', 'mute', 'play-pause',
    'screenshot', 'lock-screen', 'show-desktop'
  ] as const

  return (
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
        Edit Slot
      </h3>

      {/* Label */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Label</span>
        <input
          value={slot.label}
          onChange={(e) => onChange({ ...slot, label: e.target.value })}
          style={{
            background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'white', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit'
          }}
        />
      </label>

      {/* Icon picker */}
      <div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Icon</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {BUILTIN_ICONS.map((ic) => (
            <button
              key={ic.name}
              onClick={() => onChange({ ...slot, icon: ic.name, iconIsCustom: false })}
              title={ic.label}
              style={{
                width: 36, height: 36, border: `2px solid ${slot.icon === ic.name && !slot.iconIsCustom ? '#6060ff' : 'transparent'}`,
                borderRadius: 8, background: '#2a2a3e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              dangerouslySetInnerHTML={{ __html: ic.svg }}
            />
          ))}
          <button
            onClick={async () => {
              const path = await window.settingsAPI.pickIcon()
              if (path) onChange({ ...slot, icon: path, iconIsCustom: true })
            }}
            title="Custom icon..."
            style={{
              width: 36, height: 36, border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: 8, background: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 18
            }}
          >+</button>
        </div>
      </div>

      {/* Action type (first action in sequence) */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Action Type</span>
        <select
          value={slot.actions[0]?.type ?? 'shell'}
          onChange={(e) => {
            const type = e.target.value as typeof actionTypes[number]
            let action: ActionConfig
            if (type === 'launch') action = { type: 'launch', target: '' }
            else if (type === 'shortcut') action = { type: 'shortcut', keys: '' }
            else if (type === 'shell') action = { type: 'shell', command: '' }
            else action = { type: 'system', action: 'volume-up' }
            onChange({ ...slot, actions: [action] })
          }}
          style={{
            background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'white', padding: '8px 12px', fontSize: 13
          }}
        >
          {actionTypes.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </label>

      {/* Action target (context-sensitive) */}
      {slot.actions[0]?.type === 'launch' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Application Path</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={(slot.actions[0] as import('@shared/config.types').LaunchAction).target}
              onChange={(e) => onChange({ ...slot, actions: [{ type: 'launch', target: e.target.value }] })}
              placeholder="e.g. chrome.exe"
              style={{
                flex: 1, background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: 'white', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit'
              }}
            />
            <button
              onClick={async () => {
                const path = await window.settingsAPI.pickExe()
                if (path) onChange({ ...slot, actions: [{ type: 'launch', target: path }] })
              }}
              style={{
                background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: 'rgba(255,255,255,0.7)', padding: '0 10px', cursor: 'pointer', fontSize: 13
              }}
            >Browse</button>
          </div>
        </label>
      )}

      {slot.actions[0]?.type === 'shortcut' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Combo</span>
          <input
            value={(slot.actions[0] as import('@shared/config.types').ShortcutAction).keys}
            onChange={(e) => onChange({ ...slot, actions: [{ type: 'shortcut', keys: e.target.value }] })}
            placeholder="e.g. ctrl+c"
            style={{
              background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'white', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit'
            }}
          />
        </label>
      )}

      {slot.actions[0]?.type === 'shell' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Command</span>
          <input
            value={(slot.actions[0] as import('@shared/config.types').ShellAction).command}
            onChange={(e) => onChange({ ...slot, actions: [{ type: 'shell', command: e.target.value }] })}
            placeholder="e.g. notepad.exe"
            style={{
              background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'white', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit'
            }}
          />
        </label>
      )}

      {slot.actions[0]?.type === 'system' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>System Action</span>
          <select
            value={(slot.actions[0] as import('@shared/config.types').SystemAction).action}
            onChange={(e) =>
              onChange({ ...slot, actions: [{ type: 'system', action: e.target.value as typeof systemActions[number] }] })
            }
            style={{
              background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'white', padding: '8px 12px', fontSize: 13
            }}
          >
            {systemActions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      )}

      {/* Enable/Disable toggle */}
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 14 }}>Enabled</span>
        <input
          type="checkbox"
          checked={slot.enabled}
          onChange={(e) => onChange({ ...slot, enabled: e.target.checked })}
          style={{ width: 18, height: 18, cursor: 'pointer' }}
        />
      </label>
    </div>
  )
}
