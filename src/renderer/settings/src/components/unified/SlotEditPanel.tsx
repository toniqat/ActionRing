import React, { useState, useCallback, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { BUILTIN_ICONS } from '@shared/icons'
import { ShortcutsModal } from './ShortcutsModal'
import { useT } from '../../i18n/I18nContext'
import type { SlotConfig, ActionConfig, SystemActionId } from '@shared/config.types'
import type { Translations } from '../../i18n/locales'

const NODE_STYLE_BASE: Record<string, { icon: string; color: string }> = {
  launch:   { icon: '🚀', color: '#3b82f6' },
  shortcut: { icon: '⌨️', color: '#8b5cf6' },
  shell:    { icon: '💻', color: '#10b981' },
  system:   { icon: '⚙️', color: '#f59e0b' },
}

function actionSummary(
  action: ActionConfig,
  t: (key: keyof Translations) => string,
): string {
  if (action.type === 'launch') return action.target || 'No path set'
  if (action.type === 'shortcut') return action.keys || 'No key combo set'
  if (action.type === 'shell') return action.command || 'No command set'
  if (action.type === 'system') {
    const key = `system.${action.action}` as keyof Translations
    return t(key) ?? action.action
  }
  return ''
}

export function SlotEditPanel({ width = 288 }: { width?: number }): JSX.Element {
  const t = useT()
  const {
    draft, updateDraft,
    selectedSlotIndex,
    editingFolderIndex, setEditingFolderIndex,
    selectedSubSlotIndex, setSelectedSubSlotIndex,
  } = useSettings()
  const { slots } = draft

  const actionLabels: Record<string, string> = {
    launch: t('action.launch'),
    shortcut: t('action.shortcut'),
    shell: t('action.shell'),
    system: t('action.system'),
  }

  const [showShortcutsModal, setShowShortcutsModal] = useState(false)

  const isEditingSubSlot = editingFolderIndex !== null && selectedSubSlotIndex !== null
  const isEditingPrimarySlot = !isEditingSubSlot && selectedSlotIndex !== null

  const slot: SlotConfig | undefined = isEditingSubSlot
    ? slots[editingFolderIndex!]?.subSlots?.[selectedSubSlotIndex!]
    : isEditingPrimarySlot
      ? slots[selectedSlotIndex!]
      : undefined

  // Close the shortcuts modal if the selected slot disappears (e.g. profile switch)
  useEffect(() => {
    if (!slot) setShowShortcutsModal(false)
  }, [slot])

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

  const openAppearanceEditor = useCallback(() => {
    if (!slot) return
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    window.settingsAPI.openAppearanceEditor({
      slot,
      slotIndex: isEditingSubSlot ? editingFolderIndex! : selectedSlotIndex!,
      isSubSlot: isEditingSubSlot,
      folderIndex: isEditingSubSlot ? editingFolderIndex : null,
      subSlotIndex: isEditingSubSlot ? selectedSubSlotIndex : null,
      theme,
    })
  }, [slot, isEditingSubSlot, editingFolderIndex, selectedSlotIndex, selectedSubSlotIndex])

  const isFolder = slot?.actions[0]?.type === 'folder'

  // Render the icon as SVG (builtin) or img (custom)
  const iconContent = slot?.iconIsCustom
    ? `<img src="file://${slot.icon}" style="width:18px;height:18px;object-fit:contain"/>`
    : (BUILTIN_ICONS.find((ic) => ic.name === slot?.icon)?.svg ?? '')

  return (
    <>
      <div
        style={{
          width,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* When slot is null (e.g. during profile-switch exit animation) render nothing */}
        {slot && <>
        {/* ─── Integrated name + icon row ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--c-border-sub)',
            flexShrink: 0,
          }}
        >
          {/* Icon button — opens Edit Appearance */}
          <button
            onClick={openAppearanceEditor}
            title={t('slot.editAppearance')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: slot.bgColor ?? 'var(--c-elevated)',
              border: '1px solid var(--c-border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'border-color 0.15s',
              padding: 0,
              color: slot.iconColor ?? 'var(--c-text)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-accent)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-border)' }}
            dangerouslySetInnerHTML={{ __html: iconContent }}
          />

          {/* Label input — always editable */}
          <input
            value={slot.label}
            onChange={(e) => updateSlot({ ...slot, label: e.target.value })}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              color: 'var(--c-text)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              outline: 'none',
              padding: '2px 0',
              minWidth: 0,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderBottomColor = 'var(--c-accent)' }}
            onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderBottomColor = 'transparent' }}
          />

          {/* Enabled toggle */}
          <input
            type="checkbox"
            checked={slot.enabled}
            onChange={(e) => updateSlot({ ...slot, enabled: e.target.checked })}
            title={slot.enabled ? 'Disable button' : 'Enable button'}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--c-accent)', flexShrink: 0 }}
          />
        </div>

        {/* ─── Body ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isFolder ? (
            /* ── Folder slot — sub-slot management ── */
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
              <div style={{ fontWeight: 600, color: 'var(--c-text)', marginBottom: 4 }}>{t('slot.folder')}</div>
              {editingFolderIndex !== null ? (
                <>
                  {(slot.subSlots?.length ?? 0) > 0
                    ? t('slot.subSlotsConfigured').replace('{n}', String(slot.subSlots!.length))
                    : t('slot.noSubSlots')}
                </>
              ) : (
                <>
                  {t('slot.clickFolderHint')}
                  {(slot.subSlots?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 6, color: 'var(--c-text-muted)' }}>
                      {t('slot.subSlotsCount').replace('{n}', String(slot.subSlots!.length))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setEditingFolderIndex(selectedSlotIndex)
                      setSelectedSubSlotIndex(null)
                    }}
                    style={{
                      marginTop: 10, width: '100%', padding: '7px 0',
                      borderRadius: 6, border: '1px solid var(--c-accent)',
                      background: 'none', cursor: 'pointer',
                      color: 'var(--c-accent)', fontSize: 12, fontFamily: 'inherit',
                    }}
                  >
                    {t('slot.editSubSlots')}
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ── Shortcuts section ── */
            <>
              {/* Section header + edit button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--c-text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('slot.shortcuts')}
                </span>
                <button
                  onClick={() => setShowShortcutsModal(true)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--c-border)',
                    borderRadius: 6,
                    color: 'var(--c-accent)',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: '3px 10px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--c-elevated)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  {t('slot.editShortcuts')}
                </button>
              </div>

              {/* Node preview list */}
              {slot.actions.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--c-text-dim)',
                    fontSize: 12,
                    padding: '16px 10px',
                    borderRadius: 8,
                    border: '1px dashed var(--c-border)',
                  }}
                >
                  {t('slot.noActions')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slot.actions.map((action, i) => {
                    const base = NODE_STYLE_BASE[action.type] ?? NODE_STYLE_BASE.shell
                    const label = actionLabels[action.type] ?? action.type
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: 'var(--c-elevated)',
                          border: '1px solid var(--c-border)',
                          borderLeft: `3px solid ${base.color}`,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{base.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: base.color }}>{label}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--c-text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {actionSummary(action, t)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {/* ─── Preset import / export ─── */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              onClick={async () => {
                const imported = await window.settingsAPI.importPreset()
                if (!imported) return
                updateSlot({ ...imported, id: slot.id })
              }}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6,
                border: '1px solid var(--c-border)',
                background: 'none', cursor: 'pointer',
                color: 'var(--c-text-muted)', fontSize: 11,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--c-accent)'
                e.currentTarget.style.color = 'var(--c-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--c-border)'
                e.currentTarget.style.color = 'var(--c-text-muted)'
              }}
            >
              {t('slot.importPreset')}
            </button>
            <button
              onClick={() => window.settingsAPI.exportPreset(slot)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6,
                border: '1px solid var(--c-border)',
                background: 'none', cursor: 'pointer',
                color: 'var(--c-text-muted)', fontSize: 11,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--c-accent)'
                e.currentTarget.style.color = 'var(--c-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--c-border)'
                e.currentTarget.style.color = 'var(--c-text-muted)'
              }}
            >
              {t('slot.exportPreset')}
            </button>
          </div>
        </div>
        </>}
      </div>

      {/* Shortcuts modal */}
      {showShortcutsModal && slot && (
        <ShortcutsModal
          actions={slot.actions}
          onSave={(newActions: ActionConfig[]) => {
            updateSlot({ ...slot, actions: newActions })
            setShowShortcutsModal(false)
          }}
          onClose={() => setShowShortcutsModal(false)}
        />
      )}
    </>
  )
}
