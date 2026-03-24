import { useState, useEffect } from 'react'
import { GeneralTab } from './components/tabs/GeneralTab'
import { AboutTab } from './components/tabs/AboutTab'
import { UnifiedTab } from './components/unified/UnifiedTab'
import { SettingsProvider } from './context/SettingsContext'
import type { AppConfig, ThemePreference } from '@shared/config.types'

declare global {
  interface Window {
    settingsAPI: {
      getConfig: () => Promise<AppConfig>
      saveConfig: (payload: { config: AppConfig }) => Promise<void>
      onConfigUpdated: (cb: (config: AppConfig) => void) => void
      pickExe: () => Promise<string | null>
      pickIcon: () => Promise<string | null>
    }
  }
}

type Tab = 'general' | 'configure' | 'about'

function applyTheme(pref: ThemePreference): void {
  const resolved =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.dataset.theme = resolved
}

export function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('configure')
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    window.settingsAPI.getConfig().then((cfg) => {
      setConfig(cfg)
      applyTheme(cfg.theme ?? 'dark')
    })
    window.settingsAPI.onConfigUpdated((cfg) => {
      setConfig(cfg)
      applyTheme(cfg.theme ?? 'dark')
    })
  }, [])

  // Follow OS appearance when theme is 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (config?.theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [config?.theme])

  const handleSave = async (updated: AppConfig) => {
    setConfig(updated)
    applyTheme(updated.theme ?? 'dark')
    await window.settingsAPI.saveConfig({ config: updated })
  }

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--c-surface)', color: 'var(--c-text)' }}>
        Loading...
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'configure', label: 'Configure' },
    { id: 'about', label: 'About' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif' }}>
      {/* Title bar */}
      <div
        style={{
          height: 40,
          background: 'var(--c-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          WebkitAppRegion: 'drag' as 'drag',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: 'var(--c-accent)' }}>
          ACTIONRING
        </span>
        <button
          onClick={() => window.close()}
          style={{
            background: 'none', border: 'none',
            color: 'var(--c-text-muted)',
            cursor: 'pointer', fontSize: 18,
            WebkitAppRegion: 'no-drag' as 'no-drag',
            lineHeight: 1,
          }}
        >×</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border-sub)', flexShrink: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid var(--c-accent)` : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--c-text)' : 'var(--c-text-muted)',
              cursor: 'pointer', fontSize: 13,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <SettingsProvider config={config} onSave={handleSave}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTab === 'general' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
              <GeneralTab config={config} onSave={handleSave} />
            </div>
          )}
          {activeTab === 'configure' && <UnifiedTab />}
          {activeTab === 'about' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
              <AboutTab />
            </div>
          )}
        </div>
      </SettingsProvider>
    </div>
  )
}
