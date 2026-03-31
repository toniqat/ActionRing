import { app } from 'electron'
import { join, extname, basename } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import type { CustomIconEntry } from '@shared/ipc.types'

const MAX_RECENT = 30

export class IconStore {
  private iconsDir: string
  private libraryPath: string
  private recentPath: string

  constructor() {
    const userData = app.getPath('userData')
    this.iconsDir = join(userData, 'custom-icons')
    this.libraryPath = join(userData, 'custom-icons-library.json')
    this.recentPath = join(userData, 'recent-icons.json')
    mkdirSync(this.iconsDir, { recursive: true })
  }

  // ── Custom icon library ──────────────────────────────────────────────────

  private loadLibrary(): CustomIconEntry[] {
    if (!existsSync(this.libraryPath)) return []
    try {
      return JSON.parse(readFileSync(this.libraryPath, 'utf-8')) as CustomIconEntry[]
    } catch {
      return []
    }
  }

  private saveLibrary(entries: CustomIconEntry[]): void {
    writeFileSync(this.libraryPath, JSON.stringify(entries, null, 2), 'utf-8')
  }

  getCustomIcons(): CustomIconEntry[] {
    return this.loadLibrary()
  }

  /** Copy sourcePath into userData/custom-icons/, register it, and return the entry. */
  addCustomIcon(sourcePath: string): CustomIconEntry {
    const id = Math.random().toString(36).slice(2, 10)
    const ext = extname(sourcePath)
    const name = basename(sourcePath, ext)
    const destFilename = `${id}${ext}`
    const absPath = join(this.iconsDir, destFilename)
    copyFileSync(sourcePath, absPath)
    const entry: CustomIconEntry = { id, absPath, name }
    const library = this.loadLibrary()
    library.push(entry)
    this.saveLibrary(library)
    return entry
  }

  removeCustomIcon(id: string): void {
    const library = this.loadLibrary()
    this.saveLibrary(library.filter((e) => e.id !== id))
  }

  // ── Recently used icons ──────────────────────────────────────────────────

  getRecentIcons(): string[] {
    if (!existsSync(this.recentPath)) return []
    try {
      return JSON.parse(readFileSync(this.recentPath, 'utf-8')) as string[]
    } catch {
      return []
    }
  }

  /** Prepend iconRef (builtin name or absPath) to the recent list, capped at MAX_RECENT. */
  addRecentIcon(iconRef: string): void {
    const recent = this.getRecentIcons().filter((r) => r !== iconRef)
    recent.unshift(iconRef)
    writeFileSync(
      this.recentPath,
      JSON.stringify(recent.slice(0, MAX_RECENT), null, 2),
      'utf-8'
    )
  }
}
