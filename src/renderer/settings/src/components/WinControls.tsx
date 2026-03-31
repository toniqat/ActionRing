import { useState } from 'react'
import { useT } from '../i18n/I18nContext'

interface Props {
  onMinimize: () => void
  onMaximize?: () => void
  onClose: () => void
  isMaximized?: boolean
}

type BtnId = 'min' | 'max' | 'close'

const BASE = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: 46,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  outline: 'none',
  padding: 0,
  color: 'var(--c-text-muted)',
  transition: 'background 0.1s, color 0.1s',
  WebkitAppRegion: 'no-drag',
} as React.CSSProperties

export function WinControls({ onMinimize, onMaximize, onClose, isMaximized = false }: Props): JSX.Element {
  const t = useT()
  const [hovered, setHovered] = useState<BtnId | null>(null)

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {/* Minimize */}
      <button
        onClick={onMinimize}
        title={t('win.minimize')}
        onMouseEnter={() => setHovered('min')}
        onMouseLeave={() => setHovered(null)}
        style={{ ...BASE, background: hovered === 'min' ? 'rgba(128,128,128,0.15)' : 'transparent' }}
      >
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
          <path d="M0 1h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      {onMaximize && (
        <button
          onClick={onMaximize}
          title={isMaximized ? t('win.restore') : t('win.maximize')}
          onMouseEnter={() => setHovered('max')}
          onMouseLeave={() => setHovered(null)}
          style={{ ...BASE, background: hovered === 'max' ? 'rgba(128,128,128,0.15)' : 'transparent' }}
        >
          {isMaximized ? (
            /* Restore: two overlapping squares */
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="2.75" y="0.75" width="7.5" height="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M0.75 2.75v7.5h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
          ) : (
            /* Maximize: single square */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.75" y="0.75" width="8.5" height="8.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        title={t('win.close')}
        onMouseEnter={() => setHovered('close')}
        onMouseLeave={() => setHovered(null)}
        style={{
          ...BASE,
          background: hovered === 'close' ? '#c42b1c' : 'transparent',
          color: hovered === 'close' ? '#ffffff' : 'var(--c-text-muted)',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M0.75 0.75l8.5 8.5M9.25 0.75l-8.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
