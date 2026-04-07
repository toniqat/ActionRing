import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, useContext } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import type {
  ActionConfig, SetVarAction, CalculateAction, LoopAction, RunShortcutAction, ListAction, DictAction,
} from '@shared/config.types'
import { UIIcon } from '@shared/UIIcon'
import { useT } from '@settings/i18n/I18nContext'

// ── Viewport clamping utility ────────────────────────────────────────────────

/**
 * Clamps a menu position so it stays within the viewport with an 8px margin.
 * Must be called after the menu is rendered (needs element dimensions).
 */
export function clampMenuPosition(
  menuEl: HTMLElement | null,
  rawPos: { top: number; left: number },
): { top: number; left: number } {
  if (!menuEl) return rawPos
  const rect = menuEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let { top, left } = rawPos
  if (left + rect.width > vw) left = vw - rect.width - 8
  if (top + rect.height > vh) top = vh - rect.height - 8
  if (left < 8) left = 8
  if (top < 8) top = 8
  return { top, left }
}

// ── Return value picker context ──────────────────────────────────────────────

export interface ReturnValuePickerState {
  active: boolean
  onPick: ((ref: string) => void) | null
  /** Index of the node whose input triggered the picker — only nodes before this index show chips. */
  requestingNodeIndex: number
}

/** Resolved visual identity of a source node for a return value reference. */
export interface ReturnValueNodeMeta {
  icon: string
  label: string
  color: string
}

/** Lightweight return-value descriptor used by the suggestion list inside VariableInput menus. */
export interface ReturnValueInfo {
  ref: string
  label: string
  sourceType: string
}

export const ReturnValuePickerContext = React.createContext<{
  pickerState: ReturnValuePickerState
  requestPick: (nodeIndex: number, onPick: (ref: string) => void) => void
  cancelPick: () => void
  /** Resolve source-node visual info for a return value ref (e.g. "$__launch_0"). */
  resolveReturnValueMeta: (ref: string) => ReturnValueNodeMeta | null
  /** ID of the node to highlight (after return value pick). */
  highlightNodeId: string | null
  /** Trigger highlight animation + scroll on a node. */
  setHighlightNodeId: (id: string | null) => void
  /** Collect return values from nodes preceding `beforeIndex`. */
  getAvailableReturnValues: (beforeIndex: number) => ReturnValueInfo[]
}>({
  pickerState: { active: false, onPick: null, requestingNodeIndex: Infinity },
  requestPick: () => {},
  cancelPick: () => {},
  resolveReturnValueMeta: () => null,
  highlightNodeId: null,
  setHighlightNodeId: () => {},
  getAvailableReturnValues: () => [],
})

// ── Loop insert context ──────────────────────────────────────────────────────

export interface LoopAssignOption {
  /** Menu label (i18n key already resolved) */
  label: string
  /** Default variable name for the inserted set-var (legacy, used by repeat/for modes) */
  varName: string
  /** Value expression referencing the loop variable, e.g. "$__loop_count" or "$_item" */
  value: string
}

export interface LoopInsertContextValue {
  /** Available loop assignment options (empty when not inside a loop body) */
  options: LoopAssignOption[]
  /** Insert a set-var action at the beginning of the loop body. Returns false if duplicate. */
  insertSetVar: (name: string, value: string) => boolean
  /** When true, loop options directly set the variable reference without inserting set-var */
  directRef?: boolean
}

export const LoopInsertContext = React.createContext<LoopInsertContextValue>({
  options: [],
  insertSetVar: () => false,
  directRef: false,
})

// ── Value drag context (for dragging values from palette to inputs) ──────────

export interface ValueDragState {
  active: boolean
  ref: string            // e.g., "$myVar" or "$__launch_0"
  definedAtIndex: number  // node index where this value is first defined
  sourceType: string
  label: string
}

const EMPTY_VALUE_DRAG: ValueDragState = { active: false, ref: '', definedAtIndex: -1, sourceType: '', label: '' }

export const ValueDragContext = React.createContext<{
  dragState: ValueDragState
  setDragState: (state: ValueDragState) => void
  /** Tooltip state for forbidden drops */
  forbiddenTooltip: { x: number; y: number; visible: boolean }
  setForbiddenTooltip: (t: { x: number; y: number; visible: boolean }) => void
}>({
  dragState: EMPTY_VALUE_DRAG,
  setDragState: () => {},
  forbiddenTooltip: { x: 0, y: 0, visible: false },
  setForbiddenTooltip: () => {},
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionNode {
  _id: string
  action: ActionConfig
}

/** Info about a variable: name + the action type that produced it. */
export interface VarInfo {
  name: string
  sourceType: string // action type that produced this variable
  /** Optional display label shown on chips instead of the variable name (e.g. "Current Key") */
  displayLabel?: string
}

// ── Variable collection utility ───────────────────────────────────────────────

/**
 * Collects variable names produced by nodes preceding `beforeIndex`.
 * Returns both flat string[] (backwards-compatible) and VarInfo[] with source types.
 */
export function collectAvailableVars(
  nodes: ActionNode[],
  beforeIndex: number,
  parentVars: string[] = [],
): string[] {
  return collectAvailableVarInfos(nodes, beforeIndex, parentVars).map(v => v.name)
}

export function collectAvailableVarInfos(
  nodes: ActionNode[],
  beforeIndex: number,
  parentVars: string[] = [],
): VarInfo[] {
  const seen = new Set<string>()
  const infos: VarInfo[] = []

  for (const pv of parentVars) {
    if (!seen.has(pv)) {
      seen.add(pv)
      infos.push({ name: pv, sourceType: 'set-var' })
    }
  }

  for (let i = 0; i < beforeIndex && i < nodes.length; i++) {
    const a = nodes[i].action
    const add = (name: string) => {
      if (name && !seen.has(name)) {
        seen.add(name)
        infos.push({ name, sourceType: a.type })
      }
    }
    switch (a.type) {
      case 'set-var': {
        const sv = a as SetVarAction
        add(sv.name.replace(/^\$/, ''))
        break
      }
      case 'list': {
        const la = a as ListAction
        const op = la.operation ?? 'set'
        if (la.mode === 'define' || op === 'set' || op === 'push') add(la.name)
        if (op === 'get' && la.resultVar) add(la.resultVar)
        break
      }
      case 'dict': {
        const da = a as DictAction
        const op = da.operation ?? 'set'
        if (da.mode === 'define' || op === 'set') add(da.name)
        if (op === 'get' && da.resultVar) add(da.resultVar)
        break
      }
      case 'calculate': {
        const ca = a as CalculateAction
        if (ca.resultVar) add(ca.resultVar)
        break
      }
      case 'loop': {
        const la = a as LoopAction
        const mode = la.mode ?? 'repeat'
        if (mode === 'for' && la.iterVar) add(la.iterVar)
        if (mode === 'foreach') {
          if (la.itemVar) add(la.itemVar)
          if (la.keyVar) add(la.keyVar)
        }
        break
      }
      case 'run-shortcut': {
        const rs = a as RunShortcutAction
        if (rs.outputVar) add(rs.outputVar)
        break
      }
    }
  }

  return infos.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Source type → icon name mapping ──────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  'set-var':      'variable',
  'list':         'list_alt',
  'dict':         'data_object',
  'calculate':    'calculate',
  'loop':         'loop',
  'run-shortcut': 'call_shortcut',
}

export function getSourceIcon(sourceType: string): string {
  return SOURCE_ICON[sourceType] ?? 'variable'
}

// ── Chip color utility ────────────────────────────────────────────────────────

/** Fixed color used for loop iteration variable chips */
export const LOOP_CHIP_COLOR = '#06b6d4'

/** Maps source action type → node color (must match getNodeStyle in ShortcutsApp) */
const SOURCE_COLOR: Record<string, string> = {
  'set-var':      '#f472b6',
  'list':         '#f472b6',
  'dict':         '#f472b6',
  'calculate':    '#10b981',
  'loop':         LOOP_CHIP_COLOR,
  'run-shortcut': '#22d3ee',
}

/** Return the node color for the given source action type. */
export function getSourceColor(sourceType: string): string {
  return SOURCE_COLOR[sourceType] ?? '#f472b6'
}

// ── Tab field navigation utility ─────────────────────────────────────────────

/** Attribute used to mark VariableInput elements as tab-navigable. */
export const TAB_FIELD_ATTR = 'data-tab-field'

/** Selector for all tab-navigable fields inside the workspace area. */
const TAB_FIELD_SELECTOR = [
  `[${TAB_FIELD_ATTR}]`,
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([data-no-tab])',
  'select:not([data-no-tab])',
  'textarea:not([data-no-tab])',
].join(', ')

/**
 * Collect all tab-navigable fields in document order within the workspace.
 * Deduplicates VariableInput elements (button/chip and input share the same slot).
 */
function collectTabFields(): HTMLElement[] {
  // Scope to the workspace area (left panel with action nodes)
  const workspace = document.querySelector<HTMLElement>('[data-workspace]')
  if (!workspace) return []
  const raw = Array.from(workspace.querySelectorAll<HTMLElement>(TAB_FIELD_SELECTOR))
  // Deduplicate: if a VariableInput input is in editing mode, skip its button/chip (they share data-variable-input)
  const seen = new Set<HTMLElement>()
  return raw.filter(el => {
    if (seen.has(el)) return false
    seen.add(el)
    return true
  })
}

/**
 * Focus the next (or previous if shift=true) tab-navigable field in the workspace.
 * For VariableInput elements (buttons/chips), dispatches a click to activate editing mode.
 * Returns true if a target was found and focused.
 */
export function focusNextTabField(current: HTMLElement, reverse = false): boolean {
  const all = collectTabFields()
  if (all.length === 0) return false

  // Find the current element's index
  let idx = all.indexOf(current)
  if (idx === -1) {
    // Try matching by closest tab-field ancestor
    const closest = current.closest<HTMLElement>(`[${TAB_FIELD_ATTR}]`)
    if (closest) idx = all.indexOf(closest)
  }
  if (idx === -1) {
    // Try matching the parent container
    for (let i = 0; i < all.length; i++) {
      if (all[i].contains(current) || current.contains(all[i])) { idx = i; break }
    }
  }
  if (idx === -1) return false

  const nextIdx = reverse
    ? (idx - 1 + all.length) % all.length
    : (idx + 1) % all.length
  const target = all[nextIdx]
  if (!target) return false

  // If target is a VariableInput button/chip, click it to activate editing mode
  if (target.hasAttribute('data-variable-input')) {
    target.click()
    return true
  }

  // If target is a CustomSelect button, click it to open the dropdown
  if (target.hasAttribute('data-custom-select')) {
    target.click()
    return true
  }

  // Regular input/select/textarea — just focus
  target.focus()
  if (target instanceof HTMLInputElement) target.select()
  return true
}

// ── VariableInput Component ───────────────────────────────────────────────────

export interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  availableVars: string[]
  /** Extended var info with source action types (optional, for richer icon display). */
  availableVarInfos?: VarInfo[]
  placeholder?: string
  style?: CSSProperties
  /** Index of the node this input belongs to — used to restrict return value picker to previous nodes. */
  nodeIndex?: number
  /** When true, this input does not accept value drops and shows no drag highlight. */
  noDropTarget?: boolean
  /** When true, hides return-value options from the menu and blocks return-value drops. Variables are still available. */
  noReturnValues?: boolean
  /** Extra menu items rendered at the top of the context menu. */
  extraMenuItems?: { id: string; label: string; icon: string; color?: string; onSelect: () => void }[]
}

/**
 * macOS Shortcuts-style variable input.
 * - Shows as a button by default
 * - Click → context menu: "직접 입력" or "변수 선택"
 * - Variable selection shows available vars with action icons (no $ prefix)
 * - Direct input transforms the button into a text field; Enter confirms
 */
export function VariableInput({
  value,
  onChange,
  availableVars,
  availableVarInfos,
  style,
  nodeIndex,
  noDropTarget,
  noReturnValues,
  extraMenuItems,
}: VariableInputProps): JSX.Element {
  const t = useT()
  const btnRef = useRef<HTMLElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState<number | undefined>(undefined)
  const { requestPick, resolveReturnValueMeta, getAvailableReturnValues } = useContext(ReturnValuePickerContext)
  const { dragState: valueDrag, setForbiddenTooltip } = useContext(ValueDragContext)

  const [mode, setMode] = useState<'button' | 'editing' | 'chip-editing'>('button')
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [menuClamped, setMenuClamped] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [submenuClamped, setSubmenuClamped] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const varSubmenuRef = useRef<HTMLDivElement>(null)
  const [varSubmenuRect, setVarSubmenuRect] = useState<DOMRect | null>(null)

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [focusedLevel, setFocusedLevel] = useState<'main' | 'sub'>('main')
  const [subFocusedIndex, setSubFocusedIndex] = useState(-1)

  // Build var infos from flat list if not provided
  const varInfos: VarInfo[] = useMemo(() => {
    if (availableVarInfos && availableVarInfos.length > 0) return availableVarInfos
    return availableVars.map(name => ({ name, sourceType: 'set-var' }))
  }, [availableVars, availableVarInfos])

  // Determine if current value is a variable reference
  const isVarRef = /^\$\w+$/.test(value.trim())
  const varName = isVarRef ? value.trim().slice(1) : null

  // ── Focus input when switching to edit mode ──────────────────────────────
  useEffect(() => {
    if (mode === 'editing' || mode === 'chip-editing') {
      inputRef.current?.focus()
      if (mode === 'editing') inputRef.current?.select()
    }
  }, [mode])

  // ── Measure content width for auto-sizing ──────────────────────────────
  useLayoutEffect(() => {
    if (measureRef.current) {
      // padding (8px * 2) + border (1px * 2) + small buffer
      const w = measureRef.current.scrollWidth + 18
      setMeasuredWidth(Math.max(w, 30)) // minimum 30px
    }
  }, [value, mode])

  // ── Close menu on outside click or Escape ──────────────────────────────
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      // Skip if clicking on the trigger button/chip/input itself
      if (btnRef.current && btnRef.current.contains(target)) return
      if (chipRef.current && chipRef.current.contains(target)) return
      if (inputRef.current && inputRef.current.contains(target)) return
      if (menuRef.current && !menuRef.current.contains(target) &&
          (!submenuRef.current || !submenuRef.current.contains(target))) {
        setMenuOpen(false)
        setSubmenuOpen(false)
        setFocusedIndex(-1)
        setFocusedLevel('main')
        setSubFocusedIndex(-1)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setSubmenuOpen(false)
        setFocusedIndex(-1)
        setFocusedLevel('main')
        setSubFocusedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  // ── Close editing when window/dialog resizes ───────────────────────────
  useEffect(() => {
    if (mode === 'button') return
    const handleResize = () => {
      setMode('button')
      setMenuOpen(false)
      setSubmenuOpen(false)
      setFocusedIndex(-1)
      setFocusedLevel('main')
      setSubFocusedIndex(-1)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mode])

  // ── Clamp menu to viewport before paint; flip above input if no room below ──
  useLayoutEffect(() => {
    if (menuOpen && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const triggerRect = triggerRectRef.current
      setMenuPos(prev => {
        let { top, left } = prev
        // If menu overflows viewport bottom and there's room above the trigger, flip
        if (triggerRect && top + menuRect.height > window.innerHeight - 8) {
          const aboveTop = triggerRect.top - menuRect.height - 4
          if (aboveTop >= 8) top = aboveTop
        }
        return clampMenuPosition(menuRef.current, { top, left })
      })
      setMenuClamped(true)
    } else {
      setMenuClamped(false)
    }
  }, [menuOpen])

  // Clamp submenu to viewport before paint
  useLayoutEffect(() => {
    if (submenuOpen && submenuRef.current && varSubmenuRect) {
      const el = submenuRef.current
      const rect = el.getBoundingClientRect()
      let top = varSubmenuRect.top
      let left = varSubmenuRect.right + 4
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (left + rect.width > vw - 8) left = varSubmenuRect.left - rect.width - 4
      if (top + rect.height > vh - 8) top = vh - rect.height - 8
      if (left < 8) left = 8
      if (top < 8) top = 8
      el.style.top = `${top}px`
      el.style.left = `${left}px`
      setSubmenuClamped(true)
    } else {
      setSubmenuClamped(false)
    }
  }, [submenuOpen, varSubmenuRect])

  // ── Handle menu item selection ─────────────────────────────────────────

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setSubmenuOpen(false)
    setFocusedIndex(-1)
    setFocusedLevel('main')
    setSubFocusedIndex(-1)
  }, [])

  const handleSelect = useCallback((id: string) => {
    closeMenu()
    setMode('button')
    if (id === '__return_value') {
      requestPick(nodeIndex ?? Infinity, (ref: string) => {
        onChange(ref)
      })
    } else if (id.startsWith('rv:')) {
      // Direct return value selection from suggestions
      onChange(id.slice(3))
    } else if (id.startsWith('var:')) {
      onChange(`$${id.slice(4)}`)
    } else if (id.startsWith('extra:')) {
      const extraItem = extraMenuItems?.find(item => item.id === id.slice(6))
      extraItem?.onSelect()
    }
  }, [requestPick, onChange, nodeIndex, closeMenu, extraMenuItems])

  // ── Build flat menu item list for keyboard navigation ──────────────────

  // Collect return values from preceding nodes for suggestions
  const availableRVs: ReturnValueInfo[] = useMemo(
    () => getAvailableReturnValues(nodeIndex ?? Infinity),
    [getAvailableReturnValues, nodeIndex],
  )

  // Determine suggestion filter mode based on current input value
  const varFilterMatch = /^\$(\w*)$/.exec(value.trim())
  const rvFilterMatch = /^@(\w*)$/.exec(value.trim())
  const isFilterMode = !!(varFilterMatch || rvFilterMatch)

  type MenuItemDef =
    | { kind: 'suggestion-var'; id: string; info: VarInfo }
    | { kind: 'suggestion-rv'; id: string; rv: ReturnValueInfo }
    | { kind: 'var-submenu'; id: string }
    | { kind: 'return-picker'; id: string }
    | { kind: 'extra'; id: string; label: string; icon: string; color?: string }

  const menuItems: MenuItemDef[] = useMemo(() => {
    if (varFilterMatch) {
      // $ mode: show matching variables
      const query = varFilterMatch[1].toLowerCase()
      return varInfos
        .filter(v => !query || v.name.toLowerCase().includes(query))
        .map(v => ({ kind: 'suggestion-var' as const, id: `var:${v.name}`, info: v }))
    }
    if (!noReturnValues && rvFilterMatch) {
      // @ mode: show matching return values
      const query = rvFilterMatch[1].toLowerCase()
      return availableRVs
        .filter(rv => !query || rv.label.toLowerCase().includes(query) || rv.ref.toLowerCase().includes(query))
        .map(rv => ({ kind: 'suggestion-rv' as const, id: `rv:${rv.ref}`, rv }))
    }
    // Normal mode
    const items: MenuItemDef[] = []
    // Extra menu items (e.g. file picker)
    if (extraMenuItems) {
      for (const em of extraMenuItems) {
        items.push({ kind: 'extra', id: `extra:${em.id}`, label: em.label, icon: em.icon, color: em.color })
      }
    }
    // Suggested variables (show all available as quick picks — includes loop scope vars)
    for (const v of varInfos) {
      items.push({ kind: 'suggestion-var', id: `var:${v.name}`, info: v })
    }
    // Suggested return values
    if (!noReturnValues) {
      for (const rv of availableRVs) {
        items.push({ kind: 'suggestion-rv', id: `rv:${rv.ref}`, rv })
      }
    }
    // Variable submenu trigger
    if (varInfos.length > 0) {
      items.push({ kind: 'var-submenu', id: 'var-submenu' })
    }
    // Return value picker
    if (!noReturnValues) {
      items.push({ kind: 'return-picker', id: '__return_value' })
    }
    return items
  }, [varFilterMatch, rvFilterMatch, varInfos, availableRVs, noReturnValues, extraMenuItems])

  // Reset focused index when menu items change
  useEffect(() => { setFocusedIndex(-1); setSubFocusedIndex(-1) }, [menuItems.length])

  // ── Open inline menu on button click ───────────────────────────────────

  // Store the trigger button rect so the layout effect can flip the menu above if needed
  const triggerRectRef = useRef<DOMRect | null>(null)

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // If already editing, keep the menu open — don't toggle
    if (mode === 'editing' || mode === 'chip-editing') return
    if (menuOpen) {
      closeMenu()
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    triggerRectRef.current = rect
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
    setSubmenuOpen(false)
    setMenuOpen(true)
    setFocusedIndex(-1)
    setMode('editing')
  }, [menuOpen, mode, closeMenu])

  const handleChipClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (mode === 'chip-editing') return
    if (menuOpen) {
      closeMenu()
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    triggerRectRef.current = rect
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
    setSubmenuOpen(false)
    setMenuOpen(true)
    setFocusedIndex(-1)
    setMode('chip-editing')
  }, [menuOpen, mode, closeMenu])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // ── Arrow key navigation when menu is open ──────────────────────────
    if (menuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (focusedLevel === 'sub') {
          setSubFocusedIndex(prev => Math.min(prev + 1, varInfos.length - 1))
        } else {
          setFocusedIndex(prev => Math.min(prev + 1, menuItems.length - 1))
        }
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (focusedLevel === 'sub') {
          setSubFocusedIndex(prev => {
            const next = prev - 1
            if (next < 0) { setFocusedLevel('main'); return -1 }
            return next
          })
        } else {
          setFocusedIndex(prev => Math.max(prev - 1, 0))
        }
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const item = menuItems[focusedIndex]
        if (item?.kind === 'var-submenu' && !submenuOpen) {
          // Open submenu
          if (varSubmenuRef.current) {
            setVarSubmenuRect(varSubmenuRef.current.getBoundingClientRect())
          }
          setSubmenuOpen(true)
          setFocusedLevel('sub')
          setSubFocusedIndex(0)
        }
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (focusedLevel === 'sub' && submenuOpen) {
          setSubmenuOpen(false)
          setFocusedLevel('main')
          setSubFocusedIndex(-1)
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (focusedLevel === 'sub' && subFocusedIndex >= 0 && subFocusedIndex < varInfos.length) {
          handleSelect(`var:${varInfos[subFocusedIndex].name}`)
        } else if (focusedIndex >= 0 && focusedIndex < menuItems.length) {
          const item = menuItems[focusedIndex]
          if (item.kind === 'var-submenu') {
            // Toggle submenu
            if (varSubmenuRef.current) {
              setVarSubmenuRect(varSubmenuRef.current.getBoundingClientRect())
            }
            setSubmenuOpen(prev => !prev)
            if (!submenuOpen) { setFocusedLevel('sub'); setSubFocusedIndex(0) }
          } else {
            handleSelect(item.id)
          }
        } else {
          // No item focused — just confirm the typed value
          setMode('button')
          closeMenu()
        }
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setMode('button')
      closeMenu()
      return
    }

    // Tab key: navigate to next/previous editable field
    if (e.key === 'Tab') {
      e.preventDefault()
      closeMenu()
      setMode('button')
      // Use requestAnimationFrame so the button re-renders before we query tab fields
      requestAnimationFrame(() => {
        const el = btnRef.current ?? chipRef.current ?? inputRef.current
        if (el) focusNextTabField(el, e.shiftKey)
      })
      return
    }

    // In chip-editing mode, only allow Backspace/Delete to clear the value
    if (mode === 'chip-editing') {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        onChange('')
        // Switch to editing mode (keep input + menu open) so user can type or pick a new variable
        setMode('editing')
        // Cancel any pending blur timeout to prevent menu from closing
        if (blurTimeoutRef.current) { clearTimeout(blurTimeoutRef.current); blurTimeoutRef.current = null }
      } else {
        e.preventDefault()
      }
    }
  }, [mode, onChange, menuOpen, menuItems, focusedIndex, focusedLevel, subFocusedIndex, varInfos, submenuOpen, handleSelect, closeMenu])

  const handleInputBlur = useCallback(() => {
    if (menuOpen) {
      // Menu is open — refocus input so typing still works (caret hidden via caretColor)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      return
    }
    // Delay to let menu click handlers fire before reverting to button mode
    blurTimeoutRef.current = setTimeout(() => {
      blurTimeoutRef.current = null
      setMode(prev => prev !== 'button' ? 'button' : prev)
      // Also close menu on blur
      setMenuOpen(false)
      setSubmenuOpen(false)
      setFocusedIndex(-1)
      setFocusedLevel('main')
      setSubFocusedIndex(-1)
    }, 150)
  }, [menuOpen])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    // Reset menu item focus (caret) when user types — keyboard input takes over from mouse
    if (menuOpen) {
      setFocusedIndex(-1)
      setFocusedLevel('main')
      setSubFocusedIndex(-1)
      setSubmenuOpen(false)
    }
  }, [onChange, menuOpen])

  // ── Value drag-and-drop handlers ────────────────────────────────────────

  const effectiveNoDropTarget = noDropTarget || noReturnValues
  const isDropAllowed = !effectiveNoDropTarget && valueDrag.active && nodeIndex !== undefined && valueDrag.definedAtIndex < nodeIndex
  const isDropForbidden = !effectiveNoDropTarget && valueDrag.active && nodeIndex !== undefined && valueDrag.definedAtIndex >= nodeIndex

  const handleNativeDragOver = useCallback((e: React.DragEvent) => {
    if (!valueDrag.active) return
    if (isDropAllowed) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
      setForbiddenTooltip({ x: 0, y: 0, visible: false })
    } else if (isDropForbidden) {
      e.dataTransfer.dropEffect = 'none'
      setDragOver(false)
      setForbiddenTooltip({ x: e.clientX, y: e.clientY, visible: true })
    }
  }, [valueDrag.active, isDropAllowed, isDropForbidden, setForbiddenTooltip])

  const handleNativeDragLeave = useCallback(() => {
    setDragOver(false)
    setForbiddenTooltip({ x: 0, y: 0, visible: false })
  }, [setForbiddenTooltip])

  const handleNativeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    setForbiddenTooltip({ x: 0, y: 0, visible: false })
    if (isDropAllowed) {
      onChange(valueDrag.ref)
    }
  }, [isDropAllowed, valueDrag.ref, onChange, setForbiddenTooltip])

  const dropTargetProps = {
    onDragOver: handleNativeDragOver,
    onDragLeave: handleNativeDragLeave,
    onDrop: handleNativeDrop,
  }

  // Blue highlight when a value is being dragged
  const valueDragHighlight: CSSProperties = (!effectiveNoDropTarget && valueDrag.active) ? {
    border: dragOver && isDropAllowed
      ? '1.5px solid #3b82f6'
      : '1px solid rgba(59,130,246,0.45)',
    background: dragOver && isDropAllowed
      ? 'rgba(59,130,246,0.15)'
      : 'rgba(59,130,246,0.06)',
    color: '#60a5fa',
    transition: 'all 0.12s',
  } : {}

  // ── Inline dropdown menu (rendered as portal) ───────────────────────────

  const menuItemStyle = (color?: string, focused?: boolean): CSSProperties => ({
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    color: color || 'var(--c-text)',
    background: focused ? 'var(--c-border)' : 'transparent',
    whiteSpace: 'nowrap',
    fontWeight: 500,
    transition: 'background 0.1s',
    boxSizing: 'border-box',
  })

  const menuContainerStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    background: 'var(--c-elevated)',
    border: '1px solid var(--c-border)',
    borderRadius: 8,
    padding: '4px 0',
    minWidth: 168,
    overflow: 'hidden',
    boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
    userSelect: 'none',
  }

  const separatorEl = <div style={{ height: 1, background: 'var(--c-border-sub, #333)', margin: '4px 0' }} />

  const renderMenu = () => {
    if (!menuOpen) return null

    // ── Filter mode ($ or @) — show flat autocomplete list ──────────────
    if (isFilterMode) {
      return createPortal(
        <div
          ref={menuRef}
          data-no-dnd="true"
          onMouseDown={e => e.preventDefault()}
          style={{ ...menuContainerStyle, top: menuPos.top, left: menuPos.left, visibility: menuClamped ? 'visible' : 'hidden', maxHeight: 260, overflowY: 'auto' }}
        >
          {menuItems.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--c-text-sub, #888)', textAlign: 'center' }}>
              {varFilterMatch ? t('shortcuts.noVarsAvailable') : t('shortcuts.noReturnValsAvailable')}
            </div>
          )}
          {menuItems.map((item, idx) => {
            const isFocused = focusedLevel === 'main' && focusedIndex === idx
            if (item.kind === 'suggestion-var') {
              const color = getSourceColor(item.info.sourceType)
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                  style={menuItemStyle(color, isFocused)}
                >
                  <UIIcon name={getSourceIcon(item.info.sourceType)} size={14} />
                  <span>{item.info.displayLabel ?? item.info.name}</span>
                </div>
              )
            }
            if (item.kind === 'suggestion-rv') {
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                  style={menuItemStyle('#f59e0b', isFocused)}
                >
                  <UIIcon name="output" size={14} />
                  <span>{item.rv.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 'auto' }}>{item.rv.ref}</span>
                </div>
              )
            }
            return null
          })}
        </div>,
        document.body,
      )
    }

    // ── Normal mode — full menu with suggestions + submenu ───────────────

    // Partition menu items into groups for rendering with separators
    const extraItems = menuItems.filter(i => i.kind === 'extra') as Extract<MenuItemDef, { kind: 'extra' }>[]
    const sugVarItems = menuItems.filter(i => i.kind === 'suggestion-var') as Extract<MenuItemDef, { kind: 'suggestion-var' }>[]
    const sugRvItems = menuItems.filter(i => i.kind === 'suggestion-rv') as Extract<MenuItemDef, { kind: 'suggestion-rv' }>[]
    const hasSuggestions = sugVarItems.length > 0 || sugRvItems.length > 0
    const varSubmenuItem = menuItems.find(i => i.kind === 'var-submenu')
    const returnPickerItem = menuItems.find(i => i.kind === 'return-picker')

    // Helper: get the flat index of an item
    const flatIdx = (item: MenuItemDef) => menuItems.indexOf(item)

    return createPortal(
      <>
        {/* Main menu */}
        <div
          ref={menuRef}
          data-no-dnd="true"
          onMouseDown={e => e.preventDefault()}
          style={{ ...menuContainerStyle, top: menuPos.top, left: menuPos.left, visibility: menuClamped ? 'visible' : 'hidden' }}
        >
          {/* Extra menu items (e.g. file picker) */}
          {extraItems.map(item => {
            const idx = flatIdx(item)
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                style={menuItemStyle(item.color || 'var(--c-text)', focusedLevel === 'main' && focusedIndex === idx)}
              >
                <UIIcon name={item.icon} size={14} />
                <span>{item.label}</span>
              </div>
            )
          })}
          {extraItems.length > 0 && (hasSuggestions || varSubmenuItem || returnPickerItem) && separatorEl}

          {/* Suggested variables */}
          {sugVarItems.map(item => {
            const idx = flatIdx(item)
            const color = getSourceColor(item.info.sourceType)
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                style={menuItemStyle(color, focusedLevel === 'main' && focusedIndex === idx)}
              >
                <UIIcon name={getSourceIcon(item.info.sourceType)} size={14} />
                <span>{item.info.displayLabel ?? item.info.name}</span>
              </div>
            )
          })}

          {/* Suggested return values */}
          {sugRvItems.map(item => {
            const idx = flatIdx(item)
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                style={menuItemStyle('#f59e0b', focusedLevel === 'main' && focusedIndex === idx)}
              >
                <UIIcon name="output" size={14} />
                <span>{item.rv.label}</span>
              </div>
            )
          })}

          {/* Separator before 변수 선택 / 반환값 선택 */}
          {hasSuggestions && separatorEl}

          {/* Variable select (submenu trigger) */}
          {varSubmenuItem && (() => {
            const idx = flatIdx(varSubmenuItem)
            const isFocused = focusedLevel === 'main' && focusedIndex === idx
            return (
              <div
                ref={varSubmenuRef}
                onClick={e => {
                  setVarSubmenuRect((e.currentTarget as HTMLElement).getBoundingClientRect())
                  setSubmenuOpen(prev => !prev)
                }}
                onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                style={{ ...menuItemStyle('#a78bfa', isFocused || submenuOpen) }}
              >
                <UIIcon name="variable" size={14} />
                <span style={{ flex: 1 }}>{t('shortcuts.selectVariable')}</span>
                <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>▸</span>
              </div>
            )
          })()}

          {/* Return value select */}
          {returnPickerItem && (() => {
            const idx = flatIdx(returnPickerItem)
            return (
              <div
                onClick={() => { handleSelect('__return_value'); setSubmenuOpen(false) }}
                onMouseEnter={() => { setFocusedIndex(idx); setFocusedLevel('main') }}
                style={menuItemStyle('#f59e0b', focusedLevel === 'main' && focusedIndex === idx)}
              >
                <UIIcon name="output" size={14} />
                <span>{t('shortcuts.selectReturnValue')}</span>
              </div>
            )
          })()}
        </div>

        {/* Variable submenu */}
        {submenuOpen && varInfos.length > 0 && varSubmenuRect && (
          <div
            ref={submenuRef}
            data-no-dnd="true"
            onMouseDown={e => e.preventDefault()}
            style={{
              ...menuContainerStyle,
              top: varSubmenuRect.top,
              left: varSubmenuRect.right + 4,
              maxHeight: 240,
              overflowY: 'auto',
              visibility: submenuClamped ? 'visible' : 'hidden',
            }}
          >
            {varInfos.map((v, vIdx) => {
              const isFocused = focusedLevel === 'sub' && subFocusedIndex === vIdx
              return (
                <div
                  key={`var:${v.name}`}
                  onClick={() => handleSelect(`var:${v.name}`)}
                  onMouseEnter={() => { setSubFocusedIndex(vIdx); setFocusedLevel('sub') }}
                  style={menuItemStyle(getSourceColor(v.sourceType), isFocused)}
                >
                  <UIIcon name={getSourceIcon(v.sourceType)} size={14} />
                  <span>{v.displayLabel ?? v.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </>,
      document.body,
    )
  }

  // ── Input style ──────────────────────────────────────────────────────────

  const baseStyle: CSSProperties = {
    borderRadius: 6,
    color: 'var(--c-text)',
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    ...style,
    background: 'var(--c-accent-bg)',
    border: '1px solid var(--c-accent-border)',
    fontWeight: 600,
    ...valueDragHighlight,
  }

  // ── Edit mode: text input ────────────────────────────────────────────────

  // Hidden span for measuring text width
  const measurer = (
    <span
      ref={measureRef}
      aria-hidden
      style={{
        position: 'absolute',
        visibility: 'hidden',
        height: 0,
        overflow: 'hidden',
        whiteSpace: 'pre',
        fontSize: 12,
        fontFamily: 'inherit',
        fontWeight: 600,
        pointerEvents: 'none',
      }}
    >
      {value || ' '}
    </span>
  )

  if (mode === 'editing' || mode === 'chip-editing') {
    return (
      <>
        {measurer}
        <input
          ref={inputRef}
          value={value}
          onChange={mode === 'chip-editing' ? undefined : handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          readOnly={mode === 'chip-editing'}
          data-no-dnd="true"
          data-tab-field=""
          data-variable-input=""
          size={1}
          {...dropTargetProps}
          style={{
            ...baseStyle,
            width: value ? measuredWidth : undefined,
            overflow: 'hidden',
            height: 26,
            lineHeight: '16px',
            cursor: mode === 'chip-editing' ? 'default' : 'text',
            caretColor: (mode === 'chip-editing' || menuOpen) ? 'transparent' : undefined,
          }}
        />
        {renderMenu()}
      </>
    )
  }

  // ── Button mode (default) ────────────────────────────────────────────────

  // Find var info for display
  const matchedVar = varName ? varInfos.find(v => v.name === varName) : null

  // Try to resolve return-value source node meta for richer display
  const rvMeta = isVarRef ? resolveReturnValueMeta(value.trim()) : null

  // ── Variable / return value assigned → chip replaces input ────────────────
  if (isVarRef && varName) {
    const chipEl = rvMeta ? (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        background: `${rvMeta.color}18`,
        color: rvMeta.color,
        fontWeight: 600,
        fontSize: 11,
        fontFamily: 'monospace',
        lineHeight: '1.6',
        cursor: 'pointer',
      }}>
        <UIIcon name={rvMeta.icon} size={12} />
        {rvMeta.label}
      </span>
    ) : (() => {
      const color = getSourceColor(matchedVar?.sourceType ?? 'set-var')
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          background: `${color}18`,
          color,
          fontWeight: 600,
          fontSize: 11,
          fontFamily: 'monospace',
          lineHeight: '1.6',
          cursor: 'pointer',
        }}>
          <UIIcon name={getSourceIcon(matchedVar?.sourceType ?? 'set-var')} size={12} />
          {matchedVar?.displayLabel ?? varName}
        </span>
      )
    })()

    return (
      <>
        {measurer}
        <div
          ref={chipRef}
          onClick={handleChipClick}
          data-no-dnd="true"
          data-tab-field=""
          data-variable-input=""
          {...dropTargetProps}
          style={{
            display: 'inline-flex', alignItems: 'center',
            borderRadius: 6,
            background: 'var(--c-accent-bg)',
            border: '1px solid var(--c-accent-border)',
            padding: '2px 4px',
            ...style,
            ...(!effectiveNoDropTarget && valueDrag.active ? {
              border: dragOver && isDropAllowed
                ? '1.5px solid #3b82f6'
                : '1px solid rgba(59,130,246,0.35)',
              background: dragOver && isDropAllowed
                ? 'rgba(59,130,246,0.12)'
                : 'rgba(59,130,246,0.04)',
              transition: 'all 0.12s',
            } : {}),
          }}
        >
          {chipEl}
        </div>
        {renderMenu()}
      </>
    )
  }

  // ── Render value with inline variable chips ─────────────────────────────
  const renderValueWithVarChips = (text: string) => {
    // Split on $varName patterns, keeping the delimiters
    const parts = text.split(/(\$\w+)/g)
    if (parts.length === 1) return <>{text}</>
    return (
      <>
        {parts.map((part, i) => {
          if (/^\$\w+$/.test(part)) {
            const vName = part.slice(1)
            const vInfo = varInfos.find(v => v.name === vName)
            const color = getSourceColor(vInfo?.sourceType ?? 'set-var')
            return (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                padding: '1px 5px',
                borderRadius: 4,
                background: `${color}18`,
                color,
                fontWeight: 600,
                fontSize: 11,
                fontFamily: 'monospace',
                lineHeight: '1.4',
                flexShrink: 0,
              }}>
                <UIIcon name={getSourceIcon(vInfo?.sourceType ?? 'set-var')} size={11} />
                {vInfo?.displayLabel ?? vName}
              </span>
            )
          }
          return part ? <span key={i}>{part}</span> : null
        })}
      </>
    )
  }

  // ── Button mode (no variable assigned) ──────────────────────────────────
  return (
    <>
      {measurer}
      <button
        ref={btnRef as React.RefObject<HTMLButtonElement>}
        onClick={handleButtonClick}
        data-no-dnd="true"
        data-tab-field=""
        data-variable-input=""
        title={value || undefined}
        {...dropTargetProps}
        style={{
          ...baseStyle,
          width: value ? measuredWidth : undefined,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          overflow: 'hidden',
          height: 26,
        }}
      >
        {value && (
          <span style={{
            color: 'var(--c-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontWeight: 600,
          }}>
            {renderValueWithVarChips(value)}
          </span>
        )}
      </button>
      {renderMenu()}
    </>
  )
}
