import type { AppConfig } from '@shared/config.types'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
}

export function AppearanceTab({ config, onSave }: Props): JSX.Element {
  const ap = config.appearance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
        Appearance
      </h2>

      {/* Opacity */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14 }}>Opacity</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{Math.round(ap.opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={40}
          max={100}
          value={Math.round(ap.opacity * 100)}
          onChange={(e) =>
            onSave({ ...config, appearance: { ...ap, opacity: parseInt(e.target.value) / 100 } })
          }
          style={{ width: '100%', accentColor: '#6060ff' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          <span>40%</span><span>100%</span>
        </div>
      </label>

      {/* Folder sub-ring radius */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14 }}>Folder Sub-Ring Radius</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{((ap.folderSubRadiusMultiplier ?? 2.0) * 10) / 10}×</span>
        </div>
        <input
          type="range"
          min={15}
          max={30}
          step={1}
          value={Math.round((ap.folderSubRadiusMultiplier ?? 2.0) * 10)}
          onChange={(e) =>
            onSave({ ...config, appearance: { ...ap, folderSubRadiusMultiplier: parseInt(e.target.value) / 10 } })
          }
          style={{ width: '100%', accentColor: '#6060ff' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          <span>1.5×</span><span>3.0×</span>
        </div>
      </label>

      {/* Animation Speed */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14 }}>Animation Speed</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['slow', 'normal', 'fast'] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => onSave({ ...config, appearance: { ...ap, animationSpeed: speed } })}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: ap.animationSpeed === speed ? '#4040aa' : '#2a2a3e',
                color: ap.animationSpeed === speed ? 'white' : 'rgba(255,255,255,0.5)',
                fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s ease'
              }}
            >
              {speed.charAt(0).toUpperCase() + speed.slice(1)}
            </button>
          ))}
        </div>
      </label>
    </div>
  )
}
