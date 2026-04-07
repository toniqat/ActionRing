import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useT } from '../../i18n/I18nContext'
import type { Translations } from '../../i18n/locales'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ActionConfig, SystemActionId } from '@shared/config.types'
import { UIIcon } from '@shared/UIIcon'

// ─── Node visual config ────────────────────────────────────────────────────────

type NodeStyle = Record<string, { label: string; icon: string; color: string; desc: string }>

function getNodeStyle(t: (key: keyof Translations) => string): NodeStyle {
  return {
    launch:         { label: t('action.launch'),      icon: 'launch',       color: '#3b82f6', desc: t('action.launchDesc') },
    keyboard:       { label: t('action.keyboard'),    icon: 'keyboard',     color: '#8b5cf6', desc: t('action.keyboardDesc') },
    shell:          { label: t('action.shell'),       icon: 'shell',        color: '#10b981', desc: t('action.shellDesc') },
    system:         { label: t('action.system'),      icon: 'system',       color: '#f59e0b', desc: t('action.systemDesc') },
    link:           { label: t('action.link'),        icon: 'action_link',  color: '#06b6d4', desc: t('action.linkDesc') },
    'mouse-move':   { label: t('action.mouseMove'),   icon: 'mouse_move',   color: '#8b5cf6', desc: t('action.mouseMoveDesc') },
    'mouse-click':  { label: t('action.mouseClick'),  icon: 'mouse_click',  color: '#8b5cf6', desc: t('action.mouseClickDesc') },
  }
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

function generateNodeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ActionNode {
  _id: string
  action: ActionConfig
}

// ─── SortableNode ──────────────────────────────────────────────────────────────

interface SortableNodeProps {
  node: ActionNode
  onChange: (action: ActionConfig) => void
  onDelete: () => void
}

function SortableNode({ node, onChange, onDelete }: SortableNodeProps): JSX.Element {
  const t = useT()
  const NODE_STYLE = getNodeStyle(t)
  const { action } = node
  const cfg = NODE_STYLE[action.type] ?? NODE_STYLE.shell
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node._id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--c-elevated)',
          border: `1px solid var(--c-border)`,
          borderLeft: `3px solid ${cfg.color}`,
          marginBottom: 8,
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        {/* Drag handle (visual indicator) */}
        <div
          style={{
            color: 'var(--c-text-dim)',
            fontSize: 14,
            lineHeight: 1,
            paddingTop: 2,
            flexShrink: 0,
            userSelect: 'none',
          }}
          title={t('modal.dragToReorder')}
        >⣿</div>

        {/* Icon */}
        <div style={{ flexShrink: 0, color: cfg.color }}><UIIcon name={cfg.icon} size={16} /></div>

        {/* Content */}
        <div
          style={{ flex: 1, minWidth: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color, marginBottom: 6 }}>
            {cfg.label}
          </div>
          <NodeFields action={action} onChange={onChange} />
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--c-text-dim)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
            borderRadius: 4,
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-dim)' }}
          title={t('modal.remove')}
        ><UIIcon name="close" size={14} /></button>
      </div>
    </div>
  )
}

// ─── ShortcutRecorder ─────────────────────────────────────────────────────────

/**
 * Builds a display-format key combo string from a DOM KeyboardEvent.
 * e.g. Ctrl+Shift+A, Alt+F4, Win+D
 */
function buildKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey)  parts.push('Win')

  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    if (key === ' ')        parts.push('Space')
    else if (key.length === 1) parts.push(key.toUpperCase())
    else                    parts.push(key)   // F1, ArrowUp, Backspace, etc.
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
    if (save && pendingRef.current) {
      onChange(pendingRef.current)
    }
  }, [onChange])

  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip events fired during IME composition (e.g. Korean/Chinese input)
      if (e.isComposing) return
      // Escape cancels without saving
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
    // Ignore keyboard-triggered clicks (Enter/Space) so they don't stop recording
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
    ? (pendingDisplay || t('recorder.pressKeys'))
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
          {recording ? `${t('recorder.recording')} ${pendingDisplay}` : displayText}
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

// ─── NodeFields ────────────────────────────────────────────────────────────────

function NodeFields({ action, onChange }: { action: ActionConfig; onChange: (a: ActionConfig) => void }): JSX.Element {
  const t = useT()
  const SYSTEM_LABELS = getSystemLabels(t)
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--c-input-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 6,
    color: 'var(--c-text)',
    padding: '5px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  if (action.type === 'launch') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={action.target}
          onChange={(e) => onChange({ type: 'launch', target: e.target.value })}
          placeholder={t('modal.appPath')}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={async () => {
            const path = await window.settingsAPI.pickExe()
            if (path) onChange({ type: 'launch', target: path })
          }}
          style={{
            background: 'var(--c-input-bg)',
            border: '1px solid var(--c-border)',
            borderRadius: 6,
            color: 'var(--c-text-muted)',
            padding: '4px 8px',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >{t('modal.browse')}</button>
      </div>
    )
  }

  if (action.type === 'keyboard') {
    return (
      <ShortcutRecorder
        value={action.keys}
        onChange={(keys) => onChange({ type: 'keyboard', keys })}
      />
    )
  }

  if (action.type === 'shell') {
    return (
      <input
        value={action.command}
        onChange={(e) => onChange({ type: 'shell', command: e.target.value })}
        placeholder={t('modal.shellCmd')}
        style={inputStyle}
      />
    )
  }

  if (action.type === 'system') {
    return (
      <select
        value={action.action}
        onChange={(e) => onChange({ type: 'system', action: e.target.value as SystemActionId })}
        style={inputStyle}
      >
        {SYSTEM_ACTIONS.map((a) => (
          <option key={a} value={a}>{SYSTEM_LABELS[a]}</option>
        ))}
      </select>
    )
  }

  if (action.type === 'link') {
    return (
      <input
        value={action.url}
        onChange={(e) => onChange({ type: 'link', url: e.target.value })}
        placeholder="https://..."
        style={inputStyle}
      />
    )
  }

  return <></>
}

// ─── ShortcutsModal ────────────────────────────────────────────────────────────

interface ShortcutsModalProps {
  actions: ActionConfig[]
  onSave: (actions: ActionConfig[]) => void
  onClose: () => void
}

export function ShortcutsModal({ actions, onSave, onClose }: ShortcutsModalProps): JSX.Element {
  const t = useT()
  const [nodes, setNodes] = useState<ActionNode[]>(() =>
    actions.map((a) => ({ _id: generateNodeId(), action: a }))
  )
  const [search, setSearch] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setNodes((prev) => {
        const oldIdx = prev.findIndex((n) => n._id === active.id)
        const newIdx = prev.findIndex((n) => n._id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }, [])

  const addNode = (type: keyof typeof localNodeStyle) => {
    let action: ActionConfig
    if (type === 'launch') action = { type: 'launch', target: '' }
    else if (type === 'keyboard') action = { type: 'keyboard', keys: '' }
    else if (type === 'shell') action = { type: 'shell', command: '' }
    else if (type === 'link') action = { type: 'link', url: '' }
    else if (type === 'mouse-move') action = { type: 'mouse-move', mode: 'set', x: '0', y: '0' }
    else if (type === 'mouse-click') action = { type: 'mouse-click', button: 'left' }
    else action = { type: 'system', action: 'volume-up' }
    setNodes((prev) => [...prev, { _id: generateNodeId(), action }])
  }

  const updateNode = (id: string, action: ActionConfig) => {
    setNodes((prev) => prev.map((n) => n._id === id ? { ...n, action } : n))
  }

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n._id !== id))
  }

  const handleSave = () => {
    onSave(nodes.map((n) => n.action))
  }

  const localNodeStyle = getNodeStyle(t)
  const libraryTypes = Object.entries(localNodeStyle).filter(([key]) =>
    !search || key.includes(search.toLowerCase()) || localNodeStyle[key].label.toLowerCase().includes(search.toLowerCase())
  ).sort(([, a], [, b]) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal card */}
      <div
        style={{
          width: 760,
          height: 540,
          background: 'var(--c-surface)',
          borderRadius: 14,
          border: '1px solid var(--c-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--c-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{t('modal.editShortcuts')}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--c-text-dim)', cursor: 'pointer',
              borderRadius: 4, padding: '2px 6px',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center',
            }}
          ><UIIcon name="close" size={16} /></button>
        </div>

        {/* Body: workspace + library */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* ─── Workspace (left) ─── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--c-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 16px 8px',
                fontSize: 10,
                color: 'var(--c-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid var(--c-border-sub)',
                flexShrink: 0,
              }}
            >
              {t('modal.sequence')}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {nodes.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--c-text-dim)',
                    fontSize: 13,
                    padding: '40px 20px',
                  }}
                >
                  {t('modal.noActionsYet')}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={nodes.map((n) => n._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {nodes.map((node) => (
                      <SortableNode
                        key={node._id}
                        node={node}
                        onChange={(action) => updateNode(node._id, action)}
                        onDelete={() => deleteNode(node._id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* ─── Library (right) ─── */}
          <div
            style={{
              width: 224,
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Search */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border-sub)', flexShrink: 0 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('modal.searchActions')}
                style={{
                  width: '100%',
                  background: 'var(--c-input-bg)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 6,
                  color: 'var(--c-text)',
                  padding: '5px 8px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Action type list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {libraryTypes.map(([type, cfg]: [string, { label: string; icon: string; color: string; desc: string }]) => (
                <button
                  key={type}
                  onClick={() => addNode(type as keyof typeof localNodeStyle)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: 2,
                    transition: 'background 0.1s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--c-elevated)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: cfg.color + '22',
                      border: `1px solid ${cfg.color}55`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: cfg.color,
                    }}
                  ><UIIcon name={cfg.icon} size={13} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--c-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 20px',
            borderTop: '1px solid var(--c-border)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: 7,
              border: '1px solid var(--c-border)',
              background: 'none',
              color: 'var(--c-text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >{t('modal.cancel')}</button>
          <button
            onClick={handleSave}
            style={{
              padding: '7px 18px',
              borderRadius: 7,
              border: 'none',
              background: 'var(--c-accent)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >{t('modal.save')}</button>
        </div>
      </div>
    </div>
  )
}
