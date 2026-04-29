import { UIIcon } from '@shared/UIIcon'
import { SVGIcon } from '@shared/SVGIcon'
import { BUILTIN_ICONS } from '@shared/icons'
import type { ShortcutEntry } from '@shared/config.types'
import type { ResourceIconEntry } from '@shared/ipc.types'

export const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  launch:          { icon: 'launch',         color: '#3b82f6' },
  keyboard:        { icon: 'keyboard',       color: '#8b5cf6' },
  shell:           { icon: 'shell',          color: '#10b981' },
  system:          { icon: 'system',         color: '#f59e0b' },
  link:            { icon: 'action_link',    color: '#06b6d4' },
  'mouse-move':    { icon: 'mouse_move',     color: '#f472b6' },
  'mouse-click':   { icon: 'mouse_click',    color: '#f472b6' },
  'if-else':       { icon: 'if_else',        color: '#2dd4bf' },
  loop:            { icon: 'loop',           color: '#2dd4bf' },
  wait:            { icon: 'wait',           color: '#5eead4' },
  'set-var':       { icon: 'variable',       color: '#f472b6' },
  toast:           { icon: 'toast',          color: '#a78bfa' },
  'run-shortcut':  { icon: 'call_shortcut',  color: '#6366f1' },
  sequence:        { icon: 'all_inclusive',  color: '#2dd4bf' },
  escape:          { icon: 'exit_to_app',   color: '#5eead4' },
  stop:            { icon: 'stop',          color: '#5eead4' },
  calculate:       { icon: 'calculate',     color: '#10b981' },
  comment:         { icon: 'comment',       color: '#6b7280' },
}

const DEFAULT_ICON = { icon: 'keyboard', color: '#8b5cf6' }

export function resolveEntryIcon(entry: ShortcutEntry): { icon: string; color: string } {
  if (entry.icon) return { icon: entry.icon, color: '#8b5cf6' }
  const first = entry.actions[0]
  if (first) return ACTION_ICONS[first.type] ?? DEFAULT_ICON
  return DEFAULT_ICON
}

/** Renders the correct icon element for a ShortcutEntry, handling builtin, resource, custom, and UI icons. */
export function renderEntryIconEl(entry: ShortcutEntry, size: number, resourceIcons: ResourceIconEntry[]): JSX.Element | null {
  if (!entry.icon) {
    const first = entry.actions[0]
    const ic = first ? (ACTION_ICONS[first.type] ?? DEFAULT_ICON) : DEFAULT_ICON
    return <UIIcon name={ic.icon} size={size} />
  }
  if (entry.iconIsCustom) {
    if (entry.icon.endsWith('.svg')) {
      const resource = resourceIcons.find((e) => e.absPath === entry.icon)
      if (resource) return <SVGIcon svgString={resource.svgContent} size={size} />
    }
    return <img src={`file://${entry.icon}`} style={{ width: size, height: size, objectFit: 'contain' }} alt="" />
  }
  const builtin = BUILTIN_ICONS.find((ic) => ic.name === entry.icon)
  if (builtin) return <SVGIcon svgString={builtin.svg} size={size} />
  return <UIIcon name={entry.icon} size={size} />
}
