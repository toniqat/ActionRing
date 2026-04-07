import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/ipc.types'

const REPO_URL = 'https://github.com/toniqat/ActionRing'

// ── GitHub logo SVG ───────────────────────────────────────────────────────────
function GitHubIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 438.549 438.549"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path d="M409.132,114.573c-19.608-33.596-46.205-60.194-79.798-79.8C295.736,15.166,259.057,5.365,219.271,5.365
        c-39.781,0-76.472,9.804-110.063,29.408c-33.596,19.605-60.192,46.204-79.8,79.8C9.803,148.168,0,184.854,0,224.63
        c0,47.78,13.94,90.745,41.827,128.906c27.884,38.164,63.906,64.572,108.063,79.227c5.14,0.954,8.945,0.283,11.419-1.996
        c2.475-2.282,3.711-5.14,3.711-8.562c0-0.571-0.049-5.708-0.144-15.417c-0.098-9.709-0.144-18.179-0.144-25.406l-6.567,1.136
        c-4.187,0.767-9.469,1.092-15.846,1c-6.374-0.089-12.991-0.757-19.842-1.999c-6.854-1.231-13.229-4.086-19.13-8.559
        c-5.898-4.473-10.085-10.328-12.56-17.556l-2.855-6.57c-1.903-4.374-4.899-9.233-8.992-14.559
        c-4.093-5.331-8.232-8.945-12.419-10.848l-1.999-1.431c-1.332-0.951-2.568-2.098-3.711-3.429
        c-1.142-1.331-1.997-2.663-2.568-3.997c-0.572-1.335-0.098-2.43,1.427-3.289c1.525-0.859,4.281-1.276,8.28-1.276
        l5.708,0.853c3.807,0.763,8.516,3.042,14.133,6.851c5.614,3.806,10.229,8.754,13.846,14.842
        c4.38,7.806,9.657,13.754,15.846,17.847c6.184,4.093,12.419,6.136,18.699,6.136c6.28,0,11.704-0.476,16.274-1.423
        c4.565-0.952,8.848-2.383,12.847-4.285c1.713-12.758,6.377-22.559,13.988-29.41c-10.848-1.14-20.601-2.857-29.264-5.14
        c-8.658-2.286-17.605-5.996-26.835-11.14c-9.235-5.137-16.896-11.516-22.985-19.126c-6.09-7.614-11.088-17.61-14.987-29.979
        c-3.901-12.374-5.852-26.648-5.852-42.826c0-23.035,7.52-42.637,22.557-58.817c-7.044-17.318-6.379-36.732,1.997-58.24
        c5.52-1.715,13.706-0.428,24.554,3.853c10.85,4.283,18.794,7.952,23.84,10.994c5.046,3.041,9.089,5.618,12.135,7.708
        c17.705-4.947,35.976-7.421,54.818-7.421s37.117,2.474,54.823,7.421l10.849-6.849c7.419-4.57,16.18-8.758,26.262-12.565
        c10.088-3.805,17.802-4.853,23.134-3.138c8.562,21.509,9.325,40.922,2.279,58.24c15.036,16.18,22.559,35.787,22.559,58.817
        c0,16.178-1.958,30.497-5.853,42.966c-3.9,12.471-8.941,22.457-15.125,29.979c-6.191,7.521-13.901,13.85-23.131,18.986
        c-9.232,5.14-18.182,8.85-26.84,11.136c-8.662,2.286-18.415,4.004-29.263,5.146c9.894,8.562,14.842,22.077,14.842,40.539
        v60.237c0,3.422,1.19,6.279,3.572,8.562c2.379,2.279,6.136,2.95,11.276,1.995
        c44.163-14.653,80.185-41.062,108.068-79.226c27.88-38.161,41.825-81.126,41.825-128.906
        C438.536,184.851,428.728,148.168,409.132,114.573z"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function AboutTab(): JSX.Element {
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    window.settingsAPI.checkForUpdates().then((s) => {
      if (s.currentVersion) setCurrentVersion(s.currentVersion)
    }).catch(() => {})
  }, [])

  const handleCheckLatest = (): void => {
    setStatus({ state: 'checking' })
    window.settingsAPI.checkForUpdates().then((s) => {
      setStatus(s)
      if (s.currentVersion) setCurrentVersion(s.currentVersion)
    }).catch(() => {
      setStatus({ state: 'error', error: 'Network error' })
    })
  }

  const handleOpenRepo = (): void => {
    window.settingsAPI.openExternalUrl(REPO_URL)
  }

  const handleOpenRelease = (): void => {
    window.settingsAPI.openExternalUrl(`${REPO_URL}/releases/latest`)
  }

  return (
    <>
      <style>{`@keyframes ar-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        padding: '32px 24px',
      }}>
        {/* App logo */}
        <svg width="80" height="80" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="aboutIconGrad" x1="48.804039" y1="48.804039" x2="207.19595" y2="207.19595" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f64161" />
              <stop offset="1" stopColor="#934161" />
            </linearGradient>
          </defs>
          <circle cx="128" cy="128" r="90" fill="none" stroke="url(#aboutIconGrad)" strokeWidth="48" strokeLinecap="round" />
        </svg>

        {/* App name */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', letterSpacing: 2, margin: 0 }}>
          ACTIONRING
        </h1>

        {/* Current version */}
        {currentVersion && (
          <p style={{ fontSize: 13, color: 'var(--c-text-dim)', margin: 0 }}>
            Version {currentVersion}
          </p>
        )}

        {/* Check latest version */}
        {status.state === 'idle' && (
          <button
            onClick={handleCheckLatest}
            style={{
              fontSize: 12,
              color: 'var(--c-text-dim)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--c-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-dim)' }}
          >
            Check for latest version
          </button>
        )}

        {status.state === 'checking' && (
          <p style={{ fontSize: 12, color: 'var(--c-text-dim)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              border: '2px solid var(--c-text-dim)', borderTopColor: 'transparent',
              animation: 'ar-spin 0.8s linear infinite',
            }} />
            Checking…
          </p>
        )}

        {status.state === 'up-to-date' && (
          <p style={{ fontSize: 12, color: 'var(--c-text-dim)', margin: 0 }}>
            You are on the latest version.
          </p>
        )}

        {status.state === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: 12, color: 'var(--c-text-dim)', margin: 0 }}>
              New version available:{' '}
              <strong
                style={{ color: '#f64161', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={handleOpenRelease}
                title="Open release page"
              >
                {status.latestVersion}
              </strong>
            </p>
          </div>
        )}

        {status.state === 'error' && (
          <p style={{ fontSize: 12, color: '#f64161', margin: 0, textAlign: 'center', maxWidth: 260 }}>
            Failed to check for updates.
          </p>
        )}

        {/* GitHub button */}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={handleOpenRepo}
            title="View on GitHub"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              fontSize: 13,
              color: 'var(--c-text-dim)',
              background: 'transparent',
              border: '1px solid rgba(128,128,128,0.25)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--c-text)'
              e.currentTarget.style.borderColor = 'rgba(128,128,128,0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--c-text-dim)'
              e.currentTarget.style.borderColor = 'rgba(128,128,128,0.25)'
            }}
          >
            <GitHubIcon size={16} />
            View on GitHub
          </button>
        </div>
      </div>
    </>
  )
}
