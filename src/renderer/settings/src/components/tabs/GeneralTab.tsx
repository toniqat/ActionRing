import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppConfig, ModifierKey, ThemePreference, Language } from '@shared/config.types'
import { useT } from '../../i18n/I18nContext'
import { LANGUAGES } from '../../i18n/locales'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
}

// ── Key → modifier mapping ────────────────────────────────────────────────────

const KEY_TO_MODIFIER: Record<string, ModifierKey> = {
  Ctrl: 'ctrl', Alt: 'alt', Shift: 'shift', Win: 'meta',
}

function parseModifiersFromKeys(keys: string): ModifierKey[] {
  if (!keys) return []
  return keys
    .split('+')
    .map((k) => KEY_TO_MODIFIER[k])
    .filter((m): m is ModifierKey => m !== undefined)
}

function modifiersToDisplayKeys(modifiers: ModifierKey[]): string {
  const MAP: Record<ModifierKey, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' }
  return modifiers.map((m) => MAP[m]).join('+')
}

/** Build a display-format key combo from a DOM KeyboardEvent. */
function buildKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey)  parts.push('Win')
  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    if (key === ' ')         parts.push('Space')
    else if (key.length === 1) parts.push(key.toUpperCase())
    else                     parts.push(key)
  }
  return parts.join('+')
}

// ── TriggerKeyRecorder ────────────────────────────────────────────────────────

interface TriggerKeyRecorderProps {
  triggerKeys: string
  onChange: (keys: string) => void
}

function TriggerKeyRecorder({ triggerKeys, onChange }: TriggerKeyRecorderProps): JSX.Element {
  const t = useT()
  const [recording, setRecording] = useState(false)
  const pendingRef = useRef<string>(triggerKeys)
  const [pendingDisplay, setPendingDisplay] = useState(triggerKeys)

  const stopRecording = useCallback((save: boolean) => {
    setRecording(false)
    if (save && pendingRef.current) {
      onChange(pendingRef.current)
    }
  }, [onChange])

  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip events fired during IME composition (e.g. Korean/Chinese input)
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        pendingRef.current = triggerKeys
        setPendingDisplay(triggerKeys)
        stopRecording(false)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const combo = buildKeyCombo(e)
      if (combo) {
        pendingRef.current = combo
        setPendingDisplay(combo)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [recording, triggerKeys, stopRecording])

  const handleClick = (e: React.MouseEvent) => {
    // Ignore keyboard-triggered clicks (Enter/Space) so they don't stop recording
    if (e.detail === 0) return
    if (recording) {
      stopRecording(true)
    } else {
      pendingRef.current = triggerKeys
      setPendingDisplay(triggerKeys)
      setRecording(true)
    }
  }

  const displayText = recording
    ? (pendingDisplay || t('recorder.pressKeys'))
    : (triggerKeys || t('recorder.none'))

  return (
    <>
      <style>{`
        @keyframes trigger-key-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }
      `}</style>
      <button
        type="button"
        onClick={handleClick}
        title={recording ? t('recorder.clickToSave') : t('recorder.clickToRecord')}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: `1.5px solid ${recording ? '#ef4444' : 'var(--c-border)'}`,
          background: recording ? 'rgba(239,68,68,0.08)' : 'var(--c-elevated)',
          color: recording ? '#ef4444' : 'var(--c-text)',
          fontSize: 13,
          fontFamily: 'monospace, inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s, background 0.15s, color 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          animation: recording ? 'trigger-key-pulse 1.2s ease-in-out infinite' : 'none',
        }}
      >
        <span style={{ fontSize: 9, lineHeight: 1, flexShrink: 0 }}>
          {recording ? '●' : '○'}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recording ? `${t('recorder.recording')} ${pendingDisplay}` : displayText}
        </span>
        {recording && (
          <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.6)', flexShrink: 0 }}>
            {t('recorder.clickToSaveHint')}
          </span>
        )}
      </button>
    </>
  )
}

// ── MouseCaptureButton ────────────────────────────────────────────────────────

interface MouseCaptureButtonProps {
  button: number
  onCapture: (button: number) => void
}

function MouseCaptureButton({ button, onCapture }: MouseCaptureButtonProps): JSX.Element {
  const t = useT()
  const [listening, setListening] = useState(false)

  useEffect(() => {
    return () => {
      if (listening) window.settingsAPI.cancelMouseCapture()
    }
  }, [listening])

  const handleClick = useCallback(() => {
    if (listening) return
    setListening(true)
    window.settingsAPI.startMouseCapture((capturedButton) => {
      onCapture(capturedButton)
      setListening(false)
    })
  }, [listening, onCapture])

  const mouseLabels: Record<number, string> = {
    1: t('mouse.1'), 2: t('mouse.2'), 3: t('mouse.3'), 4: t('mouse.4'), 5: t('mouse.5'),
  }
  const label = mouseLabels[button] ?? `${t('mouse.n')} ${button}`

  return (
    <button
      onClick={handleClick}
      disabled={listening}
      title={listening ? t('recorder.listenMsg') : t('recorder.clickToChangeHint')}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: `1.5px solid ${listening ? '#ef4444' : 'var(--c-border)'}`,
        background: listening ? 'rgba(239,68,68,0.08)' : 'var(--c-elevated)',
        color: listening ? '#ef4444' : 'var(--c-text)',
        fontSize: 13,
        fontFamily: 'inherit',
        cursor: listening ? 'default' : 'pointer',
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s, color 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        animation: listening ? 'pulse-capture 1.2s ease-in-out infinite' : 'none',
      }}
    >
      <span style={{ fontSize: 9, lineHeight: 1 }}>
        {listening ? '●' : '○'}
      </span>
      <span>{listening ? t('recorder.listening') : label}</span>
    </button>
  )
}

// ── GeneralTab ────────────────────────────────────────────────────────────────

type DataStatus = 'success' | 'error' | null

export function GeneralTab({ config, onSave }: Props): JSX.Element {
  const t = useT()
  const [exportStatus, setExportStatus] = useState<DataStatus>(null)
  const [importStatus, setImportStatus] = useState<DataStatus>(null)
  const [resetStatus, setResetStatus] = useState<DataStatus>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  function showToast(setter: (v: DataStatus) => void, value: 'success' | 'error'): void {
    setter(value)
    setTimeout(() => setter(null), 3000)
  }
  const { modifiers, button, triggerKeys } = config.trigger

  // Derive display string: prefer stored triggerKeys, fall back to modifiers array
  const currentTriggerKeys = triggerKeys ?? modifiersToDisplayKeys(modifiers)

  const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
    { value: 'dark',   label: t('general.dark'),   description: t('general.darkDesc') },
    { value: 'light',  label: t('general.light'),  description: t('general.lightDesc') },
    { value: 'system', label: t('general.system'), description: t('general.systemDesc') },
  ]

  function setTriggerKeys(keys: string): void {
    onSave({
      ...config,
      trigger: {
        ...config.trigger,
        triggerKeys: keys,
        modifiers: parseModifiersFromKeys(keys),
      },
    })
  }

  function setButton(value: number): void {
    onSave({ ...config, trigger: { ...config.trigger, button: value } })
  }

  function setTheme(theme: ThemePreference): void {
    onSave({ ...config, theme })
  }

  function setLanguage(language: Language): void {
    onSave({ ...config, language })
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-semibold text-[var(--c-text)]">{t('general.title')}</h2>

      {/* ── Pulse animation for mouse capture button ── */}
      <style>{`
        @keyframes pulse-capture {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }
      `}</style>

      {/* Theme */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-muted)]">
          {t('general.theme')}
        </span>
        <div className="flex items-center gap-0.5 p-1 rounded-full border border-[var(--c-border)] bg-[var(--c-btn-bg)]">
          {THEME_OPTIONS.map(({ value, label, description }) => {
            const active = (config.theme ?? 'dark') === value
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={description}
                className={[
                  'px-4 py-1 rounded-full text-[13px] transition-all duration-150 cursor-pointer',
                  active
                    ? 'bg-[var(--c-accent-bg)] border border-[var(--c-accent-border)] text-[var(--c-accent-text)] font-semibold'
                    : 'border border-transparent text-[var(--c-text-muted)] font-normal hover:text-[var(--c-text)]'
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Language */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-muted)]">
          {t('general.language')}
        </span>
        <select
          value={config.language ?? 'en'}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1.5px solid var(--c-border)',
            background: 'var(--c-elevated)',
            color: 'var(--c-text)',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {LANGUAGES.map(({ value, nativeLabel }) => (
            <option key={value} value={value}>{nativeLabel}</option>
          ))}
        </select>
      </div>

      {/* ── Trigger Configuration ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-muted)] shrink-0">
            {t('general.trigger')}
          </span>
          <div className="flex items-center gap-2" style={{ marginLeft: 48 }}>
            <div style={{ width: 152 }}>
              <TriggerKeyRecorder triggerKeys={currentTriggerKeys} onChange={setTriggerKeys} />
            </div>
            <div style={{ width: 132 }}>
              <MouseCaptureButton button={button} onCapture={setButton} />
            </div>
          </div>
        </div>

        {button === 1 && (
          <p className="text-[12px] text-[var(--c-warning)]">
            {t('general.leftClickWarning')}
          </p>
        )}
      </div>

      {/* Start on Login */}
      <label className="flex items-center gap-3 w-fit cursor-pointer select-none">
        <input
          type="checkbox"
          checked={config.startOnLogin}
          onChange={(e) => onSave({ ...config, startOnLogin: e.target.checked })}
          className="w-[18px] h-[18px] cursor-pointer accent-[var(--c-accent)]"
        />
        <span className="text-[14px] text-[var(--c-text)]">{t('general.startOnLogin')}</span>
      </label>

      {/* ── Data Management ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-8">
          <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-muted)] shrink-0">
            {t('general.dataManagement')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const ok = await window.settingsAPI.exportAllData()
                  if (ok) showToast(setExportStatus, 'success')
                  // ok === false means user canceled the dialog — no notification needed
                } catch {
                  showToast(setExportStatus, 'error')
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid var(--c-border)',
                background: 'var(--c-elevated)',
                color: 'var(--c-text)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {t('general.exportAllData')}
            </button>

            <button
              onClick={async () => {
                try {
                  const ok = await window.settingsAPI.importAllData()
                  if (ok) showToast(setImportStatus, 'success')
                  // ok === false means user canceled the dialog — no notification needed
                } catch {
                  showToast(setImportStatus, 'error')
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid var(--c-border)',
                background: 'var(--c-elevated)',
                color: 'var(--c-text)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {t('general.importAllData')}
            </button>

            <button
              onClick={() => setShowResetConfirm(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid var(--c-danger, #ef4444)',
                background: 'rgba(239,68,68,0.06)',
                color: 'var(--c-danger, #ef4444)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {t('general.resetSettings')}
            </button>
          </div>
        </div>

        {(exportStatus || importStatus || resetStatus) && (
          <p
            style={{
              fontSize: 12,
              color: (exportStatus === 'success' || importStatus === 'success' || resetStatus === 'success')
                ? 'var(--c-success, #22c55e)'
                : 'var(--c-danger, #ef4444)',
              margin: 0,
              textAlign: 'right',
            }}
          >
            {resetStatus === 'success'
              ? t('general.resetSuccess')
              : exportStatus === 'success'
              ? t('general.exportSuccess')
              : exportStatus === 'error'
              ? t('general.exportFailed')
              : importStatus === 'success'
              ? t('general.importSuccess')
              : t('general.importFailed')}
          </p>
        )}
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false) }}
        >
          <div
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 400,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>
                {t('general.resetConfirmTitle')}
              </span>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
                {t('general.resetConfirmMessage')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: '1.5px solid var(--c-border)',
                  background: 'var(--c-elevated)',
                  color: 'var(--c-text)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {t('modal.cancel')}
              </button>
              <button
                onClick={async () => {
                  setResetting(true)
                  try {
                    await window.settingsAPI.resetConfig()
                    setShowResetConfirm(false)
                    showToast(setResetStatus, 'success')
                  } catch {
                    setShowResetConfirm(false)
                    showToast(setResetStatus, 'error')
                  } finally {
                    setResetting(false)
                  }
                }}
                disabled={resetting}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: '1.5px solid var(--c-danger, #ef4444)',
                  background: 'rgba(239,68,68,0.12)',
                  color: 'var(--c-danger, #ef4444)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: resetting ? 'default' : 'pointer',
                  fontWeight: 600,
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {t('general.resetConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
