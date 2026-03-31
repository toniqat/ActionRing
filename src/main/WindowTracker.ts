import { exec } from 'child_process'

const POLL_INTERVAL_MS = 1000

/**
 * Polls the foreground window's process name on Windows via PowerShell and caches the result.
 * The cached value is at most ~1 second stale, which is acceptable for ring-trigger context.
 * On non-Windows platforms, getActiveExeName() always returns null.
 */
export class WindowTracker {
  private activeExeName: string | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private readonly encodedCommand: string | null = null

  constructor() {
    if (process.platform !== 'win32') return

    // Build a PowerShell script that reads the foreground window's process name.
    // Using -EncodedCommand avoids all shell-escaping issues.
    const scriptLines = [
      '$id = 0',
      "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; " +
        "public class FgWin { " +
        "[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); " +
        "[DllImport(\"user32.dll\")] public static extern int GetWindowThreadProcessId(IntPtr h, out int p); " +
        "}' -ErrorAction SilentlyContinue",
      '[FgWin]::GetWindowThreadProcessId([FgWin]::GetForegroundWindow(), [ref]$id) | Out-Null',
      '$proc = Get-Process -Id $id -ErrorAction SilentlyContinue',
      "if ($proc) { $proc.Name + '.exe' }",
    ]
    const script = scriptLines.join('\n')
    this.encodedCommand = Buffer.from(script, 'utf16le').toString('base64')
  }

  start(): void {
    if (process.platform !== 'win32') return
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** Returns the cached foreground exe name (e.g. "chrome.exe"), or null if unavailable. */
  getActiveExeName(): string | null {
    return this.activeExeName
  }

  private poll(): void {
    if (!this.encodedCommand) return
    exec(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${this.encodedCommand}`,
      { windowsHide: true, timeout: 3000 },
      (err, stdout) => {
        if (err) return
        const name = stdout.trim()
        if (name) this.activeExeName = name
      }
    )
  }
}
