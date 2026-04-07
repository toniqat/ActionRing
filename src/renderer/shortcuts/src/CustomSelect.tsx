import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { clampMenuPosition, focusNextTabField } from './VariableInput'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
  /** Optional icon element rendered before label */
  icon?: React.ReactNode
  /** Optional color for the label text */
  color?: string
}

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Inline style applied to the trigger button */
  style?: CSSProperties
  /** data-no-dnd passthrough */
  'data-no-dnd'?: string
}

// ── Styles (matching VariableInput context menu) ─────────────────────────────

const menuContainerStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 99999,
  background: 'var(--c-elevated, #1e1e2e)',
  border: '1px solid var(--c-border, #333)',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  padding: '4px 0',
  minWidth: 100,
  overflow: 'hidden',
}

const menuItemBase: CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  color: 'var(--c-text, #e0e0e0)',
  background: 'transparent',
  borderRadius: 4,
  margin: '1px 4px',
  whiteSpace: 'nowrap',
  fontWeight: 500,
  transition: 'background 0.08s',
}

// ── Component ────────────────────────────────────────────────────────────────

export function CustomSelect({
  value,
  onChange,
  options,
  style,
  ...rest
}: CustomSelectProps): JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [clamped, setClamped] = useState(false)
  const triggerRectRef = useRef<DOMRect | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // ── Open/close ──────────────────────────────────────────────────────────

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (open) { setOpen(false); setFocusedIndex(-1); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    triggerRectRef.current = rect
    setMenuPos({ top: rect.bottom + 4, left: rect.left })
    setFocusedIndex(-1)
    setOpen(true)
  }, [open])

  // ── Close on outside click / Escape ─────────────────────────────────────

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFocusedIndex(-1)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setFocusedIndex(-1)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        setOpen(false)
        setFocusedIndex(-1)
        requestAnimationFrame(() => {
          if (btnRef.current) focusNextTabField(btnRef.current, e.shiftKey)
        })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(prev => Math.min(prev + 1, options.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          onChange(options[focusedIndex].value)
          setOpen(false)
          setFocusedIndex(-1)
        }
      }
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, focusedIndex, options, onChange])

  // ── Clamp to viewport ──────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (open && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const trigger = triggerRectRef.current
      setMenuPos(prev => {
        let { top, left } = prev
        if (trigger && top + menuRect.height > window.innerHeight - 8) {
          const above = trigger.top - menuRect.height - 4
          if (above >= 8) top = above
        }
        return clampMenuPosition(menuRef.current, { top, left })
      })
      setClamped(true)
    } else {
      setClamped(false)
    }
  }, [open])

  // ── Selected label ─────────────────────────────────────────────────────

  const selected = options.find(o => o.value === value)

  // Tab navigation when closed (button focused but menu not open)
  const handleButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !open) {
      e.preventDefault()
      requestAnimationFrame(() => {
        if (btnRef.current) focusNextTabField(btnRef.current, e.shiftKey)
      })
    }
  }, [open])

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        onKeyDown={handleButtonKeyDown}
        data-no-dnd={rest['data-no-dnd'] ?? 'true'}
        data-tab-field=""
        data-custom-select=""
        style={{
          ...style,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          overflow: 'hidden',
        }}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {selected?.label ?? value}
        </span>
        <span style={{ fontSize: 8, opacity: 0.45, flexShrink: 0, marginLeft: 2 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          data-no-dnd="true"
          style={{
            ...menuContainerStyle,
            top: menuPos.top,
            left: menuPos.left,
            visibility: clamped ? 'visible' : 'hidden',
          }}
        >
          {options.map((opt, idx) => {
            const isActive = opt.value === value
            const isFocused = focusedIndex === idx
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); setFocusedIndex(-1) }}
                onMouseEnter={() => setFocusedIndex(idx)}
                style={{
                  ...menuItemBase,
                  ...(opt.color ? { color: opt.color } : {}),
                  background: isFocused ? 'rgba(255,255,255,0.14)' : isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                }}
              >
                {opt.icon}
                <span>{opt.label}</span>
                {isActive && <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>✓</span>}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
