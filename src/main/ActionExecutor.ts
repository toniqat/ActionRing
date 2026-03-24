import { exec } from 'child_process'
import { shell } from 'electron'
import type { ActionConfig, SystemActionId } from '@shared/config.types'

export class ActionExecutor {
  async execute(action: ActionConfig): Promise<void> {
    switch (action.type) {
      case 'launch':
        await this.launch(action.target)
        break
      case 'shortcut':
        await this.sendShortcut(action.keys)
        break
      case 'shell':
        await this.runShell(action.command)
        break
      case 'system':
        await this.runSystem(action.action)
        break
      case 'folder':
        // Folder is a container — sub-slot execution is handled by the ring renderer
        break
    }
  }

  private async launch(target: string): Promise<void> {
    shell.openPath(target).catch(console.error)
  }

  private async sendShortcut(keys: string): Promise<void> {
    // Use platform-appropriate method to send keyboard shortcuts
    const platform = process.platform
    if (platform === 'win32') {
      // Use PowerShell to send key combos on Windows
      const psKeys = this.toPowerShellKeys(keys)
      exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${psKeys}')"`)
    } else if (platform === 'darwin') {
      // Use osascript on macOS
      const appleKeys = this.toAppleScriptKeys(keys)
      exec(`osascript -e 'tell application "System Events" to keystroke "${appleKeys}"'`)
    }
  }

  private async runShell(command: string): Promise<void> {
    exec(command, (err) => {
      if (err) console.error('[ActionExecutor] Shell error:', err)
    })
  }

  private async runSystem(action: SystemActionId): Promise<void> {
    const platform = process.platform
    switch (action) {
      case 'volume-up':
        if (platform === 'win32') {
          exec(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"`)
        } else if (platform === 'darwin') {
          exec(`osascript -e 'set volume output volume (output volume of (get volume settings) + 10)'`)
        }
        break
      case 'volume-down':
        if (platform === 'win32') {
          exec(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"`)
        } else if (platform === 'darwin') {
          exec(`osascript -e 'set volume output volume (output volume of (get volume settings) - 10)'`)
        }
        break
      case 'mute':
        if (platform === 'win32') {
          exec(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`)
        } else if (platform === 'darwin') {
          exec(`osascript -e 'set volume with output muted'`)
        }
        break
      case 'play-pause':
        if (platform === 'win32') {
          exec(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]179)"`)
        } else if (platform === 'darwin') {
          exec(`osascript -e 'tell application "System Events" to key code 16 using {command down}'`)
        }
        break
      case 'screenshot':
        if (platform === 'win32') {
          exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}')"`)
        } else if (platform === 'darwin') {
          exec(`screencapture -i ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png`)
        }
        break
      case 'lock-screen':
        if (platform === 'win32') {
          exec('rundll32.exe user32.dll,LockWorkStation')
        } else if (platform === 'darwin') {
          exec(`osascript -e 'tell application "System Events" to keystroke "q" using {command down, control down}'`)
        }
        break
      case 'show-desktop':
        if (platform === 'win32') {
          exec(`powershell -Command "(New-Object -ComObject Shell.Application).ToggleDesktop()"`)
        } else if (platform === 'darwin') {
          exec(`osascript -e 'tell application "System Events" to key code 103 using {command down}'`)
        }
        break
    }
  }

  private toPowerShellKeys(keys: string): string {
    return keys
      .replace('ctrl+', '^')
      .replace('alt+', '%')
      .replace('shift+', '+')
      .replace('win+', '^{ESC}')
  }

  private toAppleScriptKeys(keys: string): string {
    // Simplified — just return the last part for now
    return keys.split('+').pop() || keys
  }
}
