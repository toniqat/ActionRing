import { useState, useEffect, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { GeneralTab } from './components/tabs/GeneralTab'
import { AboutTab } from './components/tabs/AboutTab'
import { ShortcutsTab } from './components/tabs/ShortcutsTab'
import { UnifiedTab } from './components/unified/UnifiedTab'
import { SettingsProvider } from './context/SettingsContext'
import { WinControls } from './components/WinControls'
import { I18nProvider, useT } from './i18n/I18nContext'
import type { AppConfig, ThemePreference, AppEntry, AppProfile, SlotConfig, Language } from '@shared/config.types'
import type { AppearanceSlotData, RunningProcess, ShortcutsSlotData, UpdateStatus, ResourceIconEntry } from '@shared/ipc.types'

declare global {
  interface Window {
    settingsAPI: {
      getConfig: () => Promise<AppConfig>
      saveConfig: (payload: { config: AppConfig }) => Promise<void>
      onConfigUpdated: (cb: (config: AppConfig) => void) => void
      pickExe: () => Promise<string | null>
      pickIcon: () => Promise<string | null>
      openAppearanceEditor: (data: AppearanceSlotData) => Promise<void>
      onAppearanceUpdated: (cb: (data: AppearanceSlotData) => void) => void
      openShortcutsEditor: (data: ShortcutsSlotData) => Promise<void>
      onShortcutsUpdated: (cb: (data: ShortcutsSlotData) => void) => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      // App management
      addApp: (exeName: string, displayName: string, iconDataUrl?: string) => Promise<AppEntry>
      removeApp: (appId: string) => Promise<void>
      // Profile management within an app
      addProfileToApp: (appId: string, name: string) => Promise<AppProfile>
      removeProfileFromApp: (appId: string, profileId: string) => Promise<void>
      renameProfileInApp: (appId: string, profileId: string, name: string) => Promise<void>
      setActiveProfileForApp: (appId: string, profileId: string) => Promise<AppConfig>
      // App icon extraction
      getAppIcon: (exePath: string) => Promise<string | null>
      // Running process discovery
      getRunningProcesses: () => Promise<RunningProcess[]>
      // App profile import
      importAppProfile: () => Promise<AppEntry | null>
      // Preset import/export
      exportPreset: (slot: SlotConfig) => Promise<void>
      importPreset: () => Promise<SlotConfig | null>
      // Trigger mouse capture
      startMouseCapture: (cb: (button: number) => void) => void
      cancelMouseCapture: () => void
      // Extended profile operations
      duplicateProfileInApp: (appId: string, profileId: string) => Promise<AppProfile>
      exportProfile: (appId: string, profileId: string) => Promise<void>
      updateAppTarget: (appId: string, exeName: string, displayName: string, iconDataUrl?: string) => Promise<void>
      // App-level export/import
      exportAppProfiles: (appId: string) => Promise<void>
      importAppProfiles: (appId: string) => Promise<boolean>
      // Global backup / restore / reset
      resetConfig: () => Promise<AppConfig | null>
      exportAllData: () => Promise<boolean>
      importAllData: () => Promise<boolean>
      // Update check & install
      checkForUpdates: () => Promise<UpdateStatus>
      downloadUpdate: () => void
      installUpdate: () => void
      onUpdateStatus: (cb: (status: UpdateStatus) => void) => void
      // Shell utilities
      openExternalUrl: (url: string) => Promise<void>
      // SVG icon loading
      readSvgContent: (absPath: string) => Promise<string>
      // Resource icons
      getResourceIcons: () => Promise<ResourceIconEntry[]>
      addRecentIcon: (iconRef: string) => void
    }
  }
}

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState { error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ActionRing] Render error caught by boundary:', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRecover={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, onRecover }: { error: Error; onRecover: () => void }): JSX.Element {
  const t = useT()
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12, padding: 32,
        background: 'var(--c-surface)', color: 'var(--c-text)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-danger, #ef4444)' }}>
        {t('app.error')}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center', maxWidth: 320 }}>
        {error.message}
      </div>
      <button
        onClick={onRecover}
        style={{
          padding: '6px 16px', borderRadius: 6, border: '1px solid var(--c-border)',
          background: 'none', color: 'var(--c-accent)', fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {t('app.errorRecover')}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'configure' | 'shortcuts' | 'general' | 'about'

function applyTheme(pref: ThemePreference): void {
  const resolved =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.dataset.theme = resolved
}

function AppInner(): JSX.Element {
  const t = useT()
  const [activeTab, setActiveTab] = useState<Tab>('configure')
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)

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
        {t('app.loading')}
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'configure', label: t('tab.configure') },
    { id: 'shortcuts', label: t('tab.shortcuts') },
    { id: 'general', label: t('tab.general') },
    { id: 'about', label: t('tab.about') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Unified title + tab bar ── */}
      <div
        style={{
          height: 40,
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-border-sub)',
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
          WebkitAppRegion: 'drag' as 'drag',
        }}
      >
        {/* App icon — far left of the tab bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
            <defs>
              <linearGradient id="tabIconGrad" x1="48.804039" y1="48.804039" x2="207.19595" y2="207.19595" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#f64161" />
                <stop offset="1" stopColor="#934161" />
              </linearGradient>
            </defs>
            <circle cx="128" cy="128" r="96" fill="none" stroke="url(#tabIconGrad)" strokeWidth="38" strokeLinecap="round" />
          </svg>
        </div>

        {/* Tabs on the left */}
        <div style={{ display: 'flex', alignItems: 'stretch', WebkitAppRegion: 'no-drag' as 'no-drag' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0 20px',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid var(--c-accent)` : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--c-text)' : 'var(--c-text-muted)',
                cursor: 'pointer', fontSize: 13,
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                height: '100%',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drag region fills the space between tabs and window controls */}
        <div style={{ flex: 1 }} />

        {/* Window controls on the right */}
        <WinControls
          onMinimize={() => window.settingsAPI.minimizeWindow()}
          onMaximize={() => {
            window.settingsAPI.maximizeWindow()
            setIsMaximized((v) => !v)
          }}
          onClose={() => window.close()}
          isMaximized={isMaximized}
        />
      </div>

      {/* Tab content */}
      <SettingsProvider
        config={config}
        onSave={(c) => handleSave(c)}
      >
        <ErrorBoundary>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'general' && (
              <div style={{ height: '100%', overflowY: 'auto', background: 'var(--c-bg)', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 688, background: 'var(--c-surface)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', padding: 24, minHeight: '100%' }}>
                  <GeneralTab config={config} onSave={(c) => handleSave(c)} />
                </div>
              </div>
            )}
            {activeTab === 'configure' && <UnifiedTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
            {activeTab === 'about' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <AboutTab />
              </div>
            )}
          </div>
        </ErrorBoundary>
      </SettingsProvider>
    </div>
  )
}

export function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    window.settingsAPI.getConfig().then((cfg) => {
      if (cfg.language) setLanguage(cfg.language)
    })
    window.settingsAPI.onConfigUpdated((cfg) => {
      if (cfg.language) setLanguage(cfg.language)
    })
  }, [])

  return (
    <I18nProvider language={language}>
      <AppInner />
    </I18nProvider>
  )
}
