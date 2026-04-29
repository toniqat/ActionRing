import { useState, useEffect, useRef, Component } from 'react'
import type { ReactNode } from 'react'
import { AppearanceEditor } from '@settings/components/unified/AppearanceEditor'
import { WinControls } from '@settings/components/WinControls'
import { I18nProvider, useT } from '@settings/i18n/I18nContext'
import type { AppearanceSlotData, CustomIconEntry, ResourceIconEntry } from '@shared/ipc.types'
import type { SlotConfig } from '@shared/config.types'
import type { Language } from '@shared/config.types'

export class ErrorBoundary extends Component<
  { children: ReactNode; language?: Language },
  { error: Error | null; componentStack: string | null }
> {
  state: { error: Error | null; componentStack: string | null } = { error: null, componentStack: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ componentStack: info.componentStack ?? null })
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      const language = this.props.language ?? 'en'
      const label = language === 'ko' ? '렌더링 오류' : 'Render error'
      const btnStyle: React.CSSProperties = {
        padding: '5px 14px', borderRadius: 6, border: '1px solid #45475a',
        background: '#313244', color: '#cdd6f4', fontSize: 12,
        cursor: 'pointer', fontFamily: 'inherit', marginRight: 6,
      }
      return (
        <div style={{ padding: 24, color: 'var(--c-danger, #ff6060)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', overflowY: 'auto', height: '100vh', background: 'var(--c-surface, #21262d)' }}>
          <strong>{label}</strong>{'\n\n'}{err.message}{'\n\n'}{err.stack}
          <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
            <button style={btnStyle} onClick={() => this.setState({ error: null, componentStack: null })}>
              {language === 'ko' ? '복구 시도' : 'Try to recover'}
            </button>
            <button style={btnStyle} onClick={() => window.appearanceAPI.showErrorLog({
              message: err.message,
              stack: err.stack ?? '',
              componentStack: this.state.componentStack ?? undefined,
            })}>
              {language === 'ko' ? '에러 로그 확인' : 'View error log'}
            </button>
            <button style={{ ...btnStyle, color: '#ff6060' }} onClick={() => window.appearanceAPI.restartApp()}>
              {language === 'ko' ? '프로그램 재시작' : 'Restart app'}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

declare global {
  interface Window {
    appearanceAPI: {
      getSlotData: () => Promise<AppearanceSlotData>
      updateSlot: (slot: SlotConfig) => void
      closeWindow: () => void
      savePanelSizes: (sizes: [number, number, number]) => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      onDataRefresh: (cb: (data: AppearanceSlotData) => void) => void
      getCustomIcons: () => Promise<CustomIconEntry[]>
      addCustomIcon: () => Promise<CustomIconEntry | null>
      removeCustomIcon: (id: string) => Promise<void>
      getRecentIcons: () => Promise<string[]>
      addRecentIcon: (iconRef: string) => void
      getResourceIcons: () => Promise<ResourceIconEntry[]>
      readSvgContent: (absPath: string) => Promise<string>
      showErrorLog: (logData: { message: string; stack: string; componentStack?: string }) => Promise<void>
      restartApp: () => Promise<void>
    }
  }
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme
}

function AppearanceAppInner(): JSX.Element {
  const t = useT()
  const [data, setData] = useState<AppearanceSlotData | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const initialSlotRef = useRef<SlotConfig | null>(null)

  useEffect(() => {
    window.appearanceAPI.getSlotData().then((d) => {
      if (!d) return
      setData(d)
      initialSlotRef.current = d.slot
      applyTheme(d.theme)
    })
    window.appearanceAPI.onDataRefresh((d) => {
      if (!d) return
      setData(d)
      initialSlotRef.current = d.slot
      applyTheme(d.theme)
    })
  }, [])

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--c-surface)', color: 'var(--c-text)' }}>
        {t('app.loading')}
      </div>
    )
  }

  const handleUpdate = (updated: SlotConfig) => {
    setData((prev) => prev ? { ...prev, slot: updated } : prev)
    window.appearanceAPI.updateSlot(updated)
  }

  const handlePanelSizes = (sizes: [number, number, number]) => {
    window.appearanceAPI.savePanelSizes(sizes)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-surface)', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* Custom title bar */}
      <div
        style={{ height: 40, flexShrink: 0, background: 'var(--c-elevated)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', display: 'flex', alignItems: 'center', paddingLeft: 14, WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {t('appearance.appTitle')} — {data.slot.label || t('appearance.unnamed')}
        </span>
        <WinControls
          onMinimize={() => window.appearanceAPI.minimizeWindow()}
          onMaximize={() => {
            window.appearanceAPI.maximizeWindow()
            setIsMaximized((v) => !v)
          }}
          onClose={() => window.appearanceAPI.closeWindow()}
          isMaximized={isMaximized}
        />
      </div>

      {/* AppearanceEditor fills remaining height */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <AppearanceEditor
          slot={data.slot}
          onUpdate={handleUpdate}
          defaultSizes={data.panelSizes}
          onSizesChange={handlePanelSizes}
          onSave={() => window.appearanceAPI.closeWindow()}
          onReset={() => {
            if (initialSlotRef.current) handleUpdate(initialSlotRef.current)
          }}
        />
      </div>
    </div>
  )
}

export function AppearanceApp(): JSX.Element {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    window.appearanceAPI.getSlotData().then((d) => {
      if (d?.language) setLanguage(d.language)
    })
    window.appearanceAPI.onDataRefresh((d) => {
      if (d?.language) setLanguage(d.language)
    })
  }, [])

  return (
    <I18nProvider language={language}>
      <AppearanceAppInner />
    </I18nProvider>
  )
}
