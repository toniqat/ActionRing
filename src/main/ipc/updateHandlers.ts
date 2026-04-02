import { ipcMain, app, shell, type IpcMainInvokeEvent } from 'electron'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn } from 'child_process'
import type { WindowManager } from '../WindowManager'
import {
  IPC_UPDATE_CHECK,
  IPC_UPDATE_DOWNLOAD,
  IPC_UPDATE_INSTALL,
  IPC_UPDATE_STATUS,
  IPC_SHELL_OPEN_EXTERNAL,
  type UpdateStatus,
} from '@shared/ipc.types'

const GITHUB_OWNER = 'toniqat'
const GITHUB_REPO  = 'ActionRing'
// PAT is used solely to raise the GitHub API rate limit for release checks.
// It lives only in the main process and is never forwarded to any renderer.
const GITHUB_PAT = ''
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedRelease {
  tag: string
  downloadUrl: string | null
  checkedAt: number
}

let cache: CachedRelease | null = null
let downloadedPath: string | null = null
let isDownloading = false

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

// ── HTTPS helpers ─────────────────────────────────────────────────────────────

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

function downloadFile(
  url: string,
  destPath: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (location: string, redirectsLeft: number): void => {
      const parsed = new URL(location)
      const isHttps = parsed.protocol === 'https:'
      const mod = isHttps ? https : http
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        // GitHub asset redirects go to S3 — no auth header needed there
        headers: location.includes('api.github.com')
          ? { 'User-Agent': 'ActionRing-App', 'Authorization': `Bearer ${GITHUB_PAT}` }
          : { 'User-Agent': 'ActionRing-App' },
      }
      mod.get(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return }
          follow(res.headers.location, redirectsLeft - 1)
          return
        }
        const total = parseInt(res.headers['content-length'] ?? '0', 10)
        let received = 0
        const out = fs.createWriteStream(destPath)
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (total > 0) onProgress(Math.round((received / total) * 100))
        })
        res.pipe(out)
        out.on('finish', () => resolve())
        out.on('error', reject)
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
    'Authorization': `Bearer ${GITHUB_PAT}`,
    'Accept': 'application/vnd.github+json',
  }

  const body = await httpsGet(apiUrl, headers)
  const release = JSON.parse(body) as {
    tag_name?: string
    assets?: Array<{ name: string; browser_download_url: string }>
    message?: string // GitHub error field (e.g. "Not Found")
  }

  if (!release.tag_name) {
    throw new Error(release.message ?? 'No releases found on GitHub.')
  }

  const asset = release.assets?.find((a) => a.name.toLowerCase().endsWith('.exe'))
  cache = {
    tag: release.tag_name,
    downloadUrl: asset?.browser_download_url ?? null,
    checkedAt: Date.now(),
  }
  return cache
}

// ── IPC handler registration ──────────────────────────────────────────────────

export function registerUpdateHandlers(windowManager: WindowManager): void {
  const sendStatus = (status: UpdateStatus): void => {
    const win = windowManager.getSettingsWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_UPDATE_STATUS, status)
    }
  }

  // check: invoked by renderer when About tab becomes visible
  ipcMain.handle(IPC_UPDATE_CHECK, async (): Promise<UpdateStatus> => {
    const currentVersion = app.getVersion()
    try {
      const release = await fetchLatestRelease()
      if (isNewer(release.tag, currentVersion)) {
        return {
          state: 'available',
          currentVersion,
          latestVersion: release.tag,
          downloadedPath: downloadedPath ?? undefined,
        }
      }
      return { state: 'up-to-date', currentVersion, latestVersion: release.tag }
    } catch (err) {
      console.error('[ActionRing] Update check failed:', err)
      return { state: 'error', currentVersion, error: String(err) }
    }
  })

  // open-external: safely opens URLs in the default browser from the renderer
  ipcMain.handle(IPC_SHELL_OPEN_EXTERNAL, (_event: IpcMainInvokeEvent, url: string): void => {
    // Only allow https URLs to prevent abuse
    if (typeof url === 'string' && url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  // download: triggered by renderer "Download Update" button
  ipcMain.on(IPC_UPDATE_DOWNLOAD, async () => {
    if (isDownloading) return
    isDownloading = true

    const currentVersion = app.getVersion()
    sendStatus({ state: 'downloading', downloadProgress: 0 })

    try {
      const release = await fetchLatestRelease()
      if (!release.downloadUrl) {
        sendStatus({ state: 'error', error: 'No downloadable asset found in release.' })
        isDownloading = false
        return
      }
      if (!isNewer(release.tag, currentVersion)) {
        sendStatus({ state: 'up-to-date', latestVersion: release.tag })
        isDownloading = false
        return
      }

      const tempDir = os.tmpdir()
      const dest = path.join(tempDir, `ActionRing-${release.tag}.exe`)

      await downloadFile(release.downloadUrl, dest, (pct) => {
        sendStatus({ state: 'downloading', downloadProgress: pct, latestVersion: release.tag })
      })

      downloadedPath = dest
      sendStatus({ state: 'ready', latestVersion: release.tag, downloadedPath: dest })
    } catch (err) {
      console.error('[ActionRing] Update download failed:', err)
      sendStatus({ state: 'error', error: String(err) })
    } finally {
      isDownloading = false
    }
  })

  // install: replace current exe via a detached batch script, then quit
  ipcMain.on(IPC_UPDATE_INSTALL, () => {
    if (!downloadedPath || !fs.existsSync(downloadedPath)) {
      sendStatus({ state: 'error', error: 'Downloaded file not found.' })
      return
    }

    if (process.platform === 'win32') {
      const currentExe = process.execPath
      // Write a batch script that waits 2s (for current process to exit),
      // copies the new exe over the old one, then launches it.
      const batPath = path.join(os.tmpdir(), 'actionring_update.bat')
      const bat = [
        '@echo off',
        'timeout /t 2 /nobreak >nul',
        `copy /y "${downloadedPath}" "${currentExe}"`,
        `start "" "${currentExe}"`,
        `del "${batPath}"`,
      ].join('\r\n')
      fs.writeFileSync(batPath, bat, 'utf-8')

      spawn('cmd.exe', ['/c', batPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref()

      app.quit()
    } else {
      // Non-Windows: open the downloaded file with the default handler and quit
      shell.openPath(downloadedPath).then(() => app.quit())
    }
  })
}
