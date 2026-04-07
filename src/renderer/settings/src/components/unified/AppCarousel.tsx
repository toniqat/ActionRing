import {
  useState, useRef, useEffect, useCallback, useLayoutEffect,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { useT } from '../../i18n/I18nContext'
import { AddAppOverlay } from './AddAppOverlay'
import { UIIcon } from '@shared/UIIcon'
import type { AppEntry, AppProfile } from '@shared/config.types'

// ── Constants (≈50% smaller than original) ───────────────────────────────────

const ITEM_WIDTH = 40
const ITEM_GAP   = 4
const ITEM_STEP  = ITEM_WIDTH + ITEM_GAP
const NAV_BTN_W  = 20
const ICON_SIZE  = 22

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return h % 360
}

// ── Default System icon ───────────────────────────────────────────────────────

function DefaultSystemIcon({ size }: { size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── App Icon ──────────────────────────────────────────────────────────────────

function AppIcon({
  app,
  isActive,
  isHovered = false,
  size = ICON_SIZE,
}: {
  app: AppEntry
  isActive: boolean
  isHovered?: boolean
  size?: number
}): JSX.Element {
  const highlighted = isActive || isHovered
  const color = highlighted ? 'var(--c-accent)' : 'var(--c-text-muted)'

  if (app.id === 'default') {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        <DefaultSystemIcon size={size * 0.8} />
      </div>
    )
  }

  if (app.iconDataUrl) {
    return (
      <img
        src={app.iconDataUrl}
        style={{
          width: size, height: size,
          objectFit: 'contain',
          borderRadius: 5,
          opacity: highlighted ? 1 : 0.55,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
    )
  }

  const hue = nameHue(app.displayName)
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: 6,
        background: highlighted
          ? `hsl(${hue}, 60%, 45%)`
          : `hsl(${hue}, 40%, 32%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.32,
        fontWeight: 700,
        color: '#fff',
        opacity: highlighted ? 1 : 0.55,
        transition: 'opacity 0.2s ease-in-out, background 0.2s ease-in-out',
        userSelect: 'none',
      }}
    >
      {initials(app.displayName)}
    </div>
  )
}

// ── Profile Context Menu ──────────────────────────────────────────────────────

function ProfileContextMenu({
  canDelete,
  pos,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  onClose,
  menuRef,
}: {
  canDelete: boolean
  pos: { top: number; left: number }
  onRename: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
  onClose: () => void
  menuRef: React.RefObject<HTMLDivElement>
}): JSX.Element {
  const t = useT()
  const items: Array<{
    label: string
    icon: React.ReactNode
    action: () => void
    danger?: boolean
    disabled?: boolean
  }> = [
    { label: t('carousel.rename'),    icon: <UIIcon name="edit" size={13} />,      action: onRename },
    { label: t('carousel.duplicate'), icon: <UIIcon name="duplicate" size={13} />, action: onDuplicate },
    { label: t('carousel.export'),    icon: <UIIcon name="upload" size={13} />,    action: onExport },
    { label: t('carousel.delete'),    icon: <UIIcon name="close" size={13} />,     action: onDelete, danger: true, disabled: !canDelete },
  ]

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 10001,
        minWidth: 172,
        background: 'var(--c-elevated)',
        border: '1px solid var(--c-border)',
        borderRadius: 9,
        boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        padding: '3px 0',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            if (!item.disabled) {
              item.action()
              onClose()
            }
          }}
          disabled={item.disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            width: '100%', padding: '6px 12px',
            background: 'none', border: 'none',
            cursor: item.disabled ? 'default' : 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
            opacity: item.disabled ? 0.35 : 1,
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled)
              e.currentTarget.style.background = item.danger ? 'rgba(220,60,60,0.1)' : 'var(--c-surface)'
          }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.danger ? '#e05555' : 'var(--c-text-dim)', flexShrink: 0 }}>
            {item.icon}
          </span>
          <span style={{ fontSize: 12, color: item.danger ? '#e05555' : 'var(--c-text)' }}>
            {item.label}
          </span>
        </button>
      ))}
    </motion.div>
  )
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────

function ProfileDropdown({
  app,
  anchorRef,
  onSelectProfile,
  onClose,
  onChangeTarget,
  onDeleteApp,
}: {
  app: AppEntry
  anchorRef: React.RefObject<HTMLElement>
  onSelectProfile: (profileId: string) => void
  onClose: () => void
  onChangeTarget: () => void
  onDeleteApp: () => void
}): JSX.Element {
  const t = useT()
  const { setActiveEditingContext, activeEditingAppId } = useSettings()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const appMenuRef = useRef<HTMLDivElement>(null)
  const appMenuBtnRef = useRef<HTMLButtonElement>(null)

  const [showAppMenu, setShowAppMenu] = useState(false)
  const [appMenuPos, setAppMenuPos] = useState({ top: 0, right: 0 })
  const [contextMenuProfileId, setContextMenuProfileId] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState({ top: 0, left: 0 })
  const [renamingProfileId, setRenamingProfileId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Position below anchor
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [anchorRef])

  // Close on outside click; clicking inside dropdown (but outside context menu) closes context menu
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      const inDropdown = dropdownRef.current?.contains(target)
      const inContextMenu = contextMenuRef.current?.contains(target)
      const inAppMenu = appMenuRef.current?.contains(target)
      const inAppMenuBtn = appMenuBtnRef.current?.contains(target)
      const inAnchor = anchorRef.current?.contains(target)

      if (!inDropdown && !inContextMenu && !inAppMenu && !inAnchor) {
        onClose()
        return
      }
      if (contextMenuProfileId && !inContextMenu) {
        setContextMenuProfileId(null)
      }
      if (showAppMenu && !inAppMenu && !inAppMenuBtn) {
        setShowAppMenu(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose, anchorRef, contextMenuProfileId, showAppMenu])

  const openContextMenu = (profileId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (contextMenuProfileId === profileId) {
      setContextMenuProfileId(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const menuWidth = 172
    const left = rect.right + 4 + menuWidth > window.innerWidth
      ? rect.left - menuWidth - 4
      : rect.right + 4
    setContextMenuPos({ top: rect.top, left })
    setContextMenuProfileId(profileId)
  }

  const startRename = (profile: AppProfile) => {
    setRenamingProfileId(profile.id)
    setRenameValue(profile.name)
  }

  const submitRename = async () => {
    if (!renamingProfileId) return
    const name = renameValue.trim()
    if (name) {
      await window.settingsAPI.renameProfileInApp(app.id, renamingProfileId, name)
    }
    setRenamingProfileId(null)
    setRenameValue('')
  }

  const addProfile = async () => {
    const name = `${t('carousel.newProfile')} ${app.profiles.length + 1}`
    const newProfile = await window.settingsAPI.addProfileToApp(app.id, name)
    setActiveEditingContext(app.id, newProfile.id)
    // Keep dropdown open
  }

  const handleDuplicate = async (profileId: string) => {
    const newProfile = await window.settingsAPI.duplicateProfileInApp(app.id, profileId)
    setActiveEditingContext(app.id, newProfile.id)
  }

  const handleExport = async (profileId: string) => {
    await window.settingsAPI.exportProfile(app.id, profileId)
  }

  const handleDeleteProfile = async (profileId: string) => {
    await window.settingsAPI.removeProfileFromApp(app.id, profileId)
  }

  const handleExportApp = async () => {
    setShowAppMenu(false)
    await window.settingsAPI.exportAppProfiles(app.id)
  }

  const handleImportApp = async () => {
    setShowAppMenu(false)
    const ok = await window.settingsAPI.importAppProfiles(app.id)
    if (ok) {
      // Refresh context — the config:updated event fires automatically
      const cfg = await window.settingsAPI.getConfig()
      const updatedApp = cfg.apps.find((a) => a.id === app.id)
      if (updatedApp) setActiveEditingContext(app.id, updatedApp.activeProfileId)
    }
  }

  return (
    <>
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, y: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.97 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 9999,
          minWidth: 210,
          background: 'var(--c-elevated)',
          border: '1px solid var(--c-border)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          padding: '4px 0',
        }}
      >
        {/* App header */}
        <div style={{
          padding: '6px 10px 5px 12px',
          borderBottom: '1px solid var(--c-border-sub)',
          marginBottom: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          position: 'relative',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {app.displayName}
            </div>
            {app.exeName && (
              <div style={{ fontSize: 10, color: 'var(--c-text-dim)', marginTop: 1 }}>
                {app.exeName}
              </div>
            )}
          </div>

          {/* App-level settings icon */}
          <button
            ref={appMenuBtnRef}
            onClick={(e) => {
              e.stopPropagation()
              if (!showAppMenu && appMenuBtnRef.current) {
                const rect = appMenuBtnRef.current.getBoundingClientRect()
                setAppMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
              }
              setShowAppMenu((v) => !v)
            }}
            title={t('carousel.appSettings')}
            style={{
              flexShrink: 0,
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showAppMenu ? 'var(--c-surface)' : 'none',
              border: 'none', borderRadius: 5,
              cursor: 'pointer',
              color: showAppMenu ? 'var(--c-text)' : 'var(--c-text-dim)',
              fontSize: 13, lineHeight: 1,
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--c-surface)'
              e.currentTarget.style.color = 'var(--c-text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = showAppMenu ? 'var(--c-surface)' : 'none'
              e.currentTarget.style.color = showAppMenu ? 'var(--c-text)' : 'var(--c-text-dim)'
            }}
          >
            ⋯
          </button>

        </div>

        {/* Profile list */}
        {app.profiles.map((profile, idx) => {
          const isActive = profile.id === app.activeProfileId && app.id === activeEditingAppId
          const isRenaming = renamingProfileId === profile.id

          return (
            <div key={profile.id}>
              {isRenaming ? (
                <div style={{ padding: '5px 10px', display: 'flex', gap: 6 }}>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return  // Skip IME composition events
                      if (e.key === 'Enter') submitRename()
                      if (e.key === 'Escape') { setRenamingProfileId(null); setRenameValue('') }
                    }}
                    onBlur={submitRename}
                    style={{
                      flex: 1, background: 'var(--c-surface)',
                      border: '1px solid var(--c-accent)', borderRadius: 5,
                      color: 'var(--c-text)', fontSize: 12,
                      padding: '3px 7px', fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex', alignItems: 'center',
                    background: isActive ? 'var(--c-accent-bg)' : 'none',
                  }}
                >
                  {/* Profile select button */}
                  <button
                    onClick={() => { onSelectProfile(profile.id); onClose() }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px 7px 12px',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget.parentElement as HTMLElement).style.background = 'var(--c-surface)'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.background = isActive ? 'var(--c-accent-bg)' : 'none'
                    }}
                  >
                    <span style={{ color: isActive ? 'var(--c-accent)' : 'var(--c-text-dim)', fontWeight: isActive ? 700 : 400 }}>
                      <UIIcon name={idx === 0 ? 'favorite' : 'radio_button'} size={10} />
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: isActive ? 'var(--c-accent)' : 'var(--c-text)', fontWeight: isActive ? 600 : 400 }}>
                      {profile.name}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'var(--c-accent)', color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
                        {t('carousel.active')}
                      </span>
                    )}
                  </button>

                  {/* Three-dot menu button */}
                  <button
                    onClick={(e) => openContextMenu(profile.id, e)}
                    title={t('carousel.moreOptions')}
                    style={{
                      flexShrink: 0,
                      width: 24, height: 24,
                      marginRight: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: contextMenuProfileId === profile.id ? 'var(--c-surface)' : 'none',
                      border: 'none', borderRadius: 5,
                      cursor: 'pointer',
                      color: 'var(--c-text-dim)',
                      fontSize: 14, lineHeight: 1,
                      transition: 'background 0.1s, color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--c-surface)'
                      e.currentTarget.style.color = 'var(--c-text)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = contextMenuProfileId === profile.id ? 'var(--c-surface)' : 'none'
                      e.currentTarget.style.color = 'var(--c-text-dim)'
                    }}
                  >
                    ⋯
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Separator */}
        <div style={{ height: 1, background: 'var(--c-border-sub)', margin: '4px 0' }} />

        {/* Add Profile */}
        <button
          onClick={addProfile}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '7px 12px',
            background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            color: 'var(--c-text-dim)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <span style={{ fontSize: 14, color: 'var(--c-accent)', lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 12 }}>{t('carousel.addProfile')}</span>
        </button>

      </motion.div>

      {/* Profile context menu — rendered above the dropdown */}
      <AnimatePresence>
        {contextMenuProfileId && (() => {
          const profile = app.profiles.find((p) => p.id === contextMenuProfileId)
          if (!profile) return null
          return (
            <ProfileContextMenu
              key={contextMenuProfileId}
              canDelete={app.profiles.length > 1}
              pos={contextMenuPos}
              onRename={() => startRename(profile)}
              onDuplicate={() => handleDuplicate(contextMenuProfileId)}
              onExport={() => handleExport(contextMenuProfileId)}
              onDelete={() => handleDeleteProfile(contextMenuProfileId)}
              onClose={() => setContextMenuProfileId(null)}
              menuRef={contextMenuRef}
            />
          )
        })()}
      </AnimatePresence>

      {/* App-level settings menu — fixed position to escape overflow:hidden */}
      <AnimatePresence>
        {showAppMenu && (
          <motion.div
            ref={appMenuRef}
            initial={{ opacity: 0, scale: 0.93, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -2 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'fixed',
              top: appMenuPos.top,
              right: appMenuPos.right,
              zIndex: 10002,
              minWidth: 180,
              background: 'var(--c-elevated)',
              border: '1px solid var(--c-border)',
              borderRadius: 9,
              boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              padding: '3px 0',
            }}
          >
            {app.id !== 'default' && (
              <button
                onClick={() => { setShowAppMenu(false); onChangeTarget() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '6px 12px',
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{ fontSize: 11, width: 14, textAlign: 'center', color: 'var(--c-text-dim)', flexShrink: 0 }}>⇄</span>
                <span style={{ fontSize: 12, color: 'var(--c-text)' }}>{t('carousel.changeTarget')}</span>
              </button>
            )}
            <button
              onClick={handleExportApp}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '6px 12px',
                background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-dim)', flexShrink: 0 }}><UIIcon name="upload" size={13} /></span>
              <span style={{ fontSize: 12, color: 'var(--c-text)' }}>{t('carousel.exportAll')}</span>
            </button>
            <button
              onClick={handleImportApp}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '6px 12px',
                background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-dim)', flexShrink: 0 }}><UIIcon name="download" size={13} /></span>
              <span style={{ fontSize: 12, color: 'var(--c-text)' }}>{t('carousel.importProfiles')}</span>
            </button>
            {app.id !== 'default' && (
              <>
                <div style={{ height: 1, background: 'var(--c-border-sub)', margin: '3px 0' }} />
                <button
                  onClick={() => { setShowAppMenu(false); onDeleteApp() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '6px 12px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,60,60,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05555', flexShrink: 0 }}><UIIcon name="close" size={13} /></span>
                  <span style={{ fontSize: 12, color: '#e05555' }}>{t('carousel.deleteApp')}</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Carousel Item ─────────────────────────────────────────────────────────────

function CarouselItem({
  app,
  isActive,
  onSelectProfile,
  onDeleteApp,
  onReassignTarget,
  forceOpen,
  onForceOpenConsumed,
}: {
  app: AppEntry
  isActive: boolean
  onSelectProfile: (profileId: string) => void
  onDeleteApp: (appId: string) => void
  onReassignTarget: (appId: string) => void
  forceOpen?: boolean
  onForceOpenConsumed?: () => void
}): JSX.Element {
  const [showDropdown, setShowDropdown] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (forceOpen) {
      setShowDropdown(true)
      onForceOpenConsumed?.()
    }
  }, [forceOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    setShowDropdown((v) => !v)
  }

  const closeDropdown = useCallback(() => setShowDropdown(false), [])

  const activeProfileName = app.profiles.find((p) => p.id === app.activeProfileId)?.name ?? ''

  return (
    <div
      ref={itemRef as React.RefObject<HTMLDivElement>}
      style={{ position: 'relative', flexShrink: 0 }}
    >
      <button
        onClick={handleClick}
        title={`${app.displayName} — ${activeProfileName}`}
        style={{
          width: ITEM_WIDTH,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, padding: '4px 0',
          background: (isHovered || showDropdown) ? 'var(--c-surface)' : 'none',
          border: 'none', cursor: 'pointer',
          borderRadius: 7,
          transition: 'background 0.12s',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Active indicator dot */}
        <div style={{
          height: 2, width: 14, borderRadius: 2, marginBottom: 1,
          background: isActive ? 'var(--c-accent)' : 'transparent',
          transition: 'background 0.2s',
        }} />
        <AppIcon app={app} isActive={isActive} isHovered={isHovered || showDropdown} size={ICON_SIZE} />
      </button>

      {createPortal(
        <AnimatePresence>
          {showDropdown && (
            <ProfileDropdown
              app={app}
              anchorRef={itemRef as React.RefObject<HTMLElement>}
              onSelectProfile={(profileId) => {
                onSelectProfile(profileId)
                closeDropdown()
              }}
              onClose={closeDropdown}
              onChangeTarget={() => { onReassignTarget(app.id); closeDropdown() }}
              onDeleteApp={() => { onDeleteApp(app.id); closeDropdown() }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

// ── Add App Button ────────────────────────────────────────────────────────────

function AddAppButton({ onClick }: { onClick: () => void }): JSX.Element {
  const t = useT()
  return (
    <button
      onClick={onClick}
      title={t('carousel.addApp')}
      style={{
        flexShrink: 0,
        width: ITEM_WIDTH,
        height: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none',
        border: '1.5px dashed var(--c-border)',
        borderRadius: 7,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--c-accent)'
        e.currentTarget.style.background = 'var(--c-accent-bg)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--c-border)'
        e.currentTarget.style.background = 'none'
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1, color: 'var(--c-accent)', fontWeight: 300 }}>+</span>
    </button>
  )
}

// ── Main AppCarousel ──────────────────────────────────────────────────────────

export function AppCarousel(): JSX.Element {
  const { draft, activeEditingAppId, setActiveEditingContext } = useSettings()
  const apps = draft.apps ?? []

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [reassignAppId, setReassignAppId] = useState<string | null>(null)
  const [openDropdownAppId, setOpenDropdownAppId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [trackOffset, setTrackOffset] = useState(0)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (containerWidth === 0 || apps.length === 0) return
    const activeIndex = apps.findIndex((a) => a.id === activeEditingAppId)
    if (activeIndex < 0) return

    const usableWidth = containerWidth - NAV_BTN_W * 2
    const totalTrackWidth = apps.length * ITEM_STEP + ITEM_WIDTH  // +ITEM_WIDTH for add button

    if (totalTrackWidth <= usableWidth) {
      // Center items when they all fit
      setTrackOffset((usableWidth - totalTrackWidth) / 2)
      return
    }

    const idealOffset = -(activeIndex * ITEM_STEP) + usableWidth / 2 - ITEM_WIDTH / 2
    const maxScrollLeft = Math.max(0, totalTrackWidth - usableWidth)
    const minOffset = -maxScrollLeft
    setTrackOffset(Math.max(minOffset, Math.min(0, idealOffset)))
  }, [activeEditingAppId, containerWidth, apps.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalTrackWidth = apps.length * ITEM_STEP + ITEM_WIDTH
  const usableWidth = containerWidth - NAV_BTN_W * 2
  const canScrollLeft = trackOffset < 0
  const canScrollRight = totalTrackWidth + trackOffset > usableWidth

  const scrollBy = (direction: 'left' | 'right') => {
    const delta = direction === 'left' ? ITEM_STEP * 2 : -(ITEM_STEP * 2)
    const maxScrollLeft = Math.max(0, totalTrackWidth - usableWidth)
    setTrackOffset((prev) => Math.max(-maxScrollLeft, Math.min(0, prev + delta)))
  }

  const handleSelectProfile = useCallback((app: AppEntry, profileId: string) => {
    setActiveEditingContext(app.id, profileId)
  }, [setActiveEditingContext])

  const handleDeleteApp = useCallback((appId: string) => {
    window.settingsAPI.removeApp(appId).then(() => {
      if (appId === activeEditingAppId) {
        setActiveEditingContext('default')
      }
    })
  }, [activeEditingAppId, setActiveEditingContext])

  const handleReassignTarget = useCallback((appId: string) => {
    setReassignAppId(appId)
  }, [])

  const handleAddApp = useCallback(async (exeName: string, displayName: string, iconDataUrl?: string) => {
    const newApp = await window.settingsAPI.addApp(exeName, displayName, iconDataUrl)
    setOverlayOpen(false)
    setActiveEditingContext(newApp.id)
  }, [setActiveEditingContext])

  const handleReassignApp = useCallback(async (exeName: string, displayName: string, iconDataUrl?: string) => {
    if (!reassignAppId) return
    await window.settingsAPI.updateAppTarget(reassignAppId, exeName, displayName, iconDataUrl)
    setReassignAppId(null)
  }, [reassignAppId])

  const handleImported = useCallback((appId: string, profileId: string) => {
    setOverlayOpen(false)
    setActiveEditingContext(appId, profileId)
    setOpenDropdownAppId(appId)
  }, [setActiveEditingContext])

  const existingExeNames = new Set(
    apps.filter((a) => a.exeName).map((a) => a.exeName!.toLowerCase())
  )

  // For reassign: allow selecting any exe (including the current one), excluding others
  const reassignExistingExeNames = reassignAppId
    ? new Set([...existingExeNames].filter((n) => {
        const reassignApp = apps.find((a) => a.id === reassignAppId)
        return reassignApp?.exeName?.toLowerCase() !== n
      }))
    : existingExeNames

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 0 4px',
        background: 'none',
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Left nav button */}
      <button
        onClick={() => scrollBy('left')}
        disabled={!canScrollLeft}
        style={{
          width: NAV_BTN_W, height: '100%',
          flexShrink: 0,
          background: 'none', border: 'none',
          cursor: canScrollLeft ? 'pointer' : 'default',
          color: canScrollLeft ? 'var(--c-text-muted)' : 'var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, transition: 'color 0.15s',
          padding: 0,
        }}
      >
        ‹
      </button>

      {/* Scrollable track container */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0 }}
      >
        <motion.div
          animate={{ x: trackOffset }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          style={{ display: 'flex', gap: ITEM_GAP }}
        >
          {apps.map((app) => (
            <CarouselItem
              key={app.id}
              app={app}
              isActive={app.id === activeEditingAppId}
              onSelectProfile={(profileId) => handleSelectProfile(app, profileId)}
              onDeleteApp={handleDeleteApp}
              onReassignTarget={handleReassignTarget}
              forceOpen={openDropdownAppId === app.id}
              onForceOpenConsumed={() => setOpenDropdownAppId(null)}
            />
          ))}
          <AddAppButton onClick={() => setOverlayOpen(true)} />
        </motion.div>
      </div>

      {/* Right nav button */}
      <button
        onClick={() => scrollBy('right')}
        disabled={!canScrollRight}
        style={{
          width: NAV_BTN_W, height: '100%',
          flexShrink: 0,
          background: 'none', border: 'none',
          cursor: canScrollRight ? 'pointer' : 'default',
          color: canScrollRight ? 'var(--c-text-muted)' : 'var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, transition: 'color 0.15s',
          padding: 0,
        }}
      >
        ›
      </button>

      {/* Add App overlay */}
      <AnimatePresence>
        {overlayOpen && (
          <AddAppOverlay
            existingExeNames={existingExeNames}
            onAdd={handleAddApp}
            onImported={handleImported}
            onClose={() => setOverlayOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Reassign Target App overlay */}
      <AnimatePresence>
        {reassignAppId && (
          <AddAppOverlay
            existingExeNames={reassignExistingExeNames}
            onAdd={handleReassignApp}
            onImported={() => setReassignAppId(null)}
            onClose={() => setReassignAppId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
