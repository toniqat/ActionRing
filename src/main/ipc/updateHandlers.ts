import { ipcMain, app, shell, type IpcMainInvokeEvent } from 'electron'
import * as https from 'https'
import * as http from 'http'
import {
  IPC_UPDATE_CHECK,
  IPC_SHELL_OPEN_EXTERNAL,
  type UpdateStatus,
} from '@shared/ipc.types'

const GITHUB_OWNER = 'toniqat'
const GITHUB_REPO  = 'ActionRing'
const GITHUB_PAT   = process.env.GITHUB_PAT ?? ''
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

async function fetchLatestRelease(): Promise<CachedRelease> {
  const now = Date.now()
  if (cache && now - cache.checkedAt < CACHE_TTL_MS) return cache

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  const headers: Record<string, string> = {
    'User-Agent': 'ActionRing-App',
    'Accept': 'application/vnd.github+json',
  }
  if (GITHUB_PAT) headers['Authorization'] = `Bearer ${GITHUB_PAT}`

  const body = await httpsGet(apiUrl, headers)
  const release = JSON.parse(body) as {
    tag_name?: string
    message?: string
  }

  if (!release.tag_name) {
    throw new Error(release.message ?? 'No releases found on GitHub.')
  }

  cache = { tag: release.tag_name, checkedAt: Date.now() }
  return cache
}

// ── IPC handler registration ──────────────────────────────────────────────────

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC_UPDATE_CHECK, async (): Promise<UpdateStatus> => {
    const currentVersion = app.getVersion()
    try {
      const release = await fetchLatestRelease()
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
}
