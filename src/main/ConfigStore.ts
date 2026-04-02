import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type {
  AppConfig, SlotConfig, ModifierKey,
  AppearanceConfig, AppEntry, AppProfile,
  ShortcutEntry, ActionConfig,
  // Legacy (migration only)
  Profile,
} from '@shared/config.types'

const CONFIG_VERSION = 11

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const DEFAULT_APPEARANCE: AppearanceConfig = {
  ringRadius: 80,
  buttonSize: 24,
  iconSize: 18,
  showText: false,
  opacity: 0.92,
  animationSpeed: 'normal'
}

const DEFAULT_SLOTS: SlotConfig[] = [
  {
    id: generateId(),
    label: 'Browser',
    icon: 'browser',
    iconIsCustom: false,
    actions: [{ type: 'system', action: 'show-desktop' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'File Explorer',
    icon: 'folder',
    iconIsCustom: false,
    actions: [{ type: 'launch', target: process.platform === 'win32' ? 'explorer.exe' : 'open' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'Play / Pause',
    icon: 'play',
    iconIsCustom: false,
    actions: [{ type: 'system', action: 'play-pause' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'Volume Up',
    icon: 'volume-up',
    iconIsCustom: false,
    actions: [{ type: 'system', action: 'volume-up' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'Volume Down',
    icon: 'volume-down',
    iconIsCustom: false,
    actions: [{ type: 'system', action: 'volume-down' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'Screenshot',
    icon: 'screenshot',
    iconIsCustom: false,
    actions: [{ type: 'system', action: 'screenshot' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'Lock Screen',
    icon: 'lock',
    iconIsCustom: false,
    actions: [{ type: 'system', action: 'lock-screen' }],
    enabled: true
  },
  {
    id: generateId(),
    label: 'Calculator',
    icon: 'calculator',
    iconIsCustom: false,
    actions: [{ type: 'launch', target: process.platform === 'win32' ? 'calc.exe' : 'open -a Calculator' }],
    enabled: true
  }
]

function cloneSlots(slots: SlotConfig[]): SlotConfig[] {
  return JSON.parse(JSON.stringify(slots))
}

/**
 * Seeds a ShortcutEntry in the library for each non-folder slot.
 * Returns updated slots (each with shortcutIds set, actions cleared) and the populated library.
 * Used when building the default config on first launch.
 */
function seedLibraryFromSlots(slots: SlotConfig[]): { slots: SlotConfig[]; library: ShortcutEntry[] } {
  const library: ShortcutEntry[] = []
  const now = Date.now()
  const seededSlots = slots.map((slot) => {
    if (slot.actions.length === 0 || slot.actions[0].type === 'folder') {
      return { ...slot, shortcutIds: [] }
    }
    const id = generateId()
    library.push({
      id,
      name: slot.label,
      actions: JSON.parse(JSON.stringify(slot.actions)),
      isFavorite: false,
      createdAt: now,
      icon: slot.icon,
      iconIsCustom: slot.iconIsCustom,
      ...(slot.bgColor !== undefined ? { bgColor: slot.bgColor } : {}),
    })
    return { ...slot, shortcutIds: [id], actions: [] }
  })
  return { slots: seededSlots, library }
}

function makeDefaultAppEntry(slots: SlotConfig[], appearance: AppearanceConfig): AppEntry {
  const profileId = generateId()
  return {
    id: 'default',
    displayName: 'Default System',
    profiles: [
      {
        id: profileId,
        name: 'Default',
        slots: cloneSlots(slots),
        appearance: { ...appearance },
      },
    ],
    activeProfileId: profileId,
  }
}

function buildDefaultConfig(): AppConfig {
  const { slots: seededSlots, library } = seedLibraryFromSlots(DEFAULT_SLOTS)
  const defaultEntry = makeDefaultAppEntry(seededSlots, DEFAULT_APPEARANCE)
  const activeProfile = defaultEntry.profiles[0]
  return {
    version: CONFIG_VERSION,
    enabled: true,
    trigger: { button: 3, modifiers: ['ctrl', 'shift'] },
    slots: activeProfile.slots,
    appearance: activeProfile.appearance,
    startOnLogin: true,
    trayNotificationsEnabled: true,
    theme: 'system',
    language: 'en',
    apps: [defaultEntry],
    shortcutsLibrary: library,
  }
}

export class ConfigStore {
  private configPath: string
  private config: AppConfig

  constructor() {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    this.configPath = join(userDataPath, 'config.json')
    this.config = this.load()
  }

  private load(): AppConfig {
    if (!existsSync(this.configPath)) {
      const cfg = buildDefaultConfig()
      this.persist(cfg)
      return cfg
    }
    try {
      const raw = readFileSync(this.configPath, 'utf-8')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(raw) as any
      let config = parsed as AppConfig

      // ── v1 → v2: fix incorrect middle-click button code ──────────────────
      if ((parsed.version ?? 1) < 2 && config.trigger?.button === 2) {
        config = { ...config, trigger: { ...config.trigger, button: 3 }, version: 2 }
      }
      // ── v2 → v3: migrate single modifier string to array ─────────────────
      if ((parsed.version ?? 1) < 3) {
        const oldModifier = parsed.trigger?.modifier as string | undefined
        const modifiers: ModifierKey[] =
          oldModifier && oldModifier !== 'none' ? [oldModifier as ModifierKey] : []
        config = { ...config, trigger: { button: config.trigger.button, modifiers }, version: 3 }
      }
      // ── v3 → v4: add theme field ──────────────────────────────────────────
      if ((parsed.version ?? 1) < 4) {
        config = { ...config, theme: 'dark', version: 4 }
      }
      // ── v4 → v5: migrate single `action` to `actions` array ──────────────
      if ((parsed.version ?? 1) < 5) {
        const migrateSlots = (slots: SlotConfig[]): SlotConfig[] =>
          slots.map((s) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const legacy = s as any
            const actions = legacy.actions ?? (legacy.action ? [legacy.action] : [{ type: 'shell', command: '' }])
            return { ...s, actions, subSlots: s.subSlots ? migrateSlots(s.subSlots) : undefined }
          })
        config = { ...config, slots: migrateSlots(config.slots ?? []), version: 5 }
      }
      // ── v5 → v6: wrap slots + appearance into a Default profile ──────────
      if ((parsed.version ?? 1) < 6) {
        const legacySlots: SlotConfig[] = (config as AppConfig & { slots?: SlotConfig[] }).slots ?? DEFAULT_SLOTS
        const legacyAppearance: AppearanceConfig =
          (config as AppConfig & { appearance?: AppearanceConfig }).appearance ?? DEFAULT_APPEARANCE
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const legacyProfileId = generateId()
        const legacyProfile: Profile = {
          id: legacyProfileId,
          name: 'Default',
          defaultSlots: legacySlots,
          appearance: legacyAppearance,
          appOverrides: [],
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(config as any).profiles = [legacyProfile]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(config as any).activeProfileId = legacyProfileId
        config = { ...config, version: 6 }
      }
      // ── v6 → v7: replace profiles + appOverrides with apps ───────────────
      if ((parsed.version ?? 1) < 7) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v6 = config as any
        const profiles: Profile[] = v6.profiles ?? []
        const activeProfileId: string = v6.activeProfileId ?? ''
        const activeProfile: Profile =
          profiles.find((p: Profile) => p.id === activeProfileId) ?? profiles[0]

        if (activeProfile) {
          // Default System entry from the active profile's defaultSlots
          const defaultProfileId = generateId()
          const defaultEntry: AppEntry = {
            id: 'default',
            displayName: 'Default System',
            profiles: [
              {
                id: defaultProfileId,
                name: 'Default',
                slots: cloneSlots(activeProfile.defaultSlots),
                appearance: { ...activeProfile.appearance },
              },
            ],
            activeProfileId: defaultProfileId,
          }

          // One app entry per appOverride in the active profile
          const appEntries: AppEntry[] = activeProfile.appOverrides.map((o) => {
            const profileId = generateId()
            return {
              id: generateId(),
              exeName: o.exeName,
              displayName: o.displayName || o.exeName,
              profiles: [
                {
                  id: profileId,
                  name: 'Default',
                  slots: cloneSlots(o.slots),
                  appearance: { ...activeProfile.appearance },
                },
              ],
              activeProfileId: profileId,
            }
          })

          config = {
            ...config,
            version: 7,
            slots: defaultEntry.profiles[0].slots,
            appearance: defaultEntry.profiles[0].appearance,
            apps: [defaultEntry, ...appEntries],
          }
        } else {
          // No usable profile data — build fresh
          config = buildDefaultConfig()
        }

        // Remove legacy fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (config as any).profiles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (config as any).activeProfileId
      }

      // ── v7 → v8: extract slot actions into a global shortcuts library ────────
      if ((parsed.version ?? 1) < 8) {
        const library: ShortcutEntry[] = config.shortcutsLibrary ? [...config.shortcutsLibrary] : []
        // fingerprint → id map for deduplication across all apps/profiles
        const fpMap = new Map<string, string>(library.map((e) => [JSON.stringify(e.actions), e.id]))

        const migrateSlot = (slot: SlotConfig): SlotConfig => {
          const migratedSubSlots = slot.subSlots ? slot.subSlots.map(migrateSlot) : undefined
          if (slot.shortcutId || slot.actions.length === 0 || slot.actions[0].type === 'folder') {
            return { ...slot, subSlots: migratedSubSlots }
          }
          const fp = JSON.stringify(slot.actions)
          let shortcutId = fpMap.get(fp)
          if (!shortcutId) {
            shortcutId = generateId()
            fpMap.set(fp, shortcutId)
            library.push({
              id: shortcutId,
              name: slot.label,
              actions: JSON.parse(JSON.stringify(slot.actions)),
              isFavorite: false,
              createdAt: Date.now(),
              icon: slot.icon,
              iconIsCustom: slot.iconIsCustom,
            })
          }
          return { ...slot, shortcutId, subSlots: migratedSubSlots }
        }

        const migratedApps = config.apps.map((app) => ({
          ...app,
          profiles: app.profiles.map((profile) => ({
            ...profile,
            slots: profile.slots.map(migrateSlot),
          })),
        }))

        config = { ...config, version: 8, apps: migratedApps, shortcutsLibrary: library }
      }

      // ── v8 → v9: convert shortcutId to shortcutIds array, clear slot actions ────
      if ((parsed.version ?? 1) < 9) {
        const library: ShortcutEntry[] = config.shortcutsLibrary ? [...config.shortcutsLibrary] : []
        const fpMap = new Map<string, string>(library.map((e) => [JSON.stringify(e.actions), e.id]))

        const migrateSlot = (slot: SlotConfig): SlotConfig => {
          const migratedSubSlots = slot.subSlots ? slot.subSlots.map(migrateSlot) : undefined
          // Folder slots: keep actions, just ensure shortcutIds is set
          if (slot.actions[0]?.type === 'folder') {
            return { ...slot, shortcutIds: [], subSlots: migratedSubSlots }
          }
          // Already has shortcutIds: just clear raw actions
          if (slot.shortcutIds && slot.shortcutIds.length > 0) {
            return { ...slot, actions: [], subSlots: migratedSubSlots }
          }
          // Has shortcutId (from v8): convert to shortcutIds array
          if (slot.shortcutId) {
            return { ...slot, shortcutIds: [slot.shortcutId], shortcutId: undefined, actions: [], subSlots: migratedSubSlots }
          }
          // Has raw actions but no shortcutId: create a library entry
          if (slot.actions.length > 0) {
            const fp = JSON.stringify(slot.actions)
            let id = fpMap.get(fp)
            if (!id) {
              id = generateId()
              fpMap.set(fp, id)
              library.push({ id, name: slot.label, actions: JSON.parse(JSON.stringify(slot.actions)), isFavorite: false, createdAt: Date.now(), icon: slot.icon, iconIsCustom: slot.iconIsCustom })
            }
            return { ...slot, shortcutIds: [id], shortcutId: undefined, actions: [], subSlots: migratedSubSlots }
          }
          // Empty slot
          return { ...slot, shortcutIds: [], shortcutId: undefined, actions: [], subSlots: migratedSubSlots }
        }

        const migratedApps = config.apps.map((app) => ({
          ...app,
          profiles: app.profiles.map((profile) => ({
            ...profile,
            slots: profile.slots.map(migrateSlot),
          })),
        }))

        config = { ...config, version: 9, apps: migratedApps, shortcutsLibrary: library }
      }

      // ── v9 → v10: remove global scope, rename call-shortcut → run-shortcut ────
      if ((parsed.version ?? 1) < 10) {
        const migrateActionV10 = (action: any): any => {
          if (action.type === 'set-var' && action.scope === 'global') {
            action = { ...action, scope: 'local' }
          }
          if (action.type === 'calculate' && action.scope === 'global') {
            action = { ...action, scope: 'local' }
          }
          if (action.type === 'stop' && action.scope === 'global') {
            const { scope: _, ...rest } = action
            action = rest
          }
          if (action.type === 'call-shortcut') {
            action = { type: 'run-shortcut', shortcutId: action.shortcutId }
          }
          if (action.type === 'if-else') {
            action = { ...action, thenActions: action.thenActions.map(migrateActionV10), elseActions: action.elseActions.map(migrateActionV10) }
          }
          if (action.type === 'loop') {
            action = { ...action, body: action.body.map(migrateActionV10) }
          }
          return action
        }

        // Migrate shortcuts library
        const library = (config.shortcutsLibrary ?? []).map((entry: any) => ({
          ...entry,
          actions: entry.actions.map(migrateActionV10),
        }))

        // Migrate all slot actions across all app profiles
        const migrateSlot = (slot: any): any => ({
          ...slot,
          actions: (slot.actions ?? []).map(migrateActionV10),
          subSlots: slot.subSlots ? slot.subSlots.map(migrateSlot) : undefined,
        })

        const migratedApps = config.apps.map((appEntry: any) => ({
          ...appEntry,
          profiles: appEntry.profiles.map((profile: any) => ({
            ...profile,
            slots: profile.slots.map(migrateSlot),
          })),
        }))

        // Remove globalVars
        const { globalVars: _, ...configWithoutGlobalVars } = config as any
        config = { ...configWithoutGlobalVars, version: 10, apps: migratedApps, shortcutsLibrary: library }
      }

      // ── v10 → v11: additive only — new sequence action type, extended wait modes ──
      if ((parsed.version ?? 1) < 11) {
        config = { ...config, version: 11 }
      }

      // ── Backfill missing icons on library entries ──────────────────────────
      // Earlier migrations (v7→v8, v8→v9) may not have copied icon from slot.
      // Walk all slots and propagate icon to their referenced library entries.
      {
        const library = config.shortcutsLibrary ?? []
        const needsFill = library.some((e) => !e.icon)
        if (needsFill) {
          const iconMap = new Map<string, { icon: string; iconIsCustom: boolean }>()
          for (const appEntry of config.apps) {
            for (const profile of appEntry.profiles) {
              const walkSlots = (slots: SlotConfig[]): void => {
                for (const slot of slots) {
                  if (slot.icon) {
                    for (const sid of slot.shortcutIds ?? []) {
                      if (!iconMap.has(sid)) iconMap.set(sid, { icon: slot.icon, iconIsCustom: slot.iconIsCustom })
                    }
                  }
                  if (slot.subSlots) walkSlots(slot.subSlots)
                }
              }
              walkSlots(profile.slots)
            }
          }
          config = {
            ...config,
            shortcutsLibrary: library.map((entry) => {
              if (entry.icon) return entry
              const found = iconMap.get(entry.id)
              return found ? { ...entry, icon: found.icon, iconIsCustom: found.iconIsCustom } : entry
            }),
          }
        }
      }

      // Ensure top-level slots/appearance always match the Default System's active profile
      config = this.syncTopLevel(config)
      this.persist(config)
      return config
    } catch {
      console.error('[ConfigStore] Failed to parse config, using defaults')
      const cfg = buildDefaultConfig()
      this.persist(cfg)
      return cfg
    }
  }

  /**
   * Syncs config.slots and config.appearance to the Default System's active profile.
   * This ensures the ring renderer always gets the correct default slots.
   */
  private syncTopLevel(config: AppConfig): AppConfig {
    const defaultApp = config.apps.find((a) => a.id === 'default') ?? config.apps[0]
    if (!defaultApp) return config
    const profile = defaultApp.profiles.find((p) => p.id === defaultApp.activeProfileId)
      ?? defaultApp.profiles[0]
    if (!profile) return config
    return { ...config, slots: profile.slots, appearance: profile.appearance }
  }

  private persist(config: AppConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get(): AppConfig {
    return this.config
  }

  save(config: AppConfig): void {
    this.config = config
    this.persist(config)
  }

  update(partial: Partial<AppConfig>): void {
    this.save({ ...this.config, ...partial })
  }

  toggleEnabled(): void {
    this.update({ enabled: !this.config.enabled })
  }

  reset(): AppConfig {
    const cfg = buildDefaultConfig()
    this.config = cfg
    this.persist(cfg)
    return cfg
  }

  // ── App queries ────────────────────────────────────────────────────────────

  getDefaultApp(): AppEntry {
    return this.config.apps.find((a) => a.id === 'default') ?? this.config.apps[0]
  }

  getAppById(id: string): AppEntry | undefined {
    return this.config.apps.find((a) => a.id === id)
  }

  /**
   * Resolves which slots to show for a given foreground exe name.
   * Checks each app entry's exeName; if matched, returns that entry's active profile slots.
   * Falls back to Default System's active profile slots.
   */
  resolveSlots(exeName: string | null): SlotConfig[] {
    if (exeName) {
      const appEntry = this.config.apps.find(
        (a) => a.exeName && a.exeName.toLowerCase() === exeName.toLowerCase()
      )
      if (appEntry) {
        const profile = appEntry.profiles.find((p) => p.id === appEntry.activeProfileId)
          ?? appEntry.profiles[0]
        if (profile) return profile.slots
      }
    }
    const defaultApp = this.getDefaultApp()
    const defaultProfile = defaultApp.profiles.find((p) => p.id === defaultApp.activeProfileId)
      ?? defaultApp.profiles[0]
    return defaultProfile?.slots ?? this.config.slots
  }

  // ── App mutations ──────────────────────────────────────────────────────────

  /**
   * Add a new app entry. The first profile is seeded from Default System's active profile slots.
   */
  addApp(exeName: string, displayName: string, iconDataUrl?: string): AppEntry {
    const defaultApp = this.getDefaultApp()
    const defaultProfile = defaultApp.profiles.find((p) => p.id === defaultApp.activeProfileId)
      ?? defaultApp.profiles[0]

    const profileId = generateId()
    const newApp: AppEntry = {
      id: generateId(),
      exeName,
      displayName,
      iconDataUrl,
      profiles: [
        {
          id: profileId,
          name: 'Default',
          slots: cloneSlots(defaultProfile?.slots ?? DEFAULT_SLOTS),
          appearance: { ...(defaultProfile?.appearance ?? DEFAULT_APPEARANCE) },
        },
      ],
      activeProfileId: profileId,
    }

    this.config = { ...this.config, apps: [...this.config.apps, newApp] }
    this.persist(this.config)
    return newApp
  }

  removeApp(appId: string): void {
    if (appId === 'default') return  // Default System cannot be removed
    const newApps = this.config.apps.filter((a) => a.id !== appId)
    this.config = this.syncTopLevel({ ...this.config, apps: newApps })
    this.persist(this.config)
  }

  /** Update the exe target (exeName, displayName, icon) for an existing app entry. */
  updateAppTarget(appId: string, exeName: string, displayName: string, iconDataUrl?: string): void {
    const newApps = this.config.apps.map((a) =>
      a.id === appId ? { ...a, exeName, displayName, iconDataUrl } : a
    )
    this.config = { ...this.config, apps: newApps }
    this.persist(this.config)
  }

  /** Update the cached icon data URL for an app entry. */
  setAppIcon(appId: string, iconDataUrl: string): void {
    const newApps = this.config.apps.map((a) =>
      a.id === appId ? { ...a, iconDataUrl } : a
    )
    this.config = { ...this.config, apps: newApps }
    this.persist(this.config)
  }

  // ── Profile mutations within an app ───────────────────────────────────────

  /**
   * Add a new profile to an app.
   * New profile is seeded from Default System's active profile slots (as requested).
   */
  addProfileToApp(appId: string, name: string): AppProfile {
    const defaultApp = this.getDefaultApp()
    const defaultProfile = defaultApp.profiles.find((p) => p.id === defaultApp.activeProfileId)
      ?? defaultApp.profiles[0]

    const newProfile: AppProfile = {
      id: generateId(),
      name,
      slots: cloneSlots(defaultProfile?.slots ?? DEFAULT_SLOTS),
      appearance: { ...(defaultProfile?.appearance ?? DEFAULT_APPEARANCE) },
    }

    const newApps = this.config.apps.map((a) =>
      a.id === appId
        ? { ...a, profiles: [...a.profiles, newProfile], activeProfileId: newProfile.id }
        : a
    )
    this.config = this.syncTopLevel({ ...this.config, apps: newApps })
    this.persist(this.config)
    return newProfile
  }

  removeProfileFromApp(appId: string, profileId: string): void {
    const app = this.getAppById(appId)
    if (!app || app.profiles.length <= 1) return  // always keep at least one profile

    const newProfiles = app.profiles.filter((p) => p.id !== profileId)
    let newActiveProfileId = app.activeProfileId
    if (newActiveProfileId === profileId) {
      newActiveProfileId = newProfiles[0].id
    }

    const newApps = this.config.apps.map((a) =>
      a.id === appId
        ? { ...a, profiles: newProfiles, activeProfileId: newActiveProfileId }
        : a
    )
    this.config = this.syncTopLevel({ ...this.config, apps: newApps })
    this.persist(this.config)
  }

  renameProfileInApp(appId: string, profileId: string, name: string): void {
    const newApps = this.config.apps.map((a) =>
      a.id === appId
        ? {
            ...a,
            profiles: a.profiles.map((p) => (p.id === profileId ? { ...p, name } : p)),
          }
        : a
    )
    this.config = { ...this.config, apps: newApps }
    this.persist(this.config)
  }

  /** Duplicate a profile within an app. The copy becomes the active profile. */
  duplicateProfileInApp(appId: string, sourceProfileId: string): AppProfile {
    const appEntry = this.getAppById(appId)
    if (!appEntry) throw new Error(`App '${appId}' not found`)
    const source = appEntry.profiles.find((p) => p.id === sourceProfileId)
    if (!source) throw new Error(`Profile '${sourceProfileId}' not found`)

    const newProfile: AppProfile = {
      id: generateId(),
      name: `${source.name} (Copy)`,
      slots: cloneSlots(source.slots),
      appearance: { ...source.appearance },
    }

    const newApps = this.config.apps.map((a) =>
      a.id === appId
        ? { ...a, profiles: [...a.profiles, newProfile], activeProfileId: newProfile.id }
        : a
    )
    this.config = this.syncTopLevel({ ...this.config, apps: newApps })
    this.persist(this.config)
    return newProfile
  }

  /**
   * Set the active profile for an app entry and persist.
   * Returns the updated AppConfig (synced).
   */
  setActiveProfileForApp(appId: string, profileId: string): AppConfig {
    const app = this.getAppById(appId)
    if (!app || !app.profiles.find((p) => p.id === profileId)) return this.config

    const newApps = this.config.apps.map((a) =>
      a.id === appId ? { ...a, activeProfileId: profileId } : a
    )
    const updated = this.syncTopLevel({ ...this.config, apps: newApps })
    this.config = updated
    this.persist(updated)
    return updated
  }

  // ── Shortcuts library ─────────────────────────────────────────────────────

  /**
   * Update a library entry's actions (and optionally name).
   * Slots reference entries by ID so no propagation is needed.
   */
  updateLibraryEntry(
    id: string,
    actions: ActionConfig[],
    name?: string,
    icon?: string,
    iconIsCustom?: boolean,
    bgColor?: string,
  ): void {
    const library = this.config.shortcutsLibrary ?? []
    const idx = library.findIndex((e) => e.id === id)
    if (idx < 0) return

    const updated: ShortcutEntry = {
      ...library[idx],
      actions,
      lastUsed: Date.now(),
      ...(name !== undefined ? { name } : {}),
      ...(icon !== undefined ? { icon, iconIsCustom: iconIsCustom ?? false } : {}),
      ...(bgColor !== undefined ? { bgColor } : bgColor === null ? { bgColor: undefined } : {}),
    }
    const newLibrary = [...library]
    newLibrary[idx] = updated

    this.config = this.syncTopLevel({ ...this.config, shortcutsLibrary: newLibrary })
    this.persist(this.config)
  }

  /**
   * Remove a library entry and orphan all slots that referenced it
   * (deleted entry ID is removed from shortcutIds arrays in all slots).
   */
  deleteLibraryEntry(id: string): void {
    const newLibrary = (this.config.shortcutsLibrary ?? []).filter((e) => e.id !== id)
    const newApps = this.config.apps.map((app) => ({
      ...app,
      profiles: app.profiles.map((profile) => ({
        ...profile,
        slots: this.orphanLibrarySlots(profile.slots, id),
      })),
    }))
    this.config = this.syncTopLevel({ ...this.config, shortcutsLibrary: newLibrary, apps: newApps })
    this.persist(this.config)
  }

  private orphanLibrarySlots(slots: SlotConfig[], entryId: string): SlotConfig[] {
    return slots.map((slot) => ({
      ...slot,
      shortcutIds: (slot.shortcutIds ?? []).filter((id) => id !== entryId),
      subSlots: slot.subSlots ? this.orphanLibrarySlots(slot.subSlots, entryId) : undefined,
    }))
  }

  // ── Legacy compatibility — still used by HookManager ──────────────────────

  getActiveProfile(): { defaultSlots: SlotConfig[]; appearance: AppearanceConfig } {
    const defaultApp = this.getDefaultApp()
    const profile = defaultApp.profiles.find((p) => p.id === defaultApp.activeProfileId)
      ?? defaultApp.profiles[0]
    return { defaultSlots: profile?.slots ?? this.config.slots, appearance: profile?.appearance ?? this.config.appearance }
  }
}
