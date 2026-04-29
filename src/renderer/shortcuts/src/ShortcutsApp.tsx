import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, useContext, Component } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { PlayNodeResult, ShortcutsSlotData, ResourceIconEntry, PopupMenuShowRequest } from '@shared/ipc.types'
import { WinControls } from '@settings/components/WinControls'
import { I18nProvider, useT } from '@settings/i18n/I18nContext'
import { BUILTIN_ICONS } from '@shared/icons'
import { UIIcon } from '@shared/UIIcon'
import { SVGIcon } from '@shared/SVGIcon'
import { IconColorPopup } from '@shared/IconColorPopup'
import { HexColorPicker } from 'react-colorful'
import { VariableInput, collectAvailableVars, collectAvailableVarInfos, ReturnValuePickerContext, LoopInsertContext, clampMenuPosition, getSourceIcon, getSourceColor, ValueDragContext, TAB_FIELD_ATTR, focusNextTabField } from './VariableInput'
import { CustomSelect } from './CustomSelect'
import type { VarInfo, ReturnValuePickerState, ReturnValueNodeMeta, LoopAssignOption, ValueDragState, ReturnValueInfo } from './VariableInput'
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
  type DragMoveEvent,
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
  ConditionCriteria, ConditionOperator, ConditionMatchLogic, ConditionMode, SwitchCase,
  LoopMode, VarOperation, VarMode, CalculateAction, CalcOperation, CommentAction, StopAction,
  SequenceAction, WaitMode, ListAction, DictAction,
  ClipboardAction, ClipboardMode, TextAction, TextMode, TextCaseMode, TransformAction, TransformMode, HashAlgorithm,
  AskInputAction, AskInputType, ChooseFromListAction, ShowAlertAction,
  HttpRequestAction, HttpMethod, FileAction, FileMode, FileInfoField,
  DateTimeAction, DateTimeMode, DateTimeUnit, TryCatchAction,
  RegistryAction, RegistryMode, RegistryHive, RegistryDataType,
  EnvironmentAction, EnvironmentMode,
  ServiceAction, ServiceMode,
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
      showPopupMenu: (request: PopupMenuShowRequest) => Promise<string | null>
      onThemeChanged: (cb: (theme: 'light' | 'dark') => void) => void
      showErrorLog: (logData: { message: string; stack: string; componentStack?: string }) => Promise<void>
      restartApp: () => Promise<void>
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

class SmartKeyboardSensor extends KeyboardSensor {
  static activators = [
    {
      eventName: 'onKeyDown' as const,
      handler: ({ nativeEvent: e }: { nativeEvent: KeyboardEvent }) => {
        return !isInteractiveElement(e.target as HTMLElement)
      },
    },
  ]
}

// IDs of large wrapper drop zones that should only match as a last resort
const ZONE_IDS = new Set(['workspace', 'delete-zone'])

// ── Return value picker context ───────────────────────────────────────────────

/** Describes the return value produced by a single action node. */
export interface NodeReturnValue {
  /** Variable-style reference to insert (e.g. "$myVar", "$__launch_0") */
  ref: string
  /** Human-readable short label (e.g. "앱 경로", "종료 코드") */
  label: string
  /** Action type that produced this return value (for icon display) */
  sourceType: string
}

/**
 * Returns the return value(s) a given action produces, or null if none.
 * `nodeIndex` is used to generate unique implicit variable names for actions
 * that don't declare an explicit variable (launch, shortcut, shell).
 */
function getNodeReturnValues(
  action: ActionConfig,
  nodeIndex: number,
  t: (key: keyof Translations) => string,
): NodeReturnValue[] | null {
  switch (action.type) {
    case 'launch': {
      const launchRvs: NodeReturnValue[] = [{ ref: `$__launch_${nodeIndex}`, label: t('script.returnLaunchTarget'), sourceType: 'launch' }]
      if (action.pidVar) {
        launchRvs.push({ ref: `$${action.pidVar}`, label: t('script.launchPid'), sourceType: 'launch' })
      }
      return launchRvs
    }
    case 'keyboard':
      return [{ ref: `$__keys_${nodeIndex}`, label: t('script.returnKeysCombo'), sourceType: 'keyboard' }]
    case 'shell':
      return [{ ref: `$__exit_${nodeIndex}`, label: t('script.returnExitCode'), sourceType: 'shell' }]
    case 'set-var':
    case 'list':
    case 'dict':
      return null
    case 'calculate': {
      const a = action as CalculateAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'calculate' }]
      return null
    }
    case 'run-shortcut': {
      const a = action as RunShortcutAction
      if (a.outputVar) return [{ ref: `$${a.outputVar}`, label: t('script.returnOutputVar'), sourceType: 'run-shortcut' }]
      return null
    }
    case 'stop': {
      const a = action as StopAction
      if (a.returnVar) return [{ ref: `$${a.returnVar}`, label: t('script.returnReturnVar'), sourceType: 'stop' }]
      return null
    }
    case 'loop': {
      const a = action as LoopAction
      const mode = a.mode ?? 'repeat'
      if (mode === 'repeat') return [{ ref: `$__loop_count_${nodeIndex}`, label: t('script.returnLoopCount'), sourceType: 'loop' }]
      if (mode === 'for') return [{ ref: `$__loop_i_${nodeIndex}`, label: t('script.returnLoopIndex'), sourceType: 'loop' }]
      if (mode === 'foreach' && a.itemVar) return [{ ref: `$${a.itemVar}`, label: t('script.returnLoopItem'), sourceType: 'loop' }]
      return null
    }
    case 'clipboard': {
      const a = action as ClipboardAction
      if (a.mode === 'get' && a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'clipboard' }]
      return null
    }
    case 'text': {
      const a = action as TextAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'text' }]
      return null
    }
    case 'transform': {
      const a = action as TransformAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'transform' }]
      return null
    }
    case 'ask-input': {
      const a = action as AskInputAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'ask-input' }]
      return null
    }
    case 'choose-from-list': {
      const a = action as ChooseFromListAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'choose-from-list' }]
      return null
    }
    case 'show-alert': {
      const a = action as ShowAlertAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'show-alert' }]
      return null
    }
    case 'http-request': {
      const a = action as HttpRequestAction
      const results: ReturnValueInfo[] = []
      if (a.resultVar) results.push({ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'http-request' })
      if (a.statusVar) results.push({ ref: `$${a.statusVar}`, label: t('script.httpStatusVar'), sourceType: 'http-request' })
      return results.length > 0 ? results : null
    }
    case 'file': {
      const a = action as FileAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'file' }]
      return null
    }
    case 'date-time': {
      const a = action as DateTimeAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'date-time' }]
      return null
    }
    case 'registry': {
      const a = action as RegistryAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'registry' }]
      return null
    }
    case 'environment': {
      const a = action as EnvironmentAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'environment' }]
      return null
    }
    case 'service': {
      const a = action as ServiceAction
      if (a.resultVar) return [{ ref: `$${a.resultVar}`, label: t('script.returnResultVar'), sourceType: 'service' }]
      return null
    }
    default:
      return null
  }
}

/**
 * Determines whether a node produces pipeline output that auto-flows to the
 * next node — mirroring macOS Shortcuts' pipeline line behaviour.
 *
 * Return `true` → the connecting line continues after this node.
 * Return `false` → the line breaks (gap).
 */
function nodeHasPipelineOutput(action: ActionConfig): boolean {
  switch (action.type) {
    // These always produce an implicit return value that pipes forward
    case 'launch':
    case 'keyboard':
    case 'shell':
      return true
    // Computation results pipe forward when an output variable is set
    case 'calculate':
      return !!(action as CalculateAction).resultVar
    case 'run-shortcut':
      return !!(action as RunShortcutAction).outputVar
    case 'clipboard':
      return (action as ClipboardAction).mode === 'get' && !!(action as ClipboardAction).resultVar
    case 'text':
      return !!(action as TextAction).resultVar
    case 'transform':
      return !!(action as TransformAction).resultVar
    case 'ask-input':
      return !!(action as AskInputAction).resultVar
    case 'choose-from-list':
      return !!(action as ChooseFromListAction).resultVar
    case 'show-alert':
      return !!(action as ShowAlertAction).resultVar
    case 'http-request':
      return !!(action as HttpRequestAction).resultVar
    case 'file':
      return !!(action as FileAction).resultVar
    case 'date-time':
      return !!(action as DateTimeAction).resultVar
    case 'registry':
      return !!(action as RegistryAction).resultVar
    case 'environment':
      return !!(action as EnvironmentAction).resultVar
    case 'service':
      return !!(action as ServiceAction).resultVar
    // Everything else: set-var (declares a named variable — no pipe),
    // control flow (if-else, loop, sequence), side-effects (wait, toast,
    // comment, escape, stop, system) — pipeline breaks.
    default:
      return false
  }
}

// ── Palette tab type ───────────────────────────────────────────────────────────

type PaletteTab = 'actions' | 'scripts' | 'all' | 'values'

// ── Node visual config ─────────────────────────────────────────────────────────

type NodeStyle = Record<string, { label: string; icon: string; color: string; desc: string }>

function getNodeStyle(t: (key: keyof Translations) => string): NodeStyle {
  return {
    launch:          { label: t('action.launch'),          icon: 'launch',        color: '#3b82f6', desc: t('action.launchDesc') },
    keyboard:        { label: t('action.keyboard'),        icon: 'keyboard',      color: '#8b5cf6', desc: t('action.keyboardDesc') },
    shell:           { label: t('action.shell'),           icon: 'shell',         color: '#10b981', desc: t('action.shellDesc') },
    system:          { label: t('action.system'),          icon: 'system',        color: '#f59e0b', desc: t('action.systemDesc') },
    link:            { label: t('action.link'),            icon: 'action_link',   color: '#06b6d4', desc: t('action.linkDesc') },
    'mouse-move':    { label: t('action.mouseMove'),       icon: 'mouse_move',    color: '#8b5cf6', desc: t('action.mouseMoveDesc') },
    'mouse-click':   { label: t('action.mouseClick'),      icon: 'mouse_click',   color: '#8b5cf6', desc: t('action.mouseClickDesc') },
    'if-else':       { label: t('action.ifElse'),          icon: 'if_else',       color: '#2dd4bf', desc: t('action.ifElseDesc') },
    loop:            { label: t('action.loop'),            icon: 'loop',          color: '#2dd4bf', desc: t('action.loopDesc') },
    wait:            { label: t('action.wait'),            icon: 'wait',          color: '#5eead4', desc: t('action.waitDesc') },
    'set-var':       { label: t('action.setVar'),          icon: 'variable',      color: '#f472b6', desc: t('action.setVarDesc') },
    list:            { label: t('action.list'),            icon: 'list_alt',      color: '#f472b6', desc: t('action.listDesc') },
    dict:            { label: t('action.dict'),            icon: 'data_object',   color: '#f472b6', desc: t('action.dictDesc') },
    toast:           { label: t('action.toast'),           icon: 'toast',         color: '#fb923c', desc: t('action.toastDesc') },
    'run-shortcut':  { label: t('action.runShortcut'),     icon: 'call_shortcut', color: '#22d3ee', desc: t('action.runShortcutDesc') },
    escape:          { label: t('action.escape'),          icon: 'exit_to_app',   color: '#5eead4', desc: t('action.escapeDesc') },
    stop:            { label: t('action.stop'),            icon: 'stop',          color: '#5eead4', desc: t('action.stopDesc') },
    calculate:       { label: t('action.calculate'),       icon: 'calculate',     color: '#10b981', desc: t('action.calculateDesc') },
    comment:         { label: t('action.comment'),         icon: 'comment',       color: '#6b7280', desc: t('action.commentDesc') },
    sequence:        { label: t('action.sequence'),        icon: 'all_inclusive', color: '#2dd4bf', desc: t('action.sequenceDesc') },
    clipboard:       { label: t('action.clipboard'),       icon: 'clipboard',     color: '#a78bfa', desc: t('action.clipboardDesc') },
    text:            { label: t('action.text'),            icon: 'text_fields',   color: '#f472b6', desc: t('action.textDesc') },
    transform:       { label: t('action.transform'),       icon: 'transform',     color: '#38bdf8', desc: t('action.transformDesc') },
    'ask-input':     { label: t('action.askInput'),        icon: 'ask_input',     color: '#fb923c', desc: t('action.askInputDesc') },
    'choose-from-list': { label: t('action.chooseFromList'), icon: 'choose_list', color: '#fb923c', desc: t('action.chooseFromListDesc') },
    'show-alert':    { label: t('action.showAlert'),       icon: 'show_alert',    color: '#fb923c', desc: t('action.showAlertDesc') },
    'http-request':  { label: t('action.httpRequest'),     icon: 'http_request',  color: '#38bdf8', desc: t('action.httpRequestDesc') },
    file:            { label: t('action.file'),            icon: 'file_action',   color: '#10b981', desc: t('action.fileDesc') },
    'date-time':     { label: t('action.dateTime'),        icon: 'date_time',     color: '#f472b6', desc: t('action.dateTimeDesc') },
    'try-catch':     { label: t('action.tryCatch'),        icon: 'try_catch',     color: '#2dd4bf', desc: t('action.tryCatchDesc') },
    registry:        { label: t('action.registry'),        icon: 'registry',      color: '#60a5fa', desc: t('action.registryDesc') },
    environment:     { label: t('action.environment'),     icon: 'environment_var', color: '#34d399', desc: t('action.environmentDesc') },
    service:         { label: t('action.service'),         icon: 'service_action', color: '#f59e0b', desc: t('action.serviceDesc') },
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


const ACTION_TYPES  = ['launch', 'keyboard', 'shell', 'system', 'link', 'mouse-move', 'mouse-click']
const SCRIPT_TYPES  = ['if-else', 'loop', 'sequence', 'try-catch', 'wait', 'set-var', 'list', 'dict', 'clipboard', 'text', 'transform', 'date-time', 'ask-input', 'choose-from-list', 'show-alert', 'http-request', 'file', 'registry', 'environment', 'service', 'toast', 'run-shortcut', 'escape', 'stop', 'calculate', 'comment']

// ── Subcategory definitions ──────────────────────────────────────────────────
interface SubCategory {
  labelKey: string  // i18n key
  types: string[]
}

const ACTION_SUBCATEGORIES: SubCategory[] = [
  { labelKey: 'palette.sub.controls', types: ['keyboard', 'mouse-click', 'mouse-move'] },
  { labelKey: 'palette.sub.system',   types: ['launch', 'link', 'shell', 'system'] },
]

const SCRIPT_SUBCATEGORIES: SubCategory[] = [
  { labelKey: 'palette.sub.flow',    types: ['if-else', 'loop', 'sequence', 'try-catch', 'escape', 'stop', 'wait'] },
  { labelKey: 'palette.sub.data',    types: ['set-var', 'list', 'dict', 'clipboard', 'text', 'transform', 'date-time'] },
  { labelKey: 'palette.sub.interaction', types: ['ask-input', 'choose-from-list', 'show-alert'] },
  { labelKey: 'palette.sub.io', types: ['http-request', 'file'] },
  { labelKey: 'palette.sub.windows', types: ['registry', 'environment', 'service'] },
  { labelKey: 'palette.sub.utility', types: ['toast', 'run-shortcut', 'calculate', 'comment'] },
]

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

// ── ShortcutVariableInput — key recording + variable context menu ──────────────

function ShortcutVariableInput({
  value,
  onChange,
  availableVars,
  availableVarInfos,
  nodeIndex,
  label,
  style: styleProp,
}: {
  value: string
  onChange: (keys: string) => void
  availableVars: string[]
  availableVarInfos?: VarInfo[]
  nodeIndex?: number
  label?: string
  style?: React.CSSProperties
}): JSX.Element {
  const t = useT()
  const btnRef = useRef<HTMLButtonElement>(null)
  const { requestPick, resolveReturnValueMeta } = useContext(ReturnValuePickerContext)
  const loopInsert = useContext(LoopInsertContext)

  const { dragState: valueDrag, setForbiddenTooltip } = useContext(ValueDragContext)
  const [recording, setRecording] = useState(false)
  const pendingRef = useRef(value)
  const [pendingDisplay, setPendingDisplay] = useState(value)
  const [dragOver, setDragOver] = useState(false)

  // Custom context menu state
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [menuClamped, setMenuClamped] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [submenuClamped, setSubmenuClamped] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const varSubmenuRef = useRef<HTMLDivElement>(null)
  const [varSubmenuRect, setVarSubmenuRect] = useState<DOMRect | null>(null)
  const triggerRectRef = useRef<DOMRect | null>(null)

  const varInfos: VarInfo[] = useMemo(() => {
    if (availableVarInfos && availableVarInfos.length > 0) return availableVarInfos
    return availableVars.map(name => ({ name, sourceType: 'set-var' }))
  }, [availableVars, availableVarInfos])

  const isVarRef = /^\$\w+$/.test(value.trim())

  // Value drag-and-drop
  const isDropAllowed = valueDrag.active && nodeIndex !== undefined && valueDrag.definedAtIndex < nodeIndex
  const isDropForbidden = valueDrag.active && nodeIndex !== undefined && valueDrag.definedAtIndex >= nodeIndex
  const handleNativeDragOver = useCallback((e: React.DragEvent) => {
    if (!valueDrag.active) return
    if (isDropAllowed) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); setForbiddenTooltip({ x: 0, y: 0, visible: false }) }
    else if (isDropForbidden) { e.dataTransfer.dropEffect = 'none'; setDragOver(false); setForbiddenTooltip({ x: e.clientX, y: e.clientY, visible: true }) }
  }, [valueDrag.active, isDropAllowed, isDropForbidden, setForbiddenTooltip])
  const handleNativeDragLeave = useCallback(() => { setDragOver(false); setForbiddenTooltip({ x: 0, y: 0, visible: false }) }, [setForbiddenTooltip])
  const handleNativeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); setForbiddenTooltip({ x: 0, y: 0, visible: false })
    if (isDropAllowed) onChange(valueDrag.ref)
  }, [isDropAllowed, valueDrag.ref, onChange, setForbiddenTooltip])
  const dropTargetProps = { onDragOver: handleNativeDragOver, onDragLeave: handleNativeDragLeave, onDrop: handleNativeDrop }

  // Key recording
  useEffect(() => {
    if (!recording) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        pendingRef.current = value; setPendingDisplay(value)
        setRecording(false)
        return
      }
      e.preventDefault(); e.stopPropagation()
      const combo = buildKeyCombo(e)
      if (combo) {
        pendingRef.current = combo; setPendingDisplay(combo)
        onChange(combo)
        setRecording(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [recording, value, onChange])

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          (!submenuRef.current || !submenuRef.current.contains(e.target as Node))) {
        setMenuOpen(false); setSubmenuOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setSubmenuOpen(false) }
    }
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick, true); document.removeEventListener('keydown', handleKey) }
  }, [menuOpen])

  // Clamp menu to viewport; flip above input if no room below
  useLayoutEffect(() => {
    if (menuOpen && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const tRect = triggerRectRef.current
      setMenuPos(prev => {
        let { top, left } = prev
        if (tRect && top + menuRect.height > window.innerHeight - 8) {
          const aboveTop = tRect.top - menuRect.height - 4
          if (aboveTop >= 8) top = aboveTop
        }
        return clampMenuPosition(menuRef.current, { top, left })
      })
      setMenuClamped(true)
    } else { setMenuClamped(false) }
  }, [menuOpen])

  // Clamp submenu to viewport
  useLayoutEffect(() => {
    if (submenuOpen && submenuRef.current && varSubmenuRect) {
      const el = submenuRef.current
      const rect = el.getBoundingClientRect()
      let top = varSubmenuRect.top
      let left = varSubmenuRect.right + 4
      if (left + rect.width > window.innerWidth - 8) left = varSubmenuRect.left - rect.width - 4
      if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8
      if (left < 8) left = 8; if (top < 8) top = 8
      el.style.top = `${top}px`; el.style.left = `${left}px`
      setSubmenuClamped(true)
    } else { setSubmenuClamped(false) }
  }, [submenuOpen, varSubmenuRect])

  const closeMenu = useCallback(() => { setMenuOpen(false); setSubmenuOpen(false) }, [])

  const handleSelect = useCallback((id: string) => {
    closeMenu()
    if (id === '__record') {
      pendingRef.current = value; setPendingDisplay(value); setRecording(true)
    } else if (id === '__return_value') {
      requestPick(nodeIndex ?? Infinity, (ref: string) => onChange(ref))
    } else if (id.startsWith('var:')) {
      onChange(`$${id.slice(4)}`)
    } else if (id.startsWith('loop:')) {
      const parts = id.slice(5); const sepIdx = parts.indexOf(':')
      const optVarName = parts.slice(0, sepIdx); const optValue = parts.slice(sepIdx + 1)
      if (loopInsert.directRef) { onChange(optValue) }
      else { loopInsert.insertSetVar(optVarName, optValue); onChange(`$${optVarName}`) }
    }
  }, [closeMenu, value, requestPick, onChange, nodeIndex, loopInsert])

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (recording) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    triggerRectRef.current = rect
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
    setSubmenuOpen(false)
    setMenuOpen(true)
  }, [recording])

  const menuContainerStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 99999,
    background: 'var(--c-elevated, #1e1e2e)', border: '1px solid var(--c-border, #333)',
    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    padding: '4px 0', minWidth: 150, overflow: 'hidden',
  }
  const menuItemStyle = (color?: string): React.CSSProperties => ({
    padding: '5px 10px', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 7,
    color: color || 'var(--c-text, #e0e0e0)', background: 'transparent',
    borderRadius: 4, margin: '1px 4px', whiteSpace: 'nowrap',
    fontWeight: 500, transition: 'background 0.08s',
  })
  const hoverOn = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)' }
  const hoverOff = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }

  const renderMenu = () => {
    if (!menuOpen) return null
    return createPortal(
      <>
        <div ref={menuRef} data-no-dnd="true"
          style={{ ...menuContainerStyle, top: menuPos.top, left: menuPos.left, visibility: menuClamped ? 'visible' : 'hidden' }}>
          {/* Loop options */}
          {loopInsert.options.map(opt => (
            <div key={`loop:${opt.varName}:${opt.value}`}
              onClick={() => handleSelect(`loop:${opt.varName}:${opt.value}`)}
              style={menuItemStyle('#06b6d4')} onMouseOver={hoverOn} onMouseOut={hoverOff}>
              <UIIcon name="loop" size={14} /><span>{opt.label}</span>
            </div>
          ))}
          {loopInsert.options.length > 0 && (
            <div style={{ height: 1, background: 'var(--c-border-sub, #333)', margin: '4px 0' }} />
          )}

          {/* Record keyboard shortcut */}
          <div onClick={() => handleSelect('__record')}
            style={menuItemStyle()} onMouseOver={hoverOn} onMouseOut={hoverOff}>
            <UIIcon name="keyboard" size={14} /><span>{t('recorder.clickToRecord')}</span>
          </div>

          {/* Variable select (click to open submenu) */}
          {varInfos.length > 0 && (
            <div ref={varSubmenuRef}
              onClick={e => { setVarSubmenuRect((e.currentTarget as HTMLElement).getBoundingClientRect()); setSubmenuOpen(prev => !prev) }}
              onMouseOver={hoverOn}
              onMouseOut={e => { if (!submenuOpen) hoverOff(e) }}
              style={{ ...menuItemStyle('#a78bfa'), background: submenuOpen ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
              <UIIcon name="variable" size={14} />
              <span style={{ flex: 1 }}>{t('shortcuts.selectVariable')}</span>
              <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>▸</span>
            </div>
          )}

          {/* Return value select */}
          <div onClick={() => { handleSelect('__return_value'); setSubmenuOpen(false) }}
            style={menuItemStyle('#f59e0b')} onMouseOver={hoverOn} onMouseOut={hoverOff}>
            <UIIcon name="output" size={14} /><span>{t('shortcuts.selectReturnValue')}</span>
          </div>
        </div>

        {/* Variable submenu */}
        {submenuOpen && varInfos.length > 0 && varSubmenuRect && (
          <div ref={submenuRef} data-no-dnd="true"
            style={{ ...menuContainerStyle, top: varSubmenuRect.top, left: varSubmenuRect.right + 4, maxHeight: 240, overflowY: 'auto', visibility: submenuClamped ? 'visible' : 'hidden' }}>
            {varInfos.map(v => (
              <div key={`var:${v.name}`} onClick={() => handleSelect(`var:${v.name}`)}
                style={menuItemStyle(getSourceColor(v.sourceType))} onMouseOver={hoverOn} onMouseOut={hoverOff}>
                <UIIcon name={getSourceIcon(v.sourceType)} size={14} />
                <span style={{ fontFamily: 'monospace' }}>{v.displayLabel ?? v.name}</span>
              </div>
            ))}
          </div>
        )}
      </>,
      document.body,
    )
  }

  const baseStyle: React.CSSProperties = {
    borderRadius: 6, color: 'var(--c-text)', padding: '4px 8px',
    fontSize: 12, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box' as const,
    ...styleProp,
    ...(recording ? {
      background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444',
    } : {
      background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)',
    }),
    ...(valueDrag.active ? {
      border: dragOver && isDropAllowed ? '1.5px solid #3b82f6' : '1px solid rgba(59,130,246,0.45)',
      background: dragOver && isDropAllowed ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)',
      color: '#60a5fa', transition: 'all 0.12s',
    } : {}),
  }

  // Variable chip display
  if (isVarRef) {
    const varName = value.trim().slice(1)
    const rvMeta = resolveReturnValueMeta(value.trim())
    const matchedVar = varInfos.find(v => v.name === varName)
    const chipEl = rvMeta ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: `${rvMeta.color}18`, color: rvMeta.color, fontSize: 11, fontFamily: 'monospace', lineHeight: '1.6', cursor: 'pointer' }}>
        <UIIcon name={rvMeta.icon} size={12} />{rvMeta.label}
      </span>
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: `${getSourceColor(matchedVar?.sourceType ?? 'set-var')}18`, color: getSourceColor(matchedVar?.sourceType ?? 'set-var'), fontSize: 11, fontFamily: 'monospace', lineHeight: '1.6', cursor: 'pointer' }}>
        <UIIcon name={getSourceIcon(matchedVar?.sourceType ?? 'set-var')} size={12} />{varName}
      </span>
    )
    const labelEl = label ? <span style={{ fontSize: 9, color: 'var(--c-text-dim)', flexShrink: 0, fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap', userSelect: 'none' }}>{label}</span> : null
    return (<>{labelEl}<div onClick={handleButtonClick} data-no-dnd="true" {...dropTargetProps} style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 6,
      background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)', padding: '2px 4px',
      ...styleProp,
      ...(valueDrag.active ? { border: dragOver && isDropAllowed ? '1.5px solid #3b82f6' : '1px solid rgba(59,130,246,0.35)', background: dragOver && isDropAllowed ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.04)', transition: 'all 0.12s' } : {}),
    }}>{chipEl}</div>{renderMenu()}</>)
  }

  const labelElBtn = label ? <span style={{ fontSize: 9, color: 'var(--c-text-dim)', flexShrink: 0, fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap', userSelect: 'none' }}>{label}</span> : null
  return (
    <>
      {recording && <style>{`@keyframes recorder-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3)}50%{box-shadow:0 0 0 4px rgba(239,68,68,0)}}`}</style>}
      {labelElBtn}
      <button ref={btnRef} onClick={handleButtonClick} data-no-dnd="true" {...dropTargetProps} style={{
        ...baseStyle, cursor: 'pointer', textAlign: 'left', display: 'inline-flex',
        alignItems: 'center', gap: 4, overflow: 'hidden', minHeight: 26,
        ...(recording ? { animation: 'recorder-pulse 1.2s ease-in-out infinite', color: '#ef4444' } : {}),
      }}>
        {recording ? (
          <><span style={{ fontSize: 8, lineHeight: 1, flexShrink: 0 }}>●</span><span>{pendingDisplay || t('recorder.recording')}</span></>
        ) : value ? (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{value}</span>
        ) : null}
      </button>
      {renderMenu()}
    </>
  )
}

// ── NestedActionList — action list with DnD drop zone support ────────────────

function makeDefaultAction(type: string, extraData?: { shortcutId?: string }): ActionConfig {
  switch (type) {
    case 'launch':        return { type: 'launch', target: '' }
    case 'keyboard':      return { type: 'keyboard', keys: '' }
    case 'shell':         return { type: 'shell', command: '' }
    case 'wait':          return { type: 'wait', ms: 0 }
    case 'set-var':       return { type: 'set-var', name: '', value: '' }
    case 'list':          return { type: 'list', name: '', mode: 'define', listItems: [] } as ActionConfig
    case 'dict':          return { type: 'dict', name: '', mode: 'define', dictItems: [] } as ActionConfig
    case 'toast':         return { type: 'toast', message: '' }
    case 'if-else':       return { type: 'if-else', condition: '', matchLogic: 'all', criteria: [{ variable: '', operator: 'eq' as ConditionOperator, value: '' }], thenActions: [], elseActions: [], switchDefault: [] }
    case 'loop':          return { type: 'loop', mode: 'repeat' as LoopMode, count: 0, body: [] }
    case 'run-shortcut': return { type: 'run-shortcut', shortcutId: extraData?.shortcutId ?? '' }
    case 'escape':        return { type: 'escape' }
    case 'stop':          return { type: 'stop' }
    case 'calculate':     return { type: 'calculate', operation: 'add' as CalcOperation, operandA: '', operandB: '', resultVar: '', scope: 'local' }
    case 'comment':       return { type: 'comment', text: '' }
    case 'sequence':      return { type: 'sequence', name: '', body: [], showProgress: true }
    case 'link':          return { type: 'link', url: '' }
    case 'mouse-move':    return { type: 'mouse-move', mode: 'set', x: '', y: '' }
    case 'mouse-click':   return { type: 'mouse-click', button: 'left' }
    case 'clipboard':     return { type: 'clipboard', mode: 'get', resultVar: '' } as ActionConfig
    case 'text':          return { type: 'text', mode: 'replace', input: '', resultVar: '', find: '', replaceWith: '' } as ActionConfig
    case 'transform':     return { type: 'transform', mode: 'json-parse', input: '', resultVar: '' } as ActionConfig
    case 'ask-input':     return { type: 'ask-input', resultVar: '' } as ActionConfig
    case 'choose-from-list': return { type: 'choose-from-list', items: [''], resultVar: '' } as ActionConfig
    case 'show-alert':    return { type: 'show-alert' } as ActionConfig
    case 'http-request':  return { type: 'http-request', url: '', method: 'GET' as HttpMethod, resultVar: '' } as ActionConfig
    case 'file':          return { type: 'file', mode: 'read' as FileMode, path: '', resultVar: '' } as ActionConfig
    case 'date-time':     return { type: 'date-time', mode: 'now' as DateTimeMode, resultVar: '' } as ActionConfig
    case 'try-catch':     return { type: 'try-catch', tryActions: [], catchActions: [] } as ActionConfig
    case 'registry':      return { type: 'registry', mode: 'read' as RegistryMode, hive: 'HKCU' as RegistryHive, keyPath: '', resultVar: '' } as ActionConfig
    case 'environment':   return { type: 'environment', mode: 'get' as EnvironmentMode, name: '', resultVar: '' } as ActionConfig
    case 'service':       return { type: 'service', mode: 'status' as ServiceMode, serviceName: '', resultVar: '' } as ActionConfig
    default:              return { type: 'system', action: 'volume-up' as SystemActionId }
  }
}

// ── Branch tree navigation helpers (support arbitrary nesting depth) ──

function getBranchActionsFromAction(action: ActionConfig, branchType: string): ActionConfig[] | null {
  if (action.type === 'if-else') {
    const a = action as IfElseAction
    if (branchType === 'then') return a.thenActions
    if (branchType === 'else') return a.elseActions
    if (branchType === 'default') return a.switchDefault ?? []
    const caseMatch = branchType.match(/^case-(\d+)$/)
    if (caseMatch) {
      const idx = parseInt(caseMatch[1], 10)
      return a.switchCases?.[idx]?.actions ?? null
    }
  }
  if (action.type === 'loop' && branchType === 'loop') return (action as LoopAction).body
  if (action.type === 'sequence' && branchType === 'sequence') return (action as SequenceAction).body
  if (action.type === 'try-catch') {
    const a = action as TryCatchAction
    if (branchType === 'try') return a.tryActions
    if (branchType === 'catch') return a.catchActions
  }
  return null
}

function setBranchActionsOnAction(action: ActionConfig, branchType: string, newActions: ActionConfig[]): ActionConfig {
  if (action.type === 'if-else') {
    const a = action as IfElseAction
    if (branchType === 'then') return { ...a, thenActions: newActions }
    if (branchType === 'else') return { ...a, elseActions: newActions }
    if (branchType === 'default') return { ...a, switchDefault: newActions }
    const caseMatch = branchType.match(/^case-(\d+)$/)
    if (caseMatch) {
      const idx = parseInt(caseMatch[1], 10)
      const cases = [...(a.switchCases ?? [])]
      if (idx < cases.length) cases[idx] = { ...cases[idx], actions: newActions }
      return { ...a, switchCases: cases }
    }
  }
  if (action.type === 'loop' && branchType === 'loop') return { ...(action as LoopAction), body: newActions }
  if (action.type === 'sequence' && branchType === 'sequence') return { ...(action as SequenceAction), body: newActions }
  if (action.type === 'try-catch') {
    const a = action as TryCatchAction
    if (branchType === 'try') return { ...a, tryActions: newActions }
    if (branchType === 'catch') return { ...a, catchActions: newActions }
  }
  return action
}

function modifyActionAtPath(
  action: ActionConfig,
  segments: string[],
  transform: (actions: ActionConfig[]) => ActionConfig[]
): ActionConfig | null {
  if (segments.length === 0) return null
  const branchType = segments[0]
  if (segments.length === 1) {
    const current = getBranchActionsFromAction(action, branchType)
    if (!current) return null
    return setBranchActionsOnAction(action, branchType, transform(current))
  }
  if (segments.length < 3) return null
  const index = parseInt(segments[1], 10)
  const rest = segments.slice(2)
  const branchActions = getBranchActionsFromAction(action, branchType)
  if (!branchActions || index >= branchActions.length) return null
  const modifiedChild = modifyActionAtPath(branchActions[index], rest, transform)
  if (!modifiedChild) return null
  const newBranchActions = branchActions.map((a, i) => i === index ? modifiedChild : a)
  return setBranchActionsOnAction(action, branchType, newBranchActions)
}

/** Navigate a path-based branchId and apply a transform to the target branch's action array. */
function modifyBranch(
  nodes: ActionNode[],
  branchId: string,
  transform: (actions: ActionConfig[]) => ActionConfig[]
): ActionNode[] | null {
  const withoutPrefix = branchId.slice(7) // remove "branch:"
  const colonIdx = withoutPrefix.indexOf(':')
  if (colonIdx === -1) return null
  const nodeId = withoutPrefix.slice(0, colonIdx)
  const segments = withoutPrefix.slice(colonIdx + 1).split(':')
  const nodeIdx = nodes.findIndex(n => n._id === nodeId)
  if (nodeIdx === -1) return null
  const modifiedAction = modifyActionAtPath(nodes[nodeIdx].action, segments, transform)
  if (!modifiedAction) return null
  return nodes.map((n, i) => i === nodeIdx ? { ...n, action: modifiedAction } : n)
}

/** Extract the top-level nodeId from a path-based branchId. */
function extractNodeIdFromBranchId(branchId: string): string {
  const withoutPrefix = branchId.slice(7)
  const colonIdx = withoutPrefix.indexOf(':')
  return colonIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, colonIdx)
}

/** When a sibling item is removed from a parent branch, path-based branchIds that
 *  point into items AFTER the removed index need their index decremented by one.
 *  e.g. removing index 0 from branch:abc:try makes branch:abc:try:1:sequence → branch:abc:try:0:sequence */
function adjustBranchIdAfterRemoval(targetBranchId: string, sourceBranchId: string, sourceIndex: number): string {
  const prefix = sourceBranchId + ':'
  if (!targetBranchId.startsWith(prefix)) return targetBranchId
  const rest = targetBranchId.slice(prefix.length)
  const colonPos = rest.indexOf(':')
  const indexStr = colonPos === -1 ? rest : rest.slice(0, colonPos)
  const idx = parseInt(indexStr, 10)
  if (isNaN(idx) || idx <= sourceIndex) return targetBranchId
  const suffix = colonPos === -1 ? '' : rest.slice(colonPos)
  return prefix + (idx - 1) + suffix
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
  parentVars?: string[]
  parentVarInfos?: VarInfo[]
}

function NestedActionList({ label, color, actions, onChange, nodeStyle, library, branchId, currentEntryId, parentVars, parentVarInfos }: NestedActionListProps): JSX.Element {
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
                  nestedPath={`${effectiveBranchId}:${idx}`}
                  availableVars={parentVars}
                  availableVarInfos={parentVarInfos}
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

function ConditionInlineFields({ action, onChange, availableVars, availableVarInfos, nodeIndex }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
  nodeIndex?: number
}): JSX.Element {
  const t = useT()
  const conditionMode: ConditionMode = action.conditionMode ?? 'if-else'
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
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const inpField: React.CSSProperties = {
    ...inp,
    background: 'var(--c-accent-bg)',
    border: '1px solid var(--c-accent-border)',
  }

  const updateCriteria = (newCriteria: ConditionCriteria[]) =>
    onChange({ ...action, criteria: newCriteria })

  const handleModeChange = (newMode: ConditionMode) => {
    if (newMode === conditionMode) return
    if (newMode === 'switch') {
      onChange({ ...action, conditionMode: 'switch', switchValue: '', switchCases: [{ value: '', actions: [] }], switchDefault: [] })
    } else {
      onChange({ ...action, conditionMode: 'if-else', matchLogic: 'all', criteria: [{ variable: '', operator: 'eq', value: '' }], thenActions: [], elseActions: [] })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
      {/* Row 0: Mode selector + switch value (or match logic) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <CustomSelect
          value={conditionMode}
          onChange={(v) => handleModeChange(v as ConditionMode)}
          options={[
            { value: 'if-else', label: t('script.conditionModeIfElse') },
            { value: 'switch', label: t('script.conditionModeSwitch') },
          ]}
          style={{ ...inp, minWidth: 90 }}
        />
        {conditionMode === 'if-else' ? (
          <>
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.matchLogicPrefix')}</span>
            <CustomSelect
              value={matchLogic}
              onChange={(v) => onChange({ ...action, matchLogic: v as ConditionMatchLogic })}
              options={[
                { value: 'all', label: t('script.matchAll') },
                { value: 'any', label: t('script.matchAny') },
              ]}
              style={{ ...inp, minWidth: 68 }}
            />
          </>
        ) : (
          <VariableInput
            value={action.switchValue ?? ''}
            onChange={(v) => onChange({ ...action, switchValue: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.switchValue')}
            style={{ ...inpField, flex: 1, minWidth: 100 }}
          />
        )}
      </div>

      {conditionMode === 'if-else' ? (
        <>
          {/* Criteria rows */}
          {criteria.map((crit, idx) => (
            <div key={idx}>
              <div style={{ height: 1, background: 'var(--c-border)', margin: '2px 0', opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingTop: 2 }}>
                <VariableInput
                  value={crit.variable}
                  onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, variable: v } : c))}
                  availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
                  label={t('script.conditionVar')}
                  style={{ ...inpField, minWidth: 90 }}
                />
                <CustomSelect
                  value={crit.operator}
                  onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, operator: v as ConditionOperator } : c))}
                  options={OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
                  style={{ ...inp, minWidth: 88 }}
                />
                {!noValueOps.has(crit.operator) && (
                  <VariableInput
                    value={crit.value}
                    onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, value: v } : c))}
                    availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
                    label={t('script.conditionVal')}
                    style={{ ...inpField, minWidth: 80 }}
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
        </>
      ) : (
        /* Switch mode: case value list below divider */
        <SwitchCaseValueList action={action} onChange={onChange} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
      )}
    </div>
  )
}

// ── SwitchCaseValueList — editable case value rows for switch mode ──────────────

function SwitchCaseValueList({ action, onChange, availableVars, availableVarInfos, nodeIndex }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
  nodeIndex?: number
}): JSX.Element {
  const t = useT()
  const switchCases: SwitchCase[] = action.switchCases ?? [{ value: '', actions: [] }]

  const inpField: React.CSSProperties = {
    background: 'var(--c-accent-bg)',
    border: '1px solid var(--c-accent-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const updateCaseValue = (idx: number, value: string) => {
    onChange({ ...action, switchCases: switchCases.map((c, i) => i === idx ? { ...c, value } : c) })
  }
  const deleteCase = (idx: number) => {
    onChange({ ...action, switchCases: switchCases.filter((_, i) => i !== idx) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {switchCases.map((sc, idx) => (
        <div key={idx}>
          <div style={{ height: 1, background: 'var(--c-border)', margin: '2px 0', opacity: 0.5 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--c-text-dim)', flexShrink: 0, fontWeight: 600, letterSpacing: '0.04em' }}>{t('script.caseLabel')}</span>
            <VariableInput
              value={sc.value}
              onChange={(v) => updateCaseValue(idx, v)}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              style={{ ...inpField, flex: 1, minWidth: 60 }}
            />
            {switchCases.length > 1 && (
              <button
                onClick={() => deleteCase(idx)}
                style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', borderRadius: 3, display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
              ><UIIcon name="close" size={11} /></button>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={() => onChange({ ...action, switchCases: [...switchCases, { value: '', actions: [] }] })}
        style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: '2px 0', fontFamily: 'inherit' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-accent)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
      >
        {t('script.addCase')}
      </button>
    </div>
  )
}

// ── ConditionModeSelect — mode + match logic dropdown (for header row) ──────

function ConditionModeSelect({ action, onChange }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
}): JSX.Element {
  const t = useT()
  const conditionMode: ConditionMode = action.conditionMode ?? 'if-else'
  const matchLogic: ConditionMatchLogic = action.matchLogic ?? 'all'
  const inp: React.CSSProperties = {
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const handleModeChange = (newMode: ConditionMode) => {
    if (newMode === conditionMode) return
    if (newMode === 'switch') {
      onChange({ ...action, conditionMode: 'switch', switchValue: '', switchCases: [{ value: '', actions: [] }], switchDefault: [] })
    } else {
      onChange({ ...action, conditionMode: 'if-else', matchLogic: 'all', criteria: [{ variable: '', operator: 'eq', value: '' }], thenActions: [], elseActions: [] })
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
      <CustomSelect
        value={conditionMode}
        onChange={(v) => handleModeChange(v as ConditionMode)}
        options={[
          { value: 'if-else', label: t('script.conditionModeIfElse') },
          { value: 'switch', label: t('script.conditionModeSwitch') },
        ]}
        style={{ ...inp, minWidth: 80 }}
      />
      {conditionMode === 'if-else' ? (
        <>
          <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.matchLogicPrefix')}</span>
          <CustomSelect
            value={matchLogic}
            onChange={(v) => onChange({ ...action, matchLogic: v as ConditionMatchLogic })}
            options={[
              { value: 'all', label: t('script.matchAll') },
              { value: 'any', label: t('script.matchAny') },
            ]}
            style={{ ...inp, minWidth: 68 }}
          />
        </>
      ) : (
        <input
          value={action.switchValue ?? ''}
          onChange={(e) => onChange({ ...action, switchValue: e.target.value })}
          style={{ ...inp, flex: 1, minWidth: 60, background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)' }}
        />
      )}
    </div>
  )
}

// ── ConditionCriteriaSection — criteria rows + add button (below header divider) ─

function ConditionCriteriaSection({ action, onChange, availableVars, availableVarInfos, nodeIndex }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
  nodeIndex?: number
}): JSX.Element {
  const t = useT()
  const conditionMode: ConditionMode = action.conditionMode ?? 'if-else'

  if (conditionMode === 'switch') {
    // Switch mode: show case value list
    const switchCases: SwitchCase[] = action.switchCases ?? [{ value: '', actions: [] }]
    const inpField: React.CSSProperties = {
      background: 'var(--c-accent-bg)',
      border: '1px solid var(--c-accent-border)',
      borderRadius: 5,
      color: 'var(--c-text)',
      padding: '3px 6px',
      fontSize: 11,
      fontFamily: 'inherit',
      outline: 'none',
      boxSizing: 'border-box',
    }
    const updateCaseValue = (idx: number, value: string) => {
      onChange({ ...action, switchCases: switchCases.map((c, i) => i === idx ? { ...c, value } : c) })
    }
    const deleteCase = (idx: number) => {
      onChange({ ...action, switchCases: switchCases.filter((_, i) => i !== idx) })
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
        {switchCases.map((sc, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10, color: 'var(--c-text-dim)', flexShrink: 0, fontWeight: 600, letterSpacing: '0.04em' }}>{t('script.caseLabel')}</span>
            <VariableInput
              value={sc.value}
              onChange={(v) => updateCaseValue(idx, v)}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              style={{ ...inpField, flex: 1, minWidth: 60 }}
            />
            {switchCases.length > 1 && (
              <button
                onClick={() => deleteCase(idx)}
                style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', borderRadius: 3, display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
              ><UIIcon name="close" size={11} /></button>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onChange({ ...action, switchCases: [...switchCases, { value: '', actions: [] }] })}
            style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-accent)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
          >
            {t('script.addCase')}
          </button>
        </div>
      </div>
    )
  }

  // If-Else mode: show criteria rows (original behavior)
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
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 5,
    color: 'var(--c-text)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const inpField: React.CSSProperties = {
    ...inp,
    background: 'var(--c-accent-bg)',
    border: '1px solid var(--c-accent-border)',
  }

  const updateCriteria = (newCriteria: ConditionCriteria[]) =>
    onChange({ ...action, criteria: newCriteria })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
      {criteria.map((crit, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <VariableInput
            value={crit.variable}
            onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, variable: v } : c))}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.conditionVar')}
            style={{ ...inpField, minWidth: 90 }}
          />
          <CustomSelect
            value={crit.operator}
            onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, operator: v as ConditionOperator } : c))}
            options={OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
            style={{ ...inp, minWidth: 88 }}
          />
          {!noValueOps.has(crit.operator) && (
            <VariableInput
              value={crit.value}
              onChange={(v) => updateCriteria(criteria.map((c, i) => i === idx ? { ...c, value: v } : c))}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              label={t('script.conditionVal')}
              style={{ ...inpField, minWidth: 80 }}
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
  const conditionMode: ConditionMode = action.conditionMode ?? 'if-else'

  if (conditionMode === 'switch') {
    const switchCases: SwitchCase[] = action.switchCases ?? [{ value: '', actions: [] }]
    const switchDefault: ActionConfig[] = action.switchDefault ?? []

    const updateCase = (idx: number, updated: SwitchCase) => {
      onChange({ ...action, switchCases: switchCases.map((c, i) => i === idx ? updated : c) })
    }

    return (
      <div>
        {/* Case branches — divider labels only (values edited in card above) */}
        {switchCases.map((sc, idx) => (
          <div key={idx}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 0 2px 0',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
                {t('script.caseLabel')} {sc.value ? `"${sc.value}"` : `#${idx + 1}`}
              </span>
              <div style={{ flex: 1, height: 1, background: `${color}44` }} />
            </div>
            <NestedActionList
              label=""
              color={color}
              actions={sc.actions}
              onChange={(acts) => updateCase(idx, { ...sc, actions: acts })}
              nodeStyle={nodeStyle}
              library={library}
              branchId={`branch:${nodeId}:case-${idx}`}
              currentEntryId={currentEntryId}
            />
          </div>
        ))}

        {/* DEFAULT branch — always present */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 0 2px 0',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
              {t('script.defaultLabel')}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(107,114,128,0.3)' }} />
          </div>
          <NestedActionList
            label=""
            color="#6b7280"
            actions={switchDefault}
            onChange={(acts) => onChange({ ...action, switchDefault: acts })}
            nodeStyle={nodeStyle}
            library={library}
            branchId={`branch:${nodeId}:default`}
            currentEntryId={currentEntryId}
          />
        </div>

        {/* END SWITCH divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 0 0 0',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
            {t('script.endSwitch')}
          </span>
          <div style={{ flex: 1, height: 1, background: `${color}22` }} />
        </div>
      </div>
    )
  }

  // If-Else mode (original)
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

// ── NestedSwitchBranches — case/default branches for switch mode inside nested cards ──

function NestedSwitchBranches({ action, onChange, color, nodeStyle, library, currentEntryId, depth, nestedPath }: {
  action: IfElseAction
  onChange: (a: ActionConfig) => void
  color: string
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  currentEntryId?: string
  depth: number
  nestedPath?: string
}): JSX.Element {
  const t = useT()
  const switchCases: SwitchCase[] = action.switchCases ?? [{ value: '', actions: [] }]
  const switchDefault: ActionConfig[] = action.switchDefault ?? []

  const updateCase = (idx: number, updated: SwitchCase) => {
    onChange({ ...action, switchCases: switchCases.map((c, i) => i === idx ? updated : c) })
  }

  return (
    <>
      {/* Case branches — divider labels only */}
      {switchCases.map((sc, idx) => (
        <div key={idx}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
              {t('script.caseLabel')} {sc.value ? `"${sc.value}"` : `#${idx + 1}`}
            </span>
            <div style={{ flex: 1, height: 1, background: `${color}44` }} />
          </div>
          <NestedActionListSimple
            color={color}
            actions={sc.actions}
            onChange={(acts) => updateCase(idx, { ...sc, actions: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={nestedPath ? `${nestedPath}:case-${idx}` : `branch:nested-${depth}:case-${idx}`}
          />
        </div>
      ))}

      {/* DEFAULT branch — always present */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
            {t('script.defaultLabel')}
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(107,114,128,0.3)' }} />
        </div>
        <NestedActionListSimple
          color="#6b7280"
          actions={switchDefault}
          onChange={(acts) => onChange({ ...action, switchDefault: acts })}
          nodeStyle={nodeStyle}
          library={library}
          currentEntryId={currentEntryId}
          depth={depth + 1}
          branchId={nestedPath ? `${nestedPath}:default` : `branch:nested-${depth}:default`}
        />
      </div>

      {/* END SWITCH */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.endSwitch')}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}22` }} />
      </div>
    </>
  )
}

// ── LoopBranchesExternal — Loop Body/End rendered outside the card ───────────────

function LoopBranchesExternal({ action, onChange, nodeStyle, library, nodeId, currentEntryId, availableVars, availableVarInfos }: {
  action: LoopAction
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  nodeId: string
  currentEntryId?: string
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
}): JSX.Element {
  const t = useT()
  const color = nodeStyle['loop']?.color ?? '#2dd4bf'
  // Build loop iteration variable for inner body nodes
  const loopMode = action.mode ?? 'repeat'
  // Detect if the foreach target is a list or dict (needed for display labels)
  const foreachTargetType = loopMode === 'foreach'
    ? (availableVarInfos ?? []).find(v => v.name === action.listVar)?.sourceType ?? 'list'
    : null
  const loopBodyVars: string[] = [...(availableVars ?? [])]
  const loopBodyVarInfos: VarInfo[] = [...(availableVarInfos ?? [])]
  if (loopMode === 'repeat') {
    loopBodyVars.unshift('__loop_count')
    loopBodyVarInfos.unshift({ name: '__loop_count', sourceType: 'loop', displayLabel: t('script.loopAssignCount') })
  } else if (loopMode === 'for') {
    loopBodyVars.unshift('__loop_i')
    loopBodyVarInfos.unshift({ name: '__loop_i', sourceType: 'loop', displayLabel: t('script.loopAssignIndex') })
  } else if (loopMode === 'foreach') {
    // Always provide both _key and _item for ForEach
    const itemVar = action.itemVar || '_item'
    const keyVar = action.keyVar || '_key'
    loopBodyVars.unshift(itemVar)
    loopBodyVarInfos.unshift({ name: itemVar, sourceType: 'loop', displayLabel: foreachTargetType === 'dict' ? t('script.loopForeachDictValue') : t('script.loopForeachValue') })
    loopBodyVars.unshift(keyVar)
    loopBodyVarInfos.unshift({ name: keyVar, sourceType: 'loop', displayLabel: foreachTargetType === 'dict' ? t('script.loopForeachKey') : t('script.loopForeachIndex') })
  }

  // Build loop insert context for VariableInput context menus inside the body
  const loopInsertCtx = useMemo(() => {
    const options: LoopAssignOption[] = []
    let directRef = false
    if (loopMode === 'repeat') {
      options.push({ label: t('script.loopAssignCount'), varName: 'loop_count', value: '$__loop_count' })
    } else if (loopMode === 'for') {
      options.push({ label: t('script.loopAssignIndex'), varName: action.iterVar ?? 'i', value: `$${action.iterVar ?? '__loop_i'}` })
    } else if (loopMode === 'foreach') {
      directRef = true
      const itemVar = action.itemVar || '_item'
      const keyVar = action.keyVar || '_key'
      if (foreachTargetType === 'dict') {
        options.push({ label: t('script.loopForeachKey'), varName: keyVar, value: `$${keyVar}` })
        options.push({ label: t('script.loopForeachDictValue'), varName: itemVar, value: `$${itemVar}` })
      } else {
        options.push({ label: t('script.loopForeachIndex'), varName: keyVar, value: `$${keyVar}` })
        options.push({ label: t('script.loopForeachValue'), varName: itemVar, value: `$${itemVar}` })
      }
    }
    return {
      options,
      directRef,
      insertSetVar: (name: string, value: string): boolean => {
        const exists = action.body.some(a => a.type === 'set-var' && (a as SetVarAction).name === name)
        if (exists) return false
        const newSetVar: SetVarAction = { type: 'set-var', name, value, scope: 'local' }
        onChange({ ...action, body: [newSetVar, ...action.body] })
        return true
      },
    }
  }, [loopMode, action, onChange, t, foreachTargetType])

  return (
    <LoopInsertContext.Provider value={loopInsertCtx}>
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
        parentVars={loopBodyVars}
        parentVarInfos={loopBodyVarInfos}
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
    </LoopInsertContext.Provider>
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
  const color = nodeStyle['sequence']?.color ?? '#2dd4bf'
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

// ── TryCatchBranchesExternal — top-level try/catch branch structure ──────────

function TryCatchBranchesExternal({ action, onChange, nodeStyle, library, nodeId, currentEntryId }: {
  action: TryCatchAction
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  nodeId: string
  currentEntryId?: string
}): JSX.Element {
  const t = useT()
  const color = nodeStyle['try-catch']?.color ?? '#2dd4bf'
  return (
    <div>
      {/* TRY divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 2px 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.tryLabel')}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}44` }} />
      </div>
      <NestedActionList
        label=""
        color={color}
        actions={action.tryActions}
        onChange={(acts) => onChange({ ...action, tryActions: acts })}
        nodeStyle={nodeStyle}
        library={library}
        branchId={`branch:${nodeId}:try`}
        currentEntryId={currentEntryId}
      />

      {/* CATCH divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 2px 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.catchLabel')}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(239,68,68,0.3)' }} />
      </div>
      <NestedActionList
        label=""
        color="#ef4444"
        actions={action.catchActions}
        onChange={(acts) => onChange({ ...action, catchActions: acts })}
        nodeStyle={nodeStyle}
        library={library}
        branchId={`branch:${nodeId}:catch`}
        currentEntryId={currentEntryId}
      />

      {/* END TRY divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 0 0 0',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
          {t('script.tryCatchEnd')}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}22` }} />
      </div>
    </div>
  )
}

// ── RunShortcutInline — sub-component for run-shortcut with gallery picker ────

function RunShortcutInline({ action, onChange, library, groups, resourceIcons, currentEntryId, inp }: {
  action: RunShortcutAction
  onChange: (a: ActionConfig) => void
  library: ShortcutEntry[]
  groups: ShortcutGroup[]
  resourceIcons: ResourceIconEntry[]
  currentEntryId?: string
  inp: React.CSSProperties
}): JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })

  const available = currentEntryId ? library.filter((e) => e.id !== currentEntryId) : library
  const selectedEntry = available.find((e) => e.id === action.shortcutId)

  const handleOpenPicker = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPickerPos({ top: rect.bottom + 2, left: rect.left })
    setPickerOpen(true)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <button
          ref={btnRef}
          onClick={handleOpenPicker}
          data-no-dnd="true"
          style={{
            ...inp,
            minWidth: 60,
            cursor: 'pointer',
            textAlign: 'left',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            overflow: 'hidden',
            minHeight: 26,
            background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)',
          }}
        >
          {selectedEntry ? (
            <>
              <span style={{ flexShrink: 0, color: selectedEntry.bgColor ?? '#22d3ee' }}>
                {resolveEntryIcon(selectedEntry, resourceIcons, 13)}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedEntry.name}
              </span>
            </>
          ) : (
            <span>{'\u00A0'}</span>
          )}
        </button>
      </div>

      {/* Gallery picker menu */}
      {pickerOpen && (
        <ShortcutPickerMenu
          library={available}
          groups={groups}
          resourceIcons={resourceIcons}
          selectedId={action.shortcutId}
          onSelect={(id) => onChange({ ...action, shortcutId: id })}
          onClose={() => setPickerOpen(false)}
          pos={pickerPos}
        />
      )}
    </div>
  )
}

// ── InlineNodeFields — unified right-side input for every node type ─────────────

function InlineNodeFields({ action, onChange, nodeStyle: _nodeStyle, library, groups, resourceIcons, currentEntryId, availableVars, availableVarInfos, nodeIndex }: {
  action: ActionConfig
  onChange: (a: ActionConfig) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  groups?: ShortcutGroup[]
  resourceIcons?: ResourceIconEntry[]
  currentEntryId?: string
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
  nodeIndex?: number
}): JSX.Element | null {
  const t = useT()
  const SYSTEM_LABELS = getSystemLabels(t)

  const inp: React.CSSProperties = {
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 6,
    color: 'var(--c-text)',
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    textAlign: 'right',
  }

  /** Accent-styled input field (always blue border + light blue bg) */
  const inpField: React.CSSProperties = {
    ...inp,
    background: 'var(--c-accent-bg)',
    border: '1px solid var(--c-accent-border)',
    color: 'var(--c-accent)',
  }

  if (action.type === 'launch') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={action.target}
          onChange={(v) => onChange({ ...action, target: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelTarget')}
          extraMenuItems={[{
            id: 'browse-file',
            label: t('script.browseFile'),
            icon: 'folder',
            color: '#60a5fa',
            onSelect: async () => {
              const path = await window.shortcutsAPI.pickExe()
              if (path) onChange({ ...action, target: path })
            },
          }]}
          style={{ ...inpField, minWidth: 60 }}
        />
        <VariableInput
          value={action.pidVar ?? ''}
          onChange={(v) => onChange({ ...action, pidVar: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.launchPid')}
          style={{ ...inpField, minWidth: 50 }}
        />
      </div>
    )
  }

  if (action.type === 'keyboard') {
    return (
      <ShortcutVariableInput
        value={action.keys}
        onChange={(keys) => onChange({ type: 'keyboard', keys })}
        availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
        label={t('script.labelKeys')}
        style={{ ...inpField, minWidth: 60 }}
      />
    )
  }

  if (action.type === 'shell') {
    return (
      <VariableInput
        value={action.command}
        onChange={(v) => onChange({ type: 'shell', command: v })}
        availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
        label={t('script.labelCommand')}
        style={{ ...inpField, minWidth: 120, flex: 1 }}
      />
    )
  }

  if (action.type === 'system') {
    return (
      <CustomSelect
        value={action.action}
        onChange={(v) => onChange({ type: 'system', action: v as SystemActionId })}
        options={SYSTEM_ACTIONS.map((a) => ({ value: a, label: SYSTEM_LABELS[a] }))}
        style={{ ...inp, minWidth: 120 }}
      />
    )
  }

  if (action.type === 'link') {
    return (
      <VariableInput
        value={action.url}
        onChange={(v) => onChange({ type: 'link', url: v })}
        availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
        label="URL"
        style={{ ...inpField, minWidth: 120, flex: 1 }}
        placeholder="https://..."
      />
    )
  }

  if (action.type === 'mouse-move') {
    const a = action as import('@shared/config.types').MouseMoveAction
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.mode ?? 'set'}
          onChange={(v) => onChange({ ...a, mode: v as import('@shared/config.types').MouseMoveMode })}
          options={[
            { value: 'set', label: t('mouse.modeSet') },
            { value: 'offset', label: t('mouse.modeOffset') },
          ]}
          style={{ ...inp, minWidth: 80 }}
        />
        <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>{t('mouse.x')}</span>
        <VariableInput
          value={a.x}
          onChange={(v) => onChange({ ...a, x: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          style={{ ...inpField, width: 60, minWidth: 50 }}
          placeholder="0"
        />
        <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>{t('mouse.y')}</span>
        <VariableInput
          value={a.y}
          onChange={(v) => onChange({ ...a, y: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          style={{ ...inpField, width: 60, minWidth: 50 }}
          placeholder="0"
        />
      </div>
    )
  }

  if (action.type === 'mouse-click') {
    const a = action as import('@shared/config.types').MouseClickAction
    return (
      <CustomSelect
        value={a.button ?? 'left'}
        onChange={(v) => onChange({ ...a, button: v as import('@shared/config.types').MouseButton })}
        options={[
          { value: 'left', label: t('mouse.left') },
          { value: 'right', label: t('mouse.right') },
          { value: 'middle', label: t('mouse.middle') },
          { value: 'side1', label: t('mouse.side1') },
          { value: 'side2', label: t('mouse.side2') },
          { value: 'wheel-up', label: t('mouse.wheelUp') },
          { value: 'wheel-down', label: t('mouse.wheelDown') },
        ]}
        style={{ ...inp, minWidth: 120 }}
      />
    )
  }

  if (action.type === 'sequence') {
    const a = action as SequenceAction
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.name}
          onChange={(v) => onChange({ ...a, name: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.sequenceName')}
          style={{ ...inpField, minWidth: 100, flex: 1 }}
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
        <CustomSelect
          value={mode}
          onChange={(v) => onChange({ ...a, mode: v as WaitMode })}
          options={[
            { value: 'manual', label: t('script.waitManual') },
            { value: 'variable', label: t('script.waitVariable') },
            { value: 'app-exit', label: t('script.waitAppExit') },
            { value: 'key-input', label: t('script.waitKeyInput') },
          ]}
          style={{ ...inp, minWidth: 90 }}
        />
        {mode === 'manual' && (
          <>
            <input
              type="number"
              value={a.ms}
              min={0} max={60000}
              onChange={(e) => onChange({ ...a, ms: Math.max(0, Number(e.target.value)) })}
              style={{ ...inpField, minWidth: 80 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.delayMs')}</span>
          </>
        )}
        {mode === 'variable' && (
          <VariableInput
            value={a.variable ?? ''}
            onChange={(v) => onChange({ ...a, variable: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.labelVariable')}
            style={{ ...inpField, minWidth: 100 }}
          />
        )}
        {mode === 'app-exit' && (
          <VariableInput
            value={a.launchRef ?? ''}
            onChange={(v) => onChange({ ...a, launchRef: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.waitAppTarget')}
            style={{ ...inpField, minWidth: 140 }}
          />
        )}
        {mode === 'key-input' && (
          <ShortcutRecorder
            value={a.waitKeys ?? ''}
            onChange={(keys) => onChange({ ...a, waitKeys: keys })}
          />
        )}
      </div>
    )
  }

  if (action.type === 'set-var') {
    const a = action as SetVarAction
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.name}
          onChange={(v) => onChange({ ...a, name: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          noReturnValues
          label={t('script.varName')}
          style={{ ...inpField, minWidth: 60 }}
        />
        <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>=</span>
        <VariableInput
          value={a.value}
          onChange={(v) => onChange({ ...a, value: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.varValue')}
          style={{ ...inpField, flex: 1, minWidth: 60 }}
        />
      </div>
    )
  }

  if (action.type === 'list') {
    const a = action as ListAction
    const varMode: VarMode = a.mode ?? 'define'
    const op: VarOperation = a.operation ?? 'set'

    // Edit mode — operation-based inline layout
    if (varMode === 'edit') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <CustomSelect
            value={varMode}
            onChange={(v) => onChange({ ...a, mode: v as VarMode })}
            options={[
              { value: 'define', label: t('script.varModeDefine') },
              { value: 'edit', label: t('script.varModeEdit') },
            ]}
            style={{ ...inp, minWidth: 62 }}
          />
          <CustomSelect
            value={op}
            onChange={(v) => onChange({ ...a, operation: v as VarOperation })}
            options={[
              { value: 'set', label: t('script.varOpSet') },
              { value: 'get', label: t('script.varOpGet') },
              { value: 'push', label: t('script.varOpPush') },
              { value: 'remove', label: t('script.varOpRemove') },
            ]}
            style={{ ...inp, minWidth: 72 }}
          />
          <input
            value={a.name}
            onChange={(e) => onChange({ ...a, name: e.target.value })}
            style={{ ...inpField, minWidth: 90 }}
          />
          {(op === 'set' || op === 'push') && (
            <>
              <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>
                {op === 'push' ? '←' : '='}
              </span>
              <VariableInput
                value={a.value ?? ''}
                onChange={(v) => onChange({ ...a, value: v })}
                availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
                label={t('script.varValue')}
                style={{ ...inpField, flex: 1, minWidth: 80 }}
              />
            </>
          )}
          {(op === 'push' || op === 'get' || op === 'remove') && (
            <input
              value={a.key ?? ''}
              onChange={(e) => onChange({ ...a, key: e.target.value })}
              style={{ ...inpField, minWidth: 72 }}
            />
          )}
          {op === 'get' && (
            <input
              value={a.resultVar ?? ''}
              onChange={(e) => onChange({ ...a, resultVar: e.target.value })}
              style={{ ...inpField, minWidth: 90 }}
            />
          )}
        </div>
      )
    }

    // Define mode — header-only portion (card body rendered in SortableNode)
    return null
  }

  if (action.type === 'dict') {
    const a = action as DictAction
    const varMode: VarMode = a.mode ?? 'define'
    const op: VarOperation = a.operation ?? 'set'

    // Edit mode — operation-based inline layout
    if (varMode === 'edit') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <CustomSelect
            value={varMode}
            onChange={(v) => onChange({ ...a, mode: v as VarMode })}
            options={[
              { value: 'define', label: t('script.varModeDefine') },
              { value: 'edit', label: t('script.varModeEdit') },
            ]}
            style={{ ...inp, minWidth: 62 }}
          />
          <CustomSelect
            value={op}
            onChange={(v) => onChange({ ...a, operation: v as VarOperation })}
            options={[
              { value: 'set', label: t('script.varOpSet') },
              { value: 'get', label: t('script.varOpGet') },
              { value: 'remove', label: t('script.varOpRemove') },
            ]}
            style={{ ...inp, minWidth: 72 }}
          />
          <input
            value={a.name}
            onChange={(e) => onChange({ ...a, name: e.target.value })}
            style={{ ...inpField, minWidth: 90 }}
          />
          {op === 'set' && (
            <>
              <input
                value={a.key ?? ''}
                onChange={(e) => onChange({ ...a, key: e.target.value })}
                style={{ ...inpField, minWidth: 72 }}
              />
              <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>=</span>
              <VariableInput
                value={a.value ?? ''}
                onChange={(v) => onChange({ ...a, value: v })}
                availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
                label={t('script.varValue')}
                style={{ ...inpField, flex: 1, minWidth: 80 }}
              />
            </>
          )}
          {(op === 'get' || op === 'remove') && (
            <input
              value={a.key ?? ''}
              onChange={(e) => onChange({ ...a, key: e.target.value })}
              style={{ ...inpField, minWidth: 72 }}
            />
          )}
          {op === 'get' && (
            <input
              value={a.resultVar ?? ''}
              onChange={(e) => onChange({ ...a, resultVar: e.target.value })}
              style={{ ...inpField, minWidth: 90 }}
            />
          )}
        </div>
      )
    }

    // Define mode — header-only portion (card body rendered in SortableNode)
    return null
  }

  // Toast — header-only portion (title); card body (message) rendered in SortableNode
  if (action.type === 'toast') {
    const a = action as ToastAction
    return (
      <VariableInput
        value={a.title ?? ''}
        onChange={(v) => onChange({ ...a, title: v || undefined })}
        availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
        label={t('script.toastTitle')}
        placeholder={t('script.toastTitle')}
        style={{ ...inpField, minWidth: 120, flex: 1 }}
      />
    )
  }

  if (action.type === 'run-shortcut') {
    return (
      <RunShortcutInline
        action={action as RunShortcutAction}
        onChange={onChange}
        library={library}
        groups={groups ?? []}
        resourceIcons={resourceIcons ?? []}
        currentEntryId={currentEntryId}
        inp={inp}
      />
    )
  }

  if (action.type === 'if-else') {
    return <ConditionInlineFields action={action as IfElseAction} onChange={onChange} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
  }

  if (action.type === 'loop') {
    const a = action as LoopAction
    const mode: LoopMode = a.mode ?? 'repeat'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={mode}
          onChange={(v) => onChange({ ...a, mode: v as LoopMode })}
          options={[
            { value: 'repeat', label: t('script.loopModeRepeat') },
            { value: 'for', label: t('script.loopModeFor') },
            { value: 'foreach', label: t('script.loopModeForeach') },
          ]}
          style={{ ...inp, width: 80 }}
        />
        {mode === 'repeat' && (
          <VariableInput
            value={String(a.count ?? '')}
            onChange={(v) => { const n = parseInt(v, 10); onChange({ ...a, count: !isNaN(n) && !/^\$|^@/.test(v) ? Math.max(1, Math.min(1000, n)) : v }) }}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.labelCount')}
            style={{ ...inpField, minWidth: 40 }}
          />
        )}
        {mode === 'for' && (
          <>
            <VariableInput
              value={String(a.start ?? '')}
              onChange={(v) => { const n = parseInt(v, 10); onChange({ ...a, start: !isNaN(n) && !/^\$|^@/.test(v) ? n : v }) }}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              label={t('script.labelStart')}
              style={{ ...inpField, minWidth: 40 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.loopTo')}</span>
            <VariableInput
              value={String(a.end ?? '')}
              onChange={(v) => { const n = parseInt(v, 10); onChange({ ...a, end: !isNaN(n) && !/^\$|^@/.test(v) ? n : v }) }}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              style={{ ...inpField, minWidth: 40 }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>{t('script.loopStep')}</span>
            <VariableInput
              value={String(a.step ?? '')}
              onChange={(v) => { const n = parseInt(v, 10); onChange({ ...a, step: !isNaN(n) && !/^\$|^@/.test(v) ? n : v }) }}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              style={{ ...inpField, minWidth: 40 }}
            />
          </>
        )}
        {mode === 'foreach' && (() => {
          // Filter to only show List and Dict variables
          const foreachVarInfos = (availableVarInfos ?? []).filter(v => v.sourceType === 'list' || v.sourceType === 'dict')
          const foreachVars = foreachVarInfos.map(v => v.name)
          return (
            <VariableInput
              value={a.listVar ? `$${a.listVar}` : ''}
              onChange={(v) => {
                const varName = v.startsWith('$') ? v.slice(1) : v
                onChange({ ...a, listVar: varName, itemVar: '_item', keyVar: '_key' })
              }}
              availableVars={foreachVars} availableVarInfos={foreachVarInfos} nodeIndex={nodeIndex}
              label={t('script.loopListVar')}
              style={{ ...inpField, minWidth: 60 }}
            />
          )
        })()}
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
          style={{ ...inpField, minWidth: 90 }}
        />
        {a.returnVar && (
          <>
            <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>=</span>
            <input
              value={a.returnValue ?? ''}
              onChange={(e) => onChange({ ...a, returnValue: e.target.value })}
              style={{ ...inpField, minWidth: 100 }}
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
      { value: 'add',      label: '+' },
      { value: 'sub',      label: '−' },
      { value: 'mul',      label: '×' },
      { value: 'div',      label: '÷' },
      { value: 'mod',      label: '%' },
      { value: 'floordiv', label: '//' },
      { value: 'pow',      label: '^' },
      { value: 'sqrt',     label: '√' },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.operandA}
          onChange={(v) => onChange({ ...a, operandA: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label="A"
          style={{ ...inpField, minWidth: 60 }}
        />
        <CustomSelect
          value={a.operation}
          onChange={(v) => onChange({ ...a, operation: v as CalcOperation })}
          options={CALC_OPS.map((op) => ({ value: op.value, label: op.label }))}
          style={{ ...inp, minWidth: 52 }}
        />
        {!isSqrt && (
          <VariableInput
            value={a.operandB ?? ''}
            onChange={(v) => onChange({ ...a, operandB: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label="B"
            style={{ ...inpField, minWidth: 60 }}
          />
        )}
      </div>
    )
  }

  // ── Clipboard ─────────────────────────────────────────────────────────────
  if (action.type === 'clipboard') {
    const a = action as ClipboardAction
    const CLIPBOARD_MODES: { value: ClipboardMode; label: string }[] = [
      { value: 'get', label: t('script.clipboardGet') },
      { value: 'set', label: t('script.clipboardSet') },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.mode}
          onChange={(v) => onChange({ ...a, mode: v as ClipboardMode })}
          options={CLIPBOARD_MODES.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 60 }}
        />
        {a.mode === 'set' && (
          <VariableInput
            value={a.value ?? ''}
            onChange={(v) => onChange({ ...a, value: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.clipboardValue')}
            placeholder={t('script.clipboardValue')}
            style={{ ...inpField, flex: 1, minWidth: 80 }}
          />
        )}
        {a.mode === 'get' && (
          <VariableInput
            value={a.resultVar ?? ''}
            onChange={(v) => onChange({ ...a, resultVar: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.labelResult')}
            placeholder={t('script.calcResult')}
            style={{ ...inpField, minWidth: 70 }}
          />
        )}
      </div>
    )
  }

  // ── Text ─────────────────────────────────────────────────────────────────
  if (action.type === 'text') {
    const a = action as TextAction
    const TEXT_MODES: { value: TextMode; label: string }[] = [
      { value: 'replace',   label: t('script.textModeReplace') },
      { value: 'split',     label: t('script.textModeSplit') },
      { value: 'combine',   label: t('script.textModeCombine') },
      { value: 'case',      label: t('script.textModeCase') },
      { value: 'match',     label: t('script.textModeMatch') },
      { value: 'substring', label: t('script.textModeSubstring') },
      { value: 'length',    label: t('script.textModeLength') },
      { value: 'trim',      label: t('script.textModeTrim') },
      { value: 'pad',       label: t('script.textModePad') },
    ]
    const CASE_MODES: { value: TextCaseMode; label: string }[] = [
      { value: 'upper',      label: t('script.textCaseUpper') },
      { value: 'lower',      label: t('script.textCaseLower') },
      { value: 'capitalize', label: t('script.textCaseCapitalize') },
      { value: 'camel',      label: t('script.textCaseCamel') },
      { value: 'snake',      label: t('script.textCaseSnake') },
      { value: 'kebab',      label: t('script.textCaseKebab') },
    ]

    const modeFields = (): JSX.Element | null => {
      switch (a.mode) {
        case 'replace':
          return (<>
            <VariableInput value={a.find ?? ''} onChange={(v) => onChange({ ...a, find: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textFind')} placeholder={t('script.textFind')} style={{ ...inpField, minWidth: 60 }} />
            <VariableInput value={a.replaceWith ?? ''} onChange={(v) => onChange({ ...a, replaceWith: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textReplaceWith')} placeholder={t('script.textReplaceWith')} style={{ ...inpField, minWidth: 60 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--c-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={a.useRegex ?? false} onChange={(e) => onChange({ ...a, useRegex: e.target.checked })} style={{ margin: 0 }} />
              {t('script.textRegex')}
            </label>
          </>)
        case 'split':
          return <VariableInput value={a.separator ?? ''} onChange={(v) => onChange({ ...a, separator: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textSeparator')} placeholder={t('script.textSeparator')} style={{ ...inpField, minWidth: 50 }} />
        case 'combine':
          return (<>
            <VariableInput value={a.listVar ?? ''} onChange={(v) => onChange({ ...a, listVar: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textListVar')} placeholder={t('script.textListVar')} style={{ ...inpField, minWidth: 60 }} />
            <VariableInput value={a.separator ?? ''} onChange={(v) => onChange({ ...a, separator: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textSeparator')} placeholder={t('script.textSeparator')} style={{ ...inpField, minWidth: 50 }} />
          </>)
        case 'case':
          return <CustomSelect value={a.caseMode ?? 'upper'} onChange={(v) => onChange({ ...a, caseMode: v as TextCaseMode })} options={CASE_MODES.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 80 }} />
        case 'match':
          return (<>
            <VariableInput value={a.pattern ?? ''} onChange={(v) => onChange({ ...a, pattern: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textPattern')} placeholder={t('script.textPattern')} style={{ ...inpField, minWidth: 80 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--c-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={a.matchAll ?? false} onChange={(e) => onChange({ ...a, matchAll: e.target.checked })} style={{ margin: 0 }} />
              {t('script.textMatchAll')}
            </label>
          </>)
        case 'substring':
          return (<>
            <VariableInput value={String(a.start ?? '0')} onChange={(v) => onChange({ ...a, start: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textStart')} placeholder={t('script.textStart')} style={{ ...inpField, minWidth: 40, maxWidth: 60 }} />
            <VariableInput value={a.length !== undefined ? String(a.length) : ''} onChange={(v) => onChange({ ...a, length: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textLength')} placeholder={t('script.textLength')} style={{ ...inpField, minWidth: 40, maxWidth: 60 }} />
          </>)
        case 'length':
        case 'trim':
          return null
        case 'pad':
          return (<>
            <VariableInput value={String(a.padLength ?? '')} onChange={(v) => onChange({ ...a, padLength: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textPadLength')} placeholder={t('script.textPadLength')} style={{ ...inpField, minWidth: 40, maxWidth: 60 }} />
            <VariableInput value={a.padChar ?? ''} onChange={(v) => onChange({ ...a, padChar: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.textPadChar')} placeholder={t('script.textPadChar')} style={{ ...inpField, minWidth: 30, maxWidth: 40 }} />
            <CustomSelect value={a.padSide ?? 'start'} onChange={(v) => onChange({ ...a, padSide: v as 'start' | 'end' })} options={[{ value: 'start', label: t('script.textPadStart') }, { value: 'end', label: t('script.textPadEnd') }]} style={{ ...inp, minWidth: 50 }} />
          </>)
        default:
          return null
      }
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.mode}
          onChange={(v) => {
            const next: Partial<TextAction> = { mode: v as TextMode }
            if (v === 'case' && !a.caseMode) next.caseMode = 'upper'
            onChange({ ...a, ...next })
          }}
          options={TEXT_MODES.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 70 }}
        />
        {a.mode !== 'combine' && (
          <VariableInput
            value={a.input}
            onChange={(v) => onChange({ ...a, input: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.textInput')}
            placeholder={t('script.textInput')}
            style={{ ...inpField, minWidth: 60 }}
          />
        )}
        {modeFields()}
        <VariableInput
          value={a.resultVar}
          onChange={(v) => onChange({ ...a, resultVar: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── Transform ───────────────────────────────────────────────────────────
  if (action.type === 'transform') {
    const a = action as TransformAction
    const TRANSFORM_MODES: { value: TransformMode; label: string }[] = [
      { value: 'json-parse',     label: t('script.transformJsonParse') },
      { value: 'json-stringify', label: t('script.transformJsonStringify') },
      { value: 'url-encode',     label: t('script.transformUrlEncode') },
      { value: 'url-decode',     label: t('script.transformUrlDecode') },
      { value: 'base64-encode',  label: t('script.transformBase64Encode') },
      { value: 'base64-decode',  label: t('script.transformBase64Decode') },
      { value: 'hash',           label: t('script.transformHash') },
    ]
    const HASH_ALGOS: { value: HashAlgorithm; label: string }[] = [
      { value: 'md5',    label: 'MD5' },
      { value: 'sha1',   label: 'SHA-1' },
      { value: 'sha256', label: 'SHA-256' },
      { value: 'sha512', label: 'SHA-512' },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.mode}
          onChange={(v) => {
            const next: Partial<TransformAction> = { mode: v as TransformMode }
            if (v === 'hash' && !a.algorithm) next.algorithm = 'sha256'
            onChange({ ...a, ...next })
          }}
          options={TRANSFORM_MODES.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 100 }}
        />
        <VariableInput
          value={a.input}
          onChange={(v) => onChange({ ...a, input: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.textInput')}
          placeholder={t('script.textInput')}
          style={{ ...inpField, flex: 1, minWidth: 60 }}
        />
        {a.mode === 'hash' && (
          <CustomSelect
            value={a.algorithm ?? 'sha256'}
            onChange={(v) => onChange({ ...a, algorithm: v as HashAlgorithm })}
            options={HASH_ALGOS.map((h) => ({ value: h.value, label: h.label }))}
            style={{ ...inp, minWidth: 70 }}
          />
        )}
        <VariableInput
          value={a.resultVar}
          onChange={(v) => onChange({ ...a, resultVar: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── Ask Input ──────────────────────────────────────────────────────────
  if (action.type === 'ask-input') {
    const a = action as AskInputAction
    const INPUT_TYPES: { value: AskInputType; label: string }[] = [
      { value: 'text',     label: t('script.askInputTypeText') },
      { value: 'number',   label: t('script.askInputTypeNumber') },
      { value: 'password', label: t('script.askInputTypePassword') },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.inputType ?? 'text'}
          onChange={(v) => onChange({ ...a, inputType: v as AskInputType })}
          options={INPUT_TYPES.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 70 }}
        />
        <VariableInput
          value={a.title ?? ''}
          onChange={(v) => onChange({ ...a, title: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.askInputTitle')}
          placeholder={t('script.askInputTitle')}
          style={{ ...inpField, minWidth: 60 }}
        />
        <VariableInput
          value={a.prompt ?? ''}
          onChange={(v) => onChange({ ...a, prompt: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.askInputPrompt')}
          placeholder={t('script.askInputPrompt')}
          style={{ ...inpField, flex: 1, minWidth: 60 }}
        />
        <VariableInput
          value={a.defaultValue ?? ''}
          onChange={(v) => onChange({ ...a, defaultValue: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.askInputDefault')}
          placeholder={t('script.askInputDefault')}
          style={{ ...inpField, minWidth: 50 }}
        />
        <VariableInput
          value={a.resultVar}
          onChange={(v) => onChange({ ...a, resultVar: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── Choose from List ──────────────────────────────────────────────────
  if (action.type === 'choose-from-list') {
    const a = action as ChooseFromListAction
    const useListVar = !!a.listVar
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.title ?? ''}
          onChange={(v) => onChange({ ...a, title: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.chooseTitle')}
          placeholder={t('script.chooseTitle')}
          style={{ ...inpField, minWidth: 50 }}
        />
        <CustomSelect
          value={useListVar ? 'variable' : 'items'}
          onChange={(v) => {
            if (v === 'variable') onChange({ ...a, listVar: '', items: undefined })
            else onChange({ ...a, listVar: undefined, items: a.items ?? [''] })
          }}
          options={[
            { value: 'items', label: t('script.chooseSourceItems') },
            { value: 'variable', label: t('script.chooseSourceVariable') },
          ]}
          style={{ ...inp, minWidth: 60 }}
        />
        {useListVar ? (
          <VariableInput
            value={a.listVar ?? ''}
            onChange={(v) => onChange({ ...a, listVar: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.chooseListVar')}
            placeholder={t('script.chooseListVar')}
            style={{ ...inpField, flex: 1, minWidth: 60 }}
          />
        ) : (
          <>
            {(a.items ?? []).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <VariableInput
                  value={item}
                  onChange={(v) => {
                    const next = [...(a.items ?? [])]
                    next[i] = v
                    onChange({ ...a, items: next })
                  }}
                  availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
                  placeholder={`#${i + 1}`}
                  style={{ ...inpField, minWidth: 40 }}
                />
                {(a.items ?? []).length > 1 && (
                  <button
                    onClick={() => {
                      const next = [...(a.items ?? [])]
                      next.splice(i, 1)
                      onChange({ ...a, items: next })
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}
                  >×</button>
                )}
              </div>
            ))}
            <button
              onClick={() => onChange({ ...a, items: [...(a.items ?? []), ''] })}
              style={{ background: 'none', border: '1px dashed var(--c-border)', borderRadius: 4, color: 'var(--c-text-secondary)', cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}
            >{t('script.chooseAddItem')}</button>
          </>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--c-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={a.multiple ?? false} onChange={(e) => onChange({ ...a, multiple: e.target.checked })} style={{ margin: 0 }} />
          {t('script.chooseMultiple')}
        </label>
        <VariableInput
          value={a.resultVar}
          onChange={(v) => onChange({ ...a, resultVar: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── Show Alert ────────────────────────────────────────────────────────
  if (action.type === 'show-alert') {
    const a = action as ShowAlertAction
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.title ?? ''}
          onChange={(v) => onChange({ ...a, title: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.alertTitle')}
          placeholder={t('script.alertTitle')}
          style={{ ...inpField, minWidth: 50 }}
        />
        <VariableInput
          value={a.message ?? ''}
          onChange={(v) => onChange({ ...a, message: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.alertMessage')}
          placeholder={t('script.alertMessage')}
          style={{ ...inpField, flex: 1, minWidth: 80 }}
        />
        <VariableInput
          value={a.confirmText ?? ''}
          onChange={(v) => onChange({ ...a, confirmText: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.alertConfirmText')}
          placeholder={t('script.alertConfirmText')}
          style={{ ...inpField, minWidth: 50 }}
        />
        <VariableInput
          value={a.cancelText ?? ''}
          onChange={(v) => onChange({ ...a, cancelText: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.alertCancelText')}
          placeholder={t('script.alertCancelText')}
          style={{ ...inpField, minWidth: 50 }}
        />
        <VariableInput
          value={a.resultVar ?? ''}
          onChange={(v) => onChange({ ...a, resultVar: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── HTTP Request ─────────────────────────────────────────────────────────
  if (action.type === 'http-request') {
    const a = action as HttpRequestAction
    const HTTP_METHODS: { value: HttpMethod; label: string }[] = [
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'PATCH', label: 'PATCH' },
      { value: 'HEAD', label: 'HEAD' },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.method ?? 'GET'}
          onChange={(v) => onChange({ ...a, method: v as HttpMethod })}
          options={HTTP_METHODS.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 70 }}
        />
        <VariableInput
          value={a.url ?? ''}
          onChange={(v) => onChange({ ...a, url: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.httpUrl')}
          placeholder={t('script.httpUrl')}
          style={{ ...inpField, flex: 1, minWidth: 120 }}
        />
        {a.method !== 'GET' && a.method !== 'HEAD' && (
          <VariableInput
            value={a.body ?? ''}
            onChange={(v) => onChange({ ...a, body: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.httpBody')}
            placeholder={t('script.httpBody')}
            style={{ ...inpField, flex: 1, minWidth: 80 }}
          />
        )}
        <VariableInput
          value={a.headers ?? ''}
          onChange={(v) => onChange({ ...a, headers: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.httpHeaders')}
          placeholder={t('script.httpHeaders')}
          style={{ ...inpField, minWidth: 80 }}
        />
        <VariableInput
          value={a.timeout !== undefined ? String(a.timeout) : ''}
          onChange={(v) => onChange({ ...a, timeout: v ? parseInt(v, 10) || undefined : undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.httpTimeout')}
          placeholder={t('script.httpTimeout')}
          style={{ ...inpField, minWidth: 50, maxWidth: 80 }}
        />
        <VariableInput
          value={a.resultVar ?? ''}
          onChange={(v) => onChange({ ...a, resultVar: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
        <VariableInput
          value={a.statusVar ?? ''}
          onChange={(v) => onChange({ ...a, statusVar: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.httpStatusVar')}
          placeholder={t('script.httpStatusVar')}
          style={{ ...inpField, minWidth: 60 }}
        />
      </div>
    )
  }

  // ── File ────────────────────────────────────────────────────────────────────
  if (action.type === 'file') {
    const a = action as FileAction
    const FILE_MODES: { value: FileMode; label: string }[] = [
      { value: 'read',   label: t('script.fileModeRead') },
      { value: 'write',  label: t('script.fileModeWrite') },
      { value: 'exists', label: t('script.fileModeExists') },
      { value: 'list',   label: t('script.fileModeList') },
      { value: 'pick',   label: t('script.fileModePick') },
      { value: 'info',   label: t('script.fileModeInfo') },
      { value: 'delete', label: t('script.fileModeDelete') },
      { value: 'rename', label: t('script.fileModeRename') },
      { value: 'copy',   label: t('script.fileModeCopy') },
    ]
    const INFO_FIELDS: { value: FileInfoField; label: string }[] = [
      { value: 'size',      label: t('script.fileInfoSize') },
      { value: 'modified',  label: t('script.fileInfoModified') },
      { value: 'created',   label: t('script.fileInfoCreated') },
      { value: 'extension', label: t('script.fileInfoExtension') },
      { value: 'name',      label: t('script.fileInfoName') },
      { value: 'directory',  label: t('script.fileInfoDirectory') },
    ]
    const WRITE_MODES: { value: string; label: string }[] = [
      { value: 'overwrite', label: t('script.fileWriteOverwrite') },
      { value: 'append',    label: t('script.fileWriteAppend') },
    ]
    const PICK_MODES: { value: string; label: string }[] = [
      { value: 'file',      label: t('script.filePickFile') },
      { value: 'directory',  label: t('script.filePickDirectory') },
    ]

    const modeFields = (): JSX.Element | null => {
      switch (a.mode) {
        case 'read':
          return (
            <>
              <VariableInput value={a.encoding ?? 'utf8'} onChange={(v) => onChange({ ...a, encoding: v || 'utf8' })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.fileEncoding')} placeholder={t('script.fileEncoding')} style={{ ...inpField, minWidth: 40, maxWidth: 60 }} />
            </>
          )
        case 'write':
          return (
            <>
              <VariableInput value={a.content ?? ''} onChange={(v) => onChange({ ...a, content: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.fileContent')} placeholder={t('script.fileContent')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
              <CustomSelect value={a.writeMode ?? 'overwrite'} onChange={(v) => onChange({ ...a, writeMode: v as 'overwrite' | 'append' })} options={WRITE_MODES.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 70 }} />
            </>
          )
        case 'exists':
        case 'delete':
          return null
        case 'list':
          return <VariableInput value={a.pattern ?? '*'} onChange={(v) => onChange({ ...a, pattern: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.filePattern')} placeholder={t('script.filePattern')} style={{ ...inpField, minWidth: 60 }} />
        case 'pick':
          return (
            <>
              <CustomSelect value={a.pickMode ?? 'file'} onChange={(v) => onChange({ ...a, pickMode: v as 'file' | 'directory' })} options={PICK_MODES.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 60 }} />
              <VariableInput value={a.title ?? ''} onChange={(v) => onChange({ ...a, title: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.filePickTitle')} placeholder={t('script.filePickTitle')} style={{ ...inpField, minWidth: 60 }} />
              <VariableInput value={a.filters ?? ''} onChange={(v) => onChange({ ...a, filters: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.fileFilters')} placeholder={t('script.fileFilters')} style={{ ...inpField, minWidth: 60 }} />
            </>
          )
        case 'info':
          return <CustomSelect value={a.infoField ?? 'size'} onChange={(v) => onChange({ ...a, infoField: v as FileInfoField })} options={INFO_FIELDS.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 70 }} />
        case 'rename':
        case 'copy':
          return <VariableInput value={a.destination ?? ''} onChange={(v) => onChange({ ...a, destination: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.fileDestination')} placeholder={t('script.fileDestination')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
        default:
          return null
      }
    }

    const needsPath = a.mode !== 'pick'
    const needsResult = a.mode !== 'write' && a.mode !== 'delete'

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.mode}
          onChange={(v) => onChange({ ...a, mode: v as FileMode })}
          options={FILE_MODES.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 60 }}
        />
        {needsPath && (
          <VariableInput
            value={a.path ?? ''}
            onChange={(v) => onChange({ ...a, path: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.filePath')}
            placeholder={t('script.filePath')}
            style={{ ...inpField, flex: 1, minWidth: 80 }}
          />
        )}
        {modeFields()}
        {needsResult && (
          <VariableInput
            value={a.resultVar ?? ''}
            onChange={(v) => onChange({ ...a, resultVar: v || undefined })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
            label={t('script.labelResult')}
            placeholder={t('script.calcResult')}
            style={{ ...inpField, minWidth: 70 }}
          />
        )}
      </div>
    )
  }

  // ── Date-Time ──────────────────────────────────────────────────────────────
  if (action.type === 'date-time') {
    const a = action as DateTimeAction
    const DT_MODES: { value: DateTimeMode; label: string }[] = [
      { value: 'now',    label: t('script.dtModeNow') },
      { value: 'format', label: t('script.dtModeFormat') },
      { value: 'math',   label: t('script.dtModeMath') },
      { value: 'diff',   label: t('script.dtModeDiff') },
      { value: 'parse',  label: t('script.dtModeParse') },
    ]
    const DT_UNITS: { value: DateTimeUnit; label: string }[] = [
      { value: 'years',        label: t('script.dtUnitYears') },
      { value: 'months',       label: t('script.dtUnitMonths') },
      { value: 'days',         label: t('script.dtUnitDays') },
      { value: 'hours',        label: t('script.dtUnitHours') },
      { value: 'minutes',      label: t('script.dtUnitMinutes') },
      { value: 'seconds',      label: t('script.dtUnitSeconds') },
      { value: 'milliseconds', label: t('script.dtUnitMs') },
    ]

    const modeFields = (): JSX.Element | null => {
      switch (a.mode) {
        case 'now':
          return (
            <VariableInput value={a.format ?? 'iso'} onChange={(v) => onChange({ ...a, format: v || 'iso' })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtFormat')} placeholder={t('script.dtFormat')} style={{ ...inpField, minWidth: 50, maxWidth: 80 }} />
          )
        case 'format':
          return (
            <>
              <VariableInput value={a.input ?? ''} onChange={(v) => onChange({ ...a, input: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtInput')} placeholder={t('script.dtInput')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
              <VariableInput value={a.format ?? 'iso'} onChange={(v) => onChange({ ...a, format: v || 'iso' })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtFormat')} placeholder={t('script.dtFormat')} style={{ ...inpField, minWidth: 50, maxWidth: 80 }} />
            </>
          )
        case 'math':
          return (
            <>
              <VariableInput value={a.input ?? ''} onChange={(v) => onChange({ ...a, input: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtInput')} placeholder={t('script.dtInput')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
              <VariableInput value={a.amount !== undefined ? String(a.amount) : ''} onChange={(v) => onChange({ ...a, amount: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtAmount')} placeholder={t('script.dtAmount')} style={{ ...inpField, minWidth: 40, maxWidth: 60 }} />
              <CustomSelect value={a.unit ?? 'days'} onChange={(v) => onChange({ ...a, unit: v as DateTimeUnit })} options={DT_UNITS.map((u) => ({ value: u.value, label: u.label }))} style={{ ...inp, minWidth: 60 }} />
            </>
          )
        case 'diff':
          return (
            <>
              <VariableInput value={a.date1 ?? ''} onChange={(v) => onChange({ ...a, date1: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtDate1')} placeholder={t('script.dtDate1')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
              <VariableInput value={a.date2 ?? ''} onChange={(v) => onChange({ ...a, date2: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtDate2')} placeholder={t('script.dtDate2')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
              <CustomSelect value={a.unit ?? 'milliseconds'} onChange={(v) => onChange({ ...a, unit: v as DateTimeUnit })} options={DT_UNITS.map((u) => ({ value: u.value, label: u.label }))} style={{ ...inp, minWidth: 60 }} />
            </>
          )
        case 'parse':
          return (
            <VariableInput value={a.input ?? ''} onChange={(v) => onChange({ ...a, input: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.dtInput')} placeholder={t('script.dtInput')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
          )
        default:
          return null
      }
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect
          value={a.mode}
          onChange={(v) => onChange({ ...a, mode: v as DateTimeMode })}
          options={DT_MODES.map((m) => ({ value: m.value, label: m.label }))}
          style={{ ...inp, minWidth: 60 }}
        />
        {modeFields()}
        <VariableInput
          value={a.resultVar ?? ''}
          onChange={(v) => onChange({ ...a, resultVar: v })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.labelResult')}
          placeholder={t('script.calcResult')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── Try-Catch (inline fields: just errorVar) ─────────────────────────────
  if (action.type === 'try-catch') {
    const a = action as TryCatchAction
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <VariableInput
          value={a.errorVar ?? ''}
          onChange={(v) => onChange({ ...a, errorVar: v || undefined })}
          availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
          label={t('script.errorVar')}
          placeholder={t('script.errorVar')}
          style={{ ...inpField, minWidth: 70 }}
        />
      </div>
    )
  }

  // ── Registry ─────────────────────────────────────────────────────────────
  if (action.type === 'registry') {
    const a = action as RegistryAction
    const REG_MODES: { value: RegistryMode; label: string }[] = [
      { value: 'read',   label: t('script.regModeRead') },
      { value: 'write',  label: t('script.regModeWrite') },
      { value: 'delete', label: t('script.regModeDelete') },
      { value: 'exists', label: t('script.regModeExists') },
    ]
    const HIVES: { value: RegistryHive; label: string }[] = [
      { value: 'HKCU', label: 'HKCU' },
      { value: 'HKLM', label: 'HKLM' },
      { value: 'HKCR', label: 'HKCR' },
      { value: 'HKU',  label: 'HKU' },
      { value: 'HKCC', label: 'HKCC' },
    ]
    const DATA_TYPES: { value: RegistryDataType; label: string }[] = [
      { value: 'REG_SZ',        label: 'REG_SZ' },
      { value: 'REG_DWORD',     label: 'REG_DWORD' },
      { value: 'REG_QWORD',     label: 'REG_QWORD' },
      { value: 'REG_EXPAND_SZ', label: 'REG_EXPAND_SZ' },
      { value: 'REG_MULTI_SZ',  label: 'REG_MULTI_SZ' },
    ]
    const needsResult = a.mode === 'read' || a.mode === 'exists'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect value={a.mode} onChange={(v) => onChange({ ...a, mode: v as RegistryMode })} options={REG_MODES.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 60 }} />
        <CustomSelect value={a.hive ?? 'HKCU'} onChange={(v) => onChange({ ...a, hive: v as RegistryHive })} options={HIVES.map((h) => ({ value: h.value, label: h.label }))} style={{ ...inp, minWidth: 55 }} />
        <VariableInput value={a.keyPath ?? ''} onChange={(v) => onChange({ ...a, keyPath: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.regKeyPath')} placeholder={t('script.regKeyPath')} style={{ ...inpField, flex: 1, minWidth: 100 }} />
        <VariableInput value={a.valueName ?? ''} onChange={(v) => onChange({ ...a, valueName: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.regValueName')} placeholder={t('script.regValueName')} style={{ ...inpField, minWidth: 70 }} />
        {a.mode === 'write' && (
          <>
            <VariableInput value={a.data ?? ''} onChange={(v) => onChange({ ...a, data: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.regData')} placeholder={t('script.regData')} style={{ ...inpField, flex: 1, minWidth: 60 }} />
            <CustomSelect value={a.dataType ?? 'REG_SZ'} onChange={(v) => onChange({ ...a, dataType: v as RegistryDataType })} options={DATA_TYPES.map((d) => ({ value: d.value, label: d.label }))} style={{ ...inp, minWidth: 80 }} />
          </>
        )}
        {needsResult && (
          <VariableInput value={a.resultVar ?? ''} onChange={(v) => onChange({ ...a, resultVar: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.labelResult')} placeholder={t('script.calcResult')} style={{ ...inpField, minWidth: 70 }} />
        )}
      </div>
    )
  }

  // ── Environment ─────────────────────────────────────────────────────────
  if (action.type === 'environment') {
    const a = action as EnvironmentAction
    const ENV_MODES: { value: EnvironmentMode; label: string }[] = [
      { value: 'get',  label: t('script.envModeGet') },
      { value: 'set',  label: t('script.envModeSet') },
      { value: 'list', label: t('script.envModeList') },
    ]
    const needsName = a.mode === 'get' || a.mode === 'set'
    const needsResult = a.mode === 'get' || a.mode === 'list'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect value={a.mode ?? 'get'} onChange={(v) => onChange({ ...a, mode: v as EnvironmentMode })} options={ENV_MODES.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 55 }} />
        {needsName && (
          <VariableInput value={a.name ?? ''} onChange={(v) => onChange({ ...a, name: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.envName')} placeholder={t('script.envName')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
        )}
        {a.mode === 'set' && (
          <VariableInput value={a.value ?? ''} onChange={(v) => onChange({ ...a, value: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.envValue')} placeholder={t('script.envValue')} style={{ ...inpField, flex: 1, minWidth: 80 }} />
        )}
        {needsResult && (
          <VariableInput value={a.resultVar ?? ''} onChange={(v) => onChange({ ...a, resultVar: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.labelResult')} placeholder={t('script.calcResult')} style={{ ...inpField, minWidth: 70 }} />
        )}
      </div>
    )
  }

  // ── Service ─────────────────────────────────────────────────────────────
  if (action.type === 'service') {
    const a = action as ServiceAction
    const SVC_MODES: { value: ServiceMode; label: string }[] = [
      { value: 'status',  label: t('script.svcModeStatus') },
      { value: 'start',   label: t('script.svcModeStart') },
      { value: 'stop',    label: t('script.svcModeStop') },
      { value: 'restart', label: t('script.svcModeRestart') },
    ]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <CustomSelect value={a.mode ?? 'status'} onChange={(v) => onChange({ ...a, mode: v as ServiceMode })} options={SVC_MODES.map((m) => ({ value: m.value, label: m.label }))} style={{ ...inp, minWidth: 60 }} />
        <VariableInput value={a.serviceName ?? ''} onChange={(v) => onChange({ ...a, serviceName: v })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.svcName')} placeholder={t('script.svcName')} style={{ ...inpField, flex: 1, minWidth: 100 }} />
        <VariableInput value={a.resultVar ?? ''} onChange={(v) => onChange({ ...a, resultVar: v || undefined })} availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} label={t('script.labelResult')} placeholder={t('script.calcResult')} style={{ ...inpField, minWidth: 70 }} />
      </div>
    )
  }

  // Comment — header-only (no inline fields); card body (textarea) rendered in SortableNode
  if (action.type === 'comment') {
    return null
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
  nestedPath,
  availableVars,
  availableVarInfos,
}: {
  action: ActionConfig
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  currentEntryId?: string
  onChange: (a: ActionConfig) => void
  onDelete: () => void
  depth?: number
  nestedPath?: string
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
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
      <span style={{ fontSize: 11, color: nodeColor, whiteSpace: 'nowrap' }}>
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
          borderRadius: 8, background: 'var(--c-node-bg)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          {/* Header: icon + match select + delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} onPointerDown={(e) => e.stopPropagation()}>
              <ConditionModeSelect action={a} onChange={onChange} />
            </div>
            {deleteBtn}
          </div>
          <div style={{ height: 1, background: `${color}33`, margin: '7px 0' }} />
          <div onPointerDown={(e) => e.stopPropagation()}>
            <ConditionCriteriaSection action={a} onChange={onChange} availableVars={availableVars} availableVarInfos={availableVarInfos} />
          </div>
        </div>
        {/* Recursive branches — stop propagation to prevent parent drag */}
        <div style={{ paddingLeft: 6 }} onPointerDown={(e) => e.stopPropagation()}>
          {(a.conditionMode ?? 'if-else') === 'switch' ? (
            /* Switch mode branches */
            <NestedSwitchBranches action={a} onChange={onChange} color={color} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} depth={depth} nestedPath={nestedPath} />
          ) : (
            /* If-Else mode branches */
            <>
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
                branchId={nestedPath ? `${nestedPath}:then` : `branch:nested-${depth}:then`}
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
                branchId={nestedPath ? `${nestedPath}:else` : `branch:nested-${depth}:else`}
              />
              {/* END IF */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>END IF</span>
                <div style={{ flex: 1, height: 1, background: `${color}22` }} />
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Nested loop: card header + recursive body branch ──
  if (action.type === 'loop') {
    const a = action as LoopAction
    const loopMode = a.mode ?? 'repeat'
    const color = cfg.color
    // Detect if the foreach target is a list or dict (needed for display labels)
    const nestedForeachTargetType = loopMode === 'foreach'
      ? (availableVarInfos ?? []).find(v => v.name === a.listVar)?.sourceType ?? 'list'
      : null
    // Build loop iteration variable for inner body nodes
    const loopBodyVars: string[] = [...(availableVars ?? [])]
    const loopBodyVarInfos: VarInfo[] = [...(availableVarInfos ?? [])]
    if (loopMode === 'repeat') {
      loopBodyVars.unshift('__loop_count')
      loopBodyVarInfos.unshift({ name: '__loop_count', sourceType: 'loop', displayLabel: t('script.loopAssignCount') })
    } else if (loopMode === 'for') {
      loopBodyVars.unshift('__loop_i')
      loopBodyVarInfos.unshift({ name: '__loop_i', sourceType: 'loop', displayLabel: t('script.loopAssignIndex') })
    } else if (loopMode === 'foreach') {
      const itemVar = a.itemVar || '_item'
      const keyVar = a.keyVar || '_key'
      loopBodyVars.unshift(itemVar)
      loopBodyVarInfos.unshift({ name: itemVar, sourceType: 'loop', displayLabel: nestedForeachTargetType === 'dict' ? t('script.loopForeachDictValue') : t('script.loopForeachValue') })
      loopBodyVars.unshift(keyVar)
      loopBodyVarInfos.unshift({ name: keyVar, sourceType: 'loop', displayLabel: nestedForeachTargetType === 'dict' ? t('script.loopForeachKey') : t('script.loopForeachIndex') })
    }

    // Build loop insert context for nested VariableInputs
    const nestedLoopOptions: LoopAssignOption[] = []
    let nestedDirectRef = false
    if (loopMode === 'repeat') {
      nestedLoopOptions.push({ label: t('script.loopAssignCount'), varName: 'loop_count', value: '$__loop_count' })
    } else if (loopMode === 'for') {
      nestedLoopOptions.push({ label: t('script.loopAssignIndex'), varName: a.iterVar ?? 'i', value: `$${a.iterVar ?? '__loop_i'}` })
    } else if (loopMode === 'foreach') {
      nestedDirectRef = true
      const itemVar = a.itemVar || '_item'
      const keyVar = a.keyVar || '_key'
      if (nestedForeachTargetType === 'dict') {
        nestedLoopOptions.push({ label: t('script.loopForeachKey'), varName: keyVar, value: `$${keyVar}` })
        nestedLoopOptions.push({ label: t('script.loopForeachDictValue'), varName: itemVar, value: `$${itemVar}` })
      } else {
        nestedLoopOptions.push({ label: t('script.loopForeachIndex'), varName: keyVar, value: `$${keyVar}` })
        nestedLoopOptions.push({ label: t('script.loopForeachValue'), varName: itemVar, value: `$${itemVar}` })
      }
    }
    const nestedLoopInsert = {
      options: nestedLoopOptions,
      directRef: nestedDirectRef,
      insertSetVar: (name: string, value: string): boolean => {
        const exists = a.body.some(b => b.type === 'set-var' && (b as SetVarAction).name === name)
        if (exists) return false
        onChange({ ...a, body: [{ type: 'set-var', name, value, scope: 'local' } as SetVarAction, ...a.body] })
        return true
      },
    }

    return (
      <LoopInsertContext.Provider value={nestedLoopInsert}>
      <div>
        <div style={{
          borderRadius: 8, background: 'var(--c-node-bg)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} />
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
            branchId={nestedPath ? `${nestedPath}:loop` : `branch:nested-${depth}:loop`}
            parentVars={loopBodyVars}
            parentVarInfos={loopBodyVarInfos}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>LOOP END</span>
            <div style={{ flex: 1, height: 1, background: `${color}22` }} />
          </div>
        </div>
      </div>
      </LoopInsertContext.Provider>
    )
  }

  // ── Nested sequence: card header + recursive parallel body branch ──
  if (action.type === 'sequence') {
    const a = action as SequenceAction
    const color = cfg.color
    return (
      <div>
        <div style={{
          borderRadius: 8, background: 'var(--c-node-bg)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} />
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
            branchId={nestedPath ? `${nestedPath}:sequence` : `branch:nested-${depth}:sequence`}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.sequenceEnd')}</span>
            <div style={{ flex: 1, height: 1, background: `${color}22` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Nested try-catch: card header + recursive try/catch branches ──
  if (action.type === 'try-catch') {
    const a = action as TryCatchAction
    const color = cfg.color
    return (
      <div>
        <div style={{
          borderRadius: 8, background: 'var(--c-node-bg)',
          border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconLabel}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} />
            </div>
            {deleteBtn}
          </div>
        </div>
        <div style={{ paddingLeft: 6 }} onPointerDown={(e) => e.stopPropagation()}>
          {/* TRY */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.tryLabel')}</span>
            <div style={{ flex: 1, height: 1, background: `${color}44` }} />
          </div>
          <NestedActionListSimple
            color={color}
            actions={a.tryActions}
            onChange={(acts) => onChange({ ...a, tryActions: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={nestedPath ? `${nestedPath}:try` : `branch:nested-${depth}:try`}
          />
          {/* CATCH */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', opacity: 0.9, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.catchLabel')}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(239,68,68,0.3)' }} />
          </div>
          <NestedActionListSimple
            color="#ef4444"
            actions={a.catchActions}
            onChange={(acts) => onChange({ ...a, catchActions: acts })}
            nodeStyle={nodeStyle}
            library={library}
            currentEntryId={currentEntryId}
            depth={depth + 1}
            branchId={nestedPath ? `${nestedPath}:catch` : `branch:nested-${depth}:catch`}
          />
          {/* END TRY */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 0' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em', opacity: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>{t('script.tryCatchEnd')}</span>
            <div style={{ flex: 1, height: 1, background: `${color}22` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Nested toast — title in header, body below divider ──
  if (action.type === 'toast') {
    const a = action as ToastAction
    const color = cfg.color
    return (
      <div style={{
        borderRadius: 8, background: 'var(--c-node-bg)',
        border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`,
        padding: '8px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {iconLabel}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} />
          </div>
          {deleteBtn}
        </div>
        <div style={{ height: 1, background: `${color}33`, margin: '7px 0' }} />
        <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <VariableInput
            value={a.message}
            onChange={(v) => onChange({ ...a, message: v })}
            availableVars={availableVars ?? []} availableVarInfos={availableVarInfos}
            label={t('script.toastBody')}
            placeholder={t('script.toastBody')}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)',
              borderRadius: 6, color: 'var(--c-accent)', padding: '4px 8px',
              fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
              outline: 'none',
            }}
          />
        </div>
      </div>
    )
  }

  // ── Nested comment — dashed border, textarea below divider ──
  if (action.type === 'comment') {
    const a = action as CommentAction
    return (
      <div style={{
        borderRadius: 8, background: 'var(--c-node-bg)',
        border: '1px dashed var(--c-border)',
        padding: '8px 12px', opacity: 0.7,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {iconLabel}
          <div style={{ flex: 1 }} />
          {deleteBtn}
        </div>
        <div style={{ height: 1, background: 'var(--c-border)', margin: '7px 0', opacity: 0.5 }} />
        <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <textarea
            value={a.text}
            onChange={(e) => onChange({ ...a, text: e.target.value })}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)',
              borderRadius: 6, color: 'var(--c-text)', padding: '6px 8px',
              fontSize: 12, fontFamily: 'inherit', fontStyle: 'italic',
              outline: 'none', resize: 'vertical', lineHeight: 1.5,
            }}
          />
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
        background: 'var(--c-node-bg)',
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
        <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} />
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
function NestedActionListSimple({ color, actions, onChange, nodeStyle, library, currentEntryId, depth, branchId, parentVars, parentVarInfos }: {
  color: string
  actions: ActionConfig[]
  onChange: (actions: ActionConfig[]) => void
  nodeStyle: NodeStyle
  library: ShortcutEntry[]
  currentEntryId?: string
  depth: number
  branchId?: string
  parentVars?: string[]
  parentVarInfos?: VarInfo[]
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
                nestedPath={`${effectiveBranchId}:${idx}`}
                availableVars={parentVars}
                availableVarInfos={parentVarInfos}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// ── ReturnValueChip — small ~30% size chip shown below a node in picker mode ──

function ReturnValueChip({ rv, nodeColor, nodeId }: {
  rv: NodeReturnValue
  nodeColor: string
  nodeId: string
}): JSX.Element {
  const { pickerState, setHighlightNodeId } = React.useContext(ReturnValuePickerContext)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (pickerState.onPick) {
      pickerState.onPick(rv.ref)
      setHighlightNodeId(nodeId)
    }
  }, [pickerState, rv.ref, setHighlightNodeId, nodeId])

  const sourceIcon = SOURCE_ICON_MAP[rv.sourceType] ?? 'variable'

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        background: `${nodeColor}15`,
        border: `1px solid ${nodeColor}40`,
        cursor: 'pointer',
        fontSize: 10,
        fontWeight: 600,
        color: nodeColor,
        transition: 'all 0.15s',
        marginTop: 4,
        maxWidth: 'fit-content',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = `${nodeColor}30`
        el.style.borderColor = `${nodeColor}80`
        el.style.transform = 'scale(1.04)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = `${nodeColor}15`
        el.style.borderColor = `${nodeColor}40`
        el.style.transform = 'scale(1)'
      }}
      title={rv.ref}
    >
      <UIIcon name={sourceIcon} size={11} />
      <span style={{ fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{rv.label}</span>
      <span style={{ opacity: 0.6, fontFamily: 'monospace', fontSize: 9 }}>{rv.ref}</span>
    </div>
  )
}

const SOURCE_ICON_MAP: Record<string, string> = {
  'launch': 'launch',
  'keyboard': 'keyboard',
  'shell': 'shell',
  'set-var': 'variable',
  'calculate': 'calculate',
  'run-shortcut': 'call_shortcut',
  'loop': 'loop',
  'stop': 'stop',
  'mouse-move': 'mouse_move',
  'mouse-click': 'mouse_click',
  'clipboard': 'clipboard',
  'text': 'text_fields',
  'transform': 'transform',
  'http-request': 'http_request',
  'file': 'file_action',
}

// ── SortableNode ───────────────────────────────────────────────────────────────

interface SortableNodeProps {
  node: ActionNode
  nodeIndex: number
  nodeStyle: NodeStyle
  onChange: (action: ActionConfig) => void
  onDelete: () => void
  errorMsg?: string
  library: ShortcutEntry[]
  groups?: ShortcutGroup[]
  resourceIcons?: ResourceIconEntry[]
  currentEntryId?: string
  availableVars?: string[]
  availableVarInfos?: VarInfo[]
  isGhost?: boolean
}

function SortableNode({ node, nodeIndex, nodeStyle, onChange, onDelete, errorMsg, library, groups, resourceIcons, currentEntryId, availableVars, availableVarInfos, isGhost }: SortableNodeProps): JSX.Element {
  const t = useT()
  const { action } = node
  const cfg = nodeStyle[action.type] ?? nodeStyle.shell
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node._id })
  const { pickerState, highlightNodeId, setHighlightNodeId } = React.useContext(ReturnValuePickerContext)
  const returnValues = pickerState.active && nodeIndex < pickerState.requestingNodeIndex
    ? getNodeReturnValues(action, nodeIndex, t) : null
  const hasError = Boolean(errorMsg)

  // Highlight animation when this node's return value was picked
  const nodeElRef = useRef<HTMLDivElement>(null)
  const combinedRef = useCallback((el: HTMLDivElement | null) => {
    setNodeRef(el)
    nodeElRef.current = el
  }, [setNodeRef])
  const isHighlighted = highlightNodeId === node._id
  useEffect(() => {
    if (!isHighlighted || !nodeElRef.current) return
    const el = nodeElRef.current
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.transition = 'transform 0.2s ease-out, box-shadow 0.2s ease-out'
    el.style.transform = 'scale(1.03)'
    el.style.boxShadow = `0 0 12px ${cfg.color}60`
    el.style.zIndex = '10'
    const t1 = setTimeout(() => {
      el.style.transform = 'scale(1)'
      el.style.boxShadow = 'none'
    }, 350)
    const t2 = setTimeout(() => {
      el.style.transition = ''
      el.style.zIndex = ''
      setHighlightNodeId(null)
    }, 600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      // Reset styles immediately so previous animation doesn't linger
      el.style.transform = ''
      el.style.boxShadow = ''
      el.style.transition = ''
      el.style.zIndex = ''
    }
  }, [isHighlighted, cfg.color, setHighlightNodeId])

  // Resolve run-shortcut visual identity (icon + bg color from the referenced entry)
  const csEntry = action.type === 'run-shortcut'
    ? library.find((e) => e.id === (action as RunShortcutAction).shortcutId)
    : undefined
  const nodeColor = csEntry?.bgColor ?? cfg.color
  const nodeIcon  = csEntry?.icon    ?? cfg.icon

  const cardStyle: React.CSSProperties = {
    borderRadius: 8,
    background: hasError ? 'rgba(239,68,68,0.06)' : 'var(--c-node-bg)',
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
        userSelect: 'none', flexShrink: 0, marginRight: 4,
      }}
    >
      <span style={{ color: hasError ? '#ef4444' : nodeColor }}>{renderNodeIcon(hasError ? 'info' : nodeIcon, 14)}</span>
      <span style={{ fontSize: 11, color: hasError ? '#ef4444' : nodeColor, whiteSpace: 'nowrap' }}>
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
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        {/* Card: header row + divider + criteria only */}
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
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
              <ConditionModeSelect action={a} onChange={onChange} />
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
            <ConditionCriteriaSection action={a} onChange={onChange} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
          </div>
        </div>

        {/* Then / Else / End If — rendered outside the card as structural dividers */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ConditionBranchesExternal action={a} onChange={onChange} nodeStyle={nodeStyle} library={library} nodeId={node._id} currentEntryId={currentEntryId} />
        </div>
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (
              <ReturnValueChip key={rv.ref} rv={rv} nodeColor={cfg.color} nodeId={node._id} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Loop node — external body structure like if-else ──────────────────────────
  if (action.type === 'loop') {
    const a = action as LoopAction
    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} groups={groups} resourceIcons={resourceIcons} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
            </div>
            {deleteBtn}
          </div>
        </div>
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <LoopBranchesExternal action={a} onChange={onChange} nodeStyle={nodeStyle} library={library} nodeId={node._id} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} />
        </div>
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (
              <ReturnValueChip key={rv.ref} rv={rv} nodeColor={cfg.color} nodeId={node._id} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Sequence node — parallel body structure like loop ──────────────────────────
  if (action.type === 'sequence') {
    const a = action as SequenceAction
    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} groups={groups} resourceIcons={resourceIcons} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
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
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (
              <ReturnValueChip key={rv.ref} rv={rv} nodeColor={cfg.color} nodeId={node._id} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Try-Catch node — external try/catch structure ───────────────────────────
  if (action.type === 'try-catch') {
    const a = action as TryCatchAction
    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} groups={groups} resourceIcons={resourceIcons} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
            </div>
            {deleteBtn}
          </div>
        </div>
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <TryCatchBranchesExternal action={a} onChange={onChange} nodeStyle={nodeStyle} library={library} nodeId={node._id} currentEntryId={currentEntryId} />
        </div>
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (
              <ReturnValueChip key={rv.ref} rv={rv} nodeColor={cfg.color} nodeId={node._id} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── List node — define mode ────────────────────────────────────────────────────
  if (action.type === 'list' && (action as ListAction).mode !== 'edit') {
    const a = action as ListAction
    const listItems = a.listItems ?? []
    const inp: React.CSSProperties = {
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 6,
      color: 'var(--c-text)',
      padding: '4px 8px',
      fontSize: 12,
      fontFamily: 'inherit',
      outline: 'none',
    }
    const inpField: React.CSSProperties = {
      ...inp,
      background: 'var(--c-accent-bg)',
      border: '1px solid var(--c-accent-border)',
      fontWeight: 600,
    }

    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, flexWrap: 'wrap' }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <CustomSelect
                value={a.mode ?? 'define'}
                onChange={(v) => onChange({ ...a, mode: v as VarMode })}
                options={[
                  { value: 'define', label: t('script.varModeDefine') },
                  { value: 'edit', label: t('script.varModeEdit') },
                ]}
                style={{ ...inp, minWidth: 62 }}
              />
              <input
                value={a.name}
                onChange={(e) => onChange({ ...a, name: e.target.value })}
                style={{ ...inpField, minWidth: 80 }}
              />
            </div>
            {hasError && (
              <div title={errorMsg} style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, cursor: 'help' }}>
                {errorMsg}
              </div>
            )}
            {deleteBtn}
          </div>
          <div style={{ height: 1, background: `${cfg.color}33`, margin: '7px 0' }} />
          <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              {listItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--c-text-dim)', width: 18, textAlign: 'right', flexShrink: 0 }}>{idx}</span>
                  <input
                    value={item}
                    onChange={(e) => { const next = [...listItems]; next[idx] = e.target.value; onChange({ ...a, listItems: next }) }}
                    style={{ ...inpField, minWidth: 60 }}
                    size={Math.max(8, item.length + 1)}
                  />
                  <button
                    onClick={() => onChange({ ...a, listItems: listItems.filter((_, i) => i !== idx) })}
                    style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
                  ><UIIcon name="close" size={12} /></button>
                </div>
              ))}
              <button
                onClick={() => onChange({ ...a, listItems: [...listItems, ''] })}
                style={{ background: 'none', border: `1px dashed ${cfg.color}44`, borderRadius: 6, color: cfg.color, cursor: 'pointer', padding: '3px 8px', fontSize: 11, fontFamily: 'inherit', opacity: 0.8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
              >{t('script.varAddItem')}</button>
            </div>
          </div>
        </div>
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (<ReturnValueChip key={rv.ref} rv={rv} nodeColor={cfg.color} nodeId={node._id} />))}
          </div>
        )}
      </div>
    )
  }

  // ── Dict node — define mode ────────────────────────────────────────────────────
  if (action.type === 'dict' && (action as DictAction).mode !== 'edit') {
    const a = action as DictAction
    const dictItems = a.dictItems ?? []
    const inp: React.CSSProperties = {
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 6,
      color: 'var(--c-text)',
      padding: '4px 8px',
      fontSize: 12,
      fontFamily: 'inherit',
      outline: 'none',
    }
    const inpField: React.CSSProperties = {
      ...inp,
      background: 'var(--c-accent-bg)',
      border: '1px solid var(--c-accent-border)',
      fontWeight: 600,
    }

    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, flexWrap: 'wrap' }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <CustomSelect
                value={a.mode ?? 'define'}
                onChange={(v) => onChange({ ...a, mode: v as VarMode })}
                options={[
                  { value: 'define', label: t('script.varModeDefine') },
                  { value: 'edit', label: t('script.varModeEdit') },
                ]}
                style={{ ...inp, minWidth: 62 }}
              />
              <input
                value={a.name}
                onChange={(e) => onChange({ ...a, name: e.target.value })}
                style={{ ...inpField, minWidth: 80 }}
              />
            </div>
            {hasError && (
              <div title={errorMsg} style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, cursor: 'help' }}>
                {errorMsg}
              </div>
            )}
            {deleteBtn}
          </div>
          <div style={{ height: 1, background: `${cfg.color}33`, margin: '7px 0' }} />
          <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              {dictItems.map((entry, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    value={entry.key}
                    onChange={(e) => { const next = [...dictItems]; next[idx] = { ...next[idx], key: e.target.value }; onChange({ ...a, dictItems: next }) }}
                    style={{ ...inpField, minWidth: 60, flexShrink: 0 }}
                    size={Math.max(6, entry.key.length + 1)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--c-text-dim)', flexShrink: 0 }}>:</span>
                  <input
                    value={entry.value}
                    onChange={(e) => { const next = [...dictItems]; next[idx] = { ...next[idx], value: e.target.value }; onChange({ ...a, dictItems: next }) }}
                    style={{ ...inpField, minWidth: 60 }}
                    size={Math.max(8, entry.value.length + 1)}
                  />
                  <button
                    onClick={() => onChange({ ...a, dictItems: dictItems.filter((_, i) => i !== idx) })}
                    style={{ background: 'none', border: 'none', color: 'var(--c-text-dim)', cursor: 'pointer', padding: '0 2px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
                  ><UIIcon name="close" size={12} /></button>
                </div>
              ))}
              <button
                onClick={() => onChange({ ...a, dictItems: [...dictItems, { key: '', value: '' }] })}
                style={{ background: 'none', border: `1px dashed ${cfg.color}44`, borderRadius: 6, color: cfg.color, cursor: 'pointer', padding: '3px 8px', fontSize: 11, fontFamily: 'inherit', opacity: 0.8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
              >{t('script.varAddEntry')}</button>
            </div>
          </div>
        </div>
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (<ReturnValueChip key={rv.ref} rv={rv} nodeColor={cfg.color} nodeId={node._id} />))}
          </div>
        )}
      </div>
    )
  }

  // ── Toast node — title in header, body textarea below divider ────────────────
  if (action.type === 'toast') {
    const a = action as ToastAction
    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {dragHandle}
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0, flexWrap: 'wrap' }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} groups={groups} resourceIcons={resourceIcons} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
            </div>
            {deleteBtn}
          </div>
          <div style={{ height: 1, background: `${cfg.color}33`, margin: '7px 0' }} />
          <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <VariableInput
              value={a.message}
              onChange={(v) => onChange({ ...a, message: v })}
              availableVars={availableVars ?? []} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex}
              label={t('script.toastBody')}
              placeholder={t('script.toastBody')}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)',
                borderRadius: 6, color: 'var(--c-accent)', padding: '4px 8px',
                fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>
        </div>
        {returnValues && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {returnValues.map((rv) => (
              <ReturnValueChip key={rv.ref} rv={rv} nodeColor={nodeColor} nodeId={node._id} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Comment node — dimmed, dashed border, multi-line textarea below divider ──
  if (action.type === 'comment') {
    const a = action as CommentAction
    return (
      <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : isGhost ? 0.45 : 0.7, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ ...cardStyle, borderStyle: 'dashed', borderColor: 'var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {dragHandle}
            <div style={{ flex: 1 }} />
            {deleteBtn}
          </div>
          <div style={{ height: 1, background: 'var(--c-border)', margin: '7px 0', opacity: 0.5 }} />
          <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <textarea
              value={a.text}
              onChange={(e) => onChange({ ...a, text: e.target.value })}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)',
                borderRadius: 6, color: 'var(--c-text)', padding: '6px 8px',
                fontSize: 12, fontFamily: 'inherit', fontStyle: 'italic',
                outline: 'none', resize: 'vertical', lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Default layout (all other node types) ─────────────────────────────────────

  return (
    <div ref={combinedRef} {...attributes} {...listeners} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isGhost ? 0.45 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
      <div style={{ ...cardStyle, ...(isGhost ? { borderStyle: 'dashed' } : undefined) }}>
        {/* Header row: drag handle | inputs (right) | error badge | delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {dragHandle}

          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0, flexWrap: 'wrap' }}
          >
            <InlineNodeFields action={action} onChange={onChange} nodeStyle={nodeStyle} library={library} groups={groups} resourceIcons={resourceIcons} currentEntryId={currentEntryId} availableVars={availableVars} availableVarInfos={availableVarInfos} nodeIndex={nodeIndex} />
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
      {returnValues && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {returnValues.map((rv) => (
            <ReturnValueChip key={rv.ref} rv={rv} nodeColor={nodeColor} nodeId={node._id} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── PaletteContextMenu — right-click menu for palette items ─────────────────────

function PaletteContextMenu({ x, y, onAddToStart, onAddToEnd, onClose }: {
  x: number; y: number
  onAddToStart: () => void
  onAddToEnd: () => void
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [clamped, setClamped] = useState({ top: y, left: x })

  useLayoutEffect(() => {
    if (ref.current) setClamped(clampMenuPosition(ref.current, { top: y, left: x }))
  }, [x, y])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const itemStyle: React.CSSProperties = {
    padding: '6px 12px', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', color: 'var(--c-text)', whiteSpace: 'nowrap',
    background: 'none', border: 'none', fontFamily: 'inherit',
    textAlign: 'left', transition: 'background 0.1s',
    boxSizing: 'border-box',
  }

  return (
    <div ref={ref} style={{
      position: 'fixed', left: clamped.left, top: clamped.top, zIndex: 9999,
      background: 'var(--c-elevated)', border: '1px solid var(--c-border)',
      borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
      padding: '4px 0', minWidth: 168,
    }}>
      <button style={itemStyle}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-border)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        onClick={() => { onAddToStart(); onClose() }}
      >{t('shortcuts.addToStart')}</button>
      <button style={itemStyle}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-border)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        onClick={() => { onAddToEnd(); onClose() }}
      >{t('shortcuts.addToEnd')}</button>
    </div>
  )
}

// ── LibraryItem — draggable palette item ───────────────────────────────────────

function LibraryItem({ type, cfg, onAddToStart, onAddToEnd }: {
  type: string; cfg: NodeStyle[string]
  onAddToStart?: (type: string) => void
  onAddToEnd?: (type: string) => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${type}`,
    data: { type },
  })
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
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
        onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY }) }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 4,
          background: cfg.color + '22',
          border: `1px solid ${cfg.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: cfg.color,
        }}><UIIcon name={cfg.icon} size={11} /></div>
        <span style={{ fontSize: 12, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
          {cfg.label}
        </span>
      </div>
      {ctx && onAddToStart && onAddToEnd && (
        <PaletteContextMenu
          x={ctx.x} y={ctx.y}
          onAddToStart={() => onAddToStart(type)}
          onAddToEnd={() => onAddToEnd(type)}
          onClose={() => setCtx(null)}
        />
      )}
    </>
  )
}

// ── Resolve icon for a ShortcutEntry ─────────────────────────────────────────

function resolveEntryIcon(entry: ShortcutEntry, resourceIcons: ResourceIconEntry[], size = 11): JSX.Element {
  if (!entry.icon) return <UIIcon name="call_shortcut" size={size} />
  if (entry.iconIsCustom && entry.icon.endsWith('.svg')) {
    const resource = resourceIcons.find((e) => e.absPath === entry.icon)
    return resource ? <SVGIcon svgString={resource.svgContent} size={size} /> : <UIIcon name="call_shortcut" size={size} />
  }
  if (!entry.iconIsCustom) {
    const builtin = BUILTIN_ICONS.find((ic) => ic.name === entry.icon)
    return builtin ? <SVGIcon svgString={builtin.svg} size={size} /> : <UIIcon name={entry.icon} size={size} />
  }
  return <UIIcon name="call_shortcut" size={size} />
}

// ── ShortcutPickerMenu — gallery context menu for Run Shortcut ──────────────

function ShortcutPickerMenu({ library, groups, resourceIcons, selectedId, onSelect, onClose, pos, onPickVariable, onPickReturnValue }: {
  library: ShortcutEntry[]
  groups: ShortcutGroup[]
  resourceIcons: ResourceIconEntry[]
  selectedId: string
  onSelect: (shortcutId: string) => void
  onClose: () => void
  pos: { top: number; left: number }
  onPickVariable?: () => void
  onPickReturnValue?: () => void
}): JSX.Element {
  const t = useT()
  const menuRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [clampedPos, setClampedPos] = useState(pos)
  const searchRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (menuRef.current) setClampedPos(clampMenuPosition(menuRef.current, pos))
  }, [pos])

  useEffect(() => { searchRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = library.filter((entry) => {
    const matchesSearch = !search || entry.name.toLowerCase().includes(search.toLowerCase())
    const matchesGroup = groupFilter === 'all' || entry.groupId === groupFilter
    return matchesSearch && matchesGroup
  })

  const itemStyle: React.CSSProperties = {
    padding: '5px 10px', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 7,
    color: 'var(--c-text)', borderRadius: 4,
  }

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: clampedPos.top,
        left: clampedPos.left,
        width: 240,
        maxHeight: 320,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-elevated, #1e1e2e)',
        border: '1px solid var(--c-border, #333)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 9999,
      }}
    >
      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--c-border, #333)' }}>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('modal.searchActions')}
          style={{
            width: '100%', background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 6, color: 'var(--c-text)', padding: '4px 8px', fontSize: 12,
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Group filter */}
      {groups.length > 0 && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--c-border, #333)' }}>
          <CustomSelect
            value={groupFilter}
            onChange={(v) => setGroupFilter(v)}
            options={[
              { value: 'all', label: t('palette.allGroups') },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            style={{
              width: '100%', padding: '3px 6px', borderRadius: 5,
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', fontSize: 11, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Shortcut list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--c-text-dim)', padding: '12px 10px', textAlign: 'center' }}>
            {library.length === 0 ? t('script.noShortcuts') : 'No matching shortcuts'}
          </div>
        )}
        {filtered.map((entry) => {
          const entryColor = entry.bgColor ?? '#22d3ee'
          const isSelected = entry.id === selectedId
          return (
            <div
              key={entry.id}
              onClick={() => { onSelect(entry.id); onClose() }}
              style={{
                ...itemStyle,
                background: isSelected ? 'var(--c-accent-subtle, rgba(99,102,241,0.15))' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--c-hover, rgba(255,255,255,0.08))' }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4,
                background: entryColor + '22', border: `1px solid ${entryColor}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: entryColor,
              }}>
                {resolveEntryIcon(entry, resourceIcons)}
              </div>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 400 }}>
                {entry.name || '(unnamed)'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Divider + variable/return value options */}
      {(onPickVariable || onPickReturnValue) && (
        <>
          <div style={{ height: 1, background: 'var(--c-border, #333)' }} />
          <div style={{ padding: '4px 0' }}>
            {onPickVariable && (
              <div
                onClick={() => { onPickVariable(); onClose() }}
                style={itemStyle}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover, rgba(255,255,255,0.08))' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <UIIcon name="variable" size={14} />
                <span>{t('script.pickFromVariable')}</span>
              </div>
            )}
            {onPickReturnValue && (
              <div
                onClick={() => { onPickReturnValue(); onClose() }}
                style={itemStyle}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover, rgba(255,255,255,0.08))' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <UIIcon name="output" size={14} />
                <span>{t('script.pickFromReturnValue')}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
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
  { error: Error | null; componentStack: string | null }
> {
  state: { error: Error | null; componentStack: string | null } = { error: null, componentStack: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ componentStack: info.componentStack ?? null })
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      const language = this.props.language ?? 'en'
      const btnStyle: React.CSSProperties = {
        padding: '5px 14px', borderRadius: 6, border: '1px solid #45475a',
        background: '#313244', color: '#cdd6f4', fontSize: 12,
        cursor: 'pointer', fontFamily: 'inherit',
      }
      return (
        <div style={{
          padding: 24, color: 'var(--c-danger, #ff6060)',
          fontFamily: 'monospace', fontSize: 12,
          whiteSpace: 'pre-wrap', overflowY: 'auto',
          height: '100vh', background: 'var(--c-surface, #21262d)',
        }}>
          <strong>{language === 'ko' ? '렌더링 오류' : 'Render error'}</strong>{'\n\n'}{err.message}{'\n\n'}{err.stack}
          <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
            <button style={btnStyle} onClick={() => this.setState({ error: null, componentStack: null })}>
              {language === 'ko' ? '복구 시도' : 'Try to recover'}
            </button>
            <button style={btnStyle} onClick={() => window.shortcutsAPI.showErrorLog({
              message: err.message,
              stack: err.stack ?? '',
              componentStack: this.state.componentStack ?? undefined,
            })}>
              {language === 'ko' ? '에러 로그 확인' : 'View error log'}
            </button>
            <button style={{ ...btnStyle, color: '#ff6060' }} onClick={() => window.shortcutsAPI.restartApp()}>
              {language === 'ko' ? '프로그램 재시작' : 'Restart app'}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── WorkspaceDropZone ──────────────────────────────────────────────────────────

const WorkspaceDropZone = React.forwardRef<HTMLDivElement, { children: ReactNode; style?: React.CSSProperties; isLibDrag?: boolean; hasNodes?: boolean }>(
  function WorkspaceDropZone({ children, style, isLibDrag, hasNodes }, forwardedRef) {
    const { setNodeRef, isOver } = useDroppable({ id: 'workspace' })
    const combinedRef = useCallback((el: HTMLDivElement | null) => {
      setNodeRef(el)
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    }, [setNodeRef, forwardedRef])
    // Only show the workspace border highlight when the list is empty (valid empty-drop target).
    // When nodes exist the per-item ghost indicators provide visual feedback instead.
    const showBorder = isLibDrag && !hasNodes
    return (
      <div
        ref={combinedRef}
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
)

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

// ── ValuePaletteItem — draggable value in the Values tab ─────────────────────

interface ValueEntry {
  ref: string
  label: string
  sourceType: string
  definedAtIndex: number
  color: string
  nodeId: string
}

function ValuePaletteItem({ entry }: { entry: ValueEntry }): JSX.Element {
  const { setDragState } = useContext(ValueDragContext)
  const { setHighlightNodeId } = useContext(ReturnValuePickerContext)
  const icon = getSourceIcon(entry.sourceType)

  const handleClick = useCallback(() => {
    setHighlightNodeId(entry.nodeId)
  }, [entry.nodeId, setHighlightNodeId])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', entry.ref)
    setDragState({
      active: true,
      ref: entry.ref,
      definedAtIndex: entry.definedAtIndex,
      sourceType: entry.sourceType,
      label: entry.label,
    })
  }, [entry, setDragState])

  const handleDragEnd = useCallback(() => {
    setDragState({ active: false, ref: '', definedAtIndex: -1, sourceType: '', label: '' })
  }, [setDragState])

  return (
    <div
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 6,
        background: 'none',
        cursor: 'grab',
        marginBottom: 1,
        userSelect: 'none',
        transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-elevated)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        background: entry.color + '22',
        border: `1px solid ${entry.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: entry.color,
      }}><UIIcon name={icon} size={11} /></span>
      <span style={{
        fontSize: 12, fontWeight: 600, fontFamily: 'monospace',
        color: entry.color,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
      }}>
        {entry.label}
      </span>
      <span style={{
        fontSize: 9, color: 'var(--c-text-dim)', flexShrink: 0,
        opacity: 0.7,
      }}>
        #{entry.definedAtIndex + 1}
      </span>
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
    { id: 'actions',   icon: 'system', title: t('palette.actions') },
    { id: 'scripts',   icon: 'script',     title: t('palette.scripts') },
    { id: 'values',    icon: 'variable',   title: t('palette.values') },
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

// ── MajorCategoryHeader — centered label with thin dividers ─────────────────

function MajorCategoryHeader({ label }: { label: string }): JSX.Element {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 4px 4px',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border-sub)' }} />
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
        color: 'var(--c-text-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border-sub)' }} />
    </div>
  )
}

// ── SubCategoryHeader — left-aligned small label ────────────────────────────

function SubCategoryHeader({ label, first }: { label: string; first?: boolean }): JSX.Element {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
      color: 'var(--c-text-dim)', opacity: 0.7,
      padding: first ? '2px 4px 3px' : '6px 4px 3px',
      textTransform: 'uppercase',
    }}>
      {label}
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
  const [nodes, _setNodes] = useState<ActionNode[]>([])
  const nodesRef = useRef<ActionNode[]>([])
  // Synchronously update nodesRef whenever nodes change so that DnD handlers
  // (handleDragEnd in particular) always read the latest value even when
  // React hasn't flushed the render yet.
  const setNodes: typeof _setNodes = useCallback((update) => {
    _setNodes((prev) => {
      const next = typeof update === 'function' ? (update as (p: ActionNode[]) => ActionNode[])(prev) : update
      nodesRef.current = next
      return next
    })
  }, [])

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

  // Workspace scroll container ref (for wheel-to-scroll during drag)
  const workspaceScrollRef = useRef<HTMLDivElement>(null)

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  useEffect(() => { dropIndexRef.current = dropIndex }, [dropIndex])
  const [branchDrop, setBranchDrop] = useState<{ branchId: string } | null>(null)
  const branchDropRef = useRef<{ branchId: string } | null>(null)
  useEffect(() => { branchDropRef.current = branchDrop }, [branchDrop])
  const preDragNodesRef = useRef<ActionNode[] | null>(null)
  const libInsertedIdRef = useRef<string | null>(null)
  const libActionRef = useRef<ActionConfig | null>(null)
  const activeNestedActionRef = useRef<ActionConfig | null>(null)
  const nestedDragGhostIdRef = useRef<string | null>(null)

  // Safety net: reset drag state on pointerup if dnd-kit missed the end event
  const activeDragIdRef = useRef<string | null>(null)
  useEffect(() => { activeDragIdRef.current = activeDragId }, [activeDragId])
  useEffect(() => {
    const handlePointerUp = () => {
      // Give dnd-kit a frame to process its own dragEnd/dragCancel first
      requestAnimationFrame(() => {
        if (activeDragIdRef.current !== null) {
          // dnd-kit didn't clean up — force reset
          setActiveDragId(null)
          setDropIndex(null)
          setBranchDrop(null)
          if (preDragNodesRef.current) {
            setNodes(preDragNodesRef.current)
            preDragNodesRef.current = null
          }
          libInsertedIdRef.current = null
          libActionRef.current = null
          if (nestedDragGhostIdRef.current) {
            const gid = nestedDragGhostIdRef.current
            nestedDragGhostIdRef.current = null
            setNodes(prev => prev.filter(n => n._id !== gid))
          }
        }
      })
    }
    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [])

  // Scroll workspace with mouse wheel while dragging nodes
  // Listen on window (capture phase) so the event is caught even when pointer is captured by dnd-kit
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (activeDragIdRef.current === null) return
      const container = workspaceScrollRef.current
      if (!container) return
      e.preventDefault()
      container.scrollTop += e.deltaY
    }
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleWheel, { capture: true })
  }, [])

  // Tab navigation: intercept Tab on regular inputs inside the workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const target = e.target as HTMLElement
      // Only handle for regular inputs/selects/textareas inside the workspace
      // (VariableInput handles its own Tab key)
      if (target.hasAttribute('data-variable-input')) return
      const workspace = document.querySelector('[data-workspace]')
      if (!workspace || !workspace.contains(target)) return
      const tag = target.tagName
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return
      // Skip hidden/checkbox/radio inputs
      if (tag === 'INPUT') {
        const inputType = (target as HTMLInputElement).type
        if (inputType === 'hidden' || inputType === 'checkbox' || inputType === 'radio') return
      }
      e.preventDefault()
      focusNextTabField(target, e.shiftKey)
    }
    window.addEventListener('keydown', handleKeyDown, true) // capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  const isLibDrag = activeDragId?.startsWith('lib-') ?? false
  const isNestedDrag = activeDragId?.startsWith('nested:') ?? false
  const activeLibType = isLibDrag ? (activeDragId!.startsWith('lib-run-shortcut-') ? 'run-shortcut' : activeDragId!.replace('lib-', '')) : null
  const activeNode = (!isLibDrag && !isNestedDrag && activeDragId) ? nodesRef.current.find(n => n._id === activeDragId) ?? null : null

  // Return value picker state
  const [rvPickerState, setRvPickerState] = useState<ReturnValuePickerState>({ active: false, onPick: null, requestingNodeIndex: Infinity })
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null)

  // Value drag state (for dragging values from palette to inputs)
  const [valueDragState, setValueDragState] = useState<ValueDragState>({ active: false, ref: '', definedAtIndex: -1, sourceType: '', label: '' })
  const [forbiddenTooltip, setForbiddenTooltip] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  const valueDragCtx = useMemo(() => ({
    dragState: valueDragState,
    setDragState: setValueDragState,
    forbiddenTooltip,
    setForbiddenTooltip,
  }), [valueDragState, forbiddenTooltip])

  // Resolve return-value ref → source node visual info
  const resolveReturnValueMeta = useCallback((ref: string): ReturnValueNodeMeta | null => {
    if (!ref.startsWith('$')) return null
    const currentNodes = nodesRef.current
    for (let i = 0; i < currentNodes.length; i++) {
      const rvs = getNodeReturnValues(currentNodes[i].action, i, t)
      if (!rvs) continue
      const match = rvs.find(rv => rv.ref === ref)
      if (match) {
        const a = currentNodes[i].action
        const cfg = NODE_STYLE[a.type] ?? NODE_STYLE.shell
        // For run-shortcut, resolve visual identity from library entry
        let nodeIcon = cfg.icon
        let nodeColor = cfg.color
        let nodeLabel = cfg.label
        // Show actual variable/resource name instead of generic type label
        if (a.type === 'set-var') {
          const sv = a as SetVarAction
          if (sv.name) nodeLabel = sv.name.replace(/^\$/, '')
        } else if (a.type === 'list') {
          const la = a as ListAction
          if (la.operation === 'get' && la.resultVar) nodeLabel = la.resultVar
          else if (la.name) nodeLabel = la.name
        } else if (a.type === 'dict') {
          const da = a as DictAction
          if (da.operation === 'get' && da.resultVar) nodeLabel = da.resultVar
          else if (da.name) nodeLabel = da.name
        } else if (a.type === 'calculate') {
          const ca = a as CalculateAction
          if (ca.resultVar) nodeLabel = ca.resultVar
        } else if (a.type === 'run-shortcut') {
          const lib = data?.shortcutsLibrary ?? []
          const entry = lib.find(e => e.id === (a as RunShortcutAction).shortcutId)
          if (entry) {
            if (entry.icon) nodeIcon = entry.icon
            if (entry.bgColor) nodeColor = entry.bgColor
            nodeLabel = entry.name
          }
          const rs = a as RunShortcutAction
          if (rs.outputVar) nodeLabel = rs.outputVar
        } else if (a.type === 'stop') {
          const sa = a as StopAction
          if (sa.returnVar) nodeLabel = sa.returnVar
        } else if (a.type === 'loop') {
          const la = a as LoopAction
          const mode = la.mode ?? 'repeat'
          if (mode === 'for') nodeLabel = `${la.start ?? 0}..${la.end ?? 10}`
          else if (mode === 'foreach' && la.itemVar) nodeLabel = la.itemVar
        }
        return { icon: nodeIcon, label: nodeLabel, color: nodeColor }
      }
    }
    return null
  }, [t, NODE_STYLE, data?.shortcutsLibrary])

  // Collect return values from nodes preceding a given index — used by VariableInput suggestions
  const getAvailableReturnValues = useCallback((beforeIndex: number): ReturnValueInfo[] => {
    const results: ReturnValueInfo[] = []
    const currentNodes = nodesRef.current
    for (let i = 0; i < beforeIndex && i < currentNodes.length; i++) {
      const a = currentNodes[i].action
      const rvs = getNodeReturnValues(a, i, t)
      if (rvs) {
        const nodeCfg = NODE_STYLE[a.type] ?? NODE_STYLE.shell
        const nodeLabel = nodeCfg.label
        for (const rv of rvs) {
          results.push({ ref: rv.ref, label: `${nodeLabel} · ${rv.label}`, sourceType: rv.sourceType })
        }
      }
    }
    return results
  }, [t, NODE_STYLE])

  const rvPickerCtx = React.useMemo(() => ({
    pickerState: rvPickerState,
    requestPick: (nodeIndex: number, onPick: (ref: string) => void) => {
      setRvPickerState({ active: true, requestingNodeIndex: nodeIndex, onPick: (ref: string) => { onPick(ref); setRvPickerState({ active: false, onPick: null, requestingNodeIndex: Infinity }) } })
    },
    cancelPick: () => setRvPickerState({ active: false, onPick: null, requestingNodeIndex: Infinity }),
    resolveReturnValueMeta,
    highlightNodeId,
    setHighlightNodeId,
    getAvailableReturnValues,
  }), [rvPickerState, resolveReturnValueMeta, highlightNodeId, getAvailableReturnValues])

  // Cancel return value picker on Escape
  useEffect(() => {
    if (!rvPickerState.active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setRvPickerState({ active: false, onPick: null, requestingNodeIndex: Infinity })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [rvPickerState.active])

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(SmartKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Custom collision detection — prioritise branch drop zones ──────────────
  // Moved inside the component so it can exclude the lib-drag ghost node from
  // sortable containers, preventing closestCenter from returning the ghost
  // and causing a dead-zone where the ghost can't move to first/last position.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeId = args.active.id.toString()
    const isNestedDrag = activeId.startsWith('nested:')
    const libGhostId = libInsertedIdRef.current
    const nestedGhostId = nestedDragGhostIdRef.current

    const nestedContainers: DroppableContainer[] = []
    const branchContainers: DroppableContainer[] = []
    const sortableContainers: DroppableContainer[] = []
    const zoneContainers: DroppableContainer[] = []
    for (const container of args.droppableContainers) {
      const id = container.id.toString()
      // Exclude both lib-drag ghost and nested-drag top-level ghost so they
      // can't be returned as their own collision target (causing dead zones).
      if (id === libGhostId || id === nestedGhostId) continue
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
      // Priority order for nested drags:
      //   1. delete-zone (rectIntersection) — needed for delete UX
      //   2. top-level sortables (closestCenter) — extract/reorder at root
      //   3. nested items (closestCenter, with sibling/deeper logic) — reorder within branches
      //   4. branch zones (rectIntersection) — drop into another scope
      //   5. workspace (last resort) — only when no other target exists
      // Steps 1 & 2 fall through to lower steps if a branch zone overlaps the
      // active rect, so dropping into a branch keeps working.
      const deleteZone = zoneContainers.filter(c => c.id === 'delete-zone')
      if (deleteZone.length > 0) {
        const deleteHits = rectIntersection({ ...args, droppableContainers: deleteZone })
        if (deleteHits.length > 0) {
          const branchHits = branchContainers.length > 0
            ? rectIntersection({ ...args, droppableContainers: branchContainers })
            : []
          if (branchHits.length === 0) return deleteHits
        }
      }
      if (sortableContainers.length > 0) {
        const sortHits = closestCenter({ ...args, droppableContainers: sortableContainers })
        if (sortHits.length > 0) {
          const branchHits = branchContainers.length > 0
            ? rectIntersection({ ...args, droppableContainers: branchContainers })
            : []
          if (branchHits.length === 0) return sortHits
        }
      }
      if (nestedContainers.length > 0) {
        const activeBranchId = (args.active.data.current as any)?.branchId as string | undefined
        if (activeBranchId) {
          // Check if dragged item's rect overlaps a sibling's branch zone (cross-scope intent)
          const siblingBranchPrefix = activeBranchId + ':'
          const siblingBranchContainers = branchContainers.filter(c => c.id.toString().startsWith(siblingBranchPrefix))
          const insideSiblingScope = siblingBranchContainers.length > 0
            ? rectIntersection({ ...args, droppableContainers: siblingBranchContainers }).length > 0
            : false
          if (insideSiblingScope) {
            // Inside a sibling's scope — prefer deeper nested items for cross-scope targeting
            const deeperItems = nestedContainers.filter(c => (c.data.current as any)?.branchId !== activeBranchId)
            if (deeperItems.length > 0) {
              const deeperHits = closestCenter({ ...args, droppableContainers: deeperItems })
              if (deeperHits.length > 0) return deeperHits
            }
            // No deeper items — fall through to branch containers below
          } else {
            // Not inside any sibling scope — prefer same-branch items for reorder animations
            const sameBranchItems = nestedContainers.filter(c => (c.data.current as any)?.branchId === activeBranchId)
            if (sameBranchItems.length > 0) {
              const sameBranchHits = closestCenter({ ...args, droppableContainers: sameBranchItems })
              if (sameBranchHits.length > 0) return sameBranchHits
            }
          }
        }
        const hits = closestCenter({ ...args, droppableContainers: nestedContainers })
        if (hits.length > 0) return hits
      }
      if (branchContainers.length > 0) {
        const hits = rectIntersection({ ...args, droppableContainers: branchContainers })
        if (hits.length > 0) return hits
      }
      const workspaceZone = zoneContainers.filter(c => c.id === 'workspace')
      if (workspaceZone.length > 0) {
        const wsHits = rectIntersection({ ...args, droppableContainers: workspaceZone })
        if (wsHits.length > 0) return wsHits
      }
      return closestCenter({ ...args, droppableContainers: args.droppableContainers })
    }

    // Non-nested drag: check delete-zone first (rectIntersection).
    const deleteZone = zoneContainers.filter(c => c.id === 'delete-zone')
    if (deleteZone.length > 0) {
      const deleteHits = rectIntersection({ ...args, droppableContainers: deleteZone })
      if (deleteHits.length > 0) return deleteHits
    }
    if (branchContainers.length > 0) {
      const branchHits = rectIntersection({ ...args, droppableContainers: branchContainers })
      if (branchHits.length > 0) return branchHits
    }
    if (sortableContainers.length > 0) {
      const sortHits = closestCenter({ ...args, droppableContainers: sortableContainers })
      if (sortHits.length > 0) return sortHits
    }
    if (zoneContainers.length > 0) {
      return rectIntersection({ ...args, droppableContainers: zoneContainers })
    }
    return closestCenter({ ...args, droppableContainers: args.droppableContainers })
  }, [])

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

  // ── Sync theme when Settings changes it ────────────────────────────────────

  useEffect(() => {
    window.shortcutsAPI.onThemeChanged((theme) => {
      document.documentElement.dataset.theme = theme
    })
  }, [])

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

  // ── Palette context menu: add to start / end ──────────────────────────────

  const paletteAddToStart = useCallback((type: string, shortcutId?: string) => {
    const action = makeDefaultAction(type, shortcutId ? { shortcutId } : undefined)
    const newNode: ActionNode = { _id: generateNodeId(), action }
    commitNodes([newNode, ...nodes])
  }, [nodes, commitNodes])

  const paletteAddToEnd = useCallback((type: string, shortcutId?: string) => {
    const action = makeDefaultAction(type, shortcutId ? { shortcutId } : undefined)
    const newNode: ActionNode = { _id: generateNodeId(), action }
    commitNodes([...nodes, newNode])
  }, [nodes, commitNodes])

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
    } else if (id.startsWith('nested:')) {
      const dragData = event.active.data.current as { actions: ActionConfig[]; index: number } | undefined
      activeNestedActionRef.current = dragData ? dragData.actions[dragData.index] : null
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    const activeId = active.id.toString()
    const isLib = activeId.startsWith('lib-')
    const isNested = activeId.startsWith('nested:')
    // Use pointer (cursor) position instead of dragged element center for hit-testing
    const pointerY = (event.activatorEvent as PointerEvent).clientY + event.delta.y
    const currentNodes = nodesRef.current
    const overId = over?.id?.toString() ?? ''

    // Nested item drags: track workspace/delete-zone/branch targets so that
    // nested items can be extracted, deleted, or moved across branches.
    if (isNested) {
      if (overId.startsWith('branch:')) {
        const firstColon = overId.indexOf(':', 7)
        if (firstColon > 7) {
          // Remove ghost if present when entering a branch zone
          const ghostId = nestedDragGhostIdRef.current
          if (ghostId && currentNodes.some(n => n._id === ghostId)) {
            setNodes(currentNodes.filter(n => n._id !== ghostId))
          }
          setBranchDrop({ branchId: overId })
          setDropIndex(null)
          return
        }
      }
      setBranchDrop(null)

      if (overId === 'delete-zone') {
        const ghostId = nestedDragGhostIdRef.current
        if (ghostId && currentNodes.some(n => n._id === ghostId)) {
          setNodes(currentNodes.filter(n => n._id !== ghostId))
        }
        setDropIndex(null)
        return
      }

      // Over workspace or a top-level sortable node — insert/move ghost for smooth preview
      const nestedAction = activeNestedActionRef.current
      const isOverWorkspace = overId === 'workspace'
      const isOverTopNode = !isOverWorkspace && currentNodes.some(n => n._id === overId)
      if (nestedAction && (isOverWorkspace || isOverTopNode)) {
        const ghostId = nestedDragGhostIdRef.current
        const computeTargetIndex = (): number => {
          const nodesWithout = ghostId ? currentNodes.filter(n => n._id !== ghostId) : currentNodes
          if (isOverWorkspace) {
            if (nodesWithout.length === 0) return 0
            if (over) {
              const wsMidY = over.rect.top + over.rect.height / 2
              return pointerY < wsMidY ? 0 : nodesWithout.length
            }
            return nodesWithout.length
          }
          const overIdx = nodesWithout.findIndex(n => n._id === overId)
          if (overIdx !== -1) {
            const overRect = over!.rect
            const overMidY = overRect.top + overRect.height / 2
            if (ghostId) {
              const ghostIdx = currentNodes.findIndex(n => n._id === ghostId)
              if (ghostIdx !== -1) {
                if (ghostIdx === currentNodes.length - 1 && overIdx === nodesWithout.length - 1) {
                  return pointerY < overRect.top ? overIdx : overIdx + 1
                }
                if (ghostIdx === 0 && overIdx === 0) {
                  return pointerY < overRect.top + overRect.height ? overIdx : overIdx + 1
                }
              }
            }
            return pointerY < overMidY ? overIdx : overIdx + 1
          }
          return nodesWithout.length
        }
        const targetIdx = computeTargetIndex()
        if (!ghostId) {
          const newId = generateNodeId()
          nestedDragGhostIdRef.current = newId
          const newNodes = [...currentNodes]
          newNodes.splice(targetIdx, 0, { _id: newId, action: nestedAction })
          setNodes(newNodes)
        } else {
          const currentGhostIdx = currentNodes.findIndex(n => n._id === ghostId)
          if (currentGhostIdx === -1) {
            const newNodes = [...currentNodes]
            newNodes.splice(targetIdx, 0, { _id: ghostId, action: nestedAction })
            setNodes(newNodes)
          } else {
            const nodesWithout = currentNodes.filter(n => n._id !== ghostId)
            const clampedIdx = Math.min(targetIdx, nodesWithout.length)
            const newNodes = [...nodesWithout]
            newNodes.splice(clampedIdx, 0, currentNodes[currentGhostIdx])
            if (currentGhostIdx !== newNodes.findIndex(n => n._id === ghostId)) {
              setNodes(newNodes)
            }
          }
        }
        setDropIndex(null)
        return
      }

      // Over nested items in same/other branch — remove ghost, let SortableContext handle visuals
      const ghostId = nestedDragGhostIdRef.current
      if (ghostId && currentNodes.some(n => n._id === ghostId)) {
        setNodes(currentNodes.filter(n => n._id !== ghostId))
      }
      setDropIndex(null)
      return
    }

    // Branch drop zone detection (format: "branch:{nodeId}:{path...}")
    // Works for BOTH library drags and existing node drags
    if (overId.startsWith('branch:')) {
      const firstColon = overId.indexOf(':', 7)
      if (firstColon > 7) {
        const topNodeId = extractNodeIdFromBranchId(overId)
        // Don't allow dropping a node into its own branches
        if (!isLib && activeId === topNodeId) {
          setBranchDrop(null)
          setDropIndex(null)
          return
        }
        setBranchDrop({ branchId: overId })
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

      // Skip when hovering over the inserted ghost node itself (collision
      // detection excludes the ghost, so this is a rare edge-case guard).
      if (libInsertedIdRef.current && overId === libInsertedIdRef.current) return

      // Compute target index based on pointer vs over-element position.
      // For the first/last positions we use edge-based thresholds (hysteresis)
      // when the ghost is already at that boundary.  This prevents oscillation
      // caused by the ghost's presence shifting the target node's rect:
      //   ghost before last node → node pushed down → midpoint lower → pointer
      //   below → ghost moves to end → node jumps up → midpoint higher → pointer
      //   above → ghost moves back … (infinite loop).
      const computeTargetIndex = (): number => {
        const insertedId = libInsertedIdRef.current
        const nodesWithout = insertedId ? currentNodes.filter((n) => n._id !== insertedId) : currentNodes
        if (overId === 'workspace') {
          if (nodesWithout.length === 0) return 0
          if (over) {
            const wsMidY = over.rect.top + over.rect.height / 2
            return pointerY < wsMidY ? 0 : nodesWithout.length
          }
          return nodesWithout.length
        }
        // Over a sortable top-level node
        const overIdx = nodesWithout.findIndex((n) => n._id === overId)
        if (overIdx !== -1) {
          const overRect = over!.rect
          const overMidY = overRect.top + overRect.height / 2

          // Hysteresis: once the ghost is at a boundary, use the target node's
          // edge (instead of midpoint) so the ghost "sticks" and doesn't oscillate.
          if (insertedId) {
            const ghostIdx = currentNodes.findIndex((n) => n._id === insertedId)
            if (ghostIdx !== -1) {
              // Ghost at the end — keep it there unless pointer is above the node's top
              if (ghostIdx === currentNodes.length - 1 && overIdx === nodesWithout.length - 1) {
                return pointerY < overRect.top ? overIdx : overIdx + 1
              }
              // Ghost at the start — keep it there unless pointer is below the node's bottom
              if (ghostIdx === 0 && overIdx === 0) {
                return pointerY < overRect.top + overRect.height ? overIdx : overIdx + 1
              }
            }
          }

          return pointerY < overMidY ? overIdx : overIdx + 1
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

  // ── handleDragMove — continuous ghost repositioning for lib drags ────────────
  // onDragOver only fires when the collision target (`over`) changes.  When the
  // pointer moves within the same `over` node (e.g. crossing its midpoint),
  // onDragOver does NOT fire, leaving the ghost stuck at the wrong side.
  // onDragMove fires on every pointer move, letting us recompute the index.
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const activeId = event.active.id.toString()
    if (!activeId.startsWith('lib-') && !activeId.startsWith('nested:')) return

    // ── Nested drag: only handle ghost repositioning ──
    if (activeId.startsWith('nested:')) {
      const ghostId = nestedDragGhostIdRef.current
      if (!ghostId) return

      const currentNodesN = nodesRef.current
      const currentIdxN = currentNodesN.findIndex(n => n._id === ghostId)
      if (currentIdxN === -1) return

      const overN = event.over
      if (!overN) return
      const overIdN = overN.id.toString()
      if (ZONE_IDS.has(overIdN) || overIdN.startsWith('branch:') || overIdN.startsWith('nested:') || overIdN === ghostId) return

      const pointerYN = (event.activatorEvent as PointerEvent).clientY + event.delta.y
      const nodesWithoutN = currentNodesN.filter(n => n._id !== ghostId)
      const overIdxN = nodesWithoutN.findIndex(n => n._id === overIdN)
      if (overIdxN === -1) return

      const overRectN = overN.rect
      const overMidYN = overRectN.top + overRectN.height / 2
      let targetIdxN: number
      if (currentIdxN === 0 && overIdxN === 0) {
        targetIdxN = pointerYN < overRectN.top + overRectN.height ? overIdxN : overIdxN + 1
      } else if (currentIdxN === currentNodesN.length - 1 && overIdxN === nodesWithoutN.length - 1) {
        targetIdxN = pointerYN < overRectN.top ? overIdxN : overIdxN + 1
      } else {
        targetIdxN = pointerYN < overMidYN ? overIdxN : overIdxN + 1
      }
      const clampedIdxN = Math.min(targetIdxN, nodesWithoutN.length)
      const newNodesN = [...nodesWithoutN]
      newNodesN.splice(clampedIdxN, 0, currentNodesN[currentIdxN])
      if (currentIdxN !== newNodesN.findIndex(n => n._id === ghostId)) {
        setNodes(newNodesN)
      }
      return
    }

    // ── Lib drag: continuous ghost repositioning ──
    const insertedId = libInsertedIdRef.current
    if (!insertedId) return

    const currentNodes = nodesRef.current
    const currentIdx = currentNodes.findIndex((n) => n._id === insertedId)
    if (currentIdx === -1) return // ghost removed (hovering delete-zone / branch)

    const over = event.over
    if (!over) return
    const overId = over.id.toString()

    // Only reposition when over a sortable top-level node
    if (ZONE_IDS.has(overId) || overId.startsWith('branch:') || overId.startsWith('nested:') || overId === insertedId) return

    const pointerY = (event.activatorEvent as PointerEvent).clientY + event.delta.y
    const nodesWithout = currentNodes.filter((n) => n._id !== insertedId)
    const overIdx = nodesWithout.findIndex((n) => n._id === overId)
    if (overIdx === -1) return

    const overRect = over.rect
    const overMidY = overRect.top + overRect.height / 2

    // Hysteresis at boundaries (same logic as computeTargetIndex in handleDragOver)
    let targetIdx: number
    if (currentIdx === 0 && overIdx === 0) {
      targetIdx = pointerY < overRect.top + overRect.height ? overIdx : overIdx + 1
    } else if (currentIdx === currentNodes.length - 1 && overIdx === nodesWithout.length - 1) {
      targetIdx = pointerY < overRect.top ? overIdx : overIdx + 1
    } else {
      targetIdx = pointerY < overMidY ? overIdx : overIdx + 1
    }

    const clampedIdx = Math.min(targetIdx, nodesWithout.length)
    const newNodes = [...nodesWithout]
    newNodes.splice(clampedIdx, 0, currentNodes[currentIdx])
    if (currentIdx !== newNodes.findIndex((n) => n._id === insertedId)) {
      setNodes(newNodes)
    }

  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
    setDropIndex(null)
    setBranchDrop(null)
    if (nestedDragGhostIdRef.current) {
      const gid = nestedDragGhostIdRef.current
      nestedDragGhostIdRef.current = null
      setNodes(prev => prev.filter(n => n._id !== gid))
    }
    // Revert to pre-drag state if lib drag was in progress
    if (preDragNodesRef.current) {
      setNodes(preDragNodesRef.current)
      preDragNodesRef.current = null
    }
    libInsertedIdRef.current = null
    libActionRef.current = null
    activeNestedActionRef.current = null
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const id = active.id.toString()

    setActiveDragId(null)
    activeNestedActionRef.current = null

    // ── Nested item drag — reorder, extract, delete, or cross-branch move ──
    if (id.startsWith('nested:')) {
      const branchTarget = branchDropRef.current
      const idx = dropIndexRef.current
      setBranchDrop(null)
      setDropIndex(null)

      // Collect and clear ghost node used for workspace extraction preview
      const nestedGhostId = nestedDragGhostIdRef.current
      nestedDragGhostIdRef.current = null

      const fromData = active.data.current as { branchId: string; index: number; actions: ActionConfig[]; onReorder: (a: ActionConfig[]) => void } | undefined
      if (!fromData) return

      const draggedAction = fromData.actions[fromData.index]

      // Helper: remove the dragged item from its source branch (works at any depth)
      const removeDraggedFromNodes = (nodesList: ActionNode[]): ActionNode[] => {
        return modifyBranch(nodesList, fromData.branchId, (acts) => acts.filter((_, i) => i !== fromData.index)) ?? nodesList
      }

      // Drop on another nested item — same-branch reorder handled via callbacks
      if (over && over.id.toString().startsWith('nested:')) {
        if (active.id === over.id) return
        const toData = over.data.current as { branchId: string; index: number; actions: ActionConfig[]; onReorder: (a: ActionConfig[]) => void } | undefined
        if (fromData && toData && fromData.branchId === toData.branchId) {
          // Clean up ghost before reordering
          if (nestedGhostId) setNodes(nodesRef.current.filter(n => n._id !== nestedGhostId))
          fromData.onReorder(arrayMove([...fromData.actions], fromData.index, toData.index))
          return
        }
        // Cross-branch: adjust target path in case removing source shifts sibling indices
        if (fromData && toData && fromData.branchId !== toData.branchId) {
          const adjustedToBranchId = adjustBranchIdAfterRemoval(toData.branchId, fromData.branchId, fromData.index)
          let updated = removeDraggedFromNodes(nodesRef.current)
          if (nestedGhostId) updated = updated.filter(n => n._id !== nestedGhostId)
          const added = modifyBranch(updated, adjustedToBranchId, (acts) => {
            const arr = [...acts]; arr.splice(toData.index, 0, draggedAction); return arr
          })
          if (added) commitNodes(added)
          return
        }
      }

      // Drop on delete-zone or outside workspace — delete the nested node
      if (!over || over.id === 'delete-zone') {
        let updated = removeDraggedFromNodes(nodesRef.current)
        if (nestedGhostId) updated = updated.filter(n => n._id !== nestedGhostId)
        commitNodes(updated)
        return
      }

      const overId = over.id.toString()

      // Drop on a branch zone — insert into that branch
      if (branchTarget) {
        // Adjust path in case removing source shifts the target index within a parent branch
        const adjustedBranchId = adjustBranchIdAfterRemoval(branchTarget.branchId, fromData.branchId, fromData.index)
        let updated = removeDraggedFromNodes(nodesRef.current)
        if (nestedGhostId) updated = updated.filter(n => n._id !== nestedGhostId)
        const added = modifyBranch(updated, adjustedBranchId, (acts) => [...acts, draggedAction])
        if (added) commitNodes(added)
        return
      }

      // Drop on workspace or a top-level sortable node — extract to main sequence
      if (overId === 'workspace' || nodesRef.current.some((n) => n._id === overId)) {
        let updated = removeDraggedFromNodes(nodesRef.current)
        if (nestedGhostId) {
          // Ghost exists — replace it with the real committed node
          const ghostIdx = updated.findIndex(n => n._id === nestedGhostId)
          if (ghostIdx !== -1) {
            updated = updated.map((n, i) => i === ghostIdx ? { _id: generateNodeId(), action: draggedAction } : n)
            commitNodes(updated)
            return
          }
          updated = updated.filter(n => n._id !== nestedGhostId)
        }
        // Fallback: insert at dropIndex or end
        const insertIdx = idx !== null ? Math.min(idx, updated.length) : updated.length
        updated = [...updated]
        updated.splice(insertIdx, 0, { _id: generateNodeId(), action: draggedAction })
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

      // Branch drop — insert action into branch (works at any depth)
      if (branchTarget) {
        const action = (insertedId ? currentNodes.find((n) => n._id === insertedId)?.action : null) ?? libAction
        const baseNodes = preNodes
        if (!action) { setNodes(preNodes); return }
        const updatedNodes = modifyBranch(baseNodes, branchTarget.branchId, (acts) => [...acts, action])
        if (updatedNodes) {
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
      const currentNodes = nodesRef.current
      const dragNodeIdx = currentNodes.findIndex((n) => n._id === id)
      if (dragNodeIdx !== -1) {
        const draggedAction = currentNodes[dragNodeIdx].action
        // Remove from top-level, add to the branch
        const withoutDragged = currentNodes.filter((_, i) => i !== dragNodeIdx)
        const updated = modifyBranch(withoutDragged, branchTarget.branchId, (acts) => [...acts, draggedAction])
        if (updated) commitNodes(updated)
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
  ).sort((a, b) => (NODE_STYLE[a]?.label ?? '').localeCompare(NODE_STYLE[b]?.label ?? '', undefined, { sensitivity: 'base' }))

  const scriptPaletteItems = SCRIPT_TYPES.filter((key) =>
    !search || key.includes(search.toLowerCase()) ||
    NODE_STYLE[key]?.label.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => (NODE_STYLE[a]?.label ?? '').localeCompare(NODE_STYLE[b]?.label ?? '', undefined, { sensitivity: 'base' }))

  // Collect all values (variables + return values) from current nodes
  const valueEntries = useMemo((): { variables: ValueEntry[]; returnValues: ValueEntry[] } => {
    const variables: ValueEntry[] = []
    const returnValues: ValueEntry[] = []
    const seenVars = new Set<string>()

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i].action
      // Collect user-defined variables
      if (a.type === 'set-var') {
        const sv = a as SetVarAction
        const svName = sv.name.replace(/^\$/, '')
        if (svName && !seenVars.has(svName)) {
          seenVars.add(svName)
          variables.push({ ref: `$${svName}`, label: svName, sourceType: 'set-var', definedAtIndex: i, color: getSourceColor('set-var'), nodeId: nodes[i]._id })
        }
      } else if (a.type === 'list') {
        const la = a as ListAction
        if (la.name && !seenVars.has(la.name)) {
          seenVars.add(la.name)
          variables.push({ ref: `$${la.name}`, label: la.name, sourceType: 'list', definedAtIndex: i, color: getSourceColor('list'), nodeId: nodes[i]._id })
        }
        if (la.operation === 'get' && la.resultVar && !seenVars.has(la.resultVar)) {
          seenVars.add(la.resultVar)
          variables.push({ ref: `$${la.resultVar}`, label: la.resultVar, sourceType: 'list', definedAtIndex: i, color: getSourceColor('list'), nodeId: nodes[i]._id })
        }
      } else if (a.type === 'dict') {
        const da = a as DictAction
        if (da.name && !seenVars.has(da.name)) {
          seenVars.add(da.name)
          variables.push({ ref: `$${da.name}`, label: da.name, sourceType: 'dict', definedAtIndex: i, color: getSourceColor('dict'), nodeId: nodes[i]._id })
        }
        if (da.operation === 'get' && da.resultVar && !seenVars.has(da.resultVar)) {
          seenVars.add(da.resultVar)
          variables.push({ ref: `$${da.resultVar}`, label: da.resultVar, sourceType: 'dict', definedAtIndex: i, color: getSourceColor('dict'), nodeId: nodes[i]._id })
        }
      } else if (a.type === 'calculate') {
        const ca = a as CalculateAction
        if (ca.resultVar && !seenVars.has(ca.resultVar)) {
          seenVars.add(ca.resultVar)
          variables.push({ ref: `$${ca.resultVar}`, label: ca.resultVar, sourceType: 'calculate', definedAtIndex: i, color: getSourceColor('calculate'), nodeId: nodes[i]._id })
        }
      } else if (a.type === 'loop') {
        // Loop iteration variables (for's iterVar, foreach's itemVar) are scoped
        // to the loop body — mark them as seen so they don't appear as return values,
        // but don't add them to the palette since they're not usable outside the loop.
        const la = a as LoopAction
        const mode = la.mode ?? 'repeat'
        if (mode === 'for' && la.iterVar) {
          seenVars.add(la.iterVar)
        }
        if (mode === 'foreach' && la.itemVar) {
          seenVars.add(la.itemVar)
        }
      } else if (a.type === 'run-shortcut') {
        const rs = a as RunShortcutAction
        if (rs.outputVar && !seenVars.has(rs.outputVar)) {
          seenVars.add(rs.outputVar)
          variables.push({ ref: `$${rs.outputVar}`, label: rs.outputVar, sourceType: 'run-shortcut', definedAtIndex: i, color: getSourceColor('run-shortcut'), nodeId: nodes[i]._id })
        }
      }

      // Collect implicit return values — skip variable/container nodes
      // (set-var, list, dict) whose values are already in the variables section,
      // and loop iteration vars which are scoped to the loop body.
      if (a.type !== 'set-var' && a.type !== 'list' && a.type !== 'dict' && a.type !== 'loop') {
        const rvs = getNodeReturnValues(a, i, t)
        if (rvs) {
          for (const rv of rvs) {
            // Skip if already captured as a user variable
            if (seenVars.has(rv.ref)) continue
            const cfg = NODE_STYLE[a.type]
            returnValues.push({
              ref: rv.ref,
              label: rv.label,
              sourceType: rv.sourceType,
              definedAtIndex: i,
              color: cfg?.color ?? '#888',
              nodeId: nodes[i]._id,
            })
          }
        }
      }
    }
    return { variables, returnValues }
  }, [nodes, t])

  // Filter value entries by search
  const filteredVariables = valueEntries.variables.filter(v =>
    !search || v.label.toLowerCase().includes(search.toLowerCase()) || v.ref.toLowerCase().includes(search.toLowerCase())
  )
  const filteredReturnValues = valueEntries.returnValues.filter(v =>
    !search || v.label.toLowerCase().includes(search.toLowerCase()) || v.ref.toLowerCase().includes(search.toLowerCase())
  )

  // Filter out the current shortcut being edited to prevent self-calls
  const currentEntryId = data?.libraryEntryId

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
    <ValueDragContext.Provider value={valueDragCtx}>
    <ReturnValuePickerContext.Provider value={rvPickerCtx}>
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragMove={handleDragMove}
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
                  background: 'var(--c-surface)', border: '1px solid var(--c-accent)',
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
          <div data-workspace="" style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--c-elevated)' }}>
            {/* Return value picker banner */}
            {rvPickerState.active && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px',
                background: 'rgba(59,130,246,0.12)',
                borderBottom: '1px solid rgba(59,130,246,0.3)',
                flexShrink: 0,
              }}>
                <UIIcon name="output" size={14} />
                <span style={{ fontSize: 12, color: 'var(--c-text)', flex: 1 }}>{t('script.returnValuePickerHint')}</span>
                <button
                  onClick={() => rvPickerCtx.cancelPick()}
                  style={{
                    background: 'none', border: '1px solid var(--c-border)', borderRadius: 4,
                    color: 'var(--c-text-dim)', cursor: 'pointer', padding: '2px 8px', fontSize: 11,
                  }}
                >
                  Esc
                </button>
              </div>
            )}
            <WorkspaceDropZone ref={workspaceScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 56px 50vh 56px' }} isLibDrag={isLibDrag} hasNodes={nodes.length > 0}>
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
                    const elements: JSX.Element[] = []
                    for (let i = 0; i < nodes.length; i++) {
                      const node = nodes[i]

                      // ── Pipeline connector line between previous node and current ──
                      if (i > 0) {
                        const prevAction = nodes[i - 1].action
                        const prevHasOutput = nodeHasPipelineOutput(prevAction)
                        const prevColor = (() => {
                          const prevCfg = NODE_STYLE[prevAction.type] ?? NODE_STYLE.shell
                          if (prevAction.type === 'run-shortcut') {
                            const entry = library.find(e => e.id === (prevAction as RunShortcutAction).shortcutId)
                            return entry?.bgColor ?? prevCfg.color
                          }
                          return prevCfg.color
                        })()
                        elements.push(
                          <div key={`pipe-${node._id}`} style={{
                            display: 'flex',
                            justifyContent: 'center',
                            height: prevHasOutput ? 14 : 6,
                            pointerEvents: 'none',
                          }}>
                            {prevHasOutput && (
                              <div style={{
                                width: 2,
                                height: '100%',
                                borderRadius: 1,
                                background: `${prevColor}55`,
                              }} />
                            )}
                          </div>
                        )
                      }

                      elements.push(
                        <SortableNode
                          key={node._id}
                          node={node}
                          nodeIndex={i}
                          nodeStyle={NODE_STYLE}
                          onChange={(action) => updateNode(node._id, action)}
                          onDelete={() => deleteNode(node._id)}
                          errorMsg={i === errorNodeIndex ? (errorMessage ?? t('shortcuts.executionError')) : undefined}
                          library={library}
                          groups={groups}
                          resourceIcons={resourceIcons}
                          currentEntryId={currentEntryId}
                          availableVars={collectAvailableVars(nodes, i)}
                          availableVarInfos={collectAvailableVarInfos(nodes, i)}
                          isGhost={(isLibDrag && node._id === libInsertedIdRef.current) || (isNestedDrag && node._id === nestedDragGhostIdRef.current)}
                        />
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
            <PaletteTabBar active={paletteTab} onChange={(tab) => { setPaletteTab(tab); setSearch('') }} />

            {/* Search */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--c-border-sub)', flexShrink: 0 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('modal.searchActions')}
                style={{
                  width: '100%',
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 6, color: 'var(--c-text)',
                  padding: '5px 8px', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {paletteTab === 'all' && (
                <>
                  {/* ACTIONS major category */}
                  {actionPaletteItems.length > 0 && (
                    <>
                      <MajorCategoryHeader label={t('palette.actions')} />
                      {ACTION_SUBCATEGORIES.map((sub, si) => {
                        const items = sub.types.filter((t) => actionPaletteItems.includes(t))
                        if (items.length === 0) return null
                        return (
                          <React.Fragment key={sub.labelKey}>
                            <SubCategoryHeader label={t(sub.labelKey as keyof Translations)} first={si === 0} />
                            {items.map((type) => (
                              <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} onAddToStart={(t) => paletteAddToStart(t)} onAddToEnd={(t) => paletteAddToEnd(t)} />
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                  {/* SCRIPTS major category */}
                  {scriptPaletteItems.length > 0 && (
                    <>
                      <MajorCategoryHeader label={t('palette.scripts')} />
                      {SCRIPT_SUBCATEGORIES.map((sub, si) => {
                        const items = sub.types.filter((t) => scriptPaletteItems.includes(t))
                        if (items.length === 0) return null
                        return (
                          <React.Fragment key={sub.labelKey}>
                            <SubCategoryHeader label={t(sub.labelKey as keyof Translations)} first={si === 0} />
                            {items.map((type) => (
                              <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} onAddToStart={(t) => paletteAddToStart(t)} onAddToEnd={(t) => paletteAddToEnd(t)} />
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                  {actionPaletteItems.length === 0 && scriptPaletteItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching items
                    </div>
                  )}
                </>
              )}

              {paletteTab === 'actions' && (
                <>
                  {ACTION_SUBCATEGORIES.map((sub, si) => {
                    const items = sub.types.filter((t) => actionPaletteItems.includes(t))
                    if (items.length === 0) return null
                    return (
                      <React.Fragment key={sub.labelKey}>
                        <SubCategoryHeader label={t(sub.labelKey as keyof Translations)} first={si === 0} />
                        {items.map((type) => (
                          <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} onAddToStart={(t) => paletteAddToStart(t)} onAddToEnd={(t) => paletteAddToEnd(t)} />
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {actionPaletteItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching actions
                    </div>
                  )}
                </>
              )}

              {paletteTab === 'scripts' && (
                <>
                  {SCRIPT_SUBCATEGORIES.map((sub, si) => {
                    const items = sub.types.filter((t) => scriptPaletteItems.includes(t))
                    if (items.length === 0) return null
                    return (
                      <React.Fragment key={sub.labelKey}>
                        <SubCategoryHeader label={t(sub.labelKey as keyof Translations)} first={si === 0} />
                        {items.map((type) => (
                          <LibraryItem key={type} type={type} cfg={NODE_STYLE[type]} onAddToStart={(t) => paletteAddToStart(t)} onAddToEnd={(t) => paletteAddToEnd(t)} />
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {scriptPaletteItems.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      No matching scripts
                    </div>
                  )}
                </>
              )}

              {paletteTab === 'values' && (
                <>
                  {/* Variables section */}
                  {filteredVariables.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-dim)', padding: '2px 4px 4px', textTransform: 'uppercase' }}>
                        {t('palette.variables')}
                      </div>
                      {filteredVariables.map((entry) => (
                        <ValuePaletteItem key={entry.ref} entry={entry} />
                      ))}
                    </>
                  )}
                  {/* Return values section */}
                  {filteredReturnValues.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-dim)', padding: '6px 4px 4px', textTransform: 'uppercase' }}>
                        {t('palette.returnValues')}
                      </div>
                      {filteredReturnValues.map((entry) => (
                        <ValuePaletteItem key={`${entry.ref}-${entry.definedAtIndex}`} entry={entry} />
                      ))}
                    </>
                  )}
                  {filteredVariables.length === 0 && filteredReturnValues.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-dim)', padding: '20px 8px', textAlign: 'center' }}>
                      {t('palette.noValues')}
                    </div>
                  )}
                </>
              )}

            </div>
          </DeleteDropZone>
        </div>
      </div>

      {/* ── Icon/Color picker popover (no backdrop overlay) ── */}
      {pickerOpen && pickerPos && displaySlot && (
        <IconColorPopup
          icon={displaySlot.icon}
          iconIsCustom={displaySlot.iconIsCustom}
          bgColor={displaySlot.bgColor}
          anchor={pickerPos}
          resourceIcons={resourceIcons}
          onSelectIcon={(ic, isCustom) => {
            if (isCustom) {
              const entry = resourceIcons.find((e) => e.absPath === ic)
              if (entry) handleSelectIcon(entry)
            } else {
              handleSelectBuiltinIcon(ic)
            }
          }}
          onSelectBgColor={handleSelectBgColor}
          onClose={() => setPickerOpen(false)}
          zIndex={9000}
        />
      )}

      {/* ── Drag overlay — simplified: icon + label only ── */}
      <DragOverlay dropAnimation={null}>
        {activeDragId && (() => {
          const type = isLibDrag
            ? (activeLibType ?? '')
            : isNestedDrag
              ? (activeNestedActionRef.current?.type ?? '')
              : (activeNode?.action.type ?? '')
          const cfg = NODE_STYLE[type]
          if (!cfg) return null
          // For run-shortcut drag, use the referenced entry's icon/color
          const dragCsEntry = type === 'run-shortcut'
            ? library.find((e) => e.id === (
                isLibDrag
                  ? (activeDragId.replace('lib-run-shortcut-', ''))
                  : isNestedDrag
                    ? (activeNestedActionRef.current as RunShortcutAction | undefined)?.shortcutId
                    : (activeNode?.action as RunShortcutAction | undefined)?.shortcutId
              ))
            : undefined
          const overlayColor = dragCsEntry?.bgColor ?? cfg.color
          const overlayIcon  = dragCsEntry?.icon    ?? cfg.icon
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--c-node-bg)',
              border: `1px solid ${overlayColor}55`,
              borderLeft: `3px solid ${overlayColor}`,
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              pointerEvents: 'none', opacity: 0.55,
            }}>
              <span style={{ flexShrink: 0, color: overlayColor }}>{renderNodeIcon(overlayIcon, 16)}</span>
              <span style={{ fontSize: 12, color: overlayColor, whiteSpace: 'nowrap' }}>{cfg.label}</span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
    </ReturnValuePickerContext.Provider>

    {/* Forbidden drop tooltip */}
    {forbiddenTooltip.visible && (
      <div style={{
        position: 'fixed',
        top: forbiddenTooltip.y - 36,
        left: forbiddenTooltip.x + 12,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        background: 'var(--c-elevated, #1e1e2e)',
        border: '1px solid rgba(239,68,68,0.4)',
        borderRadius: 7,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        zIndex: 99999,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: '#ef4444', display: 'flex', flexShrink: 0 }}><UIIcon name="stop" size={13} /></span>
        <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 500 }}>{t('palette.valueNotDefined')}</span>
      </div>
    )}
    </ValueDragContext.Provider>
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
