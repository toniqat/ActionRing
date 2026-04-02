import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useT } from '../../i18n/I18nContext'
import { UIIcon } from '@shared/UIIcon'
import type { RunningProcess } from '@shared/ipc.types'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconWindow(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M2 7h20" />
      <circle cx="6" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconFolder(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

function IconImport(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
    </svg>
  )
}

function IconBack(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconSpinner(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <g>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.4" />
        <path d="M12 2v4" />
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </g>
    </svg>
  )
}

// ── Process icon ──────────────────────────────────────────────────────────────

function ProcessIcon({ proc, size = 32 }: { proc: RunningProcess; size?: number }): JSX.Element {
  if (proc.iconDataUrl) {
    return (
      <img
        src={proc.iconDataUrl}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4 }}
      />
    )
  }
  // Initials fallback
  const initial = proc.displayName.charAt(0).toUpperCase()
  let hue = 0
  for (let i = 0; i < proc.displayName.length; i++) {
    hue = (hue * 31 + proc.displayName.charCodeAt(i)) & 0xffff
  }
  hue = hue % 360
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 6,
        background: `hsl(${hue}, 50%, 38%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 700, color: '#fff',
        userSelect: 'none', flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

// ── Menu Screen ───────────────────────────────────────────────────────────────

function MenuButton({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: JSX.Element
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '14px 16px',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 10, cursor: disabled ? 'wait' : 'pointer',
        textAlign: 'left', fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--c-accent-bg)'
          e.currentTarget.style.borderColor = 'var(--c-accent-border)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--c-surface)'
        e.currentTarget.style.borderColor = 'var(--c-border)'
      }}
    >
      <div style={{ color: 'var(--c-accent)', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>{description}</div>
      </div>
    </button>
  )
}

function MenuScreen({
  onFetchProcesses,
  onBrowse,
  onImport,
  browsing,
  importing,
}: {
  onFetchProcesses: () => void
  onBrowse: () => void
  onImport: () => void
  browsing: boolean
  importing: boolean
}): JSX.Element {
  const t = useT()
  return (
    <div style={{ padding: '28px 24px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>
          {t('addapp.title')}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--c-text-dim)' }}>
          {t('addapp.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MenuButton
          icon={<IconWindow />}
          title={t('addapp.fromRunning')}
          description={t('addapp.fromRunningDesc')}
          onClick={onFetchProcesses}
        />
        <MenuButton
          icon={browsing ? <IconSpinner /> : <IconFolder />}
          title={t('addapp.browse')}
          description={t('addapp.browseDesc')}
          onClick={onBrowse}
          disabled={browsing}
        />
        <MenuButton
          icon={importing ? <IconSpinner /> : <IconImport />}
          title={t('addapp.import')}
          description={t('addapp.importDesc')}
          onClick={onImport}
          disabled={importing}
        />
      </div>
    </div>
  )
}

// ── Processes Screen ──────────────────────────────────────────────────────────

function ProcessesScreen({
  processes,
  loading,
  existingExeNames,
  onSelect,
  onBack,
}: {
  processes: RunningProcess[] | null
  loading: boolean
  existingExeNames: Set<string>
  onSelect: (proc: RunningProcess) => void
  onBack: () => void
}): JSX.Element {
  const t = useT()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--c-border-sub)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            background: 'none', border: 'none',
            color: 'var(--c-text-muted)', cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
          title={t('addapp.back')}
        >
          <IconBack />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>
          {t('addapp.runningApps')}
        </span>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--c-text-dim)', gap: 10 }}>
            <IconSpinner />
            <span style={{ fontSize: 12 }}>{t('addapp.scanning')}</span>
          </div>
        )}

        {!loading && processes !== null && processes.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-dim)', fontSize: 12 }}>
            {t('addapp.noWindows')}
          </div>
        )}

        {!loading && processes !== null && processes.length > 0 && (
          <div style={{ padding: '6px 8px' }}>
            {processes.map((proc) => {
              const alreadyAdded = existingExeNames.has(proc.exeName.toLowerCase())
              return (
                <button
                  key={proc.exeName}
                  onClick={() => { if (!alreadyAdded) onSelect(proc) }}
                  disabled={alreadyAdded}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '7px 8px',
                    background: 'none', border: 'none',
                    borderRadius: 7, cursor: alreadyAdded ? 'default' : 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                    opacity: alreadyAdded ? 0.45 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!alreadyAdded) e.currentTarget.style.background = 'var(--c-surface)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  <ProcessIcon proc={proc} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proc.displayName}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--c-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proc.exeName}
                    </div>
                  </div>
                  {alreadyAdded && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: 'var(--c-border)', color: 'var(--c-text-dim)',
                      fontWeight: 600, textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      {t('addapp.added')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Overlay ──────────────────────────────────────────────────────────────

type Screen = 'menu' | 'processes'

interface AddAppOverlayProps {
  /** Lowercase exeNames of apps already in the profile list */
  existingExeNames: Set<string>
  onAdd: (exeName: string, displayName: string, iconDataUrl?: string) => void
  /** Called when import succeeded (config already updated by main process) */
  onImported: (appId: string, profileId: string) => void
  onClose: () => void
}

export function AddAppOverlay({
  existingExeNames,
  onAdd,
  onImported,
  onClose,
}: AddAppOverlayProps): JSX.Element {
  const t = useT()
  const [screen, setScreen] = useState<Screen>('menu')
  const [processes, setProcesses] = useState<RunningProcess[] | null>(null)
  const [loadingProcesses, setLoadingProcesses] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFetchProcesses = useCallback(async () => {
    setLoadingProcesses(true)
    setScreen('processes')
    const procs = await window.settingsAPI.getRunningProcesses()
    setProcesses(procs)
    setLoadingProcesses(false)
  }, [])

  const handleBrowse = useCallback(async () => {
    if (browsing) return
    setBrowsing(true)
    const exePath = await window.settingsAPI.pickExe()
    if (exePath) {
      const parts = exePath.replace(/\\/g, '/').split('/')
      const file = parts[parts.length - 1]
      const displayName = file.replace(/\.exe$/i, '')
      const iconDataUrl = await window.settingsAPI.getAppIcon(exePath) ?? undefined
      onAdd(file, displayName, iconDataUrl)
    }
    setBrowsing(false)
    // If cancelled, stay open (user can try another option)
  }, [browsing, onAdd])

  const handleImport = useCallback(async () => {
    if (importing) return
    setImporting(true)
    const entry = await window.settingsAPI.importAppProfile()
    setImporting(false)
    if (entry) {
      onImported(entry.id, entry.activeProfileId)
    }
    // If cancelled, stay open
  }, [importing, onImported])

  const handleSelectProcess = useCallback((proc: RunningProcess) => {
    onAdd(proc.exeName, proc.displayName, proc.iconDataUrl)
  }, [onAdd])

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.62)',
        backdropFilter: 'blur(2px)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => {
        // Close when clicking the backdrop (not the container)
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose()
        }
      }}
    >
      {/* Close button — top-right corner of the backdrop */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 14, right: 16,
          width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.4)', fontSize: 18,
          cursor: 'pointer', borderRadius: 6,
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
          e.currentTarget.style.background = 'none'
        }}
        title={t('addapp.close')}
      >
        <UIIcon name="close" size={16} />
      </button>

      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{
          width: screen === 'menu' ? 380 : 440,
          background: 'var(--c-elevated)',
          border: '1px solid var(--c-border)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}
      >
        {screen === 'menu' ? (
          <MenuScreen
            onFetchProcesses={handleFetchProcesses}
            onBrowse={handleBrowse}
            onImport={handleImport}
            browsing={browsing}
            importing={importing}
          />
        ) : (
          <ProcessesScreen
            processes={processes}
            loading={loadingProcesses}
            existingExeNames={existingExeNames}
            onSelect={handleSelectProcess}
            onBack={() => setScreen('menu')}
          />
        )}
      </motion.div>
    </div>
  )
}
