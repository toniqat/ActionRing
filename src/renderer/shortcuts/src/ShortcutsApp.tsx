import React, { useState, useCallback, useEffect, useRef, Component } from 'react'
import type { ReactNode } from 'react'
import type { PlayNodeResult, ShortcutsSlotData, ResourceIconEntry } from '@shared/ipc.types'
import { WinControls } from '@settings/components/WinControls'
import { I18nProvider, useT } from '@settings/i18n/I18nContext'
import { BUILTIN_ICONS } from '@shared/icons'
import { UIIcon } from '@shared/UIIcon'
import { SVGIcon } from '@shared/SVGIcon'
import { HexColorPicker } from 'react-colorful'
import { VariableInput, collectAvailableVars } from './VariableInput'
import {
  DndContext,
  closestCenter,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  MeasuringStrategy,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type DroppableContainer,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  ActionConfig, SlotConfig, SystemActionId, Language,
  IfElseAction, LoopAction, WaitAction, SetVarAction, ToastAction, RunShortcutAction,
  ConditionCriteria, ConditionOperator, ConditionMatchLogic,
  LoopMode, VarDataType, VarOperation, CalculateAction, CalcOperation, CommentAction, StopAction,
  SequenceAction, WaitMode,
} from '@shared/config.types'
import type { ShortcutEntry, ShortcutGroup } from '@shared/config.types'
import type { Translations } from '@settings/i18n/locales'

// ── Window API declaration ─────────────────────────────────────────────────────

declare global {
  interface Window {
    shortcutsAPI: {
      getSlotData: () => Promise<ShortcutsSlotData>
      updateSlot: (slot: SlotConfig) => void
      closeWindow: () => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      playActions: (actions: ActionConfig[]) => Promise<PlayNodeResult[]>
      pickExe: () => Promise<string | null>
      exportPreset: (slot: SlotConfig) => Promise<void>
      importPreset: () => Promise<SlotConfig | null>
      onDataRefresh: (cb: (data: ShortcutsSlotData) => void) => void
      getResourceIcons: () => Promise<ResourceIconEntry[]>
      addRecentIcon: (iconRef: string) => void
    }
  }
}

// ── Custom PointerSensor — skip interactive elements so empty card space drags ─

const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'OPTION'])

function isInteractiveElement(el: HTMLElement | null): boolean {
  while (el) {
    if (INTERACTIVE_TAGS.has(el.tagName)) return true
    if (el.isContentEditable) return true
    if (el.dataset?.noDnd === 'true') return true
    el = el.parentElement
  }
  return false
}

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: e }: { nativeEvent: PointerEvent }) => {
        return !isInteractiveElement(e.target as HTMLElement)
      },
    },
  ]
}

// ── Custom collision detection — prioritise branch drop zones ────────────────
// Branch zones (id starting with "branch:") are small and easily eclipsed by
// large sortable items around them.  We check branch zones first using
// rectIntersection so they win when the pointer is actually inside them.

// IDs of large wrapper drop zones that should only match as a last resort
const ZONE_IDS = new Set(['workspace', 'delete-zone'])

const branchPriorityCollision: CollisionDetection = (args) => {
  const activeId = args.active.id.toString()
  const isNestedDrag = activeId.startsWith('nested:')

  const nestedContainers: DroppableContainer[] = []
  const branchContainers: DroppableContainer[] = []
  const sortableContainers: DroppableContainer[] = []   // individual node items
  const zoneContainers: DroppableContainer[] = []        // workspace / delete-zone
  for (const container of args.droppableContainers) {
    const id = container.id.toString()
    if (id.startsWith('nested:')) {
      nestedContainers.push(container)
    } else if (id.startsWith('branch:')) {
      branchContainers.push(container)
    } else if (ZONE_IDS.has(id)) {
      zoneContainers.push(container)
    } else {
      sortableContainers.push(container)
    }
  }

  if (isNestedDrag) {
    // When dragging a nested item, first check if the pointer is over a zone
    // (delete-zone / workspace).  If so, that takes priority so nested items
    // can be extracted or deleted.
    if (zoneContainers.length > 0) {
      const zoneHits = rectIntersection({ ...args, droppableContainers: zoneContainers })
      if (zoneHits.length > 0) {
        // Pointer is inside a zone — but only honour it when it is NOT also
        // inside a branch zone (branches are more specific).
        const branchHits = branchContainers.length > 0
          ? rectIntersection({ ...args, droppableContainers: branchContainers })
          : []
        if (branchHits.length === 0) return zoneHits
      }
    }
    // Then check sortable top-level nodes (for insertion between them)
    if (sortableContainers.length > 0) {
      const sortHits = closestCenter({ ...args, droppableContainers: sortableContainers })
      if (sortHits.length > 0) {
        // Only honour sortable hits when the pointer is outside all branch zones
        const branchHits = branchContainers.length > 0
          ? rectIntersection({ ...args, droppableContainers: branchContainers })
          : []
        if (branchHits.length === 0) return sortHits
      }
    }
    // Then nested items for reorder within/across branches
    if (nestedContainers.length > 0) {
      const hits = closestCenter({ ...args, droppableContainers: nestedContainers })
      if (hits.length > 0) return hits
    }
    if (branchContainers.length > 0) {
      const hits = rectIntersection({ ...args, droppableContainers: branchContainers })
      if (hits.length > 0) return hits
    }
    const remaining = [...sortableContainers, ...zoneContainers]
    return closestCenter({ ...args, droppableContainers: remaining.length > 0 ? remaining : args.droppableContainers })
  }

  // Non-nested drag: check if pointer is inside the delete-zone first.
  // Without this, closestCenter on sortable nodes always wins even when the
  // pointer is clearly over the delete-zone, preventing node deletion.
  const deleteZone = zoneContainers.filter(c => c.id === 'delete-zone')
  if (deleteZone.length > 0) {
    const deleteHits = rectIntersection({ ...args, droppableContainers: deleteZone })
    if (deleteHits.length > 0) return deleteHits
  }
  // Then prioritise branch zones, then individual sortable nodes
  if (branchContainers.length > 0) {
    const branchHits = rectIntersection({ ...args, droppableContainers: branchContainers })
    if (branchHits.length > 0) return branchHits
  }
  if (sortableContainers.length > 0) {
    const sortHits = closestCenter({ ...args, droppableContainers: sortableContainers })
    if (sortHits.length > 0) return sortHits
  }
  // Fall back to remaining zones (workspace)
  if (zoneContainers.length > 0) {
    return rectIntersection({ ...args, droppableContainers: zoneContainers })
  }
  return closestCenter({ ...args, droppableContainers: args.droppableContainers })
}

// ── Palette tab type ───────────────────────────────────────────────────────────

type PaletteTab = 'actions' | 'scripts' | 'shortcuts' | 'all'

// ── Node visual config ─────────────────────────────────────────────────────────

type NodeStyle = Record<string, { label: string; icon: string; color: string; desc: string }>

function getNodeStyle(t: (key: keyof Translations) => string): NodeStyle {
  return {
    launch:          { label: t('action.launch'),          icon: 'launch',        color: '#3b82f6', desc: t('action.launchDesc') },
    shortcut:        { label: t('action.shortcut'),        icon: 'shortcut',      color: '#8b5cf6', desc: t('action.shortcutDesc') },
    shell:           { label: t('action.shell'),           icon: 'shell',         color: '#10b981', desc: t('action.shellDesc') },
    system:          { label: t('action.system'),          icon: 'system',        color: '#f59e0b', desc: t('action.systemDesc') },
    'if-else':       { label: t('action.ifElse'),          icon: 'if_else',       color: '#ec4899', desc: t('action.ifElseDesc') },
    loop:            { label: t('action.loop'),            icon: 'loop',          color: '#06b6d4', desc: t('action.loopDesc') },
    wait:            { label: t('action.wait'),            icon: 'wait',          color: '#84cc16', desc: t('action.waitDesc') },
    'set-var':       { label: t('action.setVar'),          icon: 'set_var',       color: '#a78bfa', desc: t('action.setVarDesc') },
    toast:           { label: t('action.toast'),           icon: 'toast',         color: '#fb923c', desc: t('action.toastDesc') },
    'run-shortcut':  { label: t('action.runShortcut'),     icon: 'call_shortcut', color: '#22d3ee', desc: t('action.runShortcutDesc') },
    escape:          { label: t('action.escape'),          icon: 'exit_to_app',   color: '#f59e0b', desc: t('action.escapeDesc') },
    stop:            { label: t('action.stop'),            icon: 'stop',          color: '#ef4444', desc: t('action.stopDesc') },
    calculate:       { label: t('action.calculate'),       icon: 'calculate',     color: '#10b981', desc: t('action.calculateDesc') },
    comment:         { label: t('action.comment'),         icon: 'comment',       color: '#6b7280', desc: t('action.commentDesc') },
    sequence:        { label: t('action.sequence'),        icon: 'all_inclusive', color: '#f472b6', desc: t('action.sequenceDesc') },
  }
}

/**
 * Renders a node icon, checking BUILTIN_ICONS first (stroke-based SVGs) before
 * falling back to UI_ICONS (Material Design filled SVGs via UIIcon).
 */
function renderNodeIcon(name: string, size: number): JSX.Element | null {
  const builtin = BUILTIN_ICONS.find((ic) => ic.name === name)
  if (builtin) return <SVGIcon svgString={builtin.svg} size={size} />
  return <UIIcon name={name} size={size} />
}

function getSystemLabels(t: (key: keyof Translations) => string): Record<SystemActionId, string> {
  return {
    'volume-up':    t('system.volume-up'),
    'volume-down':  t('system.volume-down'),
    'mute':         t('system.mute'),
    'play-pause':   t('system.play-pause'),
    'screenshot':   t('system.screenshot'),
    'lock-screen':  t('system.lock-screen'),
    'show-desktop': t('system.show-desktop'),
  }
}

const SYSTEM_ACTIONS: SystemActionId[] = [
  'volume-up', 'volume-down', 'mute', 'play-pause',
  'screenshot', 'lock-screen', 'show-desktop',
]

// ── Icon/Color picker constants ────────────────────────────────────────────────
const PRESET_BG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]
const PICKER_BTN = 36
const PICKER_GAP = 6
const PICKER_COLS = 5

const ACTION_TYPES  = ['launch', 'shortcut', 'shell', 'system']
const SCRIPT_TYPES  = ['if-else', 'loop', 'sequence', 'wait', 'set-var', 'toast', 'run-shortcut', 'escape', 'stop', 'calculate', 'comment']

function generateNodeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActionNode {
  _id: string
  action: ActionConfig
}

// ── ShortcutRecorder ───────────────────────────────────────────────────────────

function compressPath(p: string): string {
  const sep = p.includes('\\') ? '\\' : '/'
  const parts = p.split(sep).filter(Boolean)
  if (parts.length <= 3) return p
  return `${parts[0]}${sep}...${sep}${parts[parts.length - 2]}${sep}${parts[parts.length - 1]}`
}

function buildKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey)  parts.push('Win')
  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    if (key === ' ')           parts.push('Space')
    else if (key.length === 1) parts.push(key.toUpperCase())
    else                       parts.push(key)
  }
  return parts.join('+')
}

interface ShortcutRecorderProps {
  value: string
  onChange: (keys: string) => void
}

function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps): JSX.Element {
  const t = useT()
  const [recording, setRecording] = useState(false)
  const pendingRef = useRef<string>(value)
  const [pendingDisplay, setPendingDisplay] = useState(value)

  const stopRecording = useCallback((save: boolean) => {
    setRecording(false)
    if (save && pendingRef.current) onChange(pendingRef.current)
  }, [onChange])

  useEffect(() => {
    if (!recording) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        pendingRef.current = value
        setPendingDisplay(value)
        stopRecording(false)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const combo = buildKeyCombo(e)
      if (combo) {
        pendingRef.current = combo
        setPendingDisplay(combo)
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [recording, value, stopRecording])

  const handleClick = (e: React.MouseEvent) => {
    if (e.detail === 0) return
    if (recording) {
      stopRecording(true)
    } else {
      pendingRef.current = value
      setPendingDisplay(value)
      setRecording(true)
    }
  }

  const displayText = recording
    ? (pendingDisplay || t('recorder.recording'))
    : (value || t('recorder.clickToRecord'))

  return (
    <>
      <style>{`
        @keyframes recorder-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
          50%       { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
      `}</style>
      <button
        type="button"
        onClick={handleClick}
        title={recording ? t('recorder.clickToSave') : t('recorder.clickToRecord')}
        style={{
          width: '100%',
          background: recording ? 'rgba(239,68,68,0.08)' : 'var(--c-input-bg)',
          border: `1px solid ${recording ? '#ef4444' : 'var(--c-border)'}`,
          borderRadius: 6,
          color: recording ? '#ef4444' : 'var(--c-text)',
          padding: '5px 8px',
          fontSize: 12,
          fontFamily: 'monospace, inherit',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 28,
          animation: recording ? 'recorder-pulse 1.2s ease-in-out infinite' : 'none',
          transition: 'border-color 0.15s, background 0.15s, color 0.15s',
        }}
      >
        <span style={{ fontSize: 8, lineHeight: 1, flexShrink: 0 }}>
          {recording ? '●' : '○'}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText}
        </span>
        {recording && (
          <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.6)', flexShrink: 0 }}>
            {t('recorder.clickToSaveHint')}
          </span>
        )}
      </button>
    </>
  )
}

// ── NestedActionList — action list with DnD drop zone support ────────────────

function makeDefaultAction(type: string, extraData?: { shortcutId?: string }): ActionConfig {
  switch (type) {
    case 'launch':        return { type: 'launch', target: '' }
    case 'shortcut':      return { type: 'shortcut', keys: '' }
    case 'shell':         return { type: 'shell', command: '' }
    case 'wait':          return { type: 'wait', ms: 500 }
    case 'set-var':       return { type: 'set-var', name: '', value: '', scope: 'local' }
    case 'toast':         return { type: 'toast', message: '' }
    case 'if-else':       return { type: 'if-else', condition: '', matchLogic: 'all', criteria: [{ variable: '', operator: 'eq' as ConditionOperator, value: '' }], thenActions: [], elseActions: [] }
    case 'loop':          return { type: 'loop', mode: 'repeat' as LoopMode, count: 3, body: [] }
    case 'run-shortcut': return { type: 'run-shortcut', shortcutId: extraData?.shortcutId ?? '' }
    case 'escape':        return { type: 'escape' }
    case 'stop':          return { type: 'stop' }
    case 'calculate':     return { type: 'calculate', operation: 'add' as CalcOperation, operandA: '', operandB: '', resultVar: 'result', scope: 'local' }
    case 'comment':       return { type: 'comment', text: '' }
    case 'sequence':      return { type: 'sequence', name: '', body: [], showProgress: true }
    default:              return { type: 'system', action: 'volume-up' as SystemActionId }
  }
}

interface NestedActionListProps {
  label: string
  color: string
  actions: ActionConfig[]
  onChange: (actions: ActionConfig[]) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  branchId?: string
  currentEntryId?: string
}

function NestedActionList({ label, color, actions, onChange, nodeStyle, library, branchId, currentEntryId }: NestedActionListProps): JSX.Element {
  const fallbackId = useRef(`branch-noop-${Math.random().toString(36).slice(2, 6)}`).current
  const effectiveBranchId = branchId ?? fallbackId
  const { setNodeRef: setBranchDropRef, isOver: isBranchOver } = useDroppable({ id: effectiveBranchId })

  const deleteAction = (idx: number) => {
    onChange(actions.filter((_, i) => i !== idx))
  }

  const updateAction = (idx: number, updated: ActionConfig) => {
    onChange(actions.map((a, i) => i === idx ? updated : a))
  }

  const isEmpty = actions.length === 0
  const itemIds = actions.map((_, i) => `nested:${effectiveBranchId}:${i}`)

  return (
    <div style={{ marginTop: isEmpty && !isBranchOver ? 0 : 2 }}>
      {/* Section label — acts as a branch header (hidden when label is empty) */}
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          color, marginBottom: 3, opacity: 0.9,
        }}>
          <span style={{ width: 10, height: 1, background: color, display: 'inline-block', flexShrink: 0, opacity: 0.5 }} />
          {label}
          <span style={{ flex: 1, height: 1, background: color, display: 'inline-block', opacity: 0.15 }} />
        </div>
      )}

      {/* Indented block with left guide line — DnD drop zone for branch */}
      <div
        ref={branchId ? setBranchDropRef : undefined}
        style={{
          paddingLeft: isEmpty && !isBranchOver ? 0 : 10,
          borderLeft: (actions.length > 0 || isBranchOver)
            ? `2px solid ${isBranchOver ? color : `${color}33`}`
            : isEmpty ? `2px dashed ${color}22` : 'none',
          marginLeft: 4,
          minHeight: isEmpty ? (isBranchOver ? 32 : 28) : 0,
          background: isBranchOver ? `${color}0d` : undefined,
          borderRadius: isBranchOver ? '0 4px 4px 0' : undefined,
          transition: 'border-color 0.15s, background 0.15s, min-height 0.15s',
        }}
      >
        {/* Sub-action rows — sortable nested cards */}
        {actions.length > 0 && (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
              {actions.map((action, idx) => (
                <SortableNestedCard
                  key={itemIds[idx]}
                  id={itemIds[idx]}
                  branchId={effectiveBranchId}
                  index={idx}
                  actions={actions}
                  onReorder={onChange}
                  action={action}
                  nodeStyle={nodeStyle}
                  library={library}
                  onChange={(updated) => updateAction(idx, updated)}
                  onDelete={() => deleteAction(idx)}
                  currentEntryId={currentEntryId}
                  depth={0}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>{/* end indented block */}
    </div>
  )
}

// ── ConditionInlineFields — match logic + criteria list for if-else header ──────

function ConditionInlineFields({ action, onChange, availableVars }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
  availableVars?: string[]
}): JSX.Element {
  const t = useT()
  const matchLogic: ConditionMatchLogic = action.matchLogic ?? 'all'
  const criteria: ConditionCriteria[] = action.criteria ?? [{ variable: '', operator: 'eq', value: '' }]

  const OPERATORS: { value: ConditionOperator; label: string }[] = [
    { value: 'eq',          label: '==' },
    { value: 'neq',         label: '!=' },
    { value: 'gt',          label: '>'  },
    { value: 'lt',          label: '<'  },
    { value: 'gte',         label: '>=' },
    { value: 'lte',         label: '<=' },
    { value: 'contains',    label: 'contains' },
    { value: 'not-contains',label: '!contains' },
    { value: 'is-empty',    label: 'is empty' },
    { value: 'is-not-empty',label: 'not empty' },
  ]

  const noValueOps = new Set<ConditionOperator>(['is-empty', 'is-not-empty'])

  const inp: React.CSSProperties = {
    background: 'var(--c-input-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const updateCriteria = (newCriteria: ConditionCriteria[]) =>
    onChange({ ...action, criteria: newCriteria })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
      {/* Row 1: Match All / Any */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.matchLogicPrefix')}</span>
        <select
          value={matchLogic}
          onChange={(e) => onChange({ ...action, matchLogic: e.target.value as ConditionMatchLogic })}
          style={{ ...inp, minWidth: 68 }}
        >
          <option value="all">{t('script.matchAll')}</option>
          <option value="any">{t('script.matchAny')}</option>
        </select>
      </div>

      {/* Criteria rows */}
      {criteria.map((crit, idx) => (
        <div key={idx}>
          <div style={{ height: 1, background: 'var(--c-border)', margin: '2px 0', opacity: 0.5 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingTop: 2 }}>
            <VariableInput
              value={crit.variable}
              onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, variable: v } : c))}
              availableVars={availableVars ?? []}
              placeholder={t('script.conditionVar')}
              style={{ ...inp, width: 90 }}
            />
            <select
              value={crit.operator}
              onChange={(e) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, operator: e.target.value as ConditionOperator } : c))}
              style={{ ...inp, minWidth: 88 }}
            >
              {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
            {!noValueOps.has(crit.operator) && (
              <VariableInput
                value={crit.value}
                onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, value: v } : c))}
                availableVars={availableVars ?? []}
                placeholder={t('script.conditionVal')}
                style={{ ...inp, width: 80 }}
              />
            )}
            {criteria.length > 1 && (
              <button
                onClick={() => updateCriteria(criteria.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', borderRadius: 3, display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
              ><UIIcon name="close" size={11} /></button>
            )}
          </div>
        </div>
      ))}

      {/* Add criteria */}
      <button
        onClick={() => updateCriteria([...criteria, { variable: '', operator: 'eq', value: '' }])}
        style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: '2px 0', fontFamily: 'inherit' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-accent)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
      >
        {t('script.addCriteria')}
      </button>
    </div>
  )
}

// ── ConditionMatchSelect — just the Match All/Any dropdown (for header row) ──────

function ConditionMatchSelect({ action, onChange }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
}): JSX.Element {
  const t = useT()
  const matchLogic: ConditionMatchLogic = action.matchLogic ?? 'all'
  const inp: React.CSSProperties = {
    background: 'var(--c-input-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.matchLogicPrefix')}</span>
      <select
        value={matchLogic}
        onChange={(e) => onChange({ ...action, matchLogic: e.target.value as ConditionMatchLogic })}
        style={{ ...inp, minWidth: 68 }}
      >
        <option value="all">{t('script.matchAll')}</option>
        <option value="any">{t('script.matchAny')}</option>
      </select>
    </div>
  )
}

// ── ConditionCriteriaSection — criteria rows + add button (below header divider) ─

function ConditionCriteriaSection({ action, onChange }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
}): JSX.Element {
  const t = useT()
  const criteria: ConditionCriteria[] = action.criteria ?? [{ variable: '', operator: 'eq', value: '' }]

  const OPERATORS: { value: ConditionOperator; label: string }[] = [
    { value: 'eq',          label: '==' },
    { value: 'neq',         label: '!=' },
    { value: 'gt',          label: '>'  },
    { value: 'lt',          label: '<'  },
    { value: 'gte',         label: '>=' },
    { value: 'lte',         label: '<=' },
    { value: 'contains',    label: 'contains' },
    { value: 'not-contains',label: '!contains' },
    { value: 'is-empty',    label: 'is empty' },
    { value: 'is-not-empty',label: 'not empty' },
  ]

  const noValueOps = new Set<ConditionOperator>(['is-empty', 'is-not-empty'])

  const inp: React.CSSProperties = {
    background: 'var(--c-input-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const updateCriteria = (newCriteria: ConditionCriteria[]) =>
    onChange({ ...action, criteria: newCriteria })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
      {criteria.map((crit, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input
            value={crit.variable}
            onChange={(e) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, variable: e.target.value } : c))}
            placeholder={t('script.conditionVar')}
            style={{ ...inp, width: 90 }}
          />
          <select
            value={crit.operator}
            onChange={(e) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, operator: e.target.value as ConditionOperator } : c))}
            style={{ ...inp, minWidth: 88 }}
          >
            {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
          {!noValueOps.has(crit.operator) && (
            <input
              value={crit.value}
              onChange={(e) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, value: e.target.value } : c))}
              placeholder={t('script.conditionVal')}
              style={{ ...inp, width: 80 }}
            />
          )}
          {criteria.length > 1 && (
            <button
              onClick={() => updateCriteria(criteria.filter((_, i) => i !== idx))}
              style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', borderRadius: 3, display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
            ><UIIcon name="close" size={11} /></button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => updateCriteria([...criteria, { variable: '', operator: 'eq', value: '' }])}
          style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-accent)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
        >
          {t('script.addCriteria')}
        </button>
      </div>
    </div>
  )
}

// ── ConditionBranchesExternal — Then/Else/End If rendered outside the card ───────

function ConditionBranchesExternal({ action, onChange, nodeStyle, library, nodeId, currentEntryId }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  nodeId: string
  currentEntryId?: string
}): JSX.Element {
  const t = useT()
  const color = nodeStyle['if-else']?.color ?? '#ec4899'
  return (
    <div>
      {/* THEN divider — external structural marker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 2px 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.thenLabel')}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}44` }} />
      </div>
      <NestedActionList
        label=""
        color={color}
        actions={action.thenActions}
        onChange={(acts) => onChange({ ...action, thenActions: acts })}
        nodeStyle={nodeStyle}
        library={library}
        branchId={`branch:${nodeId}:then`}
        currentEntryId={currentEntryId}
      />

      {/* ELSE divider — external structural marker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 2px 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.elseLabel')}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(107,114,128,0.3)' }} />
      </div>
      <NestedActionList
        label=""
        color="#6b7280"
        actions={action.elseActions}
        onChange={(acts) => onChange({ ...action, elseActions: acts })}
        nodeStyle={nodeStyle}
        library={library}
        branchId={`branch:${nodeId}:else`}
        currentEntryId={currentEntryId}
      />

      {/* END IF divider — external structural marker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 0 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
          END IF
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}22` }} />
      </div>
    </div>
  )
}

// ── LoopBranchesExternal — Loop Body/End rendered outside the card ───────────────

function LoopBranchesExternal({ action, onChange, nodeStyle, library, nodeId, currentEntryId }: {
  action: LoopAction
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  nodeId: string
  currentEntryId?: string
}): JSX.Element {
  const color = nodeStyle['loop']?.color ?? '#06b6d4'
  return (
    <div>
      {/* DO divider — start of loop body */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 2px 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
          DO
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}44` }} />
      </div>
      <NestedActionList
        label=""
        color={color}
        actions={action.body}
        onChange={(acts) => onChange({ ...action, body: acts })}
        nodeStyle={nodeStyle}
        library={library}
        branchId={`branch:${nodeId}:loop`}
        currentEntryId={currentEntryId}
      />

      {/* LOOP END divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 0 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
          LOOP END
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}22` }} />
      </div>
    </div>
  )
}

function SequenceBranchesExternal({ action, onChange, nodeStyle, library, nodeId, currentEntryId }: {
  action: SequenceAction
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  nodeId: string
  currentEntryId?: string
}): JSX.Element {
  const t = useT()
  const color = nodeStyle['sequence']?.color ?? '#f472b6'
  return (
    <div>
      {/* PARALLEL divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 2px 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.sequenceBody')}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}44` }} />
      </div>
      <NestedActionList
        label=""
        color={color}
        actions={action.body}
        onChange={(acts) => onChange({ ...action, body: acts })}
        nodeStyle={nodeStyle}
        library={library}
        branchId={`branch:${nodeId}:sequence`}
        currentEntryId={currentEntryId}
      />

      {/* SEQ END divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 0 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.sequenceEnd')}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}22` }} />
      </div>
    </div>
  )
}

// ── InlineNodeFields — unified right-side input for every node type ─────────────

function InlineNodeFields({ action, onChange, nodeStyle, library, currentEntryId, availableVars }: {
  action: ActionConfig
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  currentEntryId?: string
  availableVars?: string[]
}): JSX.Element {
  const t = useT()
  const SYSTEM_LABELS = getSystemLabels(t)

  const inp: React.CSSProperties = {
    background: 'var(--c-input-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 6,
    color: 'var(--c-text)',
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  if (action.type === 'launch') {
    return (
      <button
        onClick={async () => {
          const path = await window.shortcutsAPI.pickExe()
          if (path) onChange({ type: 'launch', target: path })
        }}
        title={action.target || t('modal.appPath')}
        style={{
          ...inp, cursor: 'pointer', textAlign: 'left', display: 'block',
          color: action.target ? 'var(--c-text)' : 'var(--c-text-dim)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 120, maxWidth: 260,
        }}
      >
        {action.target ? compressPath(action.target) : t('modal.appPath')}
      </button>
    )
  }

  if (action.type === 'shortcut') {
    return (
      <div style={{ minWidth: 140, maxWidth: 220 }}>
        <ShortcutRecorder value={action.keys} onChange={(keys) => onChange({ type: 'shortcut', keys })} />
      </div>
    )
  }

  if (action.type === 'shell') {
    return (
      <VariableInput
        value={action.command}
        onChange={(v) => onChange({ type: 'shell', command: v })}
        availableVars={availableVars ?? []}
        placeholder={t('modal.shellCmd')}
        style={{ ...inp, minWidth: 120, flex: 1 }}
      />
    )
  }

  if (action.type === 'system') {
    return (
      <select
        value={action.action}
        onChange={(e) => onChange({ type: 'system', action: e.target.value as SystemActionId })}
        style={{ ...inp, minWidth: 120 }}
      >
        {SYSTEM_ACTIONS.map((a) => (
          <option key={a} value={a}>{SYSTEM_LABELS[a]}</option>
        ))}
      </select>
    )
  }

  if (action.type === 'sequence') {
    const a = action as SequenceAction
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.name}
          onChange={(v) => onChange({ ...a, name: v })}
          availableVars={availableVars ?? []}
          placeholder={t('script.sequenceName')}
          style={{ ...inp, minWidth: 100, flex: 1 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--c-text-dim)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={a.showProgress !== false}
            onChange={(e) => onChange({ ...a, showProgress: e.target.checked })}
          />
          {t('script.showProgress')}
        </label>
      </div>
    )
  }

  if (action.type === 'wait') {
    const a = action as WaitAction
    const mode: WaitMode = a.mode ?? 'manual'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <select
          value={mode}
          onChange={(e) => onChange({ ...a, mode: e.target.value as WaitMode })}
          style={{ ...inp, width: 90 }}
        >
          <option value="manual">{t('script.waitManual')}</option>
          <option value="variable">{t('script.waitVariable')}</option>
          <option value="app-exit">{t('script.waitAppExit')}</option>
        </select>
        {mode === 'manual' && (
          <>
            <input
              type="number"
              value={a.ms}
              min={0} max={60000}
              onChange={(e) => onChange({ ...a, ms: Math.max(0, Number(e.target.value)) })}
              style={{ ...inp, width: 80 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.delayMs')}</span>
          </>
        )}
        {mode === 'variable' && (
          <VariableInput
            value={a.variable ?? ''}
            onChange={(v) => onChange({ ...a, variable: v })}
            availableVars={availableVars ?? []}
            placeholder="$varName"
            style={{ ...inp, width: 100 }}
          />
        )}
        {mode === 'app-exit' && (
          <VariableInput
            value={a.launchRef ?? ''}
            onChange={(v) => onChange({ ...a, launchRef: v })}
            availableVars={availableVars ?? []}
            placeholder={t('script.waitAppTarget')}
            style={{ ...inp, width: 140 }}
          />
        )}
      </div>
    )
  }

  if (action.type === 'set-var') {
    const a = action as SetVarAction
    const dataType: VarDataType = a.dataType ?? 'string'
    const op: VarOperation      = a.operation ?? 'set'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {/* Data type selector */}
        <select
          value={dataType}
          onChange={(e) => onChange({ ...a, dataType: e.target.value as VarDataType, operation: 'set' as VarOperation })}
          style={{ ...inp, width: 70 }}
        >
          <option value="string">{t('script.varTypeString')}</option>
          <option value="list">{t('script.varTypeList')}</option>
          <option value="dict">{t('script.varTypeDict')}</option>
        </select>
        {/* Operation selector (non-string types) */}
        {dataType !== 'string' && (
          <select
            value={op}
            onChange={(e) => onChange({ ...a, operation: e.target.value as VarOperation })}
            style={{ ...inp, width: 72 }}
          >
            <option value="set">{t('script.varOpSet')}</option>
            <option value="get">{t('script.varOpGet')}</option>
            <option value="push">{t('script.varOpPush')}</option>
            <option value="remove">{t('script.varOpRemove')}</option>
          </select>
        )}
        {/* Variable name (target for set/push/remove; source for get) */}
        <input
          value={a.name}
          onChange={(e) => onChange({ ...a, name: e.target.value })}
          placeholder={t('script.varName')}
          style={{ ...inp, width: 90 }}
        />
        {/* Value field — shown for set/push */}
        {(dataType === 'string' || op === 'set' || op === 'push') && (
          <>
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>
              {op === 'push' ? '←' : '='}
            </span>
            <VariableInput
              value={a.value}
              onChange={(v) => onChange({ ...a, value: v })}
              availableVars={availableVars ?? []}
              placeholder={t('script.varValue')}
              style={{ ...inp, flex: 1, minWidth: 80 }}
            />
          </>
        )}
        {/* Key field — for dict push/get/remove or list get/remove */}
        {dataType !== 'string' && (op === 'push' || op === 'get' || op === 'remove') && (
          <input
            value={a.key ?? ''}
            onChange={(e) => onChange({ ...a, key: e.target.value })}
            placeholder={t('script.varKey')}
            style={{ ...inp, width: 72 }}
          />
        )}
        {/* Result variable — for get operation */}
        {op === 'get' && (
          <input
            value={a.resultVar ?? ''}
            onChange={(e) => onChange({ ...a, resultVar: e.target.value })}
            placeholder={t('script.varResultVar')}
            style={{ ...inp, width: 90 }}
          />
        )}
      </div>
    )
  }

  if (action.type === 'toast') {
    const a = action as ToastAction
    return (
      <VariableInput
        value={a.message}
        onChange={(v) => onChange({ ...a, message: v })}
        availableVars={availableVars ?? []}
        placeholder={t('script.message')}
        style={{ ...inp, minWidth: 120, flex: 1 }}
      />
    )
  }

  if (action.type === 'run-shortcut') {
    const a = action as RunShortcutAction
    const available = currentEntryId ? library.filter((e) => e.id !== currentEntryId) : library
    const inputs = a.inputs ?? {}
    const inputEntries = Object.entries(inputs)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <select
            value={a.shortcutId}
            onChange={(e) => onChange({ ...a, shortcutId: e.target.value })}
            style={{ ...inp, minWidth: 140, flex: 1 }}
          >
            <option value="">{available.length === 0 ? t('script.noShortcuts') : t('script.selectShortcut')}</option>
            {available.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
          <input
            value={a.outputVar ?? ''}
            onChange={(e) => onChange({ ...a, outputVar: e.target.value || undefined })}
            placeholder={t('script.outputVar')}
            style={{ ...inp, width: 90 }}
          />
        </div>
        {/* Input parameter mappings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
          {inputEntries.map(([param, expr], idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                value={param}
                onChange={(e) => {
                  const newInputs = { ...inputs }
                  const val = newInputs[param]
                  delete newInputs[param]
                  if (e.target.value) newInputs[e.target.value] = val
                  onChange({ ...a, inputs: Object.keys(newInputs).length > 0 ? newInputs : undefined })
                }}
                placeholder={t('script.inputParam')}
                style={{ ...inp, width: 80 }}
              />
              <span style={{ fontSize: 10, color: 'var(--c-text-dim)' }}>=</span>
              <input
                value={expr}
                onChange={(e) => {
                  const newInputs = { ...inputs, [param]: e.target.value }
                  onChange({ ...a, inputs: newInputs })
                }}
                placeholder={t('script.inputValue')}
                style={{ ...inp, width: 90, flex: 1 }}
              />
              <button
                onClick={() => {
                  const newInputs = { ...inputs }
                  delete newInputs[param]
                  onChange({ ...a, inputs: Object.keys(newInputs).length > 0 ? newInputs : undefined })
                }}
                style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', fontSize: 12 }}
                title="Remove"
              >&times;</button>
            </div>
          ))}
          <button
            onClick={() => {
              const newInputs = { ...inputs, '': '' }
              onChange({ ...a, inputs: newInputs })
            }}
            style={{
              background: 'none', border: '1px dashed var(--c-border)', borderRadius: 4,
              color: 'var(--c-text-dim)', cursor: 'pointer', padding: '2px 8px', fontSize: 10,
              alignSelf: 'flex-start',
            }}
          >
            {t('script.addInput')}
          </button>
        </div>
      </div>
    )
  }

  if (action.type === 'if-else') {
    return <ConditionInlineFields action={action as IfElseAction} onChange={onChange} availableVars={availableVars} />
  }

  if (action.type === 'loop') {
    const a = action as LoopAction
    const mode: LoopMode = a.mode ?? 'repeat'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <select
          value={mode}
          onChange={(e) => onChange({ ...a, mode: e.target.value as LoopMode })}
          style={{ ...inp, width: 80 }}
        >
          <option value="repeat">{t('script.loopModeRepeat')}</option>
          <option value="for">{t('script.loopModeFor')}</option>
          <option value="foreach">{t('script.loopModeForeach')}</option>
        </select>
        {mode === 'repeat' && (
          <>
            <input
              type="number" value={a.count} min={1} max={1000}
              onChange={(e) => onChange({ ...a, count: Math.max(1, Math.min(1000, Number(e.target.value))) })}
              style={{ ...inp, width: 60 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.repeatTimes')}</span>
          </>
        )}
        {mode === 'for' && (
          <>
            <input
              value={a.iterVar ?? 'i'}
              onChange={(e) => onChange({ ...a, iterVar: e.target.value })}
              placeholder={t('script.loopIterVar')}
              style={{ ...inp, width: 52 }}
            />
            <input
              type="number" value={a.start ?? 0}
              onChange={(e) => onChange({ ...a, start: Number(e.target.value) })}
              style={{ ...inp, width: 52 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.loopTo')}</span>
            <input
              type="number" value={a.end ?? 10}
              onChange={(e) => onChange({ ...a, end: Number(e.target.value) })}
              style={{ ...inp, width: 52 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.loopStep')}</span>
            <input
              type="number" value={a.step ?? 1}
              onChange={(e) => onChange({ ...a, step: Number(e.target.value) })}
              style={{ ...inp, width: 46 }}
            />
          </>
        )}
        {mode === 'foreach' && (
          <>
            <input
              value={a.itemVar ?? 'item'}
              onChange={(e) => onChange({ ...a, itemVar: e.target.value })}
              placeholder={t('script.loopItemVar')}
              style={{ ...inp, width: 64 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>in</span>
            <input
              value={a.listVar ?? ''}
              onChange={(e) => onChange({ ...a, listVar: e.target.value })}
              placeholder={t('script.loopListVar')}
              style={{ ...inp, width: 80 }}
            />
          </>
        )}
      </div>
    )
  }

  if (action.type === 'escape') {
    return <span style={{ fontSize: 11, color: 'var(--c-text-dim)', fontStyle: 'italic' }}>{t('action.escapeDesc')}</span>
  }

  if (action.type === 'stop') {
    const a = action as StopAction
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <input
          value={a.returnVar ?? ''}
          onChange={(e) => onChange({ ...a, returnVar: e.target.value || undefined })}
          placeholder={t('script.stopReturnVar')}
          style={{ ...inp, width: 90 }}
        />
        {a.returnVar && (
          <>
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>=</span>
            <input
              value={a.returnValue ?? ''}
              onChange={(e) => onChange({ ...a, returnValue: e.target.value })}
              placeholder={t('script.stopReturnValue')}
              style={{ ...inp, width: 100 }}
            />
          </>
        )}
      </div>
    )
  }

  if (action.type === 'calculate') {
    const a = action as CalculateAction
    const isSqrt = a.operation === 'sqrt'
    const CALC_OPS: { value: CalcOperation; label: string }[] = [
      { value: 'add',      label: t('script.calcOpAdd') },
      { value: 'sub',      label: t('script.calcOpSub') },
      { value: 'mul',      label: t('script.calcOpMul') },
      { value: 'div',      label: t('script.calcOpDiv') },
      { value: 'mod',      label: t('script.calcOpMod') },
      { value: 'floordiv', label: t('script.calcOpFloorDiv') },
      { value: 'pow',      label: t('script.calcOpPow') },
      { value: 'sqrt',     label: t('script.calcOpSqrt') },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.operandA}
          onChange={(v) => onChange({ ...a, operandA: v })}
          availableVars={availableVars ?? []}
          placeholder="$a"
          style={{ ...inp, width: 60 }}
        />
        <select
          value={a.operation}
          onChange={(e) => onChange({ ...a, operation: e.target.value as CalcOperation })}
          style={{ ...inp, minWidth: 112 }}
        >
          {CALC_OPS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>
        {!isSqrt && (
          <VariableInput
            value={a.operandB ?? ''}
            onChange={(v) => onChange({ ...a, operandB: v })}
            availableVars={availableVars ?? []}
            placeholder="$b"
            style={{ ...inp, width: 60 }}
          />
        )}
        <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.calcResult')}</span>
        <input
          value={a.resultVar}
          onChange={(e) => onChange({ ...a, resultVar: e.target.value })}
          placeholder="result"
          style={{ ...inp, width: 72 }}
        />
      </div>
    )
  }

  if (action.type === 'comment') {
    const a = action as CommentAction
    return (
      <input
        value={a.text}
        onChange={(e) => onChange({ ...a, text: e.target.value })}
        placeholder={t('script.commentPlaceholder')}
        style={{ ...inp, flex: 1, minWidth: 140, fontStyle: 'italic' }}
      />
    )
  }

  return <></>
}

// ── NestedNodeCard — full-fidelity node card for use inside branch sections ──────

function NestedNodeCard({
  action,
  nodeStyle,
  library,
  onChange,
  onDelete,
  currentEntryId,
  depth = 0,
  availableVars,
}: {
  action: ActionConfig
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  currentEntryId?: string
  onChange: (a: ActionConfig) => void
  onDelete: () => void
  depth?: number
  availableVars?: string[]
}): JSX.Element {
  const t = useT()
  const cfg = nodeStyle[action.type] ?? nodeStyle.shell
  // Resolve run-shortcut visual override
  const csEntry = action.type === 'run-shortcut'
    ? library.find((e) => e.id === (action as RunShortcutAction).shortcutId)
    : undefined
  const nodeColor = csEntry?.bgColor ?? cfg.color
  const nodeIcon  = csEntry?.icon    ?? cfg.icon

  const deleteBtn = (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onDelete}
      style={{
        background: 'none', border: 'none', color: 'var(--c-text-dim)',
        cursor: 'pointer', padding: '0 2px',
        flexShrink: 0, borderRadius: 4, transition: 'color 0.1s',
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
      title={t('modal.remove')}
    ><UIIcon name="close" size={14} /></button>
  )

  const iconLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, userSelect: 'none' }}>
      <span style={{ color: nodeColor }}>{renderNodeIcon(nodeIcon, 14)}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: nodeColor, whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
    </div>
  )

  // ── Nested if-else: card header + criteria + recursive then/else branches ──
  if (action.type === 'if-else') {
    const a = action as IfElseAction
    const color = cfg.color
    return (
      <div>
        <div style={{
          borderRadius: 8, background: 'var(--c-elevated)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          {/* Header: icon + match select + delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} onPointerDown={(e) => e.stopPropagation()}>
              <ConditionMatchSelect action={a} onChange={onChange} />
            </div>
            {deleteBtn}
          </div>
          <div style={{ height: 1, background: `${color}33`, margin: '7px 0' }} />
          <div onPointerDown={(e) => e.stopPropagation()}>
            <ConditionCriteriaSection action={a} onChange={onChange} />
          </div>
        </div>
        {/* Recursive then/else branches — stop propagation to prevent parent drag */}
        <div style={{ paddingLeft: 6 }} onPointerDown={(e) => e.stopPropagation()}>
          {/* THEN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.thenLabel')}</span>
            <div style={{ flex: 1, height: 1, background: `${color}44` }} />
          </div>
          <NestedActionListSimple
            color={color}
            actions={a.thenActions}
            onChange={(acts) => onChange({ ...a, thenActions: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={`branch:nested-${depth}:then`}
          />
          {/* ELSE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.elseLabel')}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(107,114,128,0.3)' }} />
          </div>
          <NestedActionListSimple
            color="#6b7280"
            actions={a.elseActions}
            onChange={(acts) => onChange({ ...a, elseActions: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={`branch:nested-${depth}:else`}
          />
          {/* END IF */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>END IF</span>
            <div style={{ flex: 1, height: 1, background: `${color}22` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Nested loop: card header + recursive body branch ──
  if (action.type === 'loop') {
    const a = action as LoopAction
    const color = cfg.color
    return (
      <div>
        <div style={{
          borderRadius: 8, background: 'var(--c-elevated)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
            </div>
            {deleteBtn}
          </div>
        </div>
        {/* Recursive loop body — stop propagation to prevent parent drag */}
        <div style={{ paddingLeft: 6 }} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>DO</span>
            <div style={{ flex: 1, height: 1, background: `${color}44` }} />
          </div>
          <NestedActionListSimple
            color={color}
            actions={a.body}
            onChange={(acts) => onChange({ ...a, body: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={`branch:nested-${depth}:loop`}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>LOOP END</span>
            <div style={{ flex: 1, height: 1, background: `${color}22` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Nested sequence: card header + recursive parallel body branch ──
  if (action.type === 'sequence') {
    const a = action as SequenceAction
    const color = cfg.color
    return (
      <div>
        <div style={{
          borderRadius: 8, background: 'var(--c-elevated)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
            </div>
            {deleteBtn}
          </div>
        </div>
        {/* Recursive sequence body — stop propagation to prevent parent drag */}
        <div style={{ paddingLeft: 6 }} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.sequenceBody')}</span>
            <div style={{ flex: 1, height: 1, background: `${color}44` }} />
          </div>
          <NestedActionListSimple
            color={color}
            actions={a.body}
            onChange={(acts) => onChange({ ...a, body: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={`branch:nested-${depth}:sequence`}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.sequenceEnd')}</span>
            <div style={{ flex: 1, height: 1, background: `${color}22` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Default flat node ──
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--c-elevated)',
        border: '1px solid var(--c-border)',
        borderLeft: `3px solid ${nodeColor}`,
        flexWrap: 'wrap',
      }}
    >
      {iconLabel}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0, flexWrap: 'wrap' }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
      </div>
      {deleteBtn}
    </div>
  )
}

// ── SortableNestedCard — wraps NestedNodeCard with useSortable for drag support ──

function SortableNestedCard({ id, branchId, index, actions, onReorder, ...cardProps }: {
  id: string
  branchId: string
  index: number
  actions: ActionConfig[]
  onReorder: (newActions: ActionConfig[]) => void
} & Parameters<typeof NestedNodeCard>[0]): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'nested', branchId, index, actions, onReorder },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <NestedNodeCard {...cardProps} />
    </div>
  )
}

/**
 * NestedActionListSimple — recursive action list for deeply nested control flow.
 * Supports drag-and-drop insertion via useDroppable and reordering via SortableContext.
 */
function NestedActionListSimple({ color, actions, onChange, nodeStyle, library, currentEntryId, depth, branchId }: {
  color: string
  actions: ActionConfig[]
  onChange: (actions: ActionConfig[]) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  currentEntryId?: string
  depth: number
  branchId?: string
}): JSX.Element {
  const fallbackId = useRef(`branch-nested-${Math.random().toString(36).slice(2, 6)}`).current
  const effectiveBranchId = branchId ?? fallbackId
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: effectiveBranchId })
  const deleteAction = (idx: number) => onChange(actions.filter((_, i) => i !== idx))
  const updateAction = (idx: number, updated: ActionConfig) => onChange(actions.map((a, i) => i === idx ? updated : a))
  const isEmpty = actions.length === 0
  const itemIds = actions.map((_, i) => `nested:${effectiveBranchId}:${i}`)

  return (
    <div
      ref={branchId ? setDropRef : undefined}
      style={{
        paddingLeft: isEmpty && !isOver ? 0 : 10,
        borderLeft: (actions.length > 0 || isOver)
          ? `2px solid ${isOver ? color : `${color}33`}`
          : isEmpty ? `2px dashed ${color}22` : 'none',
        marginLeft: 4,
        minHeight: isEmpty ? (isOver ? 32 : 28) : 0,
        background: isOver ? `${color}0d` : undefined,
        borderRadius: isOver ? '0 4px 4px 0' : undefined,
        transition: 'border-color 0.15s, background 0.15s, min-height 0.15s',
      }}
    >
      {actions.length > 0 && (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
            {actions.map((action, idx) => (
              <SortableNestedCard
                key={itemIds[idx]}
                id={itemIds[idx]}
                branchId={effectiveBranchId}
                index={idx}
                actions={actions}
                onReorder={onChange}
                action={action}
                nodeStyle={nodeStyle}
                library={library}
                onChange={(updated) => updateAction(idx, updated)}
                onDelete={() => deleteAction(idx)}
                currentEntryId={currentEntryId}
                depth={depth}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// ── SortableNode ───────────────────────────────────────────────────────────────

interface SortableNodeProps {
  node: ActionNode
  nodeStyle: NodeStyle
  onChange: (action: ActionConfig) => void
  onDelete: () => void
  errorMsg?: string
  library: ShortcutEntry[]
  currentEntryId?: string
  availableVars?: string[]
}

function SortableNode({ node, nodeStyle, onChange, onDelete, errorMsg, library, currentEntryId, availableVars }: SortableNodeProps): JSX.Element {
  const t = useT()
  const { action } = node
  const cfg = nodeStyle[action.type] ?? nodeStyle.shell
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node._id })
  const hasError = Boolean(errorMsg)

  // Resolve run-shortcut visual identity (icon + bg color from the referenced entry)
  const csEntry = action.type === 'run-shortcut'
    ? library.find((e) => e.id === (action as RunShortcutAction).shortcutId)
    : undefined
  const nodeColor = csEntry?.bgColor ?? cfg.color
  const nodeIcon  = csEntry?.icon    ?? cfg.icon

  const cardStyle: React.CSSProperties = {
    borderRadius: 8,
    background: hasError ? 'rgba(239,68,68,0.06)' : 'var(--c-elevated)',
    border: hasError ? '1px solid rgba(239,68,68,0.6)' : '1px solid var(--c-border)',
    borderLeft: `3px solid ${hasError ? '#ef4444' : nodeColor}`,
    padding: '8px 12px',
    overflow: 'hidden',
  }

  // Visual-only drag handle (listeners moved to outer container for full-surface drag)
  const dragHandle = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        userSelect: 'none', flexShrink: 0,
      }}
    >
      <span style={{ color: hasError ? '#ef4444' : nodeColor }}>{renderNodeIcon(hasError ? 'info' : nodeIcon, 14)}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: hasError ? '#ef4444' : nodeColor, whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
    </div>
  )

  const deleteBtn = (
    <button
      onClick={onDelete}
      style={{
        background: 'none', border: 'none', color: 'var(--c-text-dim)',
        cursor: 'pointer', padding: '0 2px',
        flexShrink: 0, borderRadius: 4, transition: 'color 0.1s',
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
      title={t('modal.remove')}
    ><UIIcon name="close" size={14} /></button>
  )

  // ── Special layout for Condition (if-else) node ────────────────────────────────
  if (action.type === 'if-else') {
    const a = action as IfElseAction
    return (
      <div ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: 6, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        {/* Card: header row + divider + criteria only */}
        <div style={cardStyle}>
          {/* Header: drag handle | [flex spacer] | match dropdown | delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
            >
              {hasError && (
                <div
                  title={errorMsg}
                  style={{
                    fontSize: 10, color: '#ef4444',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 4, padding: '2px 5px',
                    whiteSpace: 'nowrap', maxWidth: 140,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    flexShrink: 0, cursor: 'help',
                  }}
                >
                  {errorMsg}
                </div>
              )}
              <ConditionMatchSelect action={a} onChange={onChange} />
            </div>
            {deleteBtn}
          </div>

          {/* Horizontal divider below header */}
          <div style={{ height: 1, background: `${cfg.color}33`, margin: '7px 0' }} />

          {/* Criteria rows — right-aligned */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ConditionCriteriaSection action={a} onChange={onChange} />
          </div>
        </div>

        {/* Then / Else / End If — rendered outside the card as structural dividers */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ConditionBranchesExternal action={a} onChange={onChange} nodeStyle={nodeStyle} library={library} nodeId={node._id} currentEntryId={currentEntryId} />
        </div>
      </div>
    )
  }

  // ── Loop node — external body structure like if-else ──────────────────────────
  if (action.type === 'loop') {
    const a = action as LoopAction
    return (
      <div ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: 6, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
            </div>
            {deleteBtn}
          </div>
        </div>
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <LoopBranchesExternal action={a} onChange={onChange} nodeStyle={nodeStyle} library={library} nodeId={node._id} currentEntryId={currentEntryId} />
        </div>
      </div>
    )
  }

  // ── Sequence node — parallel body structure like loop ──────────────────────────
  if (action.type === 'sequence') {
    const a = action as SequenceAction
    return (
      <div ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: 6, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
            </div>
            {deleteBtn}
          </div>
        </div>
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <SequenceBranchesExternal action={a} onChange={onChange} nodeStyle={nodeStyle} library={library} nodeId={node._id} currentEntryId={currentEntryId} />
        </div>
      </div>
    )
  }

  // ── Comment node — dimmed, no drag handle grab style ──────────────────────────
  if (action.type === 'comment') {
    return (
      <div ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 0.7, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, marginBottom: 6, borderStyle: 'dashed', borderColor: 'var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
            </div>
            {deleteBtn}
          </div>
        </div>
      </div>
    )
  }

  // ── Default layout (all other node types) ─────────────────────────────────────

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
      <div style={{ ...cardStyle, marginBottom: 6 }}>
        {/* Header row: drag handle | inputs (right) | error badge | delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {dragHandle}

          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0, flexWrap: 'wrap' }}
          >
            <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} />
          </div>

          {hasError && (
            <div
              title={errorMsg}
              style={{
                fontSize: 10, color: '#ef4444',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 4, padding: '2px 5px',
                whiteSpace: 'nowrap', maxWidth: 140,
                overflow: 'hidden', textOverflow: 'ellipsis',
                flexShrink: 0, cursor: 'help',
              }}
            >
              {errorMsg}
            </div>
          )}

          {deleteBtn}
        </div>
      </div>
    </div>
  )
}

// ── LibraryItem — draggable palette item ───────────────────────────────────────

function LibraryItem({ type, cfg }: { type: string; cfg: NodeStyle[string] }): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${type}`,
    data: { type },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 6,
        background: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        marginBottom: 1,
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = 'var(--c-elevated)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4,
        background: cfg.color + '22',
        border: `1px solid ${cfg.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: cfg.color,
      }}><UIIcon name={cfg.icon} size={11} /></div>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
        {cfg.label}
      </span>
    </div>
  )
}

// ── ShortcutLibraryItem — draggable run-shortcut entry ────────────────────────

function ShortcutLibraryItem({ entry }: { entry: ShortcutEntry }): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-run-shortcut-${entry.id}`,
    data: { type: 'run-shortcut', shortcutId: entry.id },
  })

  // Derive icon and color from the entry's own metadata
  const entryColor = entry.bgColor ?? '#22d3ee'
  const entryIconName = entry.icon ?? 'call_shortcut'

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 6,
        background: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        marginBottom: 1,
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = 'var(--c-elevated)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4,
        background: entryColor + '22',
        border: `1px solid ${entryColor}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: entryColor,
      }}><UIIcon name={entryIconName} size={11} /></div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.name || '(unnamed)'}
      </span>
    </div>
  )
}

// ── ToolbarButton ──────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick, disabled, title, children, accent,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
  accent?: boolean
}): JSX.Element {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !disabled ? 'rgba(128,128,128,0.15)' : 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: 5,
        padding: '3px 8px',
        fontSize: 13,
        color: disabled ? 'var(--c-text-dim)' : accent ? 'var(--c-accent)' : 'var(--c-text-muted)',
        fontFamily: 'inherit',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.1s, color 0.1s',
        WebkitAppRegion: 'no-drag',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {children}
    </button>
  )
}

function ToolbarSep(): JSX.Element {
  return (
    <div style={{
      width: 1, height: 16, background: 'var(--c-border)',
      margin: '0 2px', flexShrink: 0, alignSelf: 'center',
    }} />
  )
}

// ── ErrorBoundary ──────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<
  { children: ReactNode; language?: Language },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{
          padding: 24, color: 'var(--c-danger, #ff6060)',
          fontFamily: 'monospace', fontSize: 12,
          whiteSpace: 'pre-wrap', overflowY: 'auto',
          height: '100vh', background: 'var(--c-surface, #21262d)',
        }}>
          <strong>Render error</strong>{'\n\n'}{err.message}{'\n\n'}{err.stack}
        </div>
      )
    }
    return this.props.children
  }
}

// ── WorkspaceDropZone ──────────────────────────────────────────────────────────

function WorkspaceDropZone({ children, style, isLibDrag, hasNodes }: { children: ReactNode; style?: React.CSSProperties; isLibDrag?: boolean; hasNodes?: boolean }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'workspace' })
  // Only show the workspace border highlight when the list is empty (valid empty-drop target).
  // When nodes exist the per-item ghost indicators provide visual feedback instead.
  const showBorder = isLibDrag && !hasNodes
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        boxShadow: showBorder
          ? isOver
            ? 'inset 0 0 0 2px var(--c-accent)'
            : 'inset 0 0 0 2px rgba(255,255,255,0.07)'
          : undefined,
        borderRadius: 10,
        transition: 'box-shadow 0.15s',
      }}
    >
      {children}
    </div>
  )
}

// ── DeleteDropZone — palette wrapper that acts as a deletion target ────────────

function DeleteDropZone({ children, style, active, mode }: { children: ReactNode; style?: React.CSSProperties; active: boolean; mode: 'delete' | 'cancel' }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'delete-zone' })
  const isDelete = mode === 'delete'
  const hoverColor = isDelete ? '#ef4444' : 'var(--c-text)'
  return (
    <div ref={setNodeRef} style={{ ...style, position: 'relative' }}>
      {/* Hide action list items entirely when drag is active */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, visibility: active ? 'hidden' : 'visible' }}>
        {children}
      </div>
      {/* Overlay — delete zone for workspace drags, cancel zone for library drags */}
      {active && (
        <div style={{
          position: 'absolute', inset: 0,
          background: isOver
            ? (isDelete ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)')
            : (isDelete ? 'rgba(239,68,68,0.04)' : 'transparent'),
          border: isOver
            ? `2px dashed ${isDelete ? '#ef4444' : 'var(--c-text-dim)'}`
            : '2px dashed transparent',
          borderRadius: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 6,
          pointerEvents: 'none',
          transition: 'background 0.15s, border-color 0.15s',
          zIndex: 10,
        }}>
          <UIIcon name={isDelete ? 'delete' : 'close'} size={isOver ? 32 : 24} />
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isOver ? hoverColor : 'var(--c-text-dim)',
            transition: 'color 0.15s, font-size 0.15s',
          }}>
            {isDelete
              ? (isOver ? 'Release to delete' : 'Drop here to delete')
              : (isOver ? 'Release to cancel' : 'Drop here to cancel')
            }
          </span>
        </div>
      )}
    </div>
  )
}

// ── PaletteTabBar — centered icon-only tabs ────────────────────────────────────

interface PaletteTabBarProps {
  active: PaletteTab
  onChange: (tab: PaletteTab) => void
}

function PaletteTabBar({ active, onChange }: PaletteTabBarProps): JSX.Element {
  const t = useT()
  const tabs: { id: PaletteTab; icon: string; title: string }[] = [
    { id: 'all',       icon: 'menu',       title: t('palette.all') },
    { id: 'actions',   icon: 'play_arrow', title: t('palette.actions') },
    { id: 'scripts',   icon: 'launch',     title: t('palette.scripts') },
    { id: 'shortcuts', icon: 'link',       title: t('palette.shortcuts') },
  ]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '6px 10px',
      borderBottom: '1px solid var(--c-border-sub)',
      background: 'var(--c-surface)',
      flexShrink: 0,
    }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            title={tab.title}
            onClick={() => onChange(tab.id)}
            style={{
              width: 34, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isActive ? 'var(--c-accent-subtle, rgba(99,102,241,0.15))' : 'none',
              border: isActive ? '1px solid var(--c-accent)' : '1px solid transparent',
              borderRadius: 7,
              color: isActive ? 'var(--c-accent)' : 'var(--c-text-dim)',
              fontSize: 15,
              cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--c-elevated)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)'
              }
            }}
          >
            <UIIcon name={tab.icon} size={16} />
          </button>
        )
      })}
    </div>
  )
}

// ── IconColorPopover ───────────────────────────────────────────────────────────

interface IconColorPopoverProps {
  pos: { top: number; left: number }
  slot: SlotConfig
  resourceIcons: ResourceIconEntry[]
  recentColors: string[]
  onSelectIcon: (entry: ResourceIconEntry) => void
  onSelectBuiltinIcon: (iconName: string) => void
  onSelectBgColor: (color: string | undefined) => void
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement>
}

function IconColorPopover({
  pos, slot, resourceIcons, recentColors,
  onSelectIcon, onSelectBuiltinIcon, onSelectBgColor, onClose, anchorRef,
}: IconColorPopoverProps): JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'icon' | 'color'>('icon')
  const [search, setSearch] = useState('')
  const [customColorOpen, setCustomColorOpen] = useState(false)
  const [customColor, setCustomColor] = useState(slot.bgColor ?? '#3a3f4b')

  // Close on outside click (deferred to avoid closing immediately on open)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        !(anchorRef?.current && anchorRef.current.contains(e.target as Node))
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose, anchorRef])

  const POPUP_WIDTH = 268
  const PADDING = 12

  const filteredBuiltin = search.trim()
    ? BUILTIN_ICONS.filter((ic) => ic.label.toLowerCase().includes(search.toLowerCase()))
    : BUILTIN_ICONS

  const filteredResource = search.trim()
    ? resourceIcons.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : resourceIcons

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPUP_WIDTH,
        maxHeight: '80vh',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 9000,
      }}
    >
      {/* ── Tab bar: Icon | Color ── */}
      <div style={{ display: 'flex', padding: '8px 10px 6px', flexShrink: 0, gap: 4 }}>
        {(['icon', 'color'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6,
              border: tab === m ? '1px solid var(--c-accent-border)' : '1px solid transparent',
              background: tab === m ? 'var(--c-accent-bg)' : 'var(--c-elevated)',
              color: tab === m ? 'var(--c-accent)' : 'var(--c-text-muted)',
              fontSize: 11, fontWeight: tab === m ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}
          >
            {m === 'icon' ? 'Icon' : 'Color'}
          </button>
        ))}
      </div>

      {tab === 'color' ? (
        /* ── Color Section ── */
        <div style={{ padding: `4px ${PADDING}px ${PADDING}px`, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PICKER_COLS}, ${PICKER_BTN}px)`, gap: PICKER_GAP, justifyContent: 'center', marginBottom: 8 }}>
            {/* Auto/None swatch */}
            <button
              onClick={() => onSelectBgColor(undefined)}
              title="Auto (theme default)"
              style={{
                width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${slot.bgColor === undefined ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: 'var(--c-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, color: 'var(--c-text-dim)', fontSize: 9, fontWeight: 600,
              }}
            >auto</button>

            {/* Preset color swatches */}
            {PRESET_BG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onSelectBgColor(color)}
                title={color}
                style={{
                  width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                  border: '2px solid transparent',
                  outline: slot.bgColor === color ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                  background: color,
                  padding: 0,
                }}
              />
            ))}

            {/* Custom color picker trigger */}
            <button
              onClick={() => setCustomColorOpen((v) => !v)}
              title="Custom color…"
              style={{
                width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${customColorOpen ? 'var(--c-accent)' : 'transparent'}`,
                background: 'conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #8b5cf6, #ec4899, #ef4444)',
                padding: 0,
              }}
            />
          </div>

          {/* Inline HexColorPicker */}
          {customColorOpen && (
            <div style={{ marginBottom: 8 }}>
              <HexColorPicker
                color={customColor}
                onChange={(c) => { setCustomColor(c); onSelectBgColor(c) }}
                style={{ width: '100%', height: 150 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input
                  value={customColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setCustomColor(v)
                      if (v.length === 7) onSelectBgColor(v)
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--c-input-bg)', border: '1px solid var(--c-border)',
                    borderRadius: 5, color: 'var(--c-text)', padding: '4px 8px',
                    fontSize: 11, fontFamily: 'monospace', outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                />
                {slot.bgColor && (
                  <button
                    onClick={() => onSelectBgColor(undefined)}
                    title="Reset to theme default"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--c-text-dim)', padding: 2, borderRadius: 4,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <UIIcon name="close" size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recently used colors */}
          {recentColors.length > 0 && (
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-dim)', fontWeight: 600, marginBottom: 6 }}>
                Recent
              </div>
              <div style={{ display: 'flex', gap: PICKER_GAP, flexWrap: 'wrap' }}>
                {recentColors.slice(0, PICKER_COLS * 2).map((color) => (
                  <button
                    key={color}
                    onClick={() => onSelectBgColor(color)}
                    title={color}
                    style={{
                      width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                      border: '2px solid transparent',
                      outline: slot.bgColor === color ? `2px solid ${color}` : 'none',
                      outlineOffset: 2,
                      background: color,
                      padding: 0, flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Icon Section ── */
        <>
          <div style={{ padding: `0 ${PADDING}px 6px`, flexShrink: 0 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons…"
              style={{
                width: '100%', background: 'var(--c-input-bg)',
                border: '1px solid var(--c-border)', borderRadius: 6,
                color: 'var(--c-text)', padding: '4px 8px',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Scrollable icon grid */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `0 ${PADDING}px ${PADDING}px` }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${PICKER_BTN}px)`, gap: PICKER_GAP, justifyContent: 'center' }}>
              {filteredBuiltin.map((ic) => (
                <button
                  key={ic.name}
                  onClick={() => onSelectBuiltinIcon(ic.name)}
                  title={ic.label}
                  style={{
                    width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${!slot.iconIsCustom && slot.icon === ic.name ? 'var(--c-accent)' : 'transparent'}`,
                    background: !slot.iconIsCustom && slot.icon === ic.name ? 'var(--c-btn-active)' : 'var(--c-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text)', padding: 0,
                  }}
                >
                  <SVGIcon svgString={ic.svg} size={18} />
                </button>
              ))}
              {filteredResource.map((entry) => (
                <button
                  key={entry.filename}
                  onClick={() => onSelectIcon(entry)}
                  title={entry.name}
                  style={{
                    width: PICKER_BTN, height: PICKER_BTN, borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${slot.iconIsCustom && slot.icon === entry.absPath ? 'var(--c-accent)' : 'transparent'}`,
                    background: slot.iconIsCustom && slot.icon === entry.absPath ? 'var(--c-btn-active)' : 'var(--c-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text)', padding: 0,
                  }}
                >
                  <SVGIcon svgString={entry.svgContent} size={18} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── ShortcutsEditorInner ───────────────────────────────────────────────────────

function ShortcutsEditorInner(): JSX.Element {
  const t = useT()
  const NODE_STYLE = getNodeStyle(t)

  // Slot data
  const [data, setData] = useState<ShortcutsSlotData | null>(null)
  const slotBaseRef = useRef<SlotConfig | null>(null)
  const isFirstUpdateRef = useRef(true)

  // Current editing state
  const [nodes, setNodes] = useState<ActionNode[]>([])
  const nodesRef = useRef<ActionNode[]>([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  const [slotLabel, setSlotLabel] = useState('')

  // Undo / redo
  const [past, setPast] = useState<ActionNode[][]>([])
  const [future, setFuture] = useState<ActionNode[][]>([])

  // Label editing
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Window chrome
  const [isMaximized, setIsMaximized] = useState(false)

  // Palette tab + search
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('all')
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')

  // Resizable panel width
  const [libWidth, setLibWidth] = useState(240)

  // Play / execution state
  const [playState, setPlayState] = useState<'idle' | 'running' | 'error'>('idle')
  const [errorNodeIndex, setErrorNodeIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Icon/color picker
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const [resourceIcons, setResourceIcons] = useState<ResourceIconEntry[]>([])
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('actionring-recent-bgcolors') ?? '[]') as string[] } catch { return [] }
  })

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  useEffect(() => { dropIndexRef.current = dropIndex }, [dropIndex])
  const [branchDrop, setBranchDrop] = useState<{ nodeId: string; branch: 'then' | 'else' | 'loop' | 'sequence' } | null>(null)
  const branchDropRef = useRef<{ nodeId: string; branch: 'then' | 'else' | 'loop' | 'sequence' } | null>(null)
  useEffect(() => { branchDropRef.current = branchDrop }, [branchDrop])
  const preDragNodesRef = useRef<ActionNode[] | null>(null)
  const libInsertedIdRef = useRef<string | null>(null)
  const libActionRef = useRef<ActionConfig | null>(null)

  const isLibDrag = activeDragId?.startsWith('lib-') ?? false
  const activeLibType = isLibDrag ? (activeDragId!.startsWith('lib-run-shortcut-') ? 'run-shortcut' : activeDragId!.replace('lib-', '')) : null
  const activeNode = (!isLibDrag && activeDragId) ? nodesRef.current.find(n => n._id === activeDragId) ?? null : null

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Load data ──────────────────────────────────────────────────────────────

  const initFromData = useCallback((d: ShortcutsSlotData) => {
    slotBaseRef.current = d.slot
    setData(d)
    setNodes(d.slot.actions.map((a) => ({ _id: generateNodeId(), action: a })))
    setSlotLabel(d.slot.label)
    setPast([])
    setFuture([])
  }, [])

  useEffect(() => {
    window.shortcutsAPI.getSlotData().then((d) => {
      if (!d) return
      initFromData(d)
    })
    window.shortcutsAPI.onDataRefresh(initFromData)
    window.shortcutsAPI.getResourceIcons().then(setResourceIcons)
  }, [initFromData])

  // ── Relay updates to main process on every change ──────────────────────────

  useEffect(() => {
    if (isFirstUpdateRef.current) {
      isFirstUpdateRef.current = false
      return
    }
    if (!slotBaseRef.current) return
    // Skip relay while a library drag is in progress (node not yet committed)
    if (preDragNodesRef.current) return
    const updatedSlot: SlotConfig = {
      ...slotBaseRef.current,
      label: slotLabel,
      actions: nodes.map((n) => n.action),
    }
    window.shortcutsAPI.updateSlot(updatedSlot)
    if (playState === 'error') {
      setPlayState('idle')
      setErrorNodeIndex(null)
      setErrorMessage(null)
    }
  }, [nodes, slotLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Undo / redo ────────────────────────────────────────────────────────────

  const commitNodes = useCallback((newNodes: ActionNode[]) => {
    setPast((p) => [...p, nodes])
    setFuture([])
    setNodes(newNodes)
  }, [nodes])

  const undo = useCallback(() => {
    if (past.length === 0) return
    const prev = past[past.length - 1]
    setFuture((f) => [nodes, ...f])
    setPast((p) => p.slice(0, -1))
    setNodes(prev)
  }, [past, nodes])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setPast((p) => [...p, nodes])
    setFuture((f) => f.slice(1))
    setNodes(next)
  }, [future, nodes])

  // ── Icon / color selection ─────────────────────────────────────────────────

  const applySlotPatch = useCallback((patch: Partial<SlotConfig>) => {
    if (!slotBaseRef.current) return
    const updatedSlot: SlotConfig = { ...slotBaseRef.current, ...patch }
    slotBaseRef.current = updatedSlot
    setData((prev) => prev ? { ...prev, slot: updatedSlot } : prev)
    window.shortcutsAPI.updateSlot({
      ...updatedSlot,
      label: slotLabel,
      actions: nodesRef.current.map((n) => n.action),
    })
  }, [slotLabel])

  const handleSelectIcon = useCallback((entry: ResourceIconEntry) => {
    applySlotPatch({ icon: entry.absPath, iconIsCustom: true })
    window.shortcutsAPI.addRecentIcon(entry.absPath)
  }, [applySlotPatch])

  const handleSelectBuiltinIcon = useCallback((iconName: string) => {
    applySlotPatch({ icon: iconName, iconIsCustom: false })
    window.shortcutsAPI.addRecentIcon(iconName)
  }, [applySlotPatch])

  const handleSelectBgColor = useCallback((color: string | undefined) => {
    applySlotPatch({ bgColor: color })
    if (color) {
      setRecentColors((prev) => {
        const next = [color, ...prev.filter((c) => c !== color)].slice(0, 10)
        localStorage.setItem('actionring-recent-bgcolors', JSON.stringify(next))
        return next
      })
    }
  }, [applySlotPatch])

  const openPicker = useCallback(() => {
    if (!iconBtnRef.current) return
    const rect = iconBtnRef.current.getBoundingClientRect()
    setPickerPos({ top: rect.top, left: rect.right + 8 })
    setPickerOpen(true)
  }, [])

  // ── Node operations ────────────────────────────────────────────────────────

  const deleteNode = useCallback((id: string) => {
    commitNodes(nodes.filter((n) => n._id !== id))
  }, [nodes, commitNodes])

  const updateNode = useCallback((id: string, action: ActionConfig) => {
    setNodes((prev) => prev.map((n) => n._id === id ? { ...n, action } : n))
  }, [])

  // ── DnD handlers ───────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    setActiveDragId(id)

    // Library drag: save pre-drag state and prepare the action, but do NOT
    // insert into nodes yet — insertion happens on first workspace dragOver.
    if (id.startsWith('lib-')) {
      const dragData = event.active.data.current as { type: string; shortcutId?: string } | undefined
      const type = dragData?.type ?? (id.startsWith('lib-run-shortcut-') ? 'run-shortcut' : id.replace('lib-', ''))
      const action = makeDefaultAction(type, dragData?.shortcutId ? { shortcutId: dragData.shortcutId } : undefined)
      preDragNodesRef.current = nodesRef.current
      libInsertedIdRef.current = null
      libActionRef.current = action
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    const activeId = active.id.toString()
    const isLib = activeId.startsWith('lib-')
    const isNested = activeId.startsWith('nested:')
    const currentNodes = nodesRef.current
    const overId = over?.id?.toString() ?? ''

    // Nested item drags: track workspace/delete-zone/branch targets so that
    // nested items can be extracted, deleted, or moved across branches.
    if (isNested) {
      if (overId.startsWith('branch:')) {
        const firstColon = overId.indexOf(':', 7)
        const nodeId = overId.slice(7, firstColon)
        const branch = overId.slice(firstColon + 1) as 'then' | 'else' | 'loop' | 'sequence'
        if (nodeId && (branch === 'then' || branch === 'else' || branch === 'loop' || branch === 'sequence')) {
          setBranchDrop({ nodeId, branch })
          setDropIndex(null)
          return
        }
      }
      // When over workspace, delete-zone, or sortable top-level nodes, clear branch target
      setBranchDrop(null)
      // Compute insertion index when over workspace or sortable nodes for extraction
      if (overId === 'workspace' || overId === 'delete-zone') {
        if (overId === 'workspace') {
          if (currentNodes.length === 0) {
            setDropIndex(0)
          } else {
            const translated = active.rect.current.translated
            if (translated && over) {
              const dragMidY = translated.top + translated.height / 2
              const wsMidY = over.rect.top + over.rect.height / 2
              setDropIndex(dragMidY < wsMidY ? 0 : currentNodes.length)
            } else {
              setDropIndex(currentNodes.length)
            }
          }
        } else {
          setDropIndex(null)
        }
        return
      }
      // Over a sortable top-level node — compute insertion position
      const overNodeIdx = currentNodes.findIndex((n) => n._id === overId)
      if (overNodeIdx !== -1) {
        const overRect = over!.rect
        const translated = active.rect.current.translated
        if (translated) {
          const dragMidY = translated.top + translated.height / 2
          const overMidY = overRect.top + overRect.height / 2
          setDropIndex(dragMidY < overMidY ? overNodeIdx : overNodeIdx + 1)
        } else {
          setDropIndex(overNodeIdx)
        }
        return
      }
      // Over nested items in same/other branch — let SortableContext handle visuals
      setDropIndex(null)
      return
    }

    // Branch drop zone detection (format: "branch:{nodeId}:{then|else|loop|sequence}")
    // Works for BOTH library drags and existing node drags
    if (overId.startsWith('branch:')) {
      const firstColon = overId.indexOf(':', 7)
      const nodeId = overId.slice(7, firstColon)
      const branch = overId.slice(firstColon + 1) as 'then' | 'else' | 'loop' | 'sequence'
      if (nodeId && (branch === 'then' || branch === 'else' || branch === 'loop' || branch === 'sequence')) {
        // Don't allow dropping a node into its own branches
        if (!isLib && activeId === nodeId) {
          setBranchDrop(null)
          setDropIndex(null)
          return
        }
        setBranchDrop({ nodeId, branch })
        setDropIndex(null)
        // Remove the lib-inserted node from top-level while hovering a branch
        if (isLib && libInsertedIdRef.current) {
          const insertedId = libInsertedIdRef.current
          if (currentNodes.some((n) => n._id === insertedId)) {
            setNodes(currentNodes.filter((n) => n._id !== insertedId))
          }
        }
        return
      }
    }

    setBranchDrop(null)

    // For library drags, insert a real node into the workspace on first entry,
    // then arrayMove it on subsequent overs — giving identical UX to existing-node drags.
    if (isLib) {
      if (overId === 'delete-zone') {
        // Remove the inserted node while hovering delete zone
        if (libInsertedIdRef.current) {
          const insertedId = libInsertedIdRef.current
          if (currentNodes.some((n) => n._id === insertedId)) {
            setNodes(currentNodes.filter((n) => n._id !== insertedId))
          }
        }
        setDropIndex(null)
        return
      }

      const action = libActionRef.current
      if (!action) return

      // Compute target index based on pointer vs over-element position
      const computeTargetIndex = (): number => {
        const insertedId = libInsertedIdRef.current
        const nodesWithout = insertedId ? currentNodes.filter((n) => n._id !== insertedId) : currentNodes
        if (overId === 'workspace') {
          if (nodesWithout.length === 0) return 0
          const translated = active.rect.current.translated
          if (translated && over) {
            const dragMidY = translated.top + translated.height / 2
            const wsMidY = over.rect.top + over.rect.height / 2
            return dragMidY < wsMidY ? 0 : nodesWithout.length
          }
          return nodesWithout.length
        }
        // Over a sortable top-level node
        const overIdx = nodesWithout.findIndex((n) => n._id === overId)
        if (overIdx !== -1) {
          const translated = active.rect.current.translated
          if (translated) {
            const dragMidY = translated.top + translated.height / 2
            const overMidY = over!.rect.top + over!.rect.height / 2
            return dragMidY < overMidY ? overIdx : overIdx + 1
          }
          return overIdx
        }
        return nodesWithout.length
      }

      const targetIdx = computeTargetIndex()

      if (!libInsertedIdRef.current) {
        // First entry into workspace — insert a real node with unique ID
        const newId = generateNodeId()
        libInsertedIdRef.current = newId
        const nodesWithout = currentNodes
        const newNodes = [...nodesWithout]
        newNodes.splice(targetIdx, 0, { _id: newId, action })
        setNodes(newNodes)
      } else {
        // Already inserted — move it to the new position
        const insertedId = libInsertedIdRef.current
        const currentIdx = currentNodes.findIndex((n) => n._id === insertedId)
        if (currentIdx === -1) {
          // Re-insert if it was removed (e.g. returned from branch/delete hover)
          const newNodes = [...currentNodes]
          newNodes.splice(targetIdx, 0, { _id: insertedId, action })
          setNodes(newNodes)
        } else {
          // Compute move target within the full array (including the inserted node)
          const nodesWithout = currentNodes.filter((n) => n._id !== insertedId)
          const clampedIdx = Math.min(targetIdx, nodesWithout.length)
          // Re-insert at the right position
          const newNodes = [...nodesWithout]
          newNodes.splice(clampedIdx, 0, currentNodes[currentIdx])
          // Only update if position actually changed
          if (currentIdx !== newNodes.findIndex((n) => n._id === insertedId)) {
            setNodes(newNodes)
          }
        }
      }
      setDropIndex(null)
      return
    }

    // For existing node drags, SortableContext handles reordering visuals
    setDropIndex(null)
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
    setDropIndex(null)
    setBranchDrop(null)
    // Revert to pre-drag state if lib drag was in progress
    if (preDragNodesRef.current) {
      setNodes(preDragNodesRef.current)
      preDragNodesRef.current = null
    }
    libInsertedIdRef.current = null
    libActionRef.current = null
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const id = active.id.toString()

    setActiveDragId(null)

    // ── Nested item drag — reorder, extract, delete, or cross-branch move ──
    if (id.startsWith('nested:')) {
      const branchTarget = branchDropRef.current
      const idx = dropIndexRef.current
      setBranchDrop(null)
      setDropIndex(null)

      const fromData = active.data.current as { branchId: string; index: number; actions: ActionConfig[]; onReorder: (a: ActionConfig[]) => void } | undefined
      if (!fromData) return

      const draggedAction = fromData.actions[fromData.index]

      // Parse source branchId (format: "branch:{nodeId}:{then|else|loop|sequence}")
      const srcParts = fromData.branchId.match(/^branch:(.+):(then|else|loop|sequence)$/)
      const srcNodeId = srcParts?.[1]
      const srcBranch = srcParts?.[2] as 'then' | 'else' | 'loop' | 'sequence' | undefined

      // Helper: produce a new nodes array with the dragged item removed from its source branch
      const removeDraggedFromNodes = (nodesList: ActionNode[]): ActionNode[] => {
        if (!srcNodeId || !srcBranch) return nodesList
        return nodesList.map((n) => {
          if (n._id !== srcNodeId) return n
          const a = n.action
          if (a.type === 'if-else' && (srcBranch === 'then' || srcBranch === 'else')) {
            const ifElse = a as IfElseAction
            return { ...n, action: srcBranch === 'then'
              ? { ...ifElse, thenActions: ifElse.thenActions.filter((_, i) => i !== fromData.index) }
              : { ...ifElse, elseActions: ifElse.elseActions.filter((_, i) => i !== fromData.index) }
            }
          }
          if (a.type === 'loop' && srcBranch === 'loop') {
            const loopAct = a as LoopAction
            return { ...n, action: { ...loopAct, body: loopAct.body.filter((_, i) => i !== fromData.index) } }
          }
          if (a.type === 'sequence' && srcBranch === 'sequence') {
            const seqAct = a as SequenceAction
            return { ...n, action: { ...seqAct, body: seqAct.body.filter((_, i) => i !== fromData.index) } }
          }
          return n
        })
      }

      // Drop on another nested item — same-branch reorder handled via callbacks
      if (over && over.id.toString().startsWith('nested:')) {
        if (active.id === over.id) return
        const toData = over.data.current as { branchId: string; index: number; actions: ActionConfig[]; onReorder: (a: ActionConfig[]) => void } | undefined
        if (fromData && toData && fromData.branchId === toData.branchId) {
          fromData.onReorder(arrayMove([...fromData.actions], fromData.index, toData.index))
          return
        }
        // Cross-branch reorder via nested items — use commitNodes for atomicity
        if (fromData && toData && fromData.branchId !== toData.branchId) {
          let updated = removeDraggedFromNodes(nodesRef.current)
          // Now add to target branch
          const tgtParts = toData.branchId.match(/^branch:(.+):(then|else|loop|sequence)$/)
          const tgtNodeId = tgtParts?.[1]
          const tgtBranch = tgtParts?.[2] as 'then' | 'else' | 'loop' | 'sequence' | undefined
          if (tgtNodeId && tgtBranch) {
            updated = updated.map((n) => {
              if (n._id !== tgtNodeId) return n
              const a = n.action
              if (a.type === 'if-else' && (tgtBranch === 'then' || tgtBranch === 'else')) {
                const ifElse = a as IfElseAction
                const arr = tgtBranch === 'then' ? [...ifElse.thenActions] : [...ifElse.elseActions]
                arr.splice(toData.index, 0, draggedAction)
                return { ...n, action: tgtBranch === 'then'
                  ? { ...ifElse, thenActions: arr }
                  : { ...ifElse, elseActions: arr }
                }
              }
              if (a.type === 'loop' && tgtBranch === 'loop') {
                const loopAct = a as LoopAction
                const arr = [...loopAct.body]; arr.splice(toData.index, 0, draggedAction)
                return { ...n, action: { ...loopAct, body: arr } }
              }
              if (a.type === 'sequence' && tgtBranch === 'sequence') {
                const seqAct = a as SequenceAction
                const arr = [...seqAct.body]; arr.splice(toData.index, 0, draggedAction)
                return { ...n, action: { ...seqAct, body: arr } }
              }
              return n
            })
          }
          commitNodes(updated)
          return
        }
      }

      // Drop on delete-zone or outside workspace — delete the nested node
      if (!over || over.id === 'delete-zone') {
        commitNodes(removeDraggedFromNodes(nodesRef.current))
        return
      }

      const overId = over.id.toString()

      // Drop on a branch zone — insert into that branch
      if (branchTarget) {
        const { nodeId, branch } = branchTarget
        let updated = removeDraggedFromNodes(nodesRef.current)
        const targetNodeIdx = updated.findIndex((n) => n._id === nodeId)
        if (targetNodeIdx !== -1) {
          const targetAction = updated[targetNodeIdx].action
          if (targetAction.type === 'if-else' && (branch === 'then' || branch === 'else')) {
            const ifElse = targetAction as IfElseAction
            const updatedAction: IfElseAction = branch === 'then'
              ? { ...ifElse, thenActions: [...ifElse.thenActions, draggedAction] }
              : { ...ifElse, elseActions: [...ifElse.elseActions, draggedAction] }
            updated = updated.map((n, i) => i === targetNodeIdx ? { ...n, action: updatedAction } : n)
          } else if (targetAction.type === 'loop' && branch === 'loop') {
            const loopAct = targetAction as LoopAction
            updated = updated.map((n, i) => i === targetNodeIdx ? { ...n, action: { ...loopAct, body: [...loopAct.body, draggedAction] } } : n)
          } else if (targetAction.type === 'sequence' && branch === 'sequence') {
            const seqAct = targetAction as SequenceAction
            updated = updated.map((n, i) => i === targetNodeIdx ? { ...n, action: { ...seqAct, body: [...seqAct.body, draggedAction] } } : n)
          }
          commitNodes(updated)
        }
        return
      }

      // Drop on workspace or a top-level sortable node — extract to main sequence
      if (overId === 'workspace' || nodesRef.current.some((n) => n._id === overId)) {
        let updated = removeDraggedFromNodes(nodesRef.current)
        const newNode: ActionNode = { _id: generateNodeId(), action: draggedAction }
        const insertIdx = idx !== null ? Math.min(idx, updated.length) : updated.length
        updated = [...updated]
        updated.splice(insertIdx, 0, newNode)
        commitNodes(updated)
        return
      }

      return
    }

    if (id.startsWith('lib-')) {
      const preNodes = preDragNodesRef.current ?? []
      preDragNodesRef.current = null
      const insertedId = libInsertedIdRef.current
      libInsertedIdRef.current = null
      const libAction = libActionRef.current
      libActionRef.current = null
      const currentNodes = nodesRef.current

      const branchTarget = branchDropRef.current
      setBranchDrop(null)
      setDropIndex(null)

      // Cancelled / dropped on delete zone / outside workspace — revert
      if (!over || over.id === 'delete-zone') {
        setNodes(preNodes)
        return
      }

      // Branch drop — insert action into branch
      if (branchTarget) {
        const { nodeId, branch } = branchTarget
        const action = insertedId ? currentNodes.find((n) => n._id === insertedId)?.action : libAction
        // Base: preNodes (no inserted node)
        const baseNodes = preNodes
        if (!action) { setNodes(preNodes); return }
        const nodeIdx = baseNodes.findIndex((n) => n._id === nodeId)
        if (nodeIdx !== -1) {
          const nodeAction = baseNodes[nodeIdx].action
          let updatedNodes = baseNodes
          if (nodeAction.type === 'if-else' && (branch === 'then' || branch === 'else')) {
            const ifElse = nodeAction as IfElseAction
            const updatedAction: IfElseAction = branch === 'then'
              ? { ...ifElse, thenActions: [...ifElse.thenActions, action] }
              : { ...ifElse, elseActions: [...ifElse.elseActions, action] }
            updatedNodes = baseNodes.map((n, i) => i === nodeIdx ? { ...n, action: updatedAction } : n)
          } else if (nodeAction.type === 'loop' && branch === 'loop') {
            const loopAct = nodeAction as LoopAction
            updatedNodes = baseNodes.map((n, i) => i === nodeIdx ? { ...n, action: { ...loopAct, body: [...loopAct.body, action] } } : n)
          } else if (nodeAction.type === 'sequence' && branch === 'sequence') {
            const seqAct = nodeAction as SequenceAction
            updatedNodes = baseNodes.map((n, i) => i === nodeIdx ? { ...n, action: { ...seqAct, body: [...seqAct.body, action] } } : n)
          }
          setPast(p => [...p, preNodes])
          setFuture([])
          setNodes(updatedNodes)
        } else {
          setNodes(preNodes)
        }
        return
      }

      // Valid drop on workspace — node is already at the correct position
      if (insertedId && currentNodes.some((n) => n._id === insertedId)) {
        setPast(p => [...p, preNodes])
        setFuture([])
        // currentNodes already has the node in the right spot — just commit
        setNodes([...currentNodes])
      } else {
        setNodes(preNodes)
      }
      return
    }

    // Existing node drag — check for branch drop first
    const branchTarget = branchDropRef.current
    setBranchDrop(null)
    setDropIndex(null)

    if (branchTarget && over) {
      const { nodeId, branch } = branchTarget
      const currentNodes = nodesRef.current
      const dragNodeIdx = currentNodes.findIndex((n) => n._id === id)
      const targetNodeIdx = currentNodes.findIndex((n) => n._id === nodeId)
      if (dragNodeIdx !== -1 && targetNodeIdx !== -1 && dragNodeIdx !== targetNodeIdx) {
        const draggedAction = currentNodes[dragNodeIdx].action
        const targetAction = currentNodes[targetNodeIdx].action
        // Remove from top-level, add to the branch
        const withoutDragged = currentNodes.filter((_, i) => i !== dragNodeIdx)
        // Recalculate target index after removal
        const newTargetIdx = withoutDragged.findIndex((n) => n._id === nodeId)
        if (newTargetIdx !== -1) {
          if (targetAction.type === 'if-else' && (branch === 'then' || branch === 'else')) {
            const ifElse = targetAction as IfElseAction
            const updatedAction: IfElseAction = branch === 'then'
              ? { ...ifElse, thenActions: [...ifElse.thenActions, draggedAction] }
              : { ...ifElse, elseActions: [...ifElse.elseActions, draggedAction] }
            commitNodes(withoutDragged.map((n, i) => i === newTargetIdx ? { ...n, action: updatedAction } : n))
          } else if (targetAction.type === 'loop' && branch === 'loop') {
            const loopAct = targetAction as LoopAction
            const updatedAction: LoopAction = { ...loopAct, body: [...loopAct.body, draggedAction] }
            commitNodes(withoutDragged.map((n, i) => i === newTargetIdx ? { ...n, action: updatedAction } : n))
          } else if (targetAction.type === 'sequence' && branch === 'sequence') {
            const seqAct = targetAction as SequenceAction
            const updatedAction: SequenceAction = { ...seqAct, body: [...seqAct.body, draggedAction] }
            commitNodes(withoutDragged.map((n, i) => i === newTargetIdx ? { ...n, action: updatedAction } : n))
          }
        }
      }
      return
    }

    // Node dropped outside the workspace area or onto the delete zone — delete it
    if (!over || over.id === 'delete-zone') {
      commitNodes(nodesRef.current.filter((n) => n._id !== id))
      return
    }

    if (active.id !== over.id) {
      const currentNodes = nodesRef.current
      const oldIdx = currentNodes.findIndex((n) => n._id === active.id)
      const newIdx = currentNodes.findIndex((n) => n._id === over.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        commitNodes(arrayMove(currentNodes, oldIdx, newIdx))
      }
    }
  }, [commitNodes])

  // ── Import / Export / Play ─────────────────────────────────────────────────

  const handleImport = async () => {
    const imported = await window.shortcutsAPI.importPreset()
    if (!imported) return
    commitNodes(imported.actions.map((a) => ({ _id: generateNodeId(), action: a })))
  }

  const handleExport = async () => {
    if (!slotBaseRef.current) return
    const currentSlot: SlotConfig = {
      ...slotBaseRef.current,
      label: slotLabel,
      actions: nodes.map((n) => n.action),
    }
    await window.shortcutsAPI.exportPreset(currentSlot)
  }

  const handlePlay = async () => {
    if (playState === 'running') return
    setPlayState('running')
    setErrorNodeIndex(null)
    setErrorMessage(null)
    try {
      const results = await window.shortcutsAPI.playActions(nodes.map((n) => n.action))
      const failed = results.find((r) => !r.success)
      if (failed) {
        setPlayState('error')
        setErrorNodeIndex(failed.index)
        setErrorMessage(failed.error ?? t('shortcuts.executionError'))
      } else {
        setPlayState('idle')
      }
    } catch (err) {
      setPlayState('error')
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  // ── Label editing ──────────────────────────────────────────────────────────

  const commitLabel = (newLabel: string) => {
    setSlotLabel(newLabel)
    setIsEditingLabel(false)
  }

  useEffect(() => {
    if (isEditingLabel) {
      labelInputRef.current?.focus()
      labelInputRef.current?.select()
    }
  }, [isEditingLabel])

  // ── Resizable panel ────────────────────────────────────────────────────────

  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = libWidth

    const onMouseMove = (mv: MouseEvent) => {
      const delta = startX - mv.clientX
      setLibWidth(Math.max(200, Math.min(480, startWidth + delta)))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [libWidth])

  // ── Icon rendering ─────────────────────────────────────────────────────────
  // Prefer reactive `data.slot` state over the ref to stay in sync after load.
  const displaySlot = data?.slot ?? slotBaseRef.current
  const builtinSvg = !displaySlot?.iconIsCustom
    ? (BUILTIN_ICONS.find((ic) => ic.name === displaySlot?.icon)?.svg ?? null)
    : null
  // For resource/custom SVG icons: look up inline SVG from loaded resourceIcons
  const resourceIconSvg = displaySlot?.iconIsCustom && displaySlot.icon.endsWith('.svg')
    ? (resourceIcons.find((e) => e.absPath === displaySlot.icon)?.svgContent ?? null)
    : null
  // If neither custom nor a builtin SVG, the icon is an emoji/text — render as text.
  const iconIsText = !displaySlot?.iconIsCustom && builtinSvg === null && !!displaySlot?.icon

  // ── Palette content ────────────────────────────────────────────────────────

  const library = data?.shortcutsLibrary ?? []
  const groups = data?.shortcutGroups ?? []

  const actionPaletteItems = ACTION_TYPES.filter((key) =>
    !search || key.includes(search.toLowerCase()) ||
    NODE_STYLE[key]?.label.toLowerCase().includes(search.toLowerCase())
  )

  const scriptPaletteItems = SCRIPT_TYPES.filter((key) =>
    !search || key.includes(search.toLowerCase()) ||
    NODE_STYLE[key]?.label.toLowerCase().includes(search.toLowerCase())
  )

  // Filter out the current shortcut being edited to prevent self-calls
  const currentEntryId = data?.libraryEntryId
  const shortcutPaletteItems = library.filter((entry) => {
    if (entry.id === currentEntryId) return false  // prevent self-reference
    const matchesSearch = !search || entry.name.toLowerCase().includes(search.toLowerCase())
    const matchesGroup = groupFilter === 'all' || entry.groupId === groupFilter
    return matchesSearch && matchesGroup
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--c-surface)', color: 'var(--c-text)' }}>
        {t('app.loading')}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={branchPriorityCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-surface)', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

        {/* ── Title bar ── */}
        <div
          style={{
            height: 40, flexShrink: 0,
            background: 'var(--c-elevated)',
            borderBottom: '1px solid var(--c-border)',
            display: 'flex', alignItems: 'stretch',
            WebkitAppRegion: 'drag',
          } as React.CSSProperties}
        >
          {/* Left: slot icon + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, flex: 1, minWidth: 0 }}>
            <button
              ref={iconBtnRef}
              onClick={() => { if (pickerOpen) { setPickerOpen(false) } else { openPicker() } }}
              title="Change icon / color"
              style={{
                width: 24, height: 24, borderRadius: 5, flexShrink: 0,
                background: (displaySlot?.bgColor ?? '#8b5cf6') + '33',
                border: `1px solid ${pickerOpen ? 'var(--c-accent)' : (displaySlot?.bgColor ?? '#8b5cf6') + '55'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: displaySlot?.iconColor ?? (displaySlot?.bgColor ?? '#8b5cf6'),
                overflow: 'hidden',
                fontSize: 14, cursor: 'pointer', padding: 0,
                WebkitAppRegion: 'no-drag',
                transition: 'border-color 0.15s, background 0.15s',
              } as React.CSSProperties}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-accent)' }}
              onMouseLeave={(e) => { if (!pickerOpen) (e.currentTarget as HTMLButtonElement).style.borderColor = (displaySlot?.bgColor ?? '#8b5cf6') + '55' }}
            >
              {iconIsText
                ? <span style={{ fontSize: 12, lineHeight: 1 }}>{displaySlot?.icon}</span>
                : builtinSvg
                  ? <SVGIcon svgString={builtinSvg} size={14} />
                  : resourceIconSvg
                    ? <SVGIcon svgString={resourceIconSvg} size={14} />
                    : displaySlot?.iconIsCustom && displaySlot.icon
                      ? <img src={`file://${displaySlot.icon}`} style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
                      : null
              }
            </button>

            {isEditingLabel ? (
              <input
                ref={labelInputRef}
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => commitLabel(labelDraft)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitLabel(labelDraft)
                  if (e.key === 'Escape') { setIsEditingLabel(false); setLabelDraft(slotLabel) }
                }}
                style={{
                  background: 'var(--c-input-bg)', border: '1px solid var(--c-accent)',
                  borderRadius: 5, color: 'var(--c-text)', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', outline: 'none', padding: '2px 6px',
                  WebkitAppRegion: 'no-drag', minWidth: 0, width: 200, height: 26,
                  boxSizing: 'border-box',
                } as React.CSSProperties}
              />
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); setLabelDraft(slotLabel); setIsEditingLabel(true) }}
                onDoubleClick={(e) => e.stopPropagation()}
                title={t('shortcuts.clickToRename')}
                style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
                  cursor: 'text', userSelect: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: '2px 4px', borderRadius: 4,
                  WebkitAppRegion: 'no-drag',
                } as React.CSSProperties}
              >
                {slotLabel}
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: 4, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <ToolbarButton onClick={undo} disabled={past.length === 0} title={t('shortcuts.undo')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/>
              </svg>
            </ToolbarButton>
            <ToolbarButton onClick={redo} disabled={future.length === 0} title={t('shortcuts.redo')}><UIIcon name="redo" size={14} /></ToolbarButton>
            <ToolbarSep />
            <ToolbarButton onClick={handleImport} title={t('shortcuts.importActions')}><UIIcon name="download" size={14} /></ToolbarButton>
            <ToolbarButton onClick={handleExport} title={t('shortcuts.exportActions')}><UIIcon name="upload" size={14} /></ToolbarButton>
            <ToolbarSep />
            <ToolbarButton
              onClick={handlePlay}
              disabled={playState === 'running'}
              title={playState === 'running' ? t('shortcuts.playing') : t('shortcuts.play')}
              accent={playState !== 'error'}
            >
              {playState === 'running'
                ? <UIIcon name="refresh" size={14} />
                : playState === 'error'
                  ? <UIIcon name="info" size={14} />
                  : <UIIcon name="play_arrow" size={14} />}
            </ToolbarButton>
            <ToolbarSep />
          </div>

          <WinControls
            onMinimize={() => window.shortcutsAPI.minimizeWindow()}
            onMaximize={() => { window.shortcutsAPI.maximizeWindow(); setIsMaximized((v) => !v) }}
            onClose={() => window.shortcutsAPI.closeWindow()}
            isMaximized={isMaximized}
          />
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Workspace (left) */}
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceDropZone style={{ flex: 1, overflowY: 'auto', padding: '16px 56px' }} isLibDrag={isLibDrag} hasNodes={nodes.length > 0}>
              {nodes.length === 0 ? (
                <div style={{
                  textAlign: 'center', color: 'var(--c-text-dim)', fontSize: 13,
                  padding: '40px 20px',
                  border: isLibDrag ? '2px dashed var(--c-accent)' : '2px dashed transparent',
                  borderRadius: 10,
                  transition: 'border-color 0.15s',
                }}>
                  {t('modal.noActionsYet')}
                </div>
              ) : (
                <SortableContext items={nodes.map((n) => n._id)} strategy={verticalListSortingStrategy}>
                  {(() => {
                    const isNestedDrag = activeDragId?.startsWith('nested:') ?? false
                    const showIndicator = isNestedDrag && dropIndex !== null
                    const elements: JSX.Element[] = []
                    for (let i = 0; i < nodes.length; i++) {
                      const node = nodes[i]
                      if (showIndicator && dropIndex === i) {
                        elements.push(
                          <div key="drop-indicator" style={{
                            height: 2, background: 'var(--c-accent)', borderRadius: 1,
                            margin: '2px 0', transition: 'opacity 0.15s', opacity: 0.8,
                          }} />
                        )
                      }
                      elements.push(
                        <SortableNode
                          key={node._id}
                          node={node}
                          nodeStyle={NODE_STYLE}
                          onChange={(action) => updateNode(node._id, action)}
                          onDelete={() => deleteNode(node._id)}
                          errorMsg={i === errorNodeIndex ? (errorMessage ?? t('shortcuts.executionError')) : undefined}
                          library={library}
                          currentEntryId={currentEntryId}
                          availableVars={collectAvailableVars(nodes, i)}
                        />
                      )
                    }
                    // Drop indicator at the end
                    if (showIndicator && dropIndex >= nodes.length) {
                      elements.push(
                        <div key="drop-indicator" style={{
                          height: 2, background: 'var(--c-accent)', borderRadius: 1,
                          margin: '2px 0', transition: 'opacity 0.15s', opacity: 0.8,
                        }} />
                      )
                    }
                    return elements
                  })()}
                </SortableContext>
              )}
            </WorkspaceDropZone>
          </div>

          {/* Resizer */}
          <div
            onMouseDown={handleResizerMouseDown}
            style={{
              width: 1, flexShrink: 0, cursor: 'col-resize',
              background: 'var(--c-border)', transition: 'background 0.15s',
              position: 'relative', zIndex: 1,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-accent)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-border)' }}
          />

          {/* Palette (right) — also serves as delete drop zone when dragging workspace nodes */}
          <DeleteDropZone style={{ width: libWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-surface)' }} active={activeDragId !== null} mode={isLibDrag ? 'cancel' : 'delete'}>
            {/* Icon-only tab bar (centered) */}
            <PaletteTabBar active={paletteTab} onChange={(tab) => { setPaletteTab(tab); setSearch(''); setGroupFilter('all') }} />

            {/* Search */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--c-border-sub)', flexShrink: 0 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('modal.searchActions')}
                style={{
                  width: '100%',
                  background: 'var(--c-input-bg)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 6, color: 'var(--c-text)',
                  padding: '5px 8px', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Group filter — only shown in 'shortcuts' or 'all' tabs when groups exist */}
            {(paletteTab === 'shortcuts' || paletteTab === 'all') && groups.length > 0 && (
              <div style={{ padding: '0 8px 6px', flexShrink: 0 }}>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid var(--c-border)',
                    background: 'var(--c-input-bg)',
                    color: 'var(--c-text)',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="all">{t('palette.allGroups')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {paletteTab === 'all' && (
                <>
                  {/* Actions section */}
                  {actionPaletteItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-dim)', padding: '2px 4px 4px', textTransform: 'uppercase' }}>
                        {t('palette.actions')}
                      </div>
                      {actionPaletteItems.map((type) => (
                        <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} />
                      ))}
                    </>
                  )}
                  {/* Scripts section */}
                  {scriptPaletteItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-dim)', padding: '6px 4px 4px', textTransform: 'uppercase' }}>
                        {t('palette.scripts')}
                      </div>
                      {scriptPaletteItems.map((type) => (
                        <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} />
                      ))}
                    </>
                  )}
                  {/* Shortcuts section */}
                  {shortcutPaletteItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-dim)', padding: '6px 4px 4px', textTransform: 'uppercase' }}>
                        {t('palette.shortcuts')}
                      </div>
                      {shortcutPaletteItems.map((entry) => (
                        <ShortcutLibraryItem key={entry.id} entry={entry} />
                      ))}
                    </>
                  )}
                  {actionPaletteItems.length === 0 && scriptPaletteItems.length === 0 && shortcutPaletteItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching items
                    </div>
                  )}
                </>
              )}

              {paletteTab === 'actions' && (
                <>
                  {actionPaletteItems.map((type) => (
                    <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} />
                  ))}
                  {actionPaletteItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching actions
                    </div>
                  )}
                </>
              )}

              {paletteTab === 'scripts' && (
                <>
                  {scriptPaletteItems.map((type) => (
                    <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} />
                  ))}
                  {scriptPaletteItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching scripts
                    </div>
                  )}
                </>
              )}

              {paletteTab === 'shortcuts' && (
                <>
                  {library.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      {t('script.noShortcuts')}
                    </div>
                  ) : shortcutPaletteItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching shortcuts
                    </div>
                  ) : (
                    shortcutPaletteItems.map((entry) => (
                      <ShortcutLibraryItem key={entry.id} entry={entry} />
                    ))
                  )}
                </>
              )}
            </div>
          </DeleteDropZone>
        </div>
      </div>

      {/* ── Icon/Color picker popover (no backdrop overlay) ── */}
      {pickerOpen && pickerPos && displaySlot && (
        <IconColorPopover
          pos={pickerPos}
          slot={displaySlot}
          resourceIcons={resourceIcons}
          recentColors={recentColors}
          onSelectIcon={handleSelectIcon}
          onSelectBuiltinIcon={handleSelectBuiltinIcon}
          onSelectBgColor={handleSelectBgColor}
          onClose={() => setPickerOpen(false)}
          anchorRef={iconBtnRef as React.RefObject<HTMLElement>}
        />
      )}

      {/* ── Drag overlay — simplified: icon + label only ── */}
      <DragOverlay dropAnimation={null}>
        {activeDragId && (() => {
          const type = isLibDrag
            ? (activeLibType ?? '')
            : (activeNode?.action.type ?? '')
          const cfg = NODE_STYLE[type]
          if (!cfg) return null
          // For run-shortcut drag, use the referenced entry's icon/color
          const dragCsEntry = type === 'run-shortcut'
            ? library.find((e) => e.id === (
                isLibDrag
                  ? (activeDragId.replace('lib-run-shortcut-', ''))
                  : (activeNode?.action as RunShortcutAction | undefined)?.shortcutId
              ))
            : undefined
          const overlayColor = dragCsEntry?.bgColor ?? cfg.color
          const overlayIcon  = dragCsEntry?.icon    ?? cfg.icon
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--c-elevated)',
              border: `1px solid ${overlayColor}55`,
              borderLeft: `3px solid ${overlayColor}`,
              boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
              pointerEvents: 'none', opacity: 0.97,
            }}>
              <span style={{ flexShrink: 0, color: overlayColor }}>{renderNodeIcon(overlayIcon, 16)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: overlayColor, whiteSpace: 'nowrap' }}>{cfg.label}</span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}

// ── ShortcutsApp ───────────────────────────────────────────────────────────────

export function ShortcutsApp(): JSX.Element {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    window.shortcutsAPI.getSlotData().then((d) => {
      if (d?.language) setLanguage(d.language)
    })
  }, [])

  return (
    <ErrorBoundary language={language}>
      <I18nProvider language={language}>
        <ShortcutsEditorInner />
      </I18nProvider>
    </ErrorBoundary>
  )
}
