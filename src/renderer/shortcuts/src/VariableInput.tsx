import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type {
  ActionConfig, SetVarAction, CalculateAction, LoopAction, RunShortcutAction,
} from '@shared/config.types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionNode {
  _id: string
  action: ActionConfig
}

/** A parsed segment of a VariableInput value. */
type Segment = { type: 'text'; value: string } | { type: 'var'; name: string }

// ── Variable collection utility ───────────────────────────────────────────────

/**
 * Collects variable names produced by nodes preceding `beforeIndex`.
 * Scans set-var, calculate, loop (iterVar/itemVar), and run-shortcut (outputVar).
 */
export function collectAvailableVars(
  nodes: ActionNode[],
  beforeIndex: number,
  parentVars: string[] = [],
): string[] {
  const vars = new Set<string>(parentVars)

  for (let i = 0; i < beforeIndex && i < nodes.length; i++) {
    const a = nodes[i].action
    switch (a.type) {
      case 'set-var': {
        const sv = a as SetVarAction
        const op = sv.operation ?? 'set'
        if (op === 'set' || op === 'push') vars.add(sv.name)
        if (op === 'get' && sv.resultVar) vars.add(sv.resultVar)
        break
      }
      case 'calculate': {
        const ca = a as CalculateAction
        if (ca.resultVar) vars.add(ca.resultVar)
        break
      }
      case 'loop': {
        const la = a as LoopAction
        const mode = la.mode ?? 'repeat'
        if (mode === 'for' && la.iterVar) vars.add(la.iterVar)
        if (mode === 'foreach' && la.itemVar) vars.add(la.itemVar)
        break
      }
      case 'run-shortcut': {
        const rs = a as RunShortcutAction
        if (rs.outputVar) vars.add(rs.outputVar)
        break
      }
    }
  }

  return Array.from(vars).sort()
}

// ── Parsing ───────────────────────────────────────────────────────────────────

const VAR_REGEX = /\$(\w+)/g

function parseSegments(value: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  VAR_REGEX.lastIndex = 0
  while ((match = VAR_REGEX.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'var', name: match[1] })
    lastIndex = VAR_REGEX.lastIndex
  }
  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) })
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', value: '' })
  }
  return segments
}


// ── Chip color utility ────────────────────────────────────────────────────────

const CHIP_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#84cc16',
]

function chipColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length]
}

// ── VariableInput Component ───────────────────────────────────────────────────

export interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  availableVars: string[]
  placeholder?: string
  style?: CSSProperties
}

export function VariableInput({
  value,
  onChange,
  availableVars,
  placeholder,
  style,
}: VariableInputProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerFilter, setPickerFilter] = useState('')
  const [pickerIndex, setPickerIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  const segments = useMemo(() => parseSegments(value), [value])

  const filteredVars = useMemo(() => {
    if (!pickerFilter) return availableVars
    const lower = pickerFilter.toLowerCase()
    return availableVars.filter((v) => v.toLowerCase().includes(lower))
  }, [availableVars, pickerFilter])

  // Reset picker index when filter changes
  useEffect(() => {
    setPickerIndex(0)
  }, [filteredVars.length])

  // ── Serialization helper ──────────────────────────────────────────────────

  const readFromDom = useCallback((): string => {
    const el = containerRef.current
    if (!el) return value
    let result = ''
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? ''
      } else if (node instanceof HTMLElement) {
        const varName = node.getAttribute('data-var')
        if (varName) {
          result += `$${varName}`
        } else {
          result += node.textContent ?? ''
        }
      }
    })
    return result
  }, [value])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleInput = useCallback(() => {
    const newValue = readFromDom()
    // Check if the user just typed a '$' — open picker
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const textNode = range.startContainer
      if (textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent ?? ''
        const pos = range.startOffset
        // Find the $ trigger
        const beforeCursor = text.slice(0, pos)
        const dollarIdx = beforeCursor.lastIndexOf('$')
        if (dollarIdx >= 0) {
          const partial = beforeCursor.slice(dollarIdx + 1)
          // Only trigger if $ is at the end or followed by word chars only
          if (/^\w*$/.test(partial)) {
            setPickerFilter(partial)
            setShowPicker(true)
            onChange(newValue)
            return
          }
        }
      }
    }
    setShowPicker(false)
    onChange(newValue)
  }, [onChange, readFromDom])

  const insertVariable = useCallback((varName: string) => {
    const el = containerRef.current
    if (!el) return

    // Remove the partial $... text that triggered the picker
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const textNode = range.startContainer
      if (textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent ?? ''
        const pos = range.startOffset
        const beforeCursor = text.slice(0, pos)
        const dollarIdx = beforeCursor.lastIndexOf('$')
        if (dollarIdx >= 0) {
          // Remove from $ to cursor
          textNode.textContent = text.slice(0, dollarIdx) + text.slice(pos)
          // Set cursor position for insertion
          const insertRange = document.createRange()
          insertRange.setStart(textNode, dollarIdx)
          insertRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(insertRange)
        }
      }
    }

    // Create chip element
    const chip = createChipElement(varName)

    // Insert chip at cursor
    const selAfter = window.getSelection()
    if (selAfter && selAfter.rangeCount > 0) {
      const range = selAfter.getRangeAt(0)
      range.deleteContents()
      range.insertNode(chip)
      // Move cursor after chip
      const newRange = document.createRange()
      newRange.setStartAfter(chip)
      newRange.collapse(true)
      selAfter.removeAllRanges()
      selAfter.addRange(newRange)
    }

    setShowPicker(false)
    setPickerFilter('')
    onChange(readFromDom())
  }, [onChange, readFromDom])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showPicker) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPickerIndex((prev) => Math.min(prev + 1, filteredVars.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPickerIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filteredVars.length > 0) {
          insertVariable(filteredVars[pickerIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowPicker(false)
      }
    }
  }, [showPicker, filteredVars, pickerIndex, insertVariable])

  const handleFocus = useCallback(() => setIsFocused(true), [])
  const handleBlur = useCallback(() => {
    // Delay to allow picker click to register
    setTimeout(() => {
      setIsFocused(false)
      setShowPicker(false)
    }, 200)
  }, [])

  // ── Sync DOM from value (on external value change) ────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Only sync if the DOM is not focused (avoids cursor jump during typing)
    if (document.activeElement === el) return

    // Build new DOM content
    const frag = document.createDocumentFragment()
    for (const seg of segments) {
      if (seg.type === 'text') {
        frag.appendChild(document.createTextNode(seg.value))
      } else {
        frag.appendChild(createChipElement(seg.name))
      }
    }
    el.innerHTML = ''
    el.appendChild(frag)
  }, [segments])

  // ── Render ────────────────────────────────────────────────────────────────

  const isEmpty = !value

  return (
    <div style={{ position: 'relative', flex: style?.flex, minWidth: style?.minWidth, width: style?.width }}>
      <div
        ref={containerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-placeholder={placeholder}
        style={{
          ...style,
          flex: undefined,
          minWidth: undefined,
          width: '100%',
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          minHeight: 24,
          outline: 'none',
          cursor: 'text',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: isEmpty && !isFocused ? 'var(--c-text-dim)' : undefined,
        }}
      />

      {/* Placeholder */}
      {isEmpty && !isFocused && placeholder && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: typeof style?.padding === 'number' ? style.padding : (typeof style?.paddingLeft === 'number' ? style.paddingLeft : 8),
            color: 'var(--c-text-dim)',
            fontSize: style?.fontSize ?? 12,
            pointerEvents: 'none',
            opacity: 0.6,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {placeholder}
        </div>
      )}

      {/* Variable Picker Dropdown */}
      {showPicker && isFocused && filteredVars.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 2,
            minWidth: 160,
            maxHeight: 180,
            overflowY: 'auto',
            background: 'var(--c-elevated, #1e1e2e)',
            border: '1px solid var(--c-border, #333)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 999,
            padding: '4px 0',
          }}
        >
          {filteredVars.map((v, i) => (
            <div
              key={v}
              onMouseDown={(e) => {
                e.preventDefault()
                insertVariable(v)
              }}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: i === pickerIndex ? 'var(--c-hover, rgba(255,255,255,0.08))' : 'transparent',
                color: 'var(--c-text, #e0e0e0)',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 8, height: 8, borderRadius: 2,
                background: chipColor(v),
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'monospace' }}>${v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chip DOM element factory ──────────────────────────────────────────────────

function createChipElement(varName: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.setAttribute('data-var', varName)
  chip.contentEditable = 'false'
  chip.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    margin: 0 1px;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
    line-height: 1.4;
    vertical-align: baseline;
    cursor: default;
    user-select: none;
    background: ${chipColor(varName)}22;
    color: ${chipColor(varName)};
    border: 1px solid ${chipColor(varName)}44;
  `
  chip.textContent = `$${varName}`

  // Close button
  const closeBtn = document.createElement('span')
  closeBtn.textContent = '\u00d7'
  closeBtn.style.cssText = `
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    opacity: 0.6;
    margin-left: 1px;
  `
  closeBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    chip.remove()
    // Trigger input event on parent
    const container = chip.parentElement
    if (container) {
      container.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  chip.appendChild(closeBtn)

  return chip
}
