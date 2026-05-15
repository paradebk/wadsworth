import { useCallback, useEffect, useState } from 'react'
import type {
  Bookmark,
  Domain,
  DomainState,
  FolderState,
  Section
} from '../types'
import { STORAGE_KEYS } from '../state/storageKeys'

/**
 * Initial state from localStorage, with migration from the older flat keys
 * (`bookmarks`, `sections`, `folderStates`, `lastPath`) into a single default
 * domain. Safe to remove the migration in a future version once everyone has
 * upgraded.
 */
function loadInitialDomainState(): DomainState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.domainState)
    if (raw) {
      const parsed = JSON.parse(raw) as DomainState
      if (parsed.domains && parsed.activeDomainId && parsed.order) return parsed
    }
  } catch {
    // Corrupt — fall through to migration.
  }
  let migratedSections: Section[] = [
    { id: 'default', name: 'Bookmarks', bookmarks: [] }
  ]
  try {
    const sectionsRaw = localStorage.getItem(STORAGE_KEYS.sections)
    if (sectionsRaw) migratedSections = JSON.parse(sectionsRaw) as Section[]
    else {
      const bookmarksRaw = localStorage.getItem(STORAGE_KEYS.bookmarks)
      if (bookmarksRaw) {
        const old = JSON.parse(bookmarksRaw) as Bookmark[]
        migratedSections = [{ id: 'default', name: 'Bookmarks', bookmarks: old }]
      }
    }
  } catch {
    // Corrupt — start fresh.
  }
  let migratedFolderStates: Record<string, FolderState> = {}
  try {
    const fsRaw = localStorage.getItem(STORAGE_KEYS.folderStates)
    if (fsRaw) migratedFolderStates = JSON.parse(fsRaw) as Record<string, FolderState>
  } catch {
    // Corrupt — start fresh.
  }
  const migratedLastPath = localStorage.getItem(STORAGE_KEYS.lastPath)
  const defaultDomain: Domain = {
    id: 'default',
    name: 'Default',
    sections: migratedSections,
    folderStates: migratedFolderStates,
    lastPath: migratedLastPath
  }
  return {
    domains: { default: defaultDomain },
    activeDomainId: 'default',
    order: ['default']
  }
}

export type UseDomainState = {
  domainState: DomainState
  activeDomain: Domain | undefined
  sections: Section[]
  folderStates: Record<string, FolderState>
  setDomainState: React.Dispatch<React.SetStateAction<DomainState>>
  updateActiveDomain: (updater: (d: Domain) => Domain) => void
  setSections: (
    updater: Section[] | ((prev: Section[]) => Section[])
  ) => void
  setFolderStates: (
    updater:
      | Record<string, FolderState>
      | ((prev: Record<string, FolderState>) => Record<string, FolderState>)
  ) => void
  // Editing-the-domain-name state (used by toolbar dropdown and tabs)
  editingDomain: string | null
  setEditingDomain: (s: string | null) => void
  editingDomainName: string
  setEditingDomainName: (s: string) => void
  startEditingDomain: (d: Domain) => void
  commitEditingDomain: () => void
  cancelEditingDomain: () => void
  // Synchronous "do this domain mutation" helpers used by orchestrations.
  deleteDomain: (id: string) => void
}

/**
 * Owns the persisted multi-domain state (workspaces). One hook = one source
 * of truth for everything inside `wadsworth:domainState`.
 *
 * Cross-cutting actions (switchDomain / createDomain) live in App.tsx because
 * they touch state owned by other hooks (expanded, selectedPath, etc.). This
 * hook exposes the low-level pieces those orchestrations need:
 * `setDomainState`, `updateActiveDomain`, etc.
 */
export function useDomainState(): UseDomainState {
  const [domainState, setDomainState] = useState<DomainState>(loadInitialDomainState)
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [editingDomainName, setEditingDomainName] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.domainState, JSON.stringify(domainState))
  }, [domainState])

  const activeDomain = domainState.domains[domainState.activeDomainId]
  const sections = activeDomain?.sections ?? []
  const folderStates = activeDomain?.folderStates ?? {}

  const updateActiveDomain = useCallback(
    (updater: (d: Domain) => Domain) => {
      setDomainState((prev) => {
        const cur = prev.domains[prev.activeDomainId]
        if (!cur) return prev
        return {
          ...prev,
          domains: { ...prev.domains, [prev.activeDomainId]: updater(cur) }
        }
      })
    },
    []
  )

  const setSections = useCallback(
    (updater: Section[] | ((prev: Section[]) => Section[])) => {
      updateActiveDomain((d) => ({
        ...d,
        sections:
          typeof updater === 'function'
            ? (updater as (p: Section[]) => Section[])(d.sections)
            : updater
      }))
    },
    [updateActiveDomain]
  )

  const setFolderStates = useCallback(
    (
      updater:
        | Record<string, FolderState>
        | ((prev: Record<string, FolderState>) => Record<string, FolderState>)
    ) => {
      updateActiveDomain((d) => ({
        ...d,
        folderStates:
          typeof updater === 'function'
            ? (
                updater as (
                  p: Record<string, FolderState>
                ) => Record<string, FolderState>
              )(d.folderStates)
            : updater
      }))
    },
    [updateActiveDomain]
  )

  const startEditingDomain = useCallback((d: Domain) => {
    setEditingDomain(d.id)
    setEditingDomainName(d.name)
  }, [])

  const commitEditingDomain = useCallback(() => {
    if (!editingDomain) return
    const name = editingDomainName.trim() || 'Untitled'
    setDomainState((prev) => {
      const d = prev.domains[editingDomain]
      if (!d) return prev
      return {
        ...prev,
        domains: { ...prev.domains, [editingDomain]: { ...d, name } }
      }
    })
    setEditingDomain(null)
  }, [editingDomain, editingDomainName])

  const cancelEditingDomain = useCallback(() => setEditingDomain(null), [])

  const deleteDomain = useCallback((id: string) => {
    setDomainState((prev) => {
      if (prev.order.length <= 1) return prev
      const remaining = prev.order.filter((x) => x !== id)
      const { [id]: _removed, ...domains } = prev.domains
      void _removed
      const nextActive =
        prev.activeDomainId === id ? remaining[0] : prev.activeDomainId
      return { domains, order: remaining, activeDomainId: nextActive }
    })
  }, [])

  return {
    domainState,
    activeDomain,
    sections,
    folderStates,
    setDomainState,
    updateActiveDomain,
    setSections,
    setFolderStates,
    editingDomain,
    setEditingDomain,
    editingDomainName,
    setEditingDomainName,
    startEditingDomain,
    commitEditingDomain,
    cancelEditingDomain,
    deleteDomain
  }
}
