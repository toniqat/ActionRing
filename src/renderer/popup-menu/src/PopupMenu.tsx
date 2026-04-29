import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import type { PopupMenuItem } from '@shared/ipc.types'
import { UIIcon } from '@shared/UIIcon'

declare global {
  interface Window {
    popupMenuAPI: {
      onInit: (cb: (data: { items: PopupMenuItem[]; theme: string }) => void) => void
      selectItem: (itemId: string) => void
      dismiss: () => void
      resize: (width: number, height: number) => void
      showSubmenu: (items: PopupMenuItem[], screenX: number, screenY: number) => void
      closeSubmenu: () => void
    }
  }
}

export function PopupMenu(): JSX.Element | null {
  const [items, setItems] = useState<PopupMenuItem[]>([])
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredSubmenuId, setHoveredSubmenuId] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Receive items from main process
  useEffect(() => {
    window.popupMenuAPI.onInit((data) => {
      setItems(data.items)
      setReady(true)
    })
  }, [])

  // After rendering, measure content and request window resize
  useLayoutEffect(() => {
    if (!ready || !containerRef.current) return
    const el = containerRef.current
    // Add small padding for shadow/border
    const width = Math.max(el.scrollWidth + 2, 160)
    const height = el.scrollHeight + 2
    window.popupMenuAPI.resize(width, height)
  }, [ready, items])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.popupMenuAPI.dismiss()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Clean up hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const handleItemClick = useCallback((item: PopupMenuItem) => {
    if (item.submenu && item.submenu.length > 0) {
      // For submenu items, click triggers submenu display
      return
    }
    window.popupMenuAPI.selectItem(item.id)
  }, [])

  const handleSubmenuEnter = useCallback((item: PopupMenuItem, e: React.MouseEvent) => {
    if (!item.submenu || item.submenu.length === 0) {
      // Not a submenu item — close any open submenu
      if (hoveredSubmenuId) {
        setHoveredSubmenuId(null)
        window.popupMenuAPI.closeSubmenu()
      }
      return
    }
    // Debounce submenu open
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHoveredSubmenuId(item.id)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const menuRect = containerRef.current?.getBoundingClientRect()
      const screenX = window.screenX + (menuRect ? menuRect.right : rect.right) + 2
      const screenY = window.screenY + rect.top
      window.popupMenuAPI.showSubmenu(item.submenu!, screenX, screenY)
    }, 120)
  }, [hoveredSubmenuId])

  const handleMenuMouseLeave = useCallback(() => {
    // Small delay before closing submenu to allow mouse to move to submenu window
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }, [])

  if (!ready) return null

  return (
    <div
      ref={containerRef}
      onMouseLeave={handleMenuMouseLeave}
      style={{
        background: 'var(--c-elevated, #1e1e2e)',
        border: '1px solid var(--c-border, #333)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        padding: '4px 0',
        minWidth: 160,
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${i}`}
              style={{
                height: 1,
                background: 'var(--c-border-sub, #333)',
                margin: '4px 0',
              }}
            />
          )
        }

        const isSubmenu = item.submenu && item.submenu.length > 0
        const isActive = hoveredSubmenuId === item.id

        return (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            onMouseEnter={(e) => handleSubmenuEnter(item, e)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: item.iconColor || 'var(--c-text, #e0e0e0)',
              background: isActive ? 'var(--c-hover, rgba(255,255,255,0.08))' : 'transparent',
              transition: 'background 0.1s',
              paddingRight: isSubmenu ? 8 : 12,
            }}
            onMouseOver={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--c-hover, rgba(255,255,255,0.08))'
            }}
            onMouseOut={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {item.icon && (
              <span style={{ color: item.iconColor || 'currentColor', flexShrink: 0, display: 'flex' }}>
                <UIIcon name={item.icon} size={14} />
              </span>
            )}
            <span style={{
              flex: 1,
              fontWeight: 500,
              fontFamily: item.id.startsWith('var:') ? 'monospace' : 'inherit',
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>
            {isSubmenu && (
              <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4, flexShrink: 0 }}>▸</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
