import { ipcMain, app, shell, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import * as https from 'https'
import * as http from 'http'
import {
  IPC_APP_GET_VERSION,
  IPC_UPDATE_CHECK,
  IPC_SHELL_OPEN_EXTERNAL,
  IPC_APP_SHOW_ERROR_LOG,
  IPC_APP_RESTART,
  type UpdateStatus,
} from '@shared/ipc.types'

const GITHUB_OWNER = 'toniqat'
const GITHUB_REPO  = 'ActionRing'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedRelease {
  tag: string
  checkedAt: number
}

let cache: CachedRelease | null = null

// ── Semver comparison ─────────────────────────────────────────────────────────

function parseSemver(v: string): [number, number, number] {
  const parts = v.replace(/^v/, '').split('.').map(Number)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

function isNewer(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = parseSemver(latest)
  const [cMaj, cMin, cPat] = parseSemver(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

// ── HTTPS helper ──────────────────────────────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (location: string, redirectsLeft: number): void => {
      const parsed = new URL(location)
      const isHttps = parsed.protocol === 'https:'
      const mod = isHttps ? https : http
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers,
      }
      mod.get(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return }
          follow(res.headers.location, redirectsLeft - 1)
          return
        }
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve(data))
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url, 5)
  })
}

// ── GitHub API ────────────────────────────────────────────────────────────────

async function fetchLatestRelease(): Promise<CachedRelease | null> {
  const now = Date.now()
  if (cache && now - cache.checkedAt < CACHE_TTL_MS) return cache

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  const headers: Record<string, string> = {
    'User-Agent': 'ActionRing-App',
    'Accept': 'application/vnd.github+json',
  }

  const body = await httpsGet(apiUrl, headers)
  const release = JSON.parse(body) as {
    tag_name?: string
    message?: string
  }

  if (!release.tag_name) {
    return null
  }

  cache = { tag: release.tag_name, checkedAt: Date.now() }
  return cache
}

// ── IPC handler registration ──────────────────────────────────────────────────

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC_APP_GET_VERSION, (): string => app.getVersion())

  ipcMain.handle(IPC_UPDATE_CHECK, async (): Promise<UpdateStatus> => {
    const currentVersion = app.getVersion()
    try {
      const release = await fetchLatestRelease()
      if (!release) {
        return { state: 'up-to-date', currentVersion, latestVersion: currentVersion }
      }
      if (isNewer(release.tag, currentVersion)) {
        return { state: 'available', currentVersion, latestVersion: release.tag }
      }
      return { state: 'up-to-date', currentVersion, latestVersion: release.tag }
    } catch (err) {
      console.error('[ActionRing] Update check failed:', err)
      return { state: 'error', currentVersion, error: String(err) }
    }
  })

  ipcMain.handle(IPC_SHELL_OPEN_EXTERNAL, (_event: IpcMainInvokeEvent, url: string): void => {
    if (typeof url === 'string' && url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  // ── Error log window ─────────────────────────────────────────────────────
  ipcMain.handle(IPC_APP_SHOW_ERROR_LOG, (_event: IpcMainInvokeEvent, logData: { message: string; stack: string; componentStack?: string }): void => {
    const escaped = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const fullLog = [
      `Error: ${logData.message}`,
      '',
      '── Stack Trace ──',
      logData.stack,
      ...(logData.componentStack ? ['', '── Component Stack ──', logData.componentStack] : []),
      '',
      `── Timestamp: ${new Date().toISOString()} ──`,
    ].join('\n')

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Error Log</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; background: #1e1e2e; color: #cdd6f4; height: 100vh; display: flex; flex-direction: column; }
  .toolbar { display: flex; justify-content: flex-end; padding: 8px 12px; background: #181825; border-bottom: 1px solid #313244; flex-shrink: 0; }
  .copy-btn { padding: 5px 14px; border-radius: 6px; border: 1px solid #45475a; background: #313244; color: #cdd6f4; font-size: 12px; cursor: pointer; font-family: inherit; }
  .copy-btn:hover { background: #45475a; }
  .copy-btn.copied { background: #a6e3a1; color: #1e1e2e; border-color: #a6e3a1; }
  .log-content { flex: 1; padding: 16px; overflow: auto; white-space: pre-wrap; word-break: break-word; line-height: 1.6; user-select: text; }
</style></head><body>
<div class="toolbar">
  <button class="copy-btn" onclick="copyLog()">Copy</button>
</div>
<pre class="log-content">${escaped(fullLog)}</pre>
<script>
  const logText = ${JSON.stringify(fullLog)};
  function copyLog() {
    navigator.clipboard.writeText(logText).then(() => {
      const btn = document.querySelector('.copy-btn');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
    });
  }
</script></body></html>`

    const logWindow = new BrowserWindow({
      width: 640,
      height: 480,
      title: 'Error Log',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    logWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })

  // ── App restart ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC_APP_RESTART, (): void => {
    app.relaunch()
    app.exit(0)
  })
}
