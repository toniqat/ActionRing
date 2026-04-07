import { exec, spawn } from 'child_process'
import path from 'path'
import { shell, Notification } from 'electron'
import type { ActionConfig, SystemActionId, ConditionCriteria, ConditionOperator, ShortcutEntry, CalcOperation, RunShortcutAction, SequenceAction, ListAction, DictAction } from '@shared/config.types'
import type { PlayNodeResult } from '@shared/ipc.types'
import type { ConfigStore } from './ConfigStore'
import type { HookManager } from './HookManager'
import type { SequenceManager } from './SequenceManager'

// ── Interruption signals ───────────────────────────────────────────────────────

/** Thrown by an 'escape' node to break out of the innermost loop. */
class LoopBreakSignal extends Error {
  constructor() { super('__loop_break__') }
}

/** Thrown by a 'stop' node to halt the entire sequence. */
class SequenceStopSignal extends Error {
  constructor(
    public readonly returnVar?: string,
    public readonly returnValue?: string,
  ) { super('__sequence_stop__') }
}

// ── RunContext ─────────────────────────────────────────────────────────────────

/** Maximum depth for nested run-shortcut invocations. */
const MAX_CALL_DEPTH = 32

export interface RunContext {
  localVars: Record<string, string>
  /** Stack of shortcut IDs currently being executed — used for circular-reference detection. */
  callStack?: string[]
  /** PIDs spawned by launch actions in this context — keyed by resolved target path. */
  launchedPids?: Map<string, number>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function interpolate(str: string, ctx: RunContext): string {
  return str.replace(/\$(\w+)/g, (_, name: string) => {
    return ctx.localVars[name] ?? `$${name}`
  })
}

function evalCondition(expr: string, ctx: RunContext): boolean {
  const resolved = interpolate(expr.trim(), ctx)

  // Comparison operators
  const match = resolved.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/)
  if (match) {
    const lhs = match[1].trim()
    const op  = match[2]
    const rhs = match[3].trim()
    const lNum = Number(lhs)
    const rNum = Number(rhs)
    const numeric = !isNaN(lNum) && !isNaN(rNum)
    switch (op) {
      case '==': return numeric ? lNum === rNum : lhs === rhs
      case '!=': return numeric ? lNum !== rNum : lhs !== rhs
      case '>':  return numeric && lNum > rNum
      case '<':  return numeric && lNum < rNum
      case '>=': return numeric && lNum >= rNum
      case '<=': return numeric && lNum <= rNum
    }
  }

  // Truthiness: truthy when non-empty and not "false" or "0"
  return resolved !== '' && resolved !== 'false' && resolved !== '0'
}

// ── ActionExecutor ─────────────────────────────────────────────────────────────

export class ActionExecutor {
  private sequenceManager: SequenceManager | null = null
  private hookManager: HookManager | null = null

  constructor(private configStore: ConfigStore) {}

  setSequenceManager(mgr: SequenceManager): void {
    this.sequenceManager = mgr
  }

  setHookManager(mgr: HookManager): void {
    this.hookManager = mgr
  }

  private makeContext(): RunContext {
    return { localVars: {} }
  }

  /**
   * Execute each ShortcutEntry referenced by the given IDs in sequence.
   * A shared RunContext is maintained across all shortcuts (local vars reset per shortcut, global vars shared).
   */
  async executeShortcutIds(shortcutIds: string[], library: ShortcutEntry[]): Promise<PlayNodeResult[]> {
    const results: PlayNodeResult[] = []
    let globalIndex = 0
    for (const id of shortcutIds) {
      const entry = library.find((e) => e.id === id)
      if (!entry) continue
      const shortcutCtx: RunContext = { localVars: {}, callStack: [id] }
      for (let i = 0; i < entry.actions.length; i++) {
        try {
          await this.execute(entry.actions[i], shortcutCtx)
          results.push({ index: globalIndex++, success: true })
        } catch (err) {
          if (err instanceof SequenceStopSignal) {
            if (err.returnVar) {
              shortcutCtx.localVars[err.returnVar] = err.returnValue ?? ''
            }
            results.push({ index: globalIndex++, success: true })
            return results
          }
          const message = err instanceof Error ? err.message : String(err)
          results.push({ index: globalIndex++, success: false, error: message })
          return results
        }
      }
    }
    return results
  }

  async executeAll(actions: ActionConfig[], ctx?: RunContext): Promise<PlayNodeResult[]> {
    const runCtx = ctx ?? this.makeContext()
    const results: PlayNodeResult[] = []
    for (let i = 0; i < actions.length; i++) {
      try {
        await this.execute(actions[i], runCtx)
        results.push({ index: i, success: true })
      } catch (err) {
        if (err instanceof SequenceStopSignal) {
          if (err.returnVar) {
            runCtx.localVars[err.returnVar] = err.returnValue ?? ''
          }
          results.push({ index: i, success: true })
          break
        }
        const message = err instanceof Error ? err.message : String(err)
        results.push({ index: i, success: false, error: message })
        break
      }
    }
    return results
  }

  async execute(action: ActionConfig, ctx?: RunContext): Promise<void> {
    const runCtx = ctx ?? this.makeContext()
    switch (action.type) {
      case 'launch': {
        const resolvedTarget = interpolate(action.target, runCtx)
        const pid = await this.launchWithPid(resolvedTarget)
        if (pid != null) {
          if (!runCtx.launchedPids) runCtx.launchedPids = new Map()
          runCtx.launchedPids.set(resolvedTarget, pid)
        }
        break
      }
      case 'keyboard':
        await this.sendShortcut(action.keys)
        break
      case 'shell':
        await this.runShell(action.command)
        break
      case 'system':
        await this.runSystem(action.action)
        break
      case 'link': {
        const resolvedUrl = interpolate(action.url, runCtx)
        await shell.openExternal(resolvedUrl)
        break
      }
      case 'folder':
        break

      // ── Script nodes ──────────────────────────────────────────────────────────

      case 'if-else': {
        const mode = action.conditionMode ?? 'if-else'

        if (mode === 'switch') {
          // Switch mode: evaluate switchValue and match against cases
          const switchVal = interpolate(action.switchValue ?? '', runCtx)
          let matched = false
          for (const sc of action.switchCases ?? []) {
            const caseVal = interpolate(sc.value, runCtx)
            if (switchVal === caseVal) {
              matched = true
              for (const sub of sc.actions) {
                await this.execute(sub, runCtx)
              }
              break // first match only (break behavior)
            }
          }
          if (!matched && action.switchDefault) {
            for (const sub of action.switchDefault) {
              await this.execute(sub, runCtx)
            }
          }
        } else {
          // If-Else mode (original behavior)
          let result: boolean
          if (action.criteria && action.criteria.length > 0) {
            const evalCriteria = (c: ConditionCriteria): boolean => {
              const lhs = interpolate(c.variable, runCtx)
              if (c.operator === 'is-empty')     return lhs === '' || lhs === c.variable
              if (c.operator === 'is-not-empty') return lhs !== '' && lhs !== c.variable
              const rhs = interpolate(c.value, runCtx)
              const lNum = Number(lhs)
              const rNum = Number(rhs)
              const num  = !isNaN(lNum) && !isNaN(rNum)
              const op   = c.operator as ConditionOperator
              switch (op) {
                case 'eq':          return lhs === rhs
                case 'neq':         return lhs !== rhs
                case 'contains':    return lhs.includes(rhs)
                case 'not-contains':return !lhs.includes(rhs)
                case 'gt':          return num && lNum > rNum
                case 'lt':          return num && lNum < rNum
                case 'gte':         return num && lNum >= rNum
                case 'lte':         return num && lNum <= rNum
                default:            return false
              }
            }
            const evals = action.criteria.map(evalCriteria)
            result = (action.matchLogic ?? 'all') === 'all'
              ? evals.every(Boolean)
              : evals.some(Boolean)
          } else {
            result = evalCondition(action.condition, runCtx)
          }
          const branch = result ? action.thenActions : action.elseActions
          for (const sub of branch) {
            await this.execute(sub, runCtx)
          }
        }
        break
      }

      case 'loop': {
        const mode = action.mode ?? 'repeat'

        if (mode === 'for') {
          const start = action.start ?? 0
          const end   = action.end   ?? 0
          const step  = action.step  ?? 1
          const iterVar = action.iterVar ?? '_i'
          const safeStep = step === 0 ? 1 : step
          const limit = 10000
          let iterations = 0
          try {
            for (let i = start; safeStep > 0 ? i < end : i > end; i += safeStep) {
              if (++iterations > limit) break
              runCtx.localVars[iterVar] = String(i)
              runCtx.localVars['__loop_i'] = String(i)
              for (const sub of action.body) {
                await this.execute(sub, runCtx)
              }
            }
          } catch (err) {
            if (!(err instanceof LoopBreakSignal)) throw err
          }
        } else if (mode === 'foreach') {
          const listVarName = action.listVar ?? ''
          const itemVar     = action.itemVar ?? '_item'
          const keyVar      = action.keyVar
          const raw = runCtx.localVars[listVarName] ?? '[]'
          let parsed: unknown
          try { parsed = JSON.parse(raw) } catch { parsed = raw }

          try {
            if (Array.isArray(parsed)) {
              // List iteration
              for (let idx = 0; idx < parsed.length; idx++) {
                const item = parsed[idx]
                runCtx.localVars[itemVar] = typeof item === 'string' ? item : JSON.stringify(item)
                if (keyVar) runCtx.localVars[keyVar] = String(idx)
                for (const sub of action.body) {
                  await this.execute(sub, runCtx)
                }
              }
            } else if (typeof parsed === 'object' && parsed !== null) {
              // Dictionary iteration
              for (const [k, v] of Object.entries(parsed)) {
                if (keyVar) runCtx.localVars[keyVar] = k
                runCtx.localVars[itemVar] = typeof v === 'string' ? v : JSON.stringify(v)
                for (const sub of action.body) {
                  await this.execute(sub, runCtx)
                }
              }
            } else {
              // Single value fallback
              runCtx.localVars[itemVar] = String(raw)
              if (keyVar) runCtx.localVars[keyVar] = '0'
              for (const sub of action.body) {
                await this.execute(sub, runCtx)
              }
            }
          } catch (err) {
            if (!(err instanceof LoopBreakSignal)) throw err
          }
        } else {
          // repeat mode (default)
          const count = Math.min(Math.max(1, action.count), 1000)
          try {
            for (let i = 0; i < count; i++) {
              runCtx.localVars['__loop_count'] = String(i + 1)
              for (const sub of action.body) {
                await this.execute(sub, runCtx)
              }
            }
          } catch (err) {
            if (!(err instanceof LoopBreakSignal)) throw err
          }
        }
        break
      }

      case 'sequence': {
        const seqAction = action as SequenceAction
        const seqId = Math.random().toString(36).slice(2, 10)
        const childCtx: RunContext = {
          localVars: { ...runCtx.localVars },
          callStack: runCtx.callStack ? [...runCtx.callStack] : [],
        }
        const totalSteps = seqAction.body.length
        const showProgress = seqAction.showProgress !== false

        if (showProgress && this.sequenceManager) {
          this.sequenceManager.register(seqId, seqAction.name || 'Sequence', totalSteps)
        }

        // Fire-and-forget: runs independently of the main flow
        ;(async () => {
          try {
            for (let i = 0; i < seqAction.body.length; i++) {
              if (showProgress && this.sequenceManager) {
                this.sequenceManager.updateStep(seqId, i + 1)
              }
              try {
                await this.execute(seqAction.body[i], childCtx)
              } catch (err) {
                if (err instanceof SequenceStopSignal) break
                if (err instanceof LoopBreakSignal) break
                console.error(`[Sequence "${seqAction.name}"] step ${i} error:`, err)
                break
              }
            }
          } finally {
            if (showProgress && this.sequenceManager) {
              this.sequenceManager.unregister(seqId)
            }
          }
        })()
        break
      }

      case 'wait': {
        const waitMode = action.mode ?? 'manual'
        if (waitMode === 'variable') {
          const varVal = runCtx.localVars[action.variable ?? ''] ?? '0'
          const ms = Math.max(0, Math.min(60000, Number(varVal) || 0))
          await new Promise<void>((resolve) => setTimeout(resolve, ms))
        } else if (waitMode === 'app-exit') {
          const ref = interpolate(action.launchRef ?? '', runCtx)
          const pid = runCtx.launchedPids?.get(ref)
          if (pid != null) {
            await this.waitForPidExit(pid)
          }
        } else if (waitMode === 'key-input') {
          const keys = interpolate(action.waitKeys ?? '', runCtx)
          if (keys && this.hookManager) {
            await this.hookManager.waitForKeyInput(keys)
          }
        } else {
          await new Promise<void>((resolve) => setTimeout(resolve, action.ms))
        }
        break
      }

      case 'set-var': {
        const value = interpolate(action.value, runCtx)
        runCtx.localVars[action.name.replace(/^\$/, '')] = value
        break
      }

      case 'list': {
        const a = action as ListAction
        const varName = a.name
        const varMode = a.mode ?? 'define'
        const op = a.operation ?? 'set'

        if (varMode === 'define') {
          const items = (a.listItems ?? []).map((v) => interpolate(v, runCtx))
          runCtx.localVars[varName] = JSON.stringify(items)
          break
        }

        // Edit mode
        if (op === 'set') {
          runCtx.localVars[varName] = interpolate(a.value ?? '', runCtx)
          break
        }

        const raw = runCtx.localVars[varName] ?? '[]'
        let parsed: unknown
        try { parsed = JSON.parse(raw) } catch { parsed = [] }
        const arr: unknown[] = Array.isArray(parsed) ? parsed : []

        if (op === 'push') {
          arr.push(interpolate(a.value ?? '', runCtx))
          runCtx.localVars[varName] = JSON.stringify(arr)
        } else if (op === 'remove') {
          const idx = parseInt(interpolate(a.key ?? '0', runCtx), 10)
          if (!isNaN(idx)) arr.splice(idx, 1)
          runCtx.localVars[varName] = JSON.stringify(arr)
        } else if (op === 'get') {
          const idx = parseInt(interpolate(a.key ?? '0', runCtx), 10)
          const item = !isNaN(idx) ? arr[idx] : undefined
          const result = item !== undefined
            ? (typeof item === 'string' ? item : JSON.stringify(item))
            : ''
          if (a.resultVar) runCtx.localVars[a.resultVar] = result
        }
        break
      }

      case 'dict': {
        const a = action as DictAction
        const varName = a.name
        const varMode = a.mode ?? 'define'
        const op = a.operation ?? 'set'

        if (varMode === 'define') {
          const dict: Record<string, string> = {}
          for (const entry of a.dictItems ?? []) {
            const key = interpolate(entry.key, runCtx)
            if (key) dict[key] = interpolate(entry.value, runCtx)
          }
          runCtx.localVars[varName] = JSON.stringify(dict)
          break
        }

        // Edit mode
        if (op === 'set') {
          const key = interpolate(a.key ?? '', runCtx)
          if (key) {
            const rawD = runCtx.localVars[varName] ?? '{}'
            let parsedD: Record<string, unknown>
            try { parsedD = JSON.parse(rawD) } catch { parsedD = {} }
            if (typeof parsedD !== 'object' || Array.isArray(parsedD)) parsedD = {}
            parsedD[key] = interpolate(a.value ?? '', runCtx)
            runCtx.localVars[varName] = JSON.stringify(parsedD)
          }
          break
        }

        const rawDict = runCtx.localVars[varName] ?? '{}'
        let dict: Record<string, unknown>
        try { dict = JSON.parse(rawDict) } catch { dict = {} }
        if (typeof dict !== 'object' || Array.isArray(dict)) dict = {}

        if (op === 'remove') {
          const key = interpolate(a.key ?? '', runCtx)
          if (key) delete dict[key]
          runCtx.localVars[varName] = JSON.stringify(dict)
        } else if (op === 'get') {
          const key = interpolate(a.key ?? '', runCtx)
          const item = key ? dict[key] : undefined
          const result = item !== undefined
            ? (typeof item === 'string' ? item : JSON.stringify(item))
            : ''
          if (a.resultVar) runCtx.localVars[a.resultVar] = result
        }
        break
      }

      case 'toast': {
        const body = interpolate(action.message, runCtx)
        if (Notification.isSupported()) {
          new Notification({ title: 'Action Ring', body }).show()
        }
        break
      }

      case 'run-shortcut': {
        const rsAction = action as RunShortcutAction
        const config = this.configStore.get()
        const entry = config.shortcutsLibrary?.find((e) => e.id === rsAction.shortcutId)
        if (!entry) throw new Error(`Shortcut not found: ${rsAction.shortcutId}`)

        // Circular-reference and depth guard
        const parentStack = runCtx.callStack ?? []
        if (parentStack.includes(rsAction.shortcutId)) {
          throw new Error(
            `Circular shortcut call detected: ${[...parentStack, rsAction.shortcutId].map(
              (id) => config.shortcutsLibrary?.find((e) => e.id === id)?.name ?? id
            ).join(' → ')}`
          )
        }
        if (parentStack.length >= MAX_CALL_DEPTH) {
          throw new Error(`Maximum call depth (${MAX_CALL_DEPTH}) exceeded`)
        }

        // Build child local vars from inputs mapping
        const childLocals: Record<string, string> = {}
        if (rsAction.inputs) {
          for (const [childParam, expr] of Object.entries(rsAction.inputs)) {
            childLocals[childParam] = interpolate(expr, runCtx)
          }
        }

        const childCtx: RunContext = {
          localVars: childLocals,
          callStack: [...parentStack, rsAction.shortcutId],
        }

        try {
          for (const sub of entry.actions) {
            await this.execute(sub, childCtx)
          }
        } catch (err) {
          if (err instanceof SequenceStopSignal) {
            // Capture child's return value into parent's outputVar
            if (rsAction.outputVar && err.returnValue !== undefined) {
              runCtx.localVars[rsAction.outputVar] = err.returnValue
            }
            break  // stop signal consumed — does not propagate to parent
          }
          throw err
        }
        break
      }

      case 'escape':
        throw new LoopBreakSignal()

      case 'stop':
        throw new SequenceStopSignal(action.returnVar, action.returnValue)

      case 'calculate': {
        const a = parseFloat(interpolate(action.operandA, runCtx))
        const b = action.operandB !== undefined ? parseFloat(interpolate(action.operandB, runCtx)) : NaN
        const op = action.operation as CalcOperation
        let result: number
        switch (op) {
          case 'add':      result = a + b; break
          case 'sub':      result = a - b; break
          case 'mul':      result = a * b; break
          case 'div':      result = b !== 0 ? a / b : NaN; break
          case 'mod':      result = b !== 0 ? a % b : NaN; break
          case 'floordiv': result = b !== 0 ? Math.trunc(a / b) : NaN; break
          case 'pow':      result = Math.pow(a, b); break
          case 'sqrt':     result = Math.sqrt(a); break
          default:         result = NaN
        }
        const resultStr = isNaN(result) ? 'NaN' : (Number.isInteger(result) ? String(result) : String(result))
        runCtx.localVars[action.resultVar] = resultStr
        break
      }

      case 'comment':
        // No-op — documentation only
        break

      // ── Mouse actions ───────────────────────────────────────────────────────────

      case 'mouse-move': {
        const mode = action.mode ?? 'set'
        const x = parseInt(interpolate(action.x, runCtx), 10) || 0
        const y = parseInt(interpolate(action.y, runCtx), 10) || 0
        await this.moveMouse(mode, x, y)
        break
      }

      case 'mouse-click':
        await this.mouseClick(action.button ?? 'left')
        break
    }
  }

  private async launchWithPid(target: string): Promise<number | null> {
    try {
      const child = spawn(target, [], {
        detached: true,
        stdio: 'ignore',
        shell: true,
        cwd: path.dirname(target),
      })
      child.unref()
      return child.pid ?? null
    } catch {
      // Fallback to shell.openPath for non-executable targets (folders, URLs, etc.)
      const errMsg = await shell.openPath(target)
      if (errMsg) throw new Error(errMsg)
      return null
    }
  }

  private async waitForPidExit(pid: number, pollMs = 500, timeoutMs = 300_000): Promise<void> {
    const start = Date.now()
    return new Promise((resolve) => {
      const check = (): void => {
        try {
          process.kill(pid, 0) // signal 0 = existence check only
          if (Date.now() - start > timeoutMs) { resolve(); return }
          setTimeout(check, pollMs)
        } catch {
          resolve() // process no longer exists
        }
      }
      check()
    })
  }

  private async sendShortcut(keys: string): Promise<void> {
    const platform = process.platform
    if (platform === 'win32') {
      const psKeys = this.toPowerShellKeys(keys)
      exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${psKeys}')"`)
    } else if (platform === 'darwin') {
      const appleKeys = this.toAppleScriptKeys(keys)
      exec(`osascript -e 'tell application "System Events" to keystroke "${appleKeys}"'`)
    }
  }

  private async runShell(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(command, (err) => {
        if (err) reject(err)
        else resolve()
      })
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
      .replace(/ctrl\+/gi, '^')
      .replace(/alt\+/gi, '%')
      .replace(/shift\+/gi, '+')
      .replace(/(?:win|meta)\+/gi, '^{ESC}')
      .replace(/space/gi, ' ')
  }

  private toAppleScriptKeys(keys: string): string {
    return keys.split('+').pop()?.toLowerCase() || keys
  }

  // ── Mouse simulation ────────────────────────────────────────────────────────

  private async moveMouse(mode: string, x: number, y: number): Promise<void> {
    if (process.platform === 'win32') {
      if (mode === 'set') {
        exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`)
      } else {
        exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($($p.X + ${x}), $($p.Y + ${y}))"`)
      }
    } else if (process.platform === 'darwin') {
      if (mode === 'set') {
        exec(`osascript -e 'do shell script "cliclick m:${x},${y}" 2>/dev/null || true'`)
      } else {
        exec(`osascript -e 'do shell script "cliclick m:+${x},+${y}" 2>/dev/null || true'`)
      }
    }
  }

  private async mouseClick(button: string): Promise<void> {
    if (process.platform === 'win32') {
      const PS_MOUSE_TYPE = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);' -Name Win32Mouse -Namespace API -ErrorAction SilentlyContinue`
      const flagMap: Record<string, [number, number]> = {
        left:   [0x0002, 0x0004],
        right:  [0x0008, 0x0010],
        middle: [0x0020, 0x0040],
      }
      if (button === 'wheel-up' || button === 'wheel-down') {
        const amount = button === 'wheel-up' ? 120 : -120
        exec(`powershell -Command "${PS_MOUSE_TYPE}; [API.Win32Mouse]::mouse_event(0x0800, 0, 0, ${amount}, [IntPtr]::Zero)"`)
      } else if (button === 'side1' || button === 'side2') {
        const xBtn = button === 'side1' ? 1 : 2
        exec(`powershell -Command "${PS_MOUSE_TYPE}; [API.Win32Mouse]::mouse_event(0x0080, 0, 0, ${xBtn}, [IntPtr]::Zero); [API.Win32Mouse]::mouse_event(0x0100, 0, 0, ${xBtn}, [IntPtr]::Zero)"`)
      } else {
        const [down, up] = flagMap[button] ?? flagMap.left
        exec(`powershell -Command "${PS_MOUSE_TYPE}; [API.Win32Mouse]::mouse_event(${down}, 0, 0, 0, [IntPtr]::Zero); [API.Win32Mouse]::mouse_event(${up}, 0, 0, 0, [IntPtr]::Zero)"`)
      }
    } else if (process.platform === 'darwin') {
      const clickMap: Record<string, string> = {
        left: 'c:.', right: 'rc:.', middle: 'mc:.',
      }
      exec(`cliclick ${clickMap[button] ?? clickMap.left} 2>/dev/null || true`)
    }
  }
}
