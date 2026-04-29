import { useState, useEffect, useRef, useCallback, Component } from 'react'
import { createPortal } from 'react-dom'
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
import { sanitizeSvg } from '@shared/svgUtils'

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
      onShortcutsCommitted: (cb: () => void) => void
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
      // Update check
      getAppVersion: () => Promise<string>
      checkForUpdates: () => Promise<UpdateStatus>
      // Shell utilities
      openExternalUrl: (url: string) => Promise<void>
      // SVG icon loading
      readSvgContent: (absPath: string) => Promise<string>
      // Resource icons
      getResourceIcons: () => Promise<ResourceIconEntry[]>
      addRecentIcon: (iconRef: string) => void
      // MCP server status
      getMcpStatus: () => Promise<{ running: boolean; port: number | null; requestCount: number; lastRequestAt: number | null; lastHeartbeat: number | null; tools: string[] }>
      setupMcpForClaude: () => Promise<{ ok: boolean; target?: string; error?: string; command?: string }>
      checkMcpClient: (target: import('@shared/ipc.types').McpSetupTarget) => Promise<import('@shared/ipc.types').McpClientStatus>
      // Error recovery
      showErrorLog: (logData: { message: string; stack: string; componentStack?: string }) => Promise<void>
      restartApp: () => Promise<void>
    }
  }
}

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState { error: Error | null; componentStack: string | null }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null, componentStack: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ActionRing] Render error caught by boundary:', error, info)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRecover={() => this.setState({ error: null, componentStack: null })}
        />
      )
    }
    return this.props.children
  }
}

function ErrorFallback({ error, componentStack, onRecover }: { error: Error; componentStack: string | null; onRecover: () => void }): JSX.Element {
  const t = useT()
  const btnStyle: React.CSSProperties = {
    padding: '6px 16px', borderRadius: 6, border: '1px solid var(--c-border)',
    background: 'none', color: 'var(--c-accent)', fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  }
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onRecover} style={btnStyle}>
          {t('app.errorRecover')}
        </button>
        <button
          onClick={() => window.settingsAPI.showErrorLog({
            message: error.message,
            stack: error.stack ?? '',
            componentStack: componentStack ?? undefined,
          })}
          style={btnStyle}
        >
          {t('app.errorShowLog')}
        </button>
        <button
          onClick={() => window.settingsAPI.restartApp()}
          style={{ ...btnStyle, color: 'var(--c-danger, #ef4444)' }}
        >
          {t('app.errorRestart')}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// ── MCP Status Badge ─────────────────────────────────────────────────────────

interface McpStatus {
  running: boolean
  port: number | null
  requestCount: number
  lastRequestAt: number | null
  lastHeartbeat: number | null
  tools: string[]
}

/** Consider a client "active" if a heartbeat arrived within this window (ms).
 *  The MCP stdio server pings every 10s, so 30s allows ~2 missed pings. */
const CLIENT_ACTIVE_THRESHOLD = 30_000

// ── Toggle Switch (reusable) ─────────────────────────────────────────────────

function ToggleSwitch({ checked, disabled, onChange }: {
  checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 36, height: 20,
        borderRadius: 10,
        border: 'none',
        background: checked ? '#22c55e' : 'var(--c-border)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: checked ? 18 : 2,
        width: 16, height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'left 0.2s ease',
      }} />
    </button>
  )
}

// ── MCP Setup Modal ──────────────────────────────────────────────────────────

type McpSetupTarget = import('@shared/ipc.types').McpSetupTarget

interface AiClient {
  id: McpSetupTarget
  name: string
  desc: string
  logo: string
}

const AI_CLIENTS: AiClient[] = [
  {
    id: 'claude-desktop', name: 'Claude', desc: 'Desktop App',
    logo: '<svg viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg"><path fill="#d97757" d="M233.96 800.21 468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-26.58-5.96L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65 19.33 0 2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15 94.79 73.37 123.79 91.17 18.12 15.06 7.25-5.15.89-3.63-8.14-13.61-67.38-121.69-71.84-123.79-31.97-51.3-8.46-30.76c-2.98-12.64-5.15-23.27-5.15-36.24l37.13-50.42 20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29.03 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64 10.55 0 12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42 51.3 0 37.77 56.13-16.91 57.99-52.83 67.01-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33L856.59 714.6l-64.77-16.27-8.46 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.62-82.47-42.28-37.13-95.76-80.62h-5.66v8.46l22.07 32.3 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.88 15.7-76.31 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.28 97.85-108.41 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 20.14-29.32 118.68-150.95 71.6-93.58 46.23-53.75-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.24-.32.32Z"/></svg>',
  },
  {
    id: 'claude-code', name: 'Claude Code', desc: 'CLI',
    logo: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fill-rule="evenodd"/></svg>',
  },
  {
    id: 'codex', name: 'Codex', desc: 'OpenAI CLI',
    logo: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.503 0H4.496A4.496 4.496 0 000 4.496v15.007A4.496 4.496 0 004.496 24h15.007A4.496 4.496 0 0024 19.503V4.496A4.496 4.496 0 0019.503 0z" fill="#fff"/><path d="M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z" fill="url(#codex-grad)"/><defs><linearGradient gradientUnits="userSpaceOnUse" id="codex-grad" x1="12" x2="12" y1="3" y2="21"><stop stop-color="#B1A7FF"/><stop offset=".5" stop-color="#7A9DFF"/><stop offset="1" stop-color="#3941FF"/></linearGradient></defs></svg>',
  },
  {
    id: 'gemini', name: 'Gemini CLI', desc: 'Google CLI',
    logo: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M0 4.391A4.391 4.391 0 014.391 0h15.217A4.391 4.391 0 0124 4.391v15.217A4.391 4.391 0 0119.608 24H4.391A4.391 4.391 0 010 19.608V4.391z" fill="url(#gemini-grad)"/><path clip-rule="evenodd" d="M19.74 1.444a2.816 2.816 0 012.816 2.816v15.48a2.816 2.816 0 01-2.816 2.816H4.26a2.816 2.816 0 01-2.816-2.816V4.26A2.816 2.816 0 014.26 1.444h15.48zM7.236 8.564l7.752 3.728-7.752 3.727v2.802l9.557-4.596v-3.866L7.236 5.763v2.801z" fill="#1E1E2E" fill-rule="evenodd"/><defs><linearGradient gradientUnits="userSpaceOnUse" id="gemini-grad" x1="24" x2="0" y1="6.587" y2="16.494"><stop stop-color="#EE4D5D"/><stop offset=".328" stop-color="#B381DD"/><stop offset=".476" stop-color="#207CFE"/></linearGradient></defs></svg>',
  },
]

/** Modeless floating window showing setup result for a single AI client */
function McpSetupResultWindow({
  target, state, detail, error, command, onClose, offsetIndex = 0,
}: {
  target: McpSetupTarget
  state: 'done' | 'error'
  detail: string
  error: string
  command: string
  onClose: () => void
  offsetIndex?: number
}): JSX.Element {
  const t = useT()
  const [errorCopied, setErrorCopied] = useState(false)
  const client = AI_CLIENTS.find((c) => c.id === target)!
  const isSuccess = state === 'done'
  const errorText = command ? `${error}\n\n${t('mcp.setupResultCommand')}\n${command}` : error

  const handleCopyError = () => {
    navigator.clipboard.writeText(errorText)
    setErrorCopied(true)
    setTimeout(() => setErrorCopied(false), 1500)
  }

  return createPortal(
    <div style={{
      position: 'fixed', top: 60 + offsetIndex * 8, right: 16 + offsetIndex * 8, zIndex: 100000 - offsetIndex,
      width: 340,
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 10,
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      color: 'var(--c-text)',
      animation: 'mcp-result-slide-in 0.2s ease-out',
    }}>
      <style>{`
        @keyframes mcp-result-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--c-border-sub)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(client.logo.replace(/width="1em"/, 'width="20"').replace(/height="1em"/, 'height="20"')) }}
          />
          <span style={{ fontWeight: 600, fontSize: 12 }}>{client.name}</span>
          <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{client.desc}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-text-muted)', fontSize: 16, lineHeight: 1, padding: '0 2px',
          }}
        >&times;</button>
      </div>
      {/* Result content */}
      <div style={{ padding: 12 }}>
        {isSuccess ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid #22c55e',
              borderRadius: 8, fontSize: 12, color: '#22c55e',
              marginBottom: detail ? 8 : 0,
            }}>
              <span style={{ fontSize: 16 }}>{'\u2713'}</span>
              <span>{t('mcp.setupResultSuccess')}</span>
            </div>
            {detail && (
              <div style={{
                background: 'var(--c-bg)',
                border: '1px solid var(--c-border-sub)',
                borderRadius: 6, padding: 10,
                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                overflowY: 'auto', maxHeight: 140,
                color: 'var(--c-text-muted)',
              }}>
                {detail}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
                {t('mcp.setupResultFailed')}
              </span>
              <button
                onClick={handleCopyError}
                style={{
                  padding: '3px 10px',
                  background: errorCopied ? '#22c55e' : 'var(--c-hover)',
                  border: '1px solid var(--c-border-sub)',
                  borderRadius: 6, cursor: 'pointer',
                  color: errorCopied ? '#fff' : 'var(--c-text)',
                  fontSize: 10, fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {errorCopied ? t('mcp.copied') : t('mcp.copy')}
              </button>
            </div>
            <div style={{
              background: 'var(--c-bg)',
              border: '1px solid #ef4444',
              borderRadius: 6, padding: 10,
              fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              overflowY: 'auto', maxHeight: 140,
              color: '#ef4444',
            }}>
              {errorText}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Module-level cache: persists across modal open/close within same session
const _clientStatusCache: Record<string, { installed: boolean; registered: boolean }> = {}

function McpSetupModal({ port, onClose }: { port: number | null; onClose: () => void }): JSX.Element {
  const t = useT()
  const [section, setSection] = useState<'quick' | 'manual'>('quick')
  const [tab, setTab] = useState<'stdio' | 'http'>('stdio')
  const [entryPath, setEntryPath] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [setupStates, setSetupStates] = useState<Record<string, 'idle' | 'working' | 'done' | 'error'>>({})
  const [setupErrors, setSetupErrors] = useState<Record<string, string>>({})
  const [setupCommands, setSetupCommands] = useState<Record<string, string>>({})
  const [setupDetails, setSetupDetails] = useState<Record<string, string>>({})
  const [resultWindows, setResultWindows] = useState<McpSetupTarget[]>([])
  const [clientStatuses, setClientStatuses] = useState<Record<string, { installed: boolean; registered: boolean }>>({ ..._clientStatusCache })
  const [clientChecking, setClientChecking] = useState<Record<string, boolean>>({})

  const checkClient = useCallback((clientId: McpSetupTarget) => {
    setClientChecking((s) => ({ ...s, [clientId]: true }))
    window.settingsAPI.checkMcpClient(clientId)
      .then((status) => {
        _clientStatusCache[clientId] = status
        setClientStatuses((s) => ({ ...s, [clientId]: status }))
      })
      .catch(() => {})
      .finally(() => setClientChecking((s) => ({ ...s, [clientId]: false })))
  }, [])

  useEffect(() => {
    window.settingsAPI.getMcpEntryPath().then(setEntryPath).catch(() => {})
    // Only check clients not already cached
    for (const client of AI_CLIENTS) {
      if (!_clientStatusCache[client.id]) {
        checkClient(client.id)
      }
    }
  }, [])

  const stdioJson = JSON.stringify({
    mcpServers: {
      actionring: {
        command: 'node',
        args: [entryPath || '<path-to>/mcp-server/dist/index.js'],
      },
    },
  }, null, 2)

  const httpInfo = port
    ? `URL: http://127.0.0.1:${port}\n\nEndpoints:\n  GET  /status\n  GET  /config\n  PUT  /config\n  POST /config/reset\n  GET  /shortcuts\n  POST /shortcuts\n  GET  /shortcut-groups\n  POST /shortcut-groups\n  GET  /apps\n  POST /apps\n  POST /actions/execute\n  GET  /action-types\n  POST /toggle-enabled`
    : 'MCP server is not running.'

  const currentJson = tab === 'stdio' ? stdioJson : httpInfo

  const handleCopy = () => {
    navigator.clipboard.writeText(currentJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleQuickSetup = async (target: McpSetupTarget) => {
    setSetupStates((s) => ({ ...s, [target]: 'working' }))
    setSetupErrors((s) => ({ ...s, [target]: '' }))
    setSetupCommands((s) => ({ ...s, [target]: '' }))
    try {
      const result = await window.settingsAPI.setupMcp(target)
      if (result.ok) {
        setSetupStates((s) => ({ ...s, [target]: 'done' }))
        setSetupDetails((s) => ({ ...s, [target]: result.detail ?? '' }))
      } else {
        setSetupStates((s) => ({ ...s, [target]: 'error' }))
        setSetupErrors((s) => ({ ...s, [target]: result.error ?? '' }))
        setSetupCommands((s) => ({ ...s, [target]: result.command ?? '' }))
      }
    } catch (err) {
      setSetupStates((s) => ({ ...s, [target]: 'error' }))
      setSetupErrors((s) => ({ ...s, [target]: (err as Error).message || 'Unexpected error' }))
    }
    // Show result in a modeless window
    setResultWindows((w) => w.includes(target) ? w : [...w, target])
  }

  const closeResultWindow = (target: McpSetupTarget) => {
    setResultWindows((w) => w.filter((t) => t !== target))
  }

  const sectionTabs: { id: 'quick' | 'manual'; label: string }[] = [
    { id: 'quick', label: t('mcp.setupQuick') },
    { id: 'manual', label: t('mcp.setupManual') },
  ]

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 12,
            width: 440, maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            color: 'var(--c-text)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--c-border-sub)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t('mcp.setupTitle')}</span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--c-text-muted)', fontSize: 18, lineHeight: 1,
                padding: '0 2px',
              }}
            >
              &times;
            </button>
          </div>

          {/* Section tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--c-border-sub)',
          }}>
            {sectionTabs.map((st) => (
              <button
                key={st.id}
                onClick={() => setSection(st.id)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: section === st.id ? '2px solid var(--c-accent)' : '2px solid transparent',
                  color: section === st.id ? 'var(--c-text)' : 'var(--c-text-muted)',
                  cursor: 'pointer',
                  fontSize: 12, fontWeight: section === st.id ? 600 : 400,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {/* Quick Setup section */}
            {section === 'quick' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 10 }}>{t('mcp.setupQuickDesc')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {AI_CLIENTS.map((client) => {
                    const state = setupStates[client.id] ?? 'idle'
                    const cs = clientStatuses[client.id]
                    const isChecking = clientChecking[client.id]
                    const isNotInstalled = !isChecking && cs && !cs.installed
                    // Green highlight only when installed AND registered
                    const isRegistered = !isNotInstalled && (state === 'done' || (cs?.installed && cs?.registered && state === 'idle'))

                    const borderColor = isRegistered ? '#22c55e'
                      : state === 'error' ? '#ef4444'
                      : 'var(--c-border-sub)'
                    const bgColor = isRegistered ? 'rgba(34,197,94,0.08)' : 'var(--c-bg)'

                    // Status replaces the desc line
                    let statusText = client.desc
                    let statusColor = 'var(--c-text-muted)'
                    if (state === 'working') {
                      statusText = t('mcp.setupWorking')
                      statusColor = 'var(--c-accent)'
                    } else if (state === 'done') {
                      statusText = t('mcp.registered')
                      statusColor = '#22c55e'
                    } else if (state === 'error') {
                      statusText = t('mcp.setupError')
                      statusColor = '#ef4444'
                    } else if (isChecking) {
                      statusText = t('mcp.checking')
                    } else if (cs) {
                      if (!cs.installed) {
                        statusText = t('mcp.installRequired')
                      } else if (cs.registered) {
                        statusText = t('mcp.registered')
                        statusColor = '#22c55e'
                      } else {
                        statusText = t('mcp.installed')
                      }
                    }

                    const handleClick = () => {
                      if (isNotInstalled) {
                        // Re-check when clicking a dimmed (not-installed) card
                        checkClient(client.id)
                      } else {
                        handleQuickSetup(client.id)
                      }
                    }

                    return (
                      <button
                        key={client.id}
                        disabled={state === 'working' || !!isChecking}
                        onClick={handleClick}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 6, padding: '14px 10px 10px',
                          background: bgColor,
                          border: `1px solid ${borderColor}`,
                          borderRadius: 10,
                          cursor: isNotInstalled ? 'pointer' : state === 'working' ? 'wait' : 'pointer',
                          color: 'var(--c-text)', fontSize: 12, fontFamily: 'inherit',
                          transition: 'all 0.15s ease',
                          opacity: isNotInstalled ? 0.35 : state === 'working' ? 0.6 : 1,
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => { if (!isRegistered) e.currentTarget.style.background = 'var(--c-hover)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = bgColor }}
                      >
                        {/* Logo */}
                        <span
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeSvg(client.logo.replace(/width="1em"/, 'width="32"').replace(/height="1em"/, 'height="32"')) }}
                        />
                        {/* Name */}
                        <span style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>{client.name}</span>
                        {/* Status (replaces desc) */}
                        <span style={{ fontSize: 10, color: statusColor, marginTop: -2 }}>
                          {statusText}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Manual Configuration section */}
            {section === 'manual' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 8 }}>{t('mcp.setupManualDesc')}</div>

                {/* Tabs + Copy button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {(['stdio', 'http'] as const).map((id) => (
                      <button
                        key={id}
                        onClick={() => setTab(id)}
                        style={{
                          padding: '4px 14px',
                          background: tab === id ? 'var(--c-hover)' : 'none',
                          border: '1px solid var(--c-border-sub)',
                          borderBottom: tab === id ? '2px solid var(--c-accent)' : '1px solid var(--c-border-sub)',
                          color: tab === id ? 'var(--c-text)' : 'var(--c-text-muted)',
                          cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                          borderRadius: id === 'stdio' ? '6px 0 0 0' : '0 6px 0 0',
                        }}
                      >
                        {id === 'stdio' ? t('mcp.setupStdio') : t('mcp.setupHttp')}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleCopy}
                    style={{
                      padding: '4px 12px',
                      background: copied ? '#22c55e' : 'var(--c-hover)',
                      border: '1px solid var(--c-border-sub)',
                      borderRadius: 6, cursor: 'pointer',
                      color: copied ? '#fff' : 'var(--c-text)',
                      fontSize: 11, fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copied ? t('mcp.copied') : t('mcp.copy')}
                  </button>
                </div>

                {/* Code block */}
                <div style={{
                  background: 'var(--c-bg)', border: '1px solid var(--c-border-sub)',
                  borderRadius: 6, padding: 10,
                  fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5,
                  whiteSpace: 'pre', overflowX: 'auto',
                  maxHeight: 180,
                  color: 'var(--c-text-muted)',
                }}>
                  {currentJson}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modeless result windows */}
      {resultWindows.map((target, idx) => {
        const state = setupStates[target]
        if (state !== 'done' && state !== 'error') return null
        return (
          <McpSetupResultWindow
            key={target}
            target={target}
            state={state}
            detail={setupDetails[target] ?? ''}
            error={setupErrors[target] ?? ''}
            command={setupCommands[target] ?? ''}
            onClose={() => closeResultWindow(target)}
            offsetIndex={idx}
          />
        )
      })}
    </>
  )
}

// ── MCP Status Badge (dropdown + modal trigger) ──────────────────────────────

function McpStatusBadge({ mcpEnabled, onToggle }: { mcpEnabled: boolean; onToggle: (v: boolean) => void }): JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const ref = useRef<HTMLDivElement>(null)
  const [toggling, setToggling] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const refresh = useCallback(() => {
    setNow(Date.now())
    window.settingsAPI.getMcpStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [refresh])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const running = status?.running ?? false
  const clientActive = running && status?.lastHeartbeat != null
    && (now - status.lastHeartbeat) < CLIENT_ACTIVE_THRESHOLD
  const dotColor = !mcpEnabled ? '#6b7280' : !running ? '#ef4444' : clientActive ? '#22c55e' : '#eab308'

  const formatTime = (ts: number | null | undefined): string => {
    if (!ts) return t('mcp.noRequests')
    const diff = Math.floor((now - ts) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' as 'no-drag' }}>
      <button
        onClick={() => { refresh(); setOpen((v) => !v) }}
        title={!mcpEnabled ? 'MCP Disabled' : !running ? t('mcp.serverStopped') : clientActive ? t('mcp.clientActive') : t('mcp.clientIdle')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', margin: '0 4px',
          background: 'none', border: '1px solid var(--c-border-sub)',
          borderRadius: 4, cursor: 'pointer',
          color: 'var(--c-text-muted)', fontSize: 11,
          fontFamily: 'inherit', height: 24,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span>MCP</span>
      </button>

      {/* Dropdown */}
      {open && status && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 8, padding: 12, minWidth: 240,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 9999, fontSize: 12,
            color: 'var(--c-text)',
          }}
        >
          {/* Header: title + Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>MCP Server</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                {mcpEnabled ? 'Enable' : 'Disable'}
              </span>
              <ToggleSwitch
                checked={mcpEnabled}
                disabled={toggling}
                onChange={async (next) => {
                  setToggling(true)
                  try {
                    await window.settingsAPI.toggleMcp(next)
                    onToggle(next)
                    refresh()
                  } finally {
                    setToggling(false)
                  }
                }}
              />
            </div>
          </div>

          {/* Details — only when enabled */}
          {mcpEnabled && (
            <>
              {running && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: clientActive ? '#22c55e' : '#eab308',
                  }} />
                  <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                    {clientActive ? t('mcp.clientActive') : t('mcp.clientIdle')}
                  </span>
                </div>
              )}

              {running && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>{t('mcp.port')}</span>
                    <span style={{ fontFamily: 'monospace' }}>{status.port}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>{t('mcp.requests')}</span>
                    <span>{status.requestCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>{t('mcp.lastRequest')}</span>
                    <span>{formatTime(status.lastRequestAt)}</span>
                  </div>
                </div>
              )}

              {/* Setup MCP button */}
              <div style={{ marginTop: 10, borderTop: '1px solid var(--c-border-sub)', paddingTop: 8 }}>
                <button
                  onClick={() => { setOpen(false); setShowSetup(true) }}
                  style={{
                    width: '100%', padding: '6px 10px',
                    background: 'var(--c-accent)', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
                  }}
                >
                  {t('mcp.setupButton')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Setup modal */}
      {showSetup && <McpSetupModal port={status?.port ?? null} onClose={() => setShowSetup(false)} />}
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

        {/* MCP status badge */}
        <McpStatusBadge
          mcpEnabled={config.mcpEnabled !== false}
          onToggle={(v) => setConfig((prev) => prev ? { ...prev, mcpEnabled: v } : prev)}
        />

        {/* Window controls on the right */}
        <WinControls
          onMinimize={() => window.settingsAPI.minimizeWindow()}
          onMaximize={() => {
            window.settingsAPI.maximizeWindow()
            setIsMaximized((v) => !v)
          }}
          onClose={() => window.settingsAPI.closeWindow()}
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
