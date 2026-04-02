import { useState, useEffect } from 'react'
import type { ProgressState, SequenceProgress } from '@shared/ipc.types'

declare global {
  interface Window {
    progressAPI: {
      onUpdate: (callback: (state: ProgressState) => void) => void
    }
  }
}

export function ProgressOverlay(): JSX.Element {
  const [sequences, setSequences] = useState<SequenceProgress[]>([])

  useEffect(() => {
    window.progressAPI.onUpdate((state) => {
      setSequences(state.sequences)
    })
  }, [])

  if (sequences.length === 0) return <></>

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      width: '100%',
      height: '100%',
      padding: 8,
      gap: 4,
    }}>
      {sequences.map((seq) => (
        <div key={seq.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(12px)',
          borderRadius: 10,
          padding: '6px 14px',
          color: '#fff',
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minWidth: 140,
          maxWidth: 300,
        }}>
          <Spinner />
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontWeight: 500,
          }}>
            {seq.name || 'Sequence'}
          </span>
          <span style={{ opacity: 0.65, flexShrink: 0, fontSize: 11 }}>
            {seq.currentStep}/{seq.totalSteps}
          </span>
        </div>
      ))}
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#fff" strokeWidth="1.5"
        strokeDasharray="12 22" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate"
          from="0 7 7" to="360 7 7" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
