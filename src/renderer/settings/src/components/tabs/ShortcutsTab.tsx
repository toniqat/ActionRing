import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AppConfig, SlotConfig, ShortcutEntry, ShortcutGroup } from '@shared/config.types'
import type { ResourceIconEntry } from '@shared/ipc.types'
import { useSettings } from '../../context/SettingsContext'
import { useT } from '../../i18n/I18nContext'
import { UIIcon } from '@shared/UIIcon'
import { SVGIcon } from '@shared/SVGIcon'
import { BUILTIN_ICONS } from '@shared/icons'

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
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

function resolveEntryIcon(entry: ShortcutEntry): { icon: string; color: string } {
  if (entry.icon) return { icon: entry.icon, color: '#8b5cf6' }
  const first = entry.actions[0]
  if (first) return ACTION_ICONS[first.type] ?? DEFAULT_ICON
  return DEFAULT_ICON
}

/** Renders the correct icon element for a ShortcutEntry, handling builtin, resource, custom, and UI icons. */
function renderEntryIconEl(entry: ShortcutEntry, size: number, resourceIcons: ResourceIconEntry[]): JSX.Element | null {
  if (!entry.icon) {
    const first = entry.actions[0]
    const ic = first ? (ACTION_ICONS[first.type] ?? DEFAULT_ICON) : DEFAULT_ICON
    return <UIIcon name={ic.icon} size={size} />
  }
  if (entry.iconIsCustom) {
    // Resource SVG icon — render inline SVG from loaded content
    if (entry.icon.endsWith('.svg')) {
      const resource = resourceIcons.find((e) => e.absPath === entry.icon)
      if (resource) return <SVGIcon svgString={resource.svgContent} size={size} />
    }
    // Custom non-SVG file icon — render via img
    return <img src={`file://${entry.icon}`} style={{ width: size, height: size, objectFit: 'contain' }} alt="" />
  }
  const builtin = BUILTIN_ICONS.find((ic) => ic.name === entry.icon)
  if (builtin) return <SVGIcon svgString={builtin.svg} size={size} />
  return <UIIcon name={entry.icon} size={size} />
}

const DEFAULT_GROUP_ID = '__default__'

function generateGroupName(groups: ShortcutGroup[]): string {
  const base = 'New Group'
  const names = new Set(groups.map((g) => g.name))
  if (!names.has(base)) return base
  let i = 1
  while (names.has(`${base} (${i})`)) i++
  return `${base} (${i})`
}

function uniqueEntryName(base: string, library: ShortcutEntry[]): string {
  const names = new Set(library.map((e) => e.name))
  if (!names.has(base)) return base
  let i = 1
  while (names.has(`${base} (${i})`)) i++
  return `${base} (${i})`
}

function flatSlots(slots: SlotConfig[]): SlotConfig[] {
  return slots.flatMap((s) => [s, ...(s.subSlots ? flatSlots(s.subSlots) : [])])
}

function countRefs(config: AppConfig, entryId: string): number {
  return config.apps.reduce(
    (total, app) =>
      total +
      app.profiles.reduce(
        (pTotal, profile) =>
          pTotal + flatSlots(profile.slots).filter((s) => (s.shortcutIds ?? []).includes(entryId)).length,
        0,
      ),
    0,
  )
}

function buildConfigForDraft(
  draft: AppConfig,
  activeEditingAppId: string,
  newLibrary: ShortcutEntry[],
  newGroups?: ShortcutGroup[],
  slotMutator?: (s: SlotConfig) => SlotConfig,
): AppConfig {
  let apps = draft.apps

  if (slotMutator) {
    const mutate = (slots: SlotConfig[]): SlotConfig[] =>
      slots.map((slot) => ({ ...slotMutator(slot), subSlots: slot.subSlots ? mutate(slot.subSlots) : undefined }))
    apps = draft.apps.map((app) => ({
      ...app,
      profiles: app.profiles.map((profile) => ({
        ...profile,
        slots: mutate(profile.slots),
      })),
    }))
  }

  const editingApp = apps.find((a) => a.id === activeEditingAppId) ?? apps[0]
  const editingProfile =
    editingApp?.profiles.find((p) => p.id === editingApp.activeProfileId) ?? editingApp?.profiles[0]

  return {
    ...draft,
    apps,
    slots: editingProfile?.slots ?? draft.slots,
    shortcutsLibrary: newLibrary,
    shortcutGroups: newGroups ?? draft.shortcutGroups,
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Selection = 'gallery' | 'recent' | 'favorites' | string  // string = groupId
type ViewMode = 'card' | 'list'

interface MenuState {
  entryId: string
  x: number   // button rect.right
  y: number   // button rect.bottom
  xl: number  // button rect.left (for flip-left positioning)
}

const RECENT_MAX = 64

// ── DeleteDialog ───────────────────────────────────────────────────────────────

function DeleteDialog({
  entry,
  refCount,
  onConfirm,
  onCancel,
}: {
  entry: ShortcutEntry
  refCount: number
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  const t = useT()
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--c-elevated)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '20px 24px', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--c-text)' }}>{t('lib.deleteTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{entry.name}</span>
        </div>
        {refCount > 0 && (
          <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '6px 10px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <UIIcon name="info" size={13} color="#f59e0b" />
            {t('lib.orphanWarning').replace('{n}', String(refCount))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, background: 'none', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('lib.cancel')}
          </button>
          <button onClick={onConfirm} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            {t('lib.deleteAnyway')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GroupDeleteDialog ──────────────────────────────────────────────────────────

function GroupDeleteDialog({
  groupName,
  onConfirm,
  onCancel,
}: {
  groupName: string
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  const t = useT()
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--c-elevated)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '20px 24px', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--c-text)' }}>{t('lib.deleteGroupTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
          {t('lib.deleteGroupMessage').replace('{name}', groupName)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, background: 'none', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('lib.cancel')}
          </button>
          <button onClick={onConfirm} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            {t('lib.deleteAnyway')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ShortcutCard (pure visual) ─────────────────────────────────────────────────

function ShortcutCard({
  entry,
  viewMode,
  onMenuOpen,
  groupName,
  resourceIcons,
}: {
  entry: ShortcutEntry
  viewMode: ViewMode
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  groupName?: string
  resourceIcons: ResourceIconEntry[]
}): JSX.Element {
  const { color } = resolveEntryIcon(entry)
  const actionBadges = entry.actions.slice(0, 4)
  const extra = entry.actions.length - actionBadges.length

  const menuBtn = (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onMenuOpen(e, entry.id) }}
      title="More options"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 15, color: 'var(--c-text-dim)', padding: '2px 6px',
        borderRadius: 4, fontFamily: 'inherit', flexShrink: 0,
        lineHeight: 1, transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(128,128,128,0.12)'; b.style.color = 'var(--c-text)' }}
      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'none'; b.style.color = 'var(--c-text-dim)' }}
    >
      <UIIcon name="more_vert" size={15} />
    </button>
  )

  const badgeColor = entry.bgColor ?? color

  if (viewMode === 'list') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border-sub)',
        cursor: 'default',
      }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: badgeColor + '33', border: `1px solid ${badgeColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: badgeColor }}>
          {renderEntryIconEl(entry, 14, resourceIcons)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.name || '(unnamed)'}
          </div>
          {groupName && (
            <div style={{ fontSize: 10, color: 'var(--c-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {groupName}
            </div>
          )}
        </div>
        {entry.isFavorite && <span style={{ color: '#f59e0b', flexShrink: 0 }}><UIIcon name="favorite" size={11} /></span>}
        {menuBtn}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column',
      height: 88, overflow: 'hidden',
      cursor: 'default', minWidth: 0,
    }}>
      {/* Top row: icon + name + menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: badgeColor + '33', border: `1px solid ${badgeColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: badgeColor }}>
          {renderEntryIconEl(entry, 15, resourceIcons)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.name || '(unnamed)'}
          </div>
          {groupName && (
            <div style={{ fontSize: 10, color: 'var(--c-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {groupName}
            </div>
          )}
        </div>
        {menuBtn}
      </div>

      {/* Action type badges */}
      {actionBadges.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 8 }}>
          {actionBadges.map((action, i) => {
            const cfg = ACTION_ICONS[action.type] ?? { icon: 'play_arrow', color: '#6b7280' }
            return (
              <span key={i} style={{ width: 20, height: 20, borderRadius: 5, background: cfg.color + '22', border: `1px solid ${cfg.color}44`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cfg.color }}>
                <UIIcon name={cfg.icon} size={11} />
              </span>
            )
          })}
          {extra > 0 && (
            <span style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--c-border)', border: '1px solid var(--c-border-sub)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--c-text-dim)' }}>
              +{extra}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── SortableCardWrapper ────────────────────────────────────────────────────────

function SortableCardWrapper({
  entry,
  viewMode,
  onMenuOpen,
  groupName,
  resourceIcons,
}: {
  entry: ShortcutEntry
  viewMode: ViewMode
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  groupName?: string
  resourceIcons: ResourceIconEntry[]
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <ShortcutCard entry={entry} viewMode={viewMode} onMenuOpen={onMenuOpen} groupName={groupName} resourceIcons={resourceIcons} />
    </div>
  )
}

// ── SidebarDroppableGroup ──────────────────────────────────────────────────────

function SidebarDroppableGroup({
  group,
  isActive,
  onClick,
}: {
  group: ShortcutGroup
  isActive: boolean
  onClick: () => void
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: `group:${group.id}`,
    data: { type: 'sidebar-group', groupId: group.id },
  })

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        width: '100%', padding: '7px 12px',
        background: isOver
          ? 'rgba(99,102,241,0.18)'
          : isActive
          ? 'var(--c-accent-subtle, rgba(99,102,241,0.12))'
          : 'none',
        border: 'none',
        borderLeft: isActive || isOver ? '3px solid var(--c-accent)' : '3px solid transparent',
        borderRadius: '0 6px 6px 0',
        color: isActive || isOver ? 'var(--c-text)' : 'var(--c-text-muted)',
        fontSize: 13, fontFamily: 'inherit',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s, color 0.1s, border-color 0.1s',
        fontWeight: isActive ? 600 : 400,
        marginBottom: 2,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {group.name}
      </span>
    </button>
  )
}

// ── MenuItem ───────────────────────────────────────────────────────────────────

function MenuItem({
  onClick,
  children,
  danger,
  muted,
  focused,
  rightAdornment,
  onMouseEnterItem,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  muted?: boolean
  focused?: boolean
  rightAdornment?: React.ReactNode
  onMouseEnterItem?: () => void
}): JSX.Element {
  const bgColor = danger ? 'rgba(239,68,68,0.1)' : 'var(--c-border)'
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '6px 12px', width: '100%',
        background: focused ? bgColor : 'none', border: 'none',
        color: danger ? '#ef4444' : muted ? 'var(--c-text-dim)' : 'var(--c-text)',
        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        textAlign: 'left', whiteSpace: 'nowrap',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = bgColor
        onMouseEnterItem?.()
      }}
      onMouseLeave={(e) => { if (!focused) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
    >
      <span>{children}</span>
      {rightAdornment && <span style={{ color: 'var(--c-text-dim)', fontSize: 10 }}>{rightAdornment}</span>}
    </button>
  )
}

function MenuSeparator(): JSX.Element {
  return <div style={{ height: 1, background: 'var(--c-border-sub)', margin: '4px 0' }} />
}

// ── ShortcutsTabInner ──────────────────────────────────────────────────────────

function ShortcutsTabInner(): JSX.Element {
  const t = useT()
  const { draft, updateDraft, activeEditingAppId } = useSettings()

  const library = draft.shortcutsLibrary ?? []
  const groups = draft.shortcutGroups ?? []

  // ── State ──────────────────────────────────────────────────────────────────

  const [selection, setSelection] = useState<Selection>('gallery')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ShortcutEntry | null>(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ShortcutGroup | null>(null)
  const [menuState, setMenuState] = useState<MenuState | null>(null)
  const [menuFocusIdx, setMenuFocusIdx] = useState(-1)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [submenuFocusIdx, setSubmenuFocusIdx] = useState(-1)
  const [focusLevel, setFocusLevel] = useState<'main' | 'sub'>('main')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renamingGroupValue, setRenamingGroupValue] = useState('')
  const [resourceIcons, setResourceIcons] = useState<ResourceIconEntry[]>([])

  const groupRenameInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.settingsAPI?.getResourceIcons?.().then(setResourceIcons).catch(() => {})
  }, [])

  useEffect(() => {
    if (renamingGroupId !== null) setTimeout(() => groupRenameInputRef.current?.select(), 0)
  }, [renamingGroupId])

  useEffect(() => {
    if (!menuState) return
    const handleOutside = (e: MouseEvent) => {
      const inMain = menuRef.current?.contains(e.target as Node)
      const inSub = submenuRef.current?.contains(e.target as Node)
      if (!inMain && !inSub) {
        setMenuState(null)
        setSubmenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuState])

  // Keyboard navigation for menu
  useEffect(() => {
    if (!menuState) return

    // Root menu items: favorite, edit, separator, moveToGroup, duplicate, separator, delete
    // Actionable indices: 0=favorite, 1=edit, 2=moveToGroup, 3=duplicate, 4=delete
    const ROOT_COUNT = 5
    const MOVE_GROUP_IDX = 2
    // Submenu items: default + groups + createNew
    const subCount = 1 + groups.length + 1

    const handler = (e: KeyboardEvent) => {
      if (focusLevel === 'main') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMenuFocusIdx(prev => prev < ROOT_COUNT - 1 ? prev + 1 : 0)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMenuFocusIdx(prev => prev > 0 ? prev - 1 : ROOT_COUNT - 1)
        } else if (e.key === 'ArrowRight') {
          if (menuFocusIdx === MOVE_GROUP_IDX) {
            e.preventDefault()
            setSubmenuOpen(true)
            setFocusLevel('sub')
            setSubmenuFocusIdx(0)
          }
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setMenuState(null)
          setSubmenuOpen(false)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          // Trigger click on focused item — handled by the menu rendering
          const btns = menuRef.current?.querySelectorAll(':scope > button')
          if (btns && btns[menuFocusIdx]) (btns[menuFocusIdx] as HTMLButtonElement).click()
        }
      } else {
        // sub level
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSubmenuFocusIdx(prev => prev < subCount - 1 ? prev + 1 : 0)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSubmenuFocusIdx(prev => prev > 0 ? prev - 1 : subCount - 1)
        } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          e.preventDefault()
          setFocusLevel('main')
          setSubmenuOpen(false)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const btns = submenuRef.current?.querySelectorAll(':scope > button')
          if (btns && btns[submenuFocusIdx]) (btns[submenuFocusIdx] as HTMLButtonElement).click()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuState, menuFocusIdx, submenuFocusIdx, focusLevel, groups.length])

  // ── DnD sensors ────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // ── Derived state ───────────────────────────────────────────────────────────

  const isGroup = selection !== 'gallery' && selection !== 'recent' && selection !== 'favorites'
  const isUserGroup = isGroup && selection !== DEFAULT_GROUP_ID

  const baseList: ShortcutEntry[] = (() => {
    if (selection === 'gallery') return [...library].sort((a, b) => b.createdAt - a.createdAt)
    if (selection === 'recent') {
      return [...library]
        .filter((e) => e.lastUsed !== undefined || e.createdAt !== undefined)
        .sort((a, b) => Math.max(b.lastUsed ?? 0, b.createdAt) - Math.max(a.lastUsed ?? 0, a.createdAt))
        .slice(0, RECENT_MAX)
    }
    if (selection === 'favorites') return library.filter((e) => e.isFavorite)
    if (selection === DEFAULT_GROUP_ID) return library.filter((e) => !e.groupId)
    return library.filter((e) => e.groupId === selection)
  })()

  const displayList = searchQuery.trim()
    ? baseList.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : baseList

  const recentSorted = [...library]
    .filter((e) => e.lastUsed !== undefined || e.createdAt !== undefined)
    .sort((a, b) => Math.max(b.lastUsed ?? 0, b.createdAt) - Math.max(a.lastUsed ?? 0, a.createdAt))
  const favorites = library.filter((e) => e.isFavorite)

  // Gallery grouped sections (sidebar-consistent order)
  const galleryGroupedSections = selection === 'gallery' ? (() => {
    const searchFiltered = searchQuery.trim()
      ? library.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : library
    const sections = [
      { id: DEFAULT_GROUP_ID, name: t('lib.defaultGroup'), entries: searchFiltered.filter((e) => !e.groupId) },
      ...groups.map((g) => ({
        id: g.id,
        name: g.name,
        entries: searchFiltered.filter((e) => e.groupId === g.id),
      })),
    ].filter((s) => s.entries.length > 0)
    return sections
  })() : null

  const headerTitle: string = (() => {
    if (selection === 'gallery') return t('lib.gallery')
    if (selection === 'recent') return t('lib.recent')
    if (selection === 'favorites') return t('lib.favorites')
    if (selection === DEFAULT_GROUP_ID) return t('lib.defaultGroup')
    return groups.find((g) => g.id === selection)?.name ?? t('lib.gallery')
  })()

  const menuEntry = menuState ? library.find((e) => e.id === menuState.entryId) ?? null : null
  const draggingEntry = draggingId ? library.find((e) => e.id === draggingId) ?? null : null

  // ── Mutations ───────────────────────────────────────────────────────────────

  const mutateLibrary = (
    newLibrary: ShortcutEntry[],
    newGroups?: ShortcutGroup[],
    slotMutator?: (s: SlotConfig) => SlotConfig,
  ) => {
    updateDraft(buildConfigForDraft(draft, activeEditingAppId, newLibrary, newGroups, slotMutator))
  }

  const handleCreate = () => {
    const name = uniqueEntryName('New Shortcut', library)
    const entry: ShortcutEntry = {
      id: generateId(),
      name,
      actions: [],
      isFavorite: false,
      createdAt: Date.now(),
      groupId: isUserGroup ? selection : undefined,
    }
    mutateLibrary([...library, entry])
    openEditorForEntry(entry)
  }

  const handleImport = async () => {
    const imported = await window.settingsAPI.importPreset()
    if (!imported) return
    const entry: ShortcutEntry = {
      id: generateId(),
      name: imported.label || 'Imported Shortcut',
      actions: imported.actions,
      isFavorite: false,
      createdAt: Date.now(),
      groupId: isUserGroup ? selection : undefined,
    }
    mutateLibrary([...library, entry])
  }

  const handleToggleFavorite = (entryId: string) => {
    mutateLibrary(library.map((e) => e.id === entryId ? { ...e, isFavorite: !e.isFavorite } : e))
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    mutateLibrary(
      library.filter((e) => e.id !== id),
      undefined,
      (slot) => ({ ...slot, shortcutIds: (slot.shortcutIds ?? []).filter((sid) => sid !== id) }),
    )
    setDeleteTarget(null)
  }

  const handleDuplicate = (entryId: string) => {
    const entry = library.find((e) => e.id === entryId)
    if (!entry) return
    const newEntry: ShortcutEntry = {
      ...entry,
      id: generateId(),
      name: uniqueEntryName(entry.name, library),
      createdAt: Date.now(),
      isFavorite: false,
    }
    const idx = library.findIndex((e) => e.id === entryId)
    const newLibrary = [...library]
    newLibrary.splice(idx + 1, 0, newEntry)
    mutateLibrary(newLibrary)
  }

  const handleMoveToGroup = (entryId: string, targetGroupId: string | null) => {
    mutateLibrary(library.map((e) => e.id === entryId ? { ...e, groupId: targetGroupId ?? undefined } : e))
    setMenuState(null)
    setSubmenuOpen(false)
  }

  const handleAddGroup = () => {
    const newGroup: ShortcutGroup = { id: generateId(), name: generateGroupName(groups) }
    mutateLibrary(library, [...groups, newGroup])
    setSelection(newGroup.id)
    setRenamingGroupId(newGroup.id)
    setRenamingGroupValue(newGroup.name)
  }

  const handleDeleteGroup = () => {
    if (!deleteGroupTarget) return
    const id = deleteGroupTarget.id
    mutateLibrary(
      library.map((e) => e.groupId === id ? { ...e, groupId: undefined } : e),
      groups.filter((g) => g.id !== id),
    )
    setDeleteGroupTarget(null)
    if (selection === id) setSelection('gallery')
  }

  const handleExportGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    const entries = library.filter((e) => e.groupId === groupId)
    const bundle = { version: 1, type: 'shortcut-group', groupName: group?.name ?? 'Group', shortcuts: entries }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(group?.name ?? 'group').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-shortcuts.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRenameGroupCommit = () => {
    if (!renamingGroupId) return
    const name = renamingGroupValue.trim()
    if (name) mutateLibrary(library, groups.map((g) => g.id === renamingGroupId ? { ...g, name } : g))
    setRenamingGroupId(null)
  }

  const openEditorForEntry = (entry: ShortcutEntry) => {
    const theme = (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'dark'
    // Use the entry's own icon if available; fall back to first-action icon name
    const resolved = resolveEntryIcon(entry)
    const entryIcon = entry.icon ?? resolved.icon
    const virtualSlot: SlotConfig = {
      id: entry.id,
      label: entry.name,
      icon: entryIcon,
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

  const handleMenuOpen = (e: React.MouseEvent, entryId: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuState({ entryId, x: rect.right, y: rect.bottom, xl: rect.left })
    setMenuFocusIdx(-1)
    setSubmenuOpen(false)
    setSubmenuFocusIdx(-1)
    setFocusLevel('main')
  }

  // ── DnD ─────────────────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as string)
    setMenuState(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingId(null)
    if (!over) return

    const overId = String(over.id)

    if (overId.startsWith('group:')) {
      const targetGroupId = overId.slice(6)
      const resolvedGroupId = (!targetGroupId || targetGroupId === DEFAULT_GROUP_ID) ? undefined : targetGroupId
      mutateLibrary(library.map((e) => e.id === active.id ? { ...e, groupId: resolvedGroupId } : e))
      return
    }

    if (active.id !== over.id) {
      const fromIdx = library.findIndex((e) => e.id === active.id)
      const toIdx = library.findIndex((e) => e.id === over.id)
      if (fromIdx !== -1 && toIdx !== -1) mutateLibrary(arrayMove(library, fromIdx, toIdx))
    }
  }

  // ── Sidebar item ────────────────────────────────────────────────────────────

  const sidebarItem = (sel: Selection, label: string, count: number) => {
    const active = selection === sel
    return (
      <button
        key={sel}
        onClick={() => setSelection(sel)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '7px 12px',
          background: active ? 'var(--c-accent-subtle, rgba(99,102,241,0.12))' : 'none',
          border: 'none',
          borderLeft: active ? '3px solid var(--c-accent)' : '3px solid transparent',
          borderRadius: '0 6px 6px 0',
          color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
          fontSize: 13, fontFamily: 'inherit',
          cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.1s, color 0.1s',
          fontWeight: active ? 600 : 400,
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 11, background: 'var(--c-border)', color: 'var(--c-text-dim)', borderRadius: 10, padding: '1px 6px', minWidth: 20, textAlign: 'center' }}>
          {count}
        </span>
      </button>
    )
  }

  // ── Icon-only header button ─────────────────────────────────────────────────

  const iconBtn = (icon: React.ReactNode, title: string, onClick: () => void) => (
    <button
      key={title}
      onClick={onClick}
      title={title}
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--c-text-muted)', transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--c-elevated)'; b.style.color = 'var(--c-text)' }}
      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'none'; b.style.color = 'var(--c-text-muted)' }}
    >
      {icon}
    </button>
  )

  // ── Empty message ───────────────────────────────────────────────────────────

  const emptyMsg = searchQuery.trim()
    ? `No results for "${searchQuery}"`
    : selection === 'gallery' ? t('lib.emptyGallery')
    : selection === 'recent' ? t('lib.emptyRecent')
    : selection === 'favorites' ? t('lib.emptyFavorites')
    : t('lib.emptyGroup')

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── Left sidebar ── */}
        <div style={{
          width: 168, flexShrink: 0,
          borderRight: '1px solid var(--c-border-sub)',
          background: 'var(--c-surface)',
          display: 'flex', flexDirection: 'column',
          paddingTop: 12, overflowY: 'auto',
        }}>
          {sidebarItem('gallery',   t('lib.gallery'),   library.length)}
          {sidebarItem('recent',    t('lib.recent'),    recentSorted.length)}
          {sidebarItem('favorites', t('lib.favorites'), favorites.length)}

          {/* Groups section */}
          <div style={{ margin: '8px 0 4px', padding: '0 12px' }}>
            <div style={{ height: 1, background: 'var(--c-border-sub)', marginBottom: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('lib.groups')}
              </span>
              <button
                onClick={handleAddGroup}
                title={t('lib.addGroup')}
                style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--c-border)', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: 'var(--c-text-dim)', lineHeight: 1, transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
                onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--c-elevated)'; b.style.color = 'var(--c-text)' }}
                onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'none'; b.style.color = 'var(--c-text-dim)' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Permanent Default group */}
          <SidebarDroppableGroup
            key={DEFAULT_GROUP_ID}
            group={{ id: DEFAULT_GROUP_ID, name: t('lib.defaultGroup') }}
            isActive={selection === DEFAULT_GROUP_ID}
            onClick={() => setSelection(DEFAULT_GROUP_ID)}
          />

          {groups.map((group) => (
            <SidebarDroppableGroup
              key={group.id}
              group={group}
              isActive={selection === group.id}
              onClick={() => setSelection(group.id)}
            />
          ))}
        </div>

        {/* ── Right pane ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--c-bg)' }}>

          {/* Dynamic header */}
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid var(--c-border-sub)',
            background: 'var(--c-surface)',
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            {/* Title or inline rename */}
            {renamingGroupId === selection && isUserGroup ? (
              <input
                ref={groupRenameInputRef}
                value={renamingGroupValue}
                onChange={(e) => setRenamingGroupValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameGroupCommit()
                  if (e.key === 'Escape') setRenamingGroupId(null)
                }}
                onBlur={handleRenameGroupCommit}
                style={{
                  fontSize: 13, fontWeight: 600,
                  background: 'var(--c-input-bg)',
                  border: '1px solid var(--c-accent)',
                  borderRadius: 6, color: 'var(--c-text)',
                  padding: '3px 8px', fontFamily: 'inherit',
                  outline: 'none', maxWidth: 180, minWidth: 80,
                }}
              />
            ) : (
              <span
                onDoubleClick={() => {
                  if (isUserGroup) {
                    setRenamingGroupId(selection)
                    setRenamingGroupValue(headerTitle)
                  }
                }}
                title={isUserGroup ? 'Double-click to rename' : undefined}
                style={{
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--c-text)',
                  cursor: isUserGroup ? 'text' : 'default',
                  minWidth: 60, userSelect: 'none',
                }}
              >
                {headerTitle}
              </span>
            )}

            <div style={{ flex: 1 }} />

            {/* Group-specific actions — only when a custom group tab is active */}
            {isUserGroup && (
              <>
                {iconBtn(<UIIcon name="download" size={13} />, t('lib.exportGroup'), () => handleExportGroup(selection))}
                {iconBtn(<UIIcon name="delete" size={13} />, t('lib.deleteGroup'), () => {
                  const g = groups.find((g) => g.id === selection)
                  if (g) setDeleteGroupTarget(g)
                })}
                <div style={{ width: 1, height: 20, background: 'var(--c-border)', flexShrink: 0 }} />
              </>
            )}

            {/* Import & Create */}
            {iconBtn(<UIIcon name="upload" size={13} />, t('lib.import'), handleImport)}
            {iconBtn(<UIIcon name="add" size={13} />, t('lib.create'), handleCreate)}

            <div style={{ width: 1, height: 20, background: 'var(--c-border)', flexShrink: 0 }} />

            {/* View toggle */}
            <button
              onClick={() => setViewMode((v) => v === 'card' ? 'list' : 'card')}
              title={viewMode === 'card' ? t('lib.viewList') : t('lib.viewCard')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--c-text-muted)', transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--c-elevated)'; b.style.color = 'var(--c-text)' }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'none'; b.style.color = 'var(--c-text-muted)' }}
            >
              <UIIcon name={viewMode === 'card' ? 'menu' : 'apps'} size={14} />
            </button>

            {/* Search */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 7, color: 'var(--c-text-dim)', pointerEvents: 'none' }}><UIIcon name="search" size={12} /></span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('lib.search')}
                style={{
                  paddingLeft: 22, paddingRight: 8, height: 28,
                  borderRadius: 6, border: '1px solid var(--c-border)',
                  background: 'var(--c-input-bg)', color: 'var(--c-text)',
                  fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 140,
                  transition: 'border-color 0.1s',
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--c-accent)' }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--c-border)' }}
              />
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

            {/* Gallery grouped display */}
            {selection === 'gallery' && galleryGroupedSections !== null ? (
              galleryGroupedSections.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--c-text-dim)', fontSize: 13, padding: '48px 24px', lineHeight: 1.6 }}>
                  {emptyMsg}
                </div>
              ) : (
                <SortableContext items={library.map((e) => e.id)} strategy={rectSortingStrategy}>
                  {galleryGroupedSections.map((section) => (
                    <div key={section.id} style={{ marginBottom: 24 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--c-text-dim)', marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span>{section.name}</span>
                        <span style={{ fontSize: 10, background: 'var(--c-border)', color: 'var(--c-text-dim)', borderRadius: 8, padding: '1px 6px' }}>
                          {section.entries.length}
                        </span>
                      </div>
                      {viewMode === 'card' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                          {section.entries.map((entry) => (
                            <SortableCardWrapper key={entry.id} entry={entry} viewMode="card" onMenuOpen={handleMenuOpen} resourceIcons={resourceIcons} />
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {section.entries.map((entry) => (
                            <SortableCardWrapper key={entry.id} entry={entry} viewMode="list" onMenuOpen={handleMenuOpen} groupName={section.id === DEFAULT_GROUP_ID ? undefined : section.name} resourceIcons={resourceIcons} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </SortableContext>
              )
            ) : (
              /* Card / list grid for non-gallery views */
              displayList.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--c-text-dim)', fontSize: 13, padding: '48px 24px', lineHeight: 1.6 }}>
                  {emptyMsg}
                </div>
              ) : (
                <SortableContext items={displayList.map((e) => e.id)} strategy={rectSortingStrategy}>
                  {viewMode === 'card' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                      {displayList.map((entry) => {
                        const grp = entry.groupId ? groups.find((g) => g.id === entry.groupId) : null
                        return (
                          <SortableCardWrapper key={entry.id} entry={entry} viewMode="card" onMenuOpen={handleMenuOpen} groupName={grp?.name} resourceIcons={resourceIcons} />
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {displayList.map((entry) => {
                        const grp = entry.groupId ? groups.find((g) => g.id === entry.groupId) : null
                        return (
                          <SortableCardWrapper key={entry.id} entry={entry} viewMode="list" onMenuOpen={handleMenuOpen} groupName={grp?.name} resourceIcons={resourceIcons} />
                        )
                      })}
                    </div>
                  )}
                </SortableContext>
              )
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {draggingEntry && (
          <div style={{ opacity: 0.85, transform: 'rotate(1.5deg)', pointerEvents: 'none', width: viewMode === 'card' ? 200 : '100%' }}>
            <ShortcutCard entry={draggingEntry} viewMode={viewMode} onMenuOpen={() => {}} resourceIcons={resourceIcons} />
          </div>
        )}
      </DragOverlay>

      {/* Floating "More options" menu */}
      {menuState && menuEntry && (() => {
        const MENU_W = 168
        const openRight = menuState.x + MENU_W + 8 <= window.innerWidth
        const menuLeft = openRight ? menuState.x + 4 : menuState.xl - MENU_W - 4
        const menuTop = Math.min(menuState.y + 4, window.innerHeight - 260)
        const mainLeft = Math.max(8, menuLeft)
        return (
        <>
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuTop,
            left: mainLeft,
            zIndex: 1000,
            background: 'var(--c-elevated)',
            border: '1px solid var(--c-border)',
            borderRadius: 8,
            padding: '4px 0',
            minWidth: MENU_W,
            boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
          }}
        >
          <MenuItem focused={menuFocusIdx === 0} onMouseEnterItem={() => { setMenuFocusIdx(0); setFocusLevel('main'); setSubmenuOpen(false) }} onClick={() => { handleToggleFavorite(menuEntry.id); setMenuState(null) }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UIIcon name="favorite" size={13} color={menuEntry.isFavorite ? '#f59e0b' : 'var(--c-text-dim)'} />
              {menuEntry.isFavorite ? t('lib.unfavorite') : t('lib.favorite')}
            </span>
          </MenuItem>
          <MenuItem focused={menuFocusIdx === 1} onMouseEnterItem={() => { setMenuFocusIdx(1); setFocusLevel('main'); setSubmenuOpen(false) }} onClick={() => { openEditorForEntry(menuEntry); setMenuState(null) }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UIIcon name="edit" size={13} />
              {t('lib.edit')}
            </span>
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            focused={menuFocusIdx === 2 || submenuOpen}
            onMouseEnterItem={() => { setMenuFocusIdx(2); setFocusLevel('main'); setSubmenuOpen(true) }}
            onClick={() => setSubmenuOpen(prev => !prev)}
            rightAdornment={<UIIcon name="play_arrow" size={10} />}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UIIcon name="folder" size={13} />
              {t('lib.moveToGroup')}
            </span>
          </MenuItem>
          <MenuItem focused={menuFocusIdx === 3} onMouseEnterItem={() => { setMenuFocusIdx(3); setFocusLevel('main'); setSubmenuOpen(false) }} onClick={() => { handleDuplicate(menuEntry.id); setMenuState(null) }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UIIcon name="duplicate" size={13} />
              {t('lib.duplicate')}
            </span>
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger focused={menuFocusIdx === 4} onMouseEnterItem={() => { setMenuFocusIdx(4); setFocusLevel('main'); setSubmenuOpen(false) }} onClick={() => { setDeleteTarget(menuEntry); setMenuState(null) }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UIIcon name="delete" size={13} />
              {t('lib.delete')}
            </span>
          </MenuItem>
        </div>

        {/* Move-to-group submenu (opens to the right) */}
        {submenuOpen && (
          <div
            ref={submenuRef}
            style={{
              position: 'fixed',
              top: menuTop,
              left: mainLeft + MENU_W + 4,
              zIndex: 1001,
              background: 'var(--c-elevated)',
              border: '1px solid var(--c-border)',
              borderRadius: 8,
              padding: '4px 0',
              minWidth: MENU_W,
              boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            <MenuItem
              focused={focusLevel === 'sub' && submenuFocusIdx === 0}
              onMouseEnterItem={() => { setSubmenuFocusIdx(0); setFocusLevel('sub') }}
              onClick={() => handleMoveToGroup(menuEntry.id, null)}
              rightAdornment={!menuEntry.groupId ? <UIIcon name="check" size={10} /> : undefined}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UIIcon name="folder" size={13} />
                {t('lib.defaultGroup')}
              </span>
            </MenuItem>
            {groups.map((g, gi) => (
              <MenuItem
                key={g.id}
                focused={focusLevel === 'sub' && submenuFocusIdx === gi + 1}
                onMouseEnterItem={() => { setSubmenuFocusIdx(gi + 1); setFocusLevel('sub') }}
                onClick={() => handleMoveToGroup(menuEntry.id, g.id)}
                rightAdornment={menuEntry.groupId === g.id ? <UIIcon name="check" size={10} /> : undefined}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UIIcon name="folder" size={13} />
                  {g.name}
                </span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem
              focused={focusLevel === 'sub' && submenuFocusIdx === groups.length + 1}
              onMouseEnterItem={() => { setSubmenuFocusIdx(groups.length + 1); setFocusLevel('sub') }}
              onClick={() => {
                const newGroup: ShortcutGroup = { id: generateId(), name: generateGroupName(groups) }
                mutateLibrary(
                  library.map((e) => e.id === menuEntry.id ? { ...e, groupId: newGroup.id } : e),
                  [...groups, newGroup],
                )
                setSelection(newGroup.id)
                setMenuState(null)
                setSubmenuOpen(false)
                setRenamingGroupId(newGroup.id)
                setRenamingGroupValue(newGroup.name)
              }}
            >
              + {t('lib.createNewGroup')}
            </MenuItem>
          </div>
        )}
        </>
        )
      })()}

      {/* Delete entry dialog */}
      {deleteTarget && (
        <DeleteDialog
          entry={deleteTarget}
          refCount={countRefs(draft, deleteTarget.id)}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Delete group dialog */}
      {deleteGroupTarget && (
        <GroupDeleteDialog
          groupName={deleteGroupTarget.name}
          onConfirm={handleDeleteGroup}
          onCancel={() => setDeleteGroupTarget(null)}
        />
      )}
    </DndContext>
  )
}

// ── ShortcutsTab ───────────────────────────────────────────────────────────────

export function ShortcutsTab(): JSX.Element {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ShortcutsTabInner />
    </div>
  )
}
