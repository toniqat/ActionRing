import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { AppConfig, SlotConfig, ModifierKey } from '@shared/config.types'

const CONFIG_VERSION = 4

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const DEFAULT_SLOTS: SlotConfig[] = [
  {
    id: generateId(),
    label: 'Browser',
    icon: 'browser',
    iconIsCustom: false,
    action: { type: 'system', action: 'show-desktop' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'File Explorer',
    icon: 'folder',
    iconIsCustom: false,
    action: { type: 'launch', target: process.platform === 'win32' ? 'explorer.exe' : 'open' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'Play / Pause',
    icon: 'play',
    iconIsCustom: false,
    action: { type: 'system', action: 'play-pause' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'Volume Up',
    icon: 'volume-up',
    iconIsCustom: false,
    action: { type: 'system', action: 'volume-up' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'Volume Down',
    icon: 'volume-down',
    iconIsCustom: false,
    action: { type: 'system', action: 'volume-down' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'Screenshot',
    icon: 'screenshot',
    iconIsCustom: false,
    action: { type: 'system', action: 'screenshot' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'Lock Screen',
    icon: 'lock',
    iconIsCustom: false,
    action: { type: 'system', action: 'lock-screen' },
    enabled: true
  },
  {
    id: generateId(),
    label: 'Calculator',
    icon: 'calculator',
    iconIsCustom: false,
    action: {
      type: 'launch',
      target: process.platform === 'win32' ? 'calc.exe' : 'open -a Calculator'
    },
    enabled: true
  }
]

const DEFAULT_CONFIG: AppConfig = {
  version: CONFIG_VERSION,
  enabled: true,
  trigger: {
    button: 3,
    modifiers: []
  },
  slots: DEFAULT_SLOTS,
  appearance: {
    ringRadius: 80,
    buttonSize: 32,
    iconSize: 18,
    showText: false,
    opacity: 0.92,
    animationSpeed: 'normal'
  },
  startOnLogin: false,
  theme: 'dark'
}

export class ConfigStore {
  private configPath: string
  private config: AppConfig

  constructor() {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    this.configPath = join(userDataPath, 'config.json')
    this.config = this.load()
  }

  private load(): AppConfig {
    if (!existsSync(this.configPath)) {
      this.save(DEFAULT_CONFIG)
      return { ...DEFAULT_CONFIG }
    }
    try {
      const raw = readFileSync(this.configPath, 'utf-8')
      const parsed = JSON.parse(raw) as AppConfig
      // Basic migration: fill in missing fields with defaults
      let config: AppConfig = { ...DEFAULT_CONFIG, ...parsed }
      // v1 → v2: fix incorrect middle-click button code (2 was right-click, 3 is middle)
      if ((parsed.version ?? 1) < 2 && config.trigger.button === 2) {
        config = { ...config, trigger: { ...config.trigger, button: 3 }, version: 2 }
      }
      // v2 → v3: migrate single modifier string to modifiers array
      if ((parsed.version ?? 1) < 3) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldModifier = (parsed.trigger as any)?.modifier as string | undefined
        const modifiers: ModifierKey[] =
          oldModifier && oldModifier !== 'none'
            ? [oldModifier as ModifierKey]
            : []
        config = { ...config, trigger: { button: config.trigger.button, modifiers }, version: 3 }
        this.save(config)
      }
      // v3 → v4: add theme field
      if ((parsed.version ?? 1) < 4) {
        config = { ...config, theme: 'dark', version: 4 }
        this.save(config)
      }
      return config
    } catch {
      console.error('[ConfigStore] Failed to parse config, using defaults')
      return { ...DEFAULT_CONFIG }
    }
  }

  get(): AppConfig {
    return this.config
  }

  save(config: AppConfig): void {
    this.config = config
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  update(partial: Partial<AppConfig>): void {
    this.save({ ...this.config, ...partial })
  }

  toggleEnabled(): void {
    this.update({ enabled: !this.config.enabled })
  }
}
