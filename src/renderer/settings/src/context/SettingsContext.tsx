import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AppConfig } from '@shared/config.types'

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
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({
  config,
  onSave,
  children,
}: {
  config: AppConfig
  onSave: (c: AppConfig) => Promise<void>
  children: React.ReactNode
}): JSX.Element {
  const [draft, setDraft] = useState<AppConfig>(config)
  const [previewDraft, setPreviewDraft] = useState<AppConfig>(config)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [editingFolderIndex, setEditingFolderIndex] = useState<number | null>(null)
  const [selectedSubSlotIndex, setSelectedSubSlotIndex] = useState<number | null>(null)
  const [animPreviewKey, setAnimPreviewKey] = useState(0)

  // Sync when outer config changes via IPC
  useEffect(() => {
    setDraft(config)
    setPreviewDraft(config)
  }, [config])

  const updateDraft = useCallback(
    (c: AppConfig) => {
      setDraft(c)
      setPreviewDraft(c)
      onSave(c)
    },
    [onSave]
  )

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
