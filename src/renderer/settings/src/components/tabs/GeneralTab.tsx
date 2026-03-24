import type { AppConfig, ModifierKey, ThemePreference } from '@shared/config.types'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
}

const MODIFIER_KEYS: { key: ModifierKey; label: string }[] = [
  { key: 'ctrl', label: 'Ctrl' },
  { key: 'shift', label: 'Shift' },
  { key: 'alt', label: 'Alt' },
  { key: 'meta', label: 'Win / Cmd' }
]

const MOUSE_BUTTONS: { value: number; label: string }[] = [
  { value: 1, label: 'Left Click' },
  { value: 2, label: 'Right Click' },
  { value: 3, label: 'Middle Click' },
  { value: 4, label: 'Side Button 1' },
  { value: 5, label: 'Side Button 2' }
]

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'dark',   label: 'Dark',   description: 'Warm dark slate' },
  { value: 'light',  label: 'Light',  description: 'Clean light' },
  { value: 'system', label: 'System', description: 'Follow OS' },
]

export function GeneralTab({ config, onSave }: Props): JSX.Element {
  const { modifiers, button } = config.trigger

  function toggleModifier(key: ModifierKey): void {
    const next = modifiers.includes(key)
      ? modifiers.filter((m) => m !== key)
      : [...modifiers, key]
    onSave({ ...config, trigger: { ...config.trigger, modifiers: next } })
  }

  function setButton(value: number): void {
    onSave({ ...config, trigger: { ...config.trigger, button: value } })
  }

  function setTheme(theme: ThemePreference): void {
    onSave({ ...config, theme })
  }

  const triggerDescription = buildTriggerDescription(modifiers, button)

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-semibold text-[var(--c-text)]">General</h2>

      {/* Theme — label and pill toggle group on the same row */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-muted)]">
          Theme
        </span>
        <div className="flex items-center gap-0.5 p-1 rounded-full border border-[var(--c-border)] bg-[var(--c-btn-bg)]">
          {THEME_OPTIONS.map(({ value, label, description }) => {
            const active = (config.theme ?? 'dark') === value
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={description}
                className={[
                  'px-4 py-1 rounded-full text-[13px] transition-all duration-150 cursor-pointer',
                  active
                    ? 'bg-[var(--c-accent-bg)] border border-[var(--c-accent-border)] text-[var(--c-accent-text)] font-semibold'
                    : 'border border-transparent text-[var(--c-text-muted)] font-normal hover:text-[var(--c-text)]'
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Trigger Configuration */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-muted)]">
          Trigger
        </h3>

        {/* Modifier key toggles */}
        <div>
          <span className="block text-[13px] text-[var(--c-text-muted)] mb-2">
            Modifier Keys (hold while clicking)
          </span>
          <div className="flex flex-wrap gap-2">
            {MODIFIER_KEYS.map(({ key, label }) => {
              const active = modifiers.includes(key)
              return (
                <button
                  key={key}
                  onClick={() => toggleModifier(key)}
                  className={[
                    'px-3.5 py-[5px] rounded-md text-[13px] border transition-all duration-150 cursor-pointer',
                    active
                      ? 'border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-text)]'
                      : 'border-[var(--c-border)] bg-[var(--c-btn-bg)] text-[var(--c-text-muted)]'
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mouse button dropdown */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-[var(--c-text)]">Mouse Button</span>
          <select
            value={button}
            onChange={(e) => setButton(Number(e.target.value))}
            className="bg-[var(--c-elevated)] border border-[var(--c-border)] rounded-md text-[var(--c-text)] px-3 py-1.5 text-[13px] cursor-pointer"
          >
            {MOUSE_BUTTONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Current trigger preview */}
        <div className="px-3 py-2 rounded-md border border-[var(--c-border-sub)] bg-[var(--c-btn-bg)]">
          <span className="text-[11px] uppercase tracking-[0.05em] text-[var(--c-text-dim)]">
            Current trigger
          </span>
          <div className="mt-1 text-[14px] text-[var(--c-text)] font-mono">
            {triggerDescription}
          </div>
        </div>

        {button === 1 && (
          <p className="text-[12px] text-[var(--c-warning)]">
            Left Click requires at least one modifier key to avoid conflicts with normal clicking.
          </p>
        )}
      </section>

      {/* Start on Login — no section header; tight left-aligned pair */}
      <label className="flex items-center gap-3 w-fit cursor-pointer select-none">
        <input
          type="checkbox"
          checked={config.startOnLogin}
          onChange={(e) => onSave({ ...config, startOnLogin: e.target.checked })}
          className="w-[18px] h-[18px] cursor-pointer accent-[var(--c-accent)]"
        />
        <span className="text-[14px] text-[var(--c-text)]">Start on Login</span>
      </label>
    </div>
  )
}

function buildTriggerDescription(modifiers: ModifierKey[], button: number): string {
  const modLabels: Record<ModifierKey, string> = {
    ctrl: 'Ctrl',
    shift: 'Shift',
    alt: 'Alt',
    meta: 'Win'
  }
  const buttonLabels: Record<number, string> = {
    1: 'Left Click',
    2: 'Right Click',
    3: 'Middle Click',
    4: 'Side Button 1',
    5: 'Side Button 2'
  }
  const parts = modifiers.map((m) => modLabels[m])
  parts.push(buttonLabels[button] ?? `Button ${button}`)
  return parts.join(' + ')
}
