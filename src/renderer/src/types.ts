import type { DirEntry, TextFile } from '../../preload'

export type { DirEntry, TextFile }

export type ViewMode = 'flat' | 'tree'
export type SearchScope = 'folder' | 'everywhere'
export type Row = { entry: DirEntry; depth: number }
export type Bookmark = { path: string; label: string }
export type Section = {
  id: string
  name: string
  bookmarks: Bookmark[]
  collapsed?: boolean
}

export type FolderState = {
  expanded: string[]
  selectedPath: string | null
  previewPath: string | null
}

export type Domain = {
  id: string
  name: string
  sections: Section[]
  folderStates: Record<string, FolderState>
  lastPath: string | null
}

export type DomainState = {
  domains: Record<string, Domain>
  activeDomainId: string
  order: string[]
}

export type ThemePref = 'system' | 'light' | 'dark'
export type Settings = {
  displayDomainsAsTabs: boolean
  theme: ThemePref
}

export type ActivePane = 'sidebar' | 'files' | 'tabs'
