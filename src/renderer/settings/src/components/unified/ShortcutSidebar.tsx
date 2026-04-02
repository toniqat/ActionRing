import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useSettings } from '../../context/SettingsContext'
import { useT } from '../../i18n/I18nContext'
import { UIIcon } from '@shared/UIIcon'
import { SVGIcon } from '@shared/SVGIcon'
import { BUILTIN_ICONS } from '@shared/icons'
import type { ShortcutEntry, SlotConfig } from '@shared/config.types'

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  launch:          { icon: 'launch',        color: '#3b82f6' },
  shortcut:        { icon: 'shortcut',      color: '#8b5cf6' },
  shell:           { icon: 'shell',         color: '#10b981' },
  system:          { icon: 'system',        color: '#f59e0b' },
  'if-else':       { icon: 'if_else',       color: '#ec4899' },
  loop:            { icon: 'loop',          color: '#14b8a6' },
  wait:            { icon: 'wait',          color: '#94a3b8' },
  'set-var':       { icon: 'set_var',       color: '#f97316' },
  toast:           { icon: 'toast',         color: '#a78bfa' },
  'run-shortcut':  { icon: 'call_shortcut', color: '#6366f1' },
}

export function entryIcon(entry: ShortcutEntry): { icon: string; color: string } {
  if (entry.icon) return { icon: entry.icon, color: '#8b5cf6' }
  const first = entry.actions[0]
  if (first) return ACTION_ICONS[first.type] ?? { icon: 'shortcut', color: '#8b5cf6' }
  return { icon: 'shortcut', color: '#8b5cf6' }
}

/** Renders the correct icon element for a ShortcutEntry, handling builtin, custom, and UI icons. */
function renderEntryIconEl(entry: ShortcutEntry, size: number): JSX.Element | null {
  if (!entry.icon) {
    const first = entry.actions[0]
    const ic = first ? (ACTION_ICONS[first.type] ?? { icon: 'shortcut', color: '#8b5cf6' }) : { icon: 'shortcut', color: '#8b5cf6' }
    return <UIIcon name={ic.icon} size={size} />
  }
  if (entry.iconIsCustom) {
    return <img src={`file://${entry.icon}`} style={{ width: size, height: size, objectFit: 'contain' }} alt="" />
  }
  const builtin = BUILTIN_ICONS.find((ic) => ic.name === entry.icon)
  if (builtin) return <SVGIcon svgString={builtin.svg} size={size} />
  return <UIIcon name={entry.icon} size={size} />
}

// ── ShortcutNodeCard ─────────────────────────────────────────────────────────
// Shared visual node used in both the right sidebar library and the left
// slot-edit panel's assigned-shortcuts list.

export interface ShortcutNodeCardProps {
  entry: ShortcutEntry
  onEdit: (entry: ShortcutEntry) => void
  /** Show a red × delete button at the far right. */
  showDeleteButton?: boolean
  onDelete?: () => void
  /** Drag-state styles (applied when the card is being dragged). */
  isDragging?: boolean
  /** Ref + spread props supplied by useDraggable/useSortable for drag support. */
  containerRef?: (el: HTMLDivElement | null) => void
  dragAttributes?: React.HTMLAttributes<HTMLDivElement>
  dragListeners?: React.HTMLAttributes<HTMLDivElement>
}

export function ShortcutNodeCard({
  entry, onEdit,
  showDeleteButton, onDelete,
  isDragging,
  containerRef, dragAttributes, dragListeners,
}: ShortcutNodeCardProps): JSX.Element {
  const { color } = entryIcon(entry)
  const badgeColor = entry.bgColor ?? color
  const hasDrag = Boolean(dragListeners)

  return (
    <div
      ref={containerRef}
      {...(dragAttributes as object)}
      {...(dragListeners as object)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 9px',
        borderRadius: 7,
        background: isDragging ? 'var(--c-accent-bg)' : 'var(--c-elevated)',
        border: `1px solid ${isDragging ? 'var(--c-accent)' : 'var(--c-border)'}`,
        cursor: hasDrag ? 'grab' : 'default',
        opacity: isDragging ? 0.45 : 1,
        transition: 'opacity 0.15s, border-color 0.15s, background 0.15s',
        userSelect: 'none',
        touchAction: hasDrag ? 'none' : undefined,
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        background: badgeColor + '33', border: `1px solid ${badgeColor}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: badgeColor,
      }}>
        {renderEntryIconEl(entry, 12)}
      </div>
      <span style={{
        flex: 1, fontSize: 12, color: 'var(--c-text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {entry.name || '(unnamed)'}
      </span>
      {entry.isFavorite && (
        <span style={{ color: '#f59e0b', flexShrink: 0 }}>
          <UIIcon name="favorite" size={10} />
        </span>
      )}
      {/* Edit button — stops drag propagation */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onEdit(entry) }}
        title="Edit shortcut"
        style={{
          flexShrink: 0, width: 22, height: 22,
          border: 'none', background: 'none',
          color: 'var(--c-text-dim)', cursor: 'pointer',
          borderRadius: 4, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, padding: 0,
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--c-text)'
          e.currentTarget.style.background = 'var(--c-border)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--c-text-dim)'
          e.currentTarget.style.background = 'none'
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      {/* Delete button */}
      {showDeleteButton && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete?.() }}
          title="Remove"
          style={{
            flexShrink: 0, width: 22, height: 22,
            border: 'none', background: 'none',
            color: 'var(--c-text-dim)', cursor: 'pointer',
            borderRadius: 4, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 0,
            transition: 'color 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-dim)' }}
        >
          <UIIcon name="close" size={12} />
        </button>
      )}
    </div>
  )
}

// ── DraggableEntry ────────────────────────────────────────────────────────────

function DraggableEntry({ entry, onEdit }: { entry: ShortcutEntry; onEdit: (entry: ShortcutEntry) => void }): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-entry-${entry.id}`,
    data: { entry },
  })

  return (
    <ShortcutNodeCard
      entry={entry}
      onEdit={onEdit}
      isDragging={isDragging}
      containerRef={setNodeRef}
      dragAttributes={attributes as React.HTMLAttributes<HTMLDivElement>}
      dragListeners={listeners as React.HTMLAttributes<HTMLDivElement>}
    />
  )
}

export function ShortcutSidebar({ width }: { width: number }): JSX.Element {
  const t = useT()
  const { draft } = useSettings()
  const library = draft.shortcutsLibrary ?? []
  const groups = draft.shortcutGroups ?? []

  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  const filtered = library.filter((entry) => {
    const matchesSearch = !search || entry.name.toLowerCase().includes(search.toLowerCase())
    const matchesGroup = selectedGroup === 'all' ? true : entry.groupId === selectedGroup
    return matchesSearch && matchesGroup
  })

  const openEditorForEntry = (entry: ShortcutEntry) => {
    const theme = (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'dark'
    const resolved = entryIcon(entry)
    const entryIconName = entry.icon ?? resolved.icon
    const virtualSlot: SlotConfig = {
      id: entry.id,
      label: entry.name,
      icon: entryIconName,
      iconIsCustom: entry.iconIsCustom ?? false,
      actions: entry.actions,
      enabled: true,
      bgColor: entry.bgColor,
    }
    window.settingsAPI.openShortcutsEditor({
      slot: virtualSlot,
      slotIndex: -1,
      isSubSlot: false,
      folderIndex: null,
      subSlotIndex: null,
      theme,
      language: draft.language,
      libraryEntryId: entry.id,
      shortcutsLibrary: library,
      shortcutGroups: groups,
    })
  }

  return (
    <div style={{
      width,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
        <div style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--c-text-dim)',
          marginBottom: 7,
          fontWeight: 600,
        }}>
          {t('sidebar.title')}
        </div>

        {/* Search bar */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sidebar.searchPlaceholder')}
          style={{
            width: '100%',
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid var(--c-border)',
            background: 'var(--c-elevated)',
            color: 'var(--c-text)',
            fontSize: 12,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)' }}
        />
      </div>

      {/* Group filter dropdown */}
      {groups.length > 0 && (
        <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 28px 4px 8px',
              borderRadius: 6,
              border: '1px solid var(--c-border)',
              background: 'var(--c-elevated)',
              color: 'var(--c-text)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              boxSizing: 'border-box',
            } as React.CSSProperties}
          >
            <option value="all">{t('sidebar.allShortcuts')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Hint */}
      <div style={{
        padding: '0 12px 6px',
        fontSize: 10,
        color: 'var(--c-text-dim)',
        flexShrink: 0,
        lineHeight: 1.4,
      }}>
        Drag onto a ring slot to assign
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--c-border-sub)', flexShrink: 0 }} />

      {/* Entry list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        {library.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--c-text-dim)',
            fontSize: 12,
            padding: '24px 8px',
            lineHeight: 1.5,
          }}>
            {t('sidebar.noShortcuts')}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--c-text-dim)',
            fontSize: 12,
            padding: '24px 8px',
          }}>
            {t('sidebar.noMatch')}
          </div>
        ) : (
          filtered.map((entry) => (
            <DraggableEntry key={entry.id} entry={entry} onEdit={openEditorForEntry} />
          ))
        )}
      </div>
    </div>
  )
}
