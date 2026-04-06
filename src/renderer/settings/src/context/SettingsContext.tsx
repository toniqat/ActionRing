import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { AppConfig, SlotConfig, AppearanceConfig } from '@shared/config.types'
import type { AppearanceSlotData, ShortcutsSlotData } from '@shared/ipc.types'

interface SettingsContextValue {
  draft: AppConfig
  updateDraft: (c: AppConfig) => void
  previewDraft: AppConfig
  setPreviewDraft: (c: AppConfig) => void
  selectedSlotIndex: number | null
  setSelectedSlotIndex: (i: number | null) => void
  /** Index of the primary slot whose folder sub-menu is being edited. null = top-level view */
  editingFolderIndex: number | null
  setEditingFolderIndex: (i: number | null) => void
  /** Index of the selected sub-slot within the active folder */
  selectedSubSlotIndex: number | null
  setSelectedSubSlotIndex: (i: number | null) => void
  animPreviewKey: number
  triggerAnimPreview: () => void
  /**
   * ID of the app entry currently being edited.
   * 'default' = Default System; other values = a specific AppEntry.id
   */
  activeEditingAppId: string
  setActiveEditingContext: (appId: string, profileId?: string) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * Resolves the slots that should be shown in the editor for the given app context.
 */
function resolveEditingSlots(config: AppConfig, appId: string): SlotConfig[] {
  const app = config.apps.find((a) => a.id === appId)
  if (!app) return config.slots
  const profile = app.profiles.find((p) => p.id === app.activeProfileId) ?? app.profiles[0]
  return profile?.slots ?? config.slots
}

/**
 * Resolves the appearance for the given app context.
 */
function resolveEditingAppearance(config: AppConfig, appId: string): AppearanceConfig {
  const app = config.apps.find((a) => a.id === appId)
  if (!app) return config.appearance
  const profile = app.profiles.find((p) => p.id === app.activeProfileId) ?? app.profiles[0]
  return profile?.appearance ?? config.appearance
}

/**
 * Merges the current editing slots/appearance back into the correct AppEntry/AppProfile,
 * and keeps config.slots/appearance synced to the Default System's active profile.
 */
function mergeEditingIntoApps(c: AppConfig, activeEditingAppId: string): AppConfig {
  const appIdx = c.apps.findIndex((a) => a.id === activeEditingAppId)
  if (appIdx < 0) return c

  const appEntry = c.apps[appIdx]
  const profileIdx = appEntry.profiles.findIndex((p) => p.id === appEntry.activeProfileId)
  if (profileIdx < 0) return c

  const newProfiles = [...appEntry.profiles]
  newProfiles[profileIdx] = {
    ...newProfiles[profileIdx],
    slots: c.slots,
    appearance: c.appearance,
  }
  const newApps = [...c.apps]
  newApps[appIdx] = { ...appEntry, profiles: newProfiles }

  // config.slots / config.appearance should always mirror Default System's active profile
  const defaultApp = newApps.find((a) => a.id === 'default') ?? newApps[0]
  const defaultProfile =
    defaultApp.profiles.find((p) => p.id === defaultApp.activeProfileId) ??
    defaultApp.profiles[0]

  return {
    ...c,
    apps: newApps,
    slots: defaultProfile?.slots ?? c.slots,
    appearance: defaultProfile?.appearance ?? c.appearance,
  }
}

export function SettingsProvider({
  config,
  onSave,
  children,
}: {
  config: AppConfig
  onSave: (c: AppConfig) => Promise<void>
  children: React.ReactNode
}): JSX.Element {
  const [activeEditingAppId, setActiveEditingAppId] = useState<string>('default')

  // Always holds the latest persisted config so switching apps never uses stale draft state.
  const configRef = useRef<AppConfig>(config)
  useEffect(() => { configRef.current = config }, [config])

  const buildDraft = useCallback(
    (cfg: AppConfig, appId: string): AppConfig => ({
      ...cfg,
      slots: resolveEditingSlots(cfg, appId),
      appearance: resolveEditingAppearance(cfg, appId),
    }),
    []
  )

  const [draft, setDraft] = useState<AppConfig>(() => buildDraft(config, 'default'))
  const [previewDraft, setPreviewDraft] = useState<AppConfig>(() => buildDraft(config, 'default'))
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [editingFolderIndex, setEditingFolderIndex] = useState<number | null>(null)
  const [selectedSubSlotIndex, setSelectedSubSlotIndex] = useState<number | null>(null)
  const [animPreviewKey, setAnimPreviewKey] = useState(0)

  // Counts how many upcoming config-prop changes should NOT reset selection state.
  // Each internal save causes exactly 2 config updates:
  //   1. handleSave's synchronous setConfig(updated) call
  //   2. The IPC round-trip onConfigUpdated callback
  // We increment by 2 so both are absorbed before reverting to normal behaviour.
  const skipSelectionResetRef = useRef(0)

  // Sync when outer config changes via IPC (e.g. profile switch, external update).
  // Also reset selection state to prevent stale slot indices after a config reload.
  useEffect(() => {
    const resolved = buildDraft(config, activeEditingAppId)
    setDraft(resolved)
    setPreviewDraft(resolved)
    if (skipSelectionResetRef.current > 0) {
      skipSelectionResetRef.current--
      return
    }
    setSelectedSlotIndex(null)
    setEditingFolderIndex(null)
    setSelectedSubSlotIndex(null)
  }, [config]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Switch the editing context to a different app (and optionally a specific profile).
   * If profileId is provided, it activates that profile first via IPC before switching context.
   */
  const setActiveEditingContext = useCallback(
    (appId: string, profileId?: string) => {
      const apply = (cfg: AppConfig) => {
        setActiveEditingAppId(appId)
        setSelectedSlotIndex(null)
        setEditingFolderIndex(null)
        setSelectedSubSlotIndex(null)
        const resolved = buildDraft(cfg, appId)
        setDraft(resolved)
        setPreviewDraft(resolved)
      }

      if (profileId) {
        // Update the active app immediately so the carousel indicator switches at once
        // and the config:updated effect rebuilds the draft for the correct app.
        setActiveEditingAppId(appId)
        // Reset selection state immediately to prevent stale-index crashes while the
        // IPC round-trip is in flight (new draft arrives via config:updated before .then()).
        setSelectedSlotIndex(null)
        setEditingFolderIndex(null)
        setSelectedSubSlotIndex(null)
        // Activate the profile on the main process, then refresh the full context
        window.settingsAPI.setActiveProfileForApp(appId, profileId).then((updatedConfig) => {
          apply(updatedConfig)
        })
      } else {
        // Use the latest persisted config (not the current editing draft) so switching
        // apps always resolves from a clean, consistent state and never renders blank.
        apply(configRef.current)
      }
    },
    [buildDraft]
  )

  const updateDraft = useCallback(
    (c: AppConfig) => {
      const merged = mergeEditingIntoApps(c, activeEditingAppId)

      // In the editor, keep showing the app-specific slots (not the default system slots)
      const viewSlots = resolveEditingSlots(merged, activeEditingAppId)
      const viewAppearance = resolveEditingAppearance(merged, activeEditingAppId)
      const viewDraft = { ...merged, slots: viewSlots, appearance: viewAppearance }

      setDraft(viewDraft)
      setPreviewDraft(viewDraft)
      // Prevent the config sync effect from resetting selection state for this save.
      // Each save produces 2 config-prop changes (sync + IPC round-trip), so absorb both.
      skipSelectionResetRef.current += 2
      onSave(merged)
    },
    [activeEditingAppId, onSave]
  )

  // Apply slot updates coming from the appearance editor window (live preview only)
  useEffect(() => {
    window.settingsAPI.onAppearanceUpdated((data: AppearanceSlotData) => {
      setDraft((prev) => {
        const newSlots = [...prev.slots]
        if (data.isSubSlot && data.folderIndex !== null && data.subSlotIndex !== null) {
          const folder = { ...newSlots[data.folderIndex] }
          const newSubSlots = [...(folder.subSlots ?? [])]
          newSubSlots[data.subSlotIndex] = data.slot
          folder.subSlots = newSubSlots
          newSlots[data.folderIndex] = folder
        } else {
          newSlots[data.slotIndex] = data.slot
        }
        const updated = { ...prev, slots: newSlots }
        setPreviewDraft(updated)
        return updated
      })
    })
  }, [])

  // When the shortcuts editor commits (closes), a config update follows — skip selection reset.
  useEffect(() => {
    window.settingsAPI.onShortcutsCommitted(() => {
      skipSelectionResetRef.current += 1
    })
  }, [])

  // Apply slot/library updates coming from the shortcuts editor window (live preview only)
  useEffect(() => {
    window.settingsAPI.onShortcutsUpdated((data: ShortcutsSlotData) => {
      if (data.libraryEntryId) {
        // Library-entry edit session: update only the library entry (slots reference by ID)
        setDraft((prev) => {
          const library = prev.shortcutsLibrary ?? []
          const entryIdx = library.findIndex((e) => e.id === data.libraryEntryId)
          if (entryIdx < 0) return prev
          const updatedEntry = {
            ...library[entryIdx],
            actions: data.slot.actions,
            name: data.slot.label,
            icon: data.slot.icon,
            iconIsCustom: data.slot.iconIsCustom,
            bgColor: data.slot.bgColor,
          }
          const newLibrary = [...library]
          newLibrary[entryIdx] = updatedEntry
          const updated = { ...prev, shortcutsLibrary: newLibrary }
          setPreviewDraft(updated)
          return updated
        })
        return
      }

      // Regular slot edit session
      setDraft((prev) => {
        const newSlots = [...prev.slots]
        if (data.isSubSlot && data.folderIndex !== null && data.subSlotIndex !== null) {
          const folder = { ...newSlots[data.folderIndex] }
          const newSubSlots = [...(folder.subSlots ?? [])]
          newSubSlots[data.subSlotIndex] = data.slot
          folder.subSlots = newSubSlots
          newSlots[data.folderIndex] = folder
        } else {
          newSlots[data.slotIndex] = data.slot
        }
        const updated = { ...prev, slots: newSlots }
        setPreviewDraft(updated)
        return updated
      })
    })
  }, [])

  const triggerAnimPreview = useCallback(() => {
    setAnimPreviewKey((k) => k + 1)
  }, [])

  return (
    <SettingsContext.Provider
      value={{
        draft, updateDraft, previewDraft, setPreviewDraft,
        selectedSlotIndex, setSelectedSlotIndex,
        editingFolderIndex, setEditingFolderIndex,
        selectedSubSlotIndex, setSelectedSubSlotIndex,
        animPreviewKey, triggerAnimPreview,
        activeEditingAppId, setActiveEditingContext,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
