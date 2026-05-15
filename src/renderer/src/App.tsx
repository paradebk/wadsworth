import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type {
  DirEntry,
  ViewMode,
  Row,
  Bookmark,
  Section,
  FolderState,
  Domain,
  DomainState
} from './types'
import { STORAGE_KEYS, MIN_PREVIEW_WIDTH, MIN_LISTING_WIDTH } from './state/storageKeys'
import { basename, dirname, parentPath } from './utils/path'
import { formatSize, formatDate } from './utils/format'
import { FileTypeIcon } from './icons/FileTypeIcon'
import { fileSystemSource } from './sources/FileSystemSource'
import type { Source } from './sources/Source'
import { AboutModal } from './components/modals/AboutModal'
import { SettingsModal } from './components/modals/SettingsModal'
import { ConfirmDeleteDomainModal } from './components/modals/ConfirmDeleteDomainModal'
import { StatusBar } from './components/StatusBar'
import { PreviewPane } from './components/PreviewPane/PreviewPane'
import { DomainTabs } from './components/DomainTabs'
import { Sidebar } from './components/Sidebar/Sidebar'
import { useTheme } from './hooks/useTheme'
import { useSearch } from './hooks/useSearch'
import { usePreviewContent } from './hooks/usePreviewContent'
import { useMarkdownView } from './hooks/useMarkdownView'
import { useSettings } from './hooks/useSettings'

const source: Source = fileSystemSource

const SHOW_HIDDEN_KEY = STORAGE_KEYS.showHidden
const PREVIEW_WIDTH_KEY = STORAGE_KEYS.previewWidth
const VIEW_MODE_KEY = STORAGE_KEYS.viewMode
const LAST_PATH_KEY = STORAGE_KEYS.lastPath
const FOLDER_STATES_KEY = STORAGE_KEYS.folderStates
const DOMAIN_STATE_KEY = STORAGE_KEYS.domainState
const BOOKMARKS_KEY = STORAGE_KEYS.bookmarks
const SECTIONS_KEY = STORAGE_KEYS.sections
const SIDEBAR_OPEN_KEY = STORAGE_KEYS.sidebarOpen

// Types and helpers are imported from ./types, ./utils, ./preview, ./icons, ./sources.

function App(): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHidden, setShowHidden] = useState<boolean>(
    () => localStorage.getItem(SHOW_HIDDEN_KEY) === 'true'
  )
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) === 'tree' ? 'tree' : 'flat')
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [treeChildren, setTreeChildren] = useState<Map<string, DirEntry[]>>(() => new Map())
  const [pathInput, setPathInput] = useState('')
  const inTransitRef = useRef(false)
  const {
    query: searchQuery,
    scope: searchScope,
    results: searchResults,
    loading: searchLoading,
    setQuery: setSearchQuery,
    setScope: setSearchScope
  } = useSearch(source, currentPath)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [domainState, setDomainState] = useState<DomainState>(() => {
    try {
      const raw = localStorage.getItem(DOMAIN_STATE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DomainState
        if (parsed.domains && parsed.activeDomainId && parsed.order) return parsed
      }
    } catch {
      // Corrupt — fall through to migration.
    }
    // Migrate from old global keys.
    let migratedSections: Section[] = [
      { id: 'default', name: 'Bookmarks', bookmarks: [] }
    ]
    try {
      const sectionsRaw = localStorage.getItem(SECTIONS_KEY)
      if (sectionsRaw) migratedSections = JSON.parse(sectionsRaw) as Section[]
      else {
        const bookmarksRaw = localStorage.getItem(BOOKMARKS_KEY)
        if (bookmarksRaw) {
          const old = JSON.parse(bookmarksRaw) as Bookmark[]
          migratedSections = [{ id: 'default', name: 'Bookmarks', bookmarks: old }]
        }
      }
    } catch {
      // Old keys corrupt — start fresh.
    }
    let migratedFolderStates: Record<string, FolderState> = {}
    try {
      const fsRaw = localStorage.getItem(FOLDER_STATES_KEY)
      if (fsRaw) migratedFolderStates = JSON.parse(fsRaw) as Record<string, FolderState>
    } catch {
      // Corrupt — start fresh.
    }
    const migratedLastPath = localStorage.getItem(LAST_PATH_KEY)
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
  })
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

  type Updater<T> = T | ((prev: T) => T)
  const setSections = useCallback(
    (u: Updater<Section[]>) => {
      updateActiveDomain((d) => ({
        ...d,
        sections: typeof u === 'function' ? (u as (p: Section[]) => Section[])(d.sections) : u
      }))
    },
    [updateActiveDomain]
  )
  const setFolderStates = useCallback(
    (u: Updater<Record<string, FolderState>>) => {
      updateActiveDomain((d) => ({
        ...d,
        folderStates:
          typeof u === 'function'
            ? (u as (p: Record<string, FolderState>) => Record<string, FolderState>)(
                d.folderStates
              )
            : u
      }))
    },
    [updateActiveDomain]
  )
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false'
  )
  const [editingBookmark, setEditingBookmark] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [dragOverBookmark, setDragOverBookmark] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [domainMenuOpen, setDomainMenuOpen] = useState(false)
  const [confirmDeleteDomainId, setConfirmDeleteDomainId] = useState<string | null>(null)
  const [settings, setSettings] = useSettings()
  const effectiveTheme = useTheme(settings.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', window.api.platform)
  }, [])

  const [markdownView, setMarkdownView] = useMarkdownView()
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [editingDomainName, setEditingDomainName] = useState('')
  const [activePane, setActivePane] = useState<'sidebar' | 'files' | 'tabs'>(
    () => (localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false' ? 'sidebar' : 'files')
  )

  useEffect(() => {
    if (!settings.displayDomainsAsTabs && activePane === 'tabs') {
      setActivePane(sidebarOpen ? 'sidebar' : 'files')
    }
  }, [settings.displayDomainsAsTabs, activePane, sidebarOpen])

  useEffect(() => {
    if (
      !menuOpen &&
      !aboutOpen &&
      !domainMenuOpen &&
      !settingsOpen &&
      !confirmDeleteDomainId
    )
      return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setAboutOpen(false)
        setDomainMenuOpen(false)
        setSettingsOpen(false)
        setConfirmDeleteDomainId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, aboutOpen, domainMenuOpen, settingsOpen, confirmDeleteDomainId])

  useEffect(() => {
    localStorage.setItem(DOMAIN_STATE_KEY, JSON.stringify(domainState))
  }, [domainState])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen))
  }, [sidebarOpen])

  const currentlyBookmarked = useMemo(
    () => sections.some((s) => s.bookmarks.some((b) => b.path === currentPath)),
    [sections, currentPath]
  )

  const navigableSidebarPaths = useMemo(
    () => sections.flatMap((s) => (s.collapsed ? [] : s.bookmarks.map((b) => b.path))),
    [sections]
  )

  useEffect(() => {
    if (inTransitRef.current) return
    if (!currentPath) return
    updateActiveDomain((d) => ({
      ...d,
      folderStates: {
        ...d.folderStates,
        [currentPath]: {
          expanded: [...expanded],
          selectedPath,
          previewPath
        }
      },
      lastPath: currentPath
    }))
  }, [currentPath, expanded, selectedPath, previewPath, updateActiveDomain])

  useEffect(() => {
    setPathInput(currentPath)
  }, [currentPath])

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])
  const [previewWidth, setPreviewWidth] = useState<number>(() => {
    const v = parseInt(localStorage.getItem(PREVIEW_WIDTH_KEY) ?? '', 10)
    return Number.isFinite(v) && v >= MIN_PREVIEW_WIDTH ? v : 600
  })

  useEffect(() => {
    localStorage.setItem(PREVIEW_WIDTH_KEY, String(previewWidth))
  }, [previewWidth])

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = previewWidth
      const onMove = (m: MouseEvent): void => {
        const delta = startX - m.clientX
        const max = Math.max(MIN_PREVIEW_WIDTH, window.innerWidth - MIN_LISTING_WIDTH)
        const next = Math.max(MIN_PREVIEW_WIDTH, Math.min(max, startW + delta))
        setPreviewWidth(next)
      }
      const onUp = (): void => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [previewWidth]
  )

  useEffect(() => {
    localStorage.setItem(SHOW_HIDDEN_KEY, String(showHidden))
  }, [showHidden])

  const visibleEntries = useMemo(
    () => (showHidden ? entries : entries.filter((e) => !e.name.startsWith('.'))),
    [entries, showHidden]
  )
  const hiddenCount = entries.length - visibleEntries.length

  const inSearch = searchResults !== null
  const searchRows = useMemo<DirEntry[]>(() => {
    if (searchResults === null) return []
    return showHidden ? searchResults : searchResults.filter((e) => !e.name.startsWith('.'))
  }, [searchResults, showHidden])

  const rows = useMemo<Row[]>(() => {
    if (viewMode === 'flat') {
      return visibleEntries.map((entry) => ({ entry, depth: 0 }))
    }
    const filter = (list: DirEntry[]): DirEntry[] =>
      showHidden ? list : list.filter((e) => !e.name.startsWith('.'))
    const walk = (list: DirEntry[], depth: number): Row[] => {
      const out: Row[] = []
      for (const entry of filter(list)) {
        out.push({ entry, depth })
        if (entry.isDirectory && expanded.has(entry.path)) {
          const sub = treeChildren.get(entry.path)
          if (sub) out.push(...walk(sub, depth + 1))
        }
      }
      return out
    }
    return walk(entries, 0)
  }, [viewMode, entries, visibleEntries, expanded, treeChildren, showHidden])

  useEffect(() => {
    if (!pendingScroll) return
    const el = document.querySelector(`[data-row-path="${CSS.escape(pendingScroll)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      setPendingScroll(null)
    }
  }, [pendingScroll, rows])

  useEffect(() => {
    if (activePane !== 'sidebar' || !currentPath) return
    const el = document.querySelector(
      `[data-sidebar-path="${CSS.escape(currentPath)}"]`
    )
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activePane, currentPath])

  useEffect(() => {
    if (activePane !== 'files' || rows.length === 0) return
    const stillThere = selectedPath && rows.some((r) => r.entry.path === selectedPath)
    if (!stillThere) {
      setSelectedPath(rows[0].entry.path)
      setPendingScroll(rows[0].entry.path)
    }
  }, [activePane, rows, selectedPath])

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const real = await source.resolvePath(path).catch(() => path)
      const result = await source.list(real)
      setEntries(result)
      setCurrentPath(real)
      return real
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const switchToFolder = useCallback(
    async (newPath: string): Promise<void> => {
      inTransitRef.current = true

      if (currentPath && currentPath !== newPath) {
        setFolderStates((prev) => ({
          ...prev,
          [currentPath]: {
            expanded: [...expanded],
            selectedPath,
            previewPath
          }
        }))
      }

      const real = await source.resolvePath(newPath).catch(() => newPath)
      const target = folderStates[real]
      setExpanded(new Set(target?.expanded ?? []))
      setSelectedPath(target?.selectedPath ?? null)
      setPreviewPath(target?.previewPath ?? null)
      setTreeChildren(new Map())
      setSearchQuery('')

      await loadDirectory(real)
      inTransitRef.current = false
    },
    [currentPath, expanded, selectedPath, previewPath, folderStates, loadDirectory]
  )

  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    void (async () => {
      const home = await source.defaultPath()
      const saved = activeDomain?.lastPath
      if (saved && saved !== home) {
        try {
          await source.list(saved)
          await switchToFolder(saved)
          return
        } catch {
          // Saved folder is gone or unreadable — fall through to home.
        }
      }
      await switchToFolder(home)
    })()
  }, [switchToFolder, activeDomain])


  useEffect(() => {
    if (!currentPath) return
    const toFetch = [...expanded].filter(
      (p) =>
        (p === currentPath || p.startsWith(currentPath + '/')) && !treeChildren.has(p)
    )
    if (toFetch.length === 0) return
    let cancelled = false
    void Promise.all(
      toFetch.map(async (p) => {
        try {
          return { path: p, children: await source.list(p) }
        } catch {
          return { path: p, children: null as DirEntry[] | null }
        }
      })
    ).then((results) => {
      if (cancelled) return
      const succeeded = results.filter(
        (r): r is { path: string; children: DirEntry[] } => r.children !== null
      )
      const failed = results.filter((r) => r.children === null).map((r) => r.path)
      if (succeeded.length > 0) {
        setTreeChildren((prev) => {
          const next = new Map(prev)
          for (const s of succeeded) next.set(s.path, s.children)
          return next
        })
      }
      if (failed.length > 0) {
        setExpanded((prev) => {
          const next = new Set(prev)
          for (const p of failed) next.delete(p)
          return next
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentPath, expanded, treeChildren])

  const navigate = useCallback(
    (path: string) => {
      setHistory((h) => [...h, currentPath])
      void switchToFolder(path)
    },
    [currentPath, switchToFolder]
  )

  const goBack = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    void switchToFolder(prev)
  }, [history, switchToFolder])

  const goUp = useCallback(() => {
    const parent = parentPath(currentPath)
    if (parent && parent !== currentPath) navigate(parent)
  }, [currentPath, navigate])

  const goHome = useCallback(async () => {
    const home = await source.defaultPath()
    if (home !== currentPath) navigate(home)
  }, [currentPath, navigate])

  const onEntryActivate = useCallback(
    (entry: DirEntry) => {
      if (entry.isDirectory) {
        navigate(entry.path)
      } else {
        setPreviewPath(entry.path)
      }
    },
    [navigate]
  )

  const onEntryClick = useCallback(
    (entry: DirEntry) => {
      setSelectedPath(entry.path)
      if (previewPath && !entry.isDirectory) {
        setPreviewPath(entry.path)
      }
    },
    [previewPath]
  )

  const toggleExpand = useCallback(
    async (path: string): Promise<void> => {
      if (expanded.has(path)) {
        setExpanded((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
        return
      }
      if (!treeChildren.has(path)) {
        try {
          const ch = await source.list(path)
          setTreeChildren((prev) => new Map(prev).set(path, ch))
        } catch {
          return
        }
      }
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(path)
        return next
      })
    },
    [expanded, treeChildren]
  )

  const collapseAll = useCallback(() => setExpanded(new Set()), [])

  const addSection = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setSections((prev) => [...prev, { id, name: 'New Section', bookmarks: [] }])
    setEditingSection(id)
    setEditingLabel('New Section')
  }, [])

  const removeSection = useCallback(
    (id: string) => {
      setSections((prev) => prev.filter((s) => s.id !== id))
      if (editingSection === id) setEditingSection(null)
    },
    [editingSection]
  )

  const toggleSectionCollapsed = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
    )
  }, [])

  const startEditingSection = useCallback((s: Section) => {
    setEditingSection(s.id)
    setEditingLabel(s.name)
  }, [])

  const commitEditingSection = useCallback(() => {
    if (editingSection === null) return
    setSections((prev) =>
      prev.map((s) =>
        s.id === editingSection ? { ...s, name: editingLabel.trim() || 'Untitled' } : s
      )
    )
    setEditingSection(null)
  }, [editingSection, editingLabel])

  const addBookmarkToSection = useCallback(
    (sectionId: string) => {
      if (!currentPath) return
      if (sections.some((s) => s.bookmarks.some((b) => b.path === currentPath))) return
      const label = basename(currentPath) || currentPath
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, bookmarks: [...s.bookmarks, { path: currentPath, label }] }
            : s
        )
      )
    },
    [currentPath, sections]
  )

  const removeBookmark = useCallback(
    (path: string) => {
      setSections((prev) =>
        prev.map((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.path !== path) }))
      )
      if (editingBookmark === path) setEditingBookmark(null)
    },
    [editingBookmark]
  )

  const startEditingBookmark = useCallback((b: Bookmark) => {
    setEditingBookmark(b.path)
    setEditingLabel(b.label)
  }, [])

  const commitEditingBookmark = useCallback(() => {
    if (editingBookmark === null) return
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        bookmarks: s.bookmarks.map((b) =>
          b.path === editingBookmark
            ? { ...b, label: editingLabel.trim() || basename(b.path) || b.path }
            : b
        )
      }))
    )
    setEditingBookmark(null)
  }, [editingBookmark, editingLabel])

  const cancelEditingBookmark = useCallback(() => {
    setEditingBookmark(null)
  }, [])

  const cancelEditingSection = useCallback(() => {
    setEditingSection(null)
  }, [])

  const moveBookmark = useCallback(
    (path: string, targetSectionId: string, targetPath: string | null) => {
      setSections((prev) => {
        let moving: Bookmark | undefined
        const without = prev.map((s) => {
          const idx = s.bookmarks.findIndex((b) => b.path === path)
          if (idx === -1) return s
          moving = s.bookmarks[idx]
          return { ...s, bookmarks: s.bookmarks.filter((_, i) => i !== idx) }
        })
        if (!moving) return prev
        return without.map((s) => {
          if (s.id !== targetSectionId) return s
          const next = [...s.bookmarks]
          const insertAt =
            targetPath === null
              ? next.length
              : Math.max(
                  0,
                  next.findIndex((b) => b.path === targetPath)
                )
          next.splice(insertAt, 0, moving!)
          return { ...s, bookmarks: next }
        })
      })
    },
    []
  )

  const switchDomain = useCallback(
    async (newDomainId: string): Promise<void> => {
      if (newDomainId === domainState.activeDomainId) return
      const target = domainState.domains[newDomainId]
      if (!target) return
      inTransitRef.current = true

      // Save current folder state into current domain before switching.
      if (currentPath) {
        setDomainState((prev) => {
          const cur = prev.domains[prev.activeDomainId]
          if (!cur) return prev
          return {
            ...prev,
            domains: {
              ...prev.domains,
              [prev.activeDomainId]: {
                ...cur,
                folderStates: {
                  ...cur.folderStates,
                  [currentPath]: {
                    expanded: [...expanded],
                    selectedPath,
                    previewPath
                  }
                },
                lastPath: currentPath
              }
            },
            activeDomainId: newDomainId
          }
        })
      } else {
        setDomainState((prev) => ({ ...prev, activeDomainId: newDomainId }))
      }

      const targetPath = target.lastPath ?? (await source.defaultPath())
      const real = await source.resolvePath(targetPath).catch(() => targetPath)
      const fs = target.folderStates[real]
      setExpanded(new Set(fs?.expanded ?? []))
      setSelectedPath(fs?.selectedPath ?? null)
      setPreviewPath(fs?.previewPath ?? null)
      setTreeChildren(new Map())
      setSearchQuery('')
      await loadDirectory(real)
      inTransitRef.current = false
    },
    [domainState, currentPath, expanded, selectedPath, previewPath, loadDirectory]
  )

  const createDomain = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const name = 'New domain'
    setDomainState((prev) => ({
      ...prev,
      domains: {
        ...prev.domains,
        [id]: {
          id,
          name,
          sections: [{ id: 'default', name: 'Bookmarks', bookmarks: [] }],
          folderStates: {},
          lastPath: null
        }
      },
      order: [...prev.order, id]
    }))
    // Switch on next tick so the new domain is in state.
    setTimeout(() => {
      void switchDomain(id)
      setEditingDomain(id)
      setEditingDomainName(name)
    }, 0)
  }, [switchDomain])

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

  const deleteDomain = useCallback(
    (id: string) => {
      setDomainState((prev) => {
        if (prev.order.length <= 1) return prev
        const remaining = prev.order.filter((x) => x !== id)
        const { [id]: _removed, ...domains } = prev.domains
        void _removed
        const nextActive = prev.activeDomainId === id ? remaining[0] : prev.activeDomainId
        return { domains, order: remaining, activeDomainId: nextActive }
      })
    },
    []
  )

  const moveSection = useCallback(
    (sourceId: string, targetId: string, before: boolean) => {
      if (sourceId === targetId) return
      setSections((prev) => {
        const srcIdx = prev.findIndex((s) => s.id === sourceId)
        const tgtIdx = prev.findIndex((s) => s.id === targetId)
        if (srcIdx === -1 || tgtIdx === -1) return prev
        const next = [...prev]
        const [moved] = next.splice(srcIdx, 1)
        let insertAt = before ? tgtIdx : tgtIdx + 1
        if (srcIdx < tgtIdx) insertAt -= 1
        next.splice(insertAt, 0, moved)
        return next
      })
    },
    []
  )

  const revealInTree = useCallback(
    async (targetPath: string): Promise<void> => {
      const isWithin =
        targetPath === currentPath || targetPath.startsWith(currentPath + '/')
      if (!isWithin) return

      setViewMode('tree')

      const rel = targetPath.slice(currentPath.length + 1)
      const segments = rel ? rel.split('/') : []
      const parents: string[] = []
      let acc = currentPath
      for (let i = 0; i < segments.length - 1; i++) {
        acc = acc + '/' + segments[i]
        parents.push(acc)
      }

      const updates: Array<[string, DirEntry[]]> = []
      for (const p of parents) {
        if (!treeChildren.has(p)) {
          try {
            const ch = await source.list(p)
            updates.push([p, ch])
          } catch {
            return
          }
        }
      }
      if (updates.length > 0) {
        setTreeChildren((prev) => {
          const next = new Map(prev)
          for (const [k, v] of updates) next.set(k, v)
          return next
        })
      }
      if (parents.length > 0) {
        setExpanded((prev) => {
          const next = new Set(prev)
          for (const p of parents) next.add(p)
          return next
        })
      }
      setSelectedPath(targetPath)
      setPendingScroll(targetPath)
    },
    [currentPath, treeChildren]
  )

  const onSearchResultClick = useCallback(
    (entry: DirEntry) => {
      setSelectedPath(entry.path)
      const isWithin =
        entry.path === currentPath || entry.path.startsWith(currentPath + '/')
      if (isWithin) void revealInTree(entry.path)
      if (previewPath && !entry.isDirectory) setPreviewPath(entry.path)
    },
    [currentPath, previewPath, revealInTree]
  )

  const onSearchResultDoubleClick = useCallback(
    (entry: DirEntry) => {
      const isWithin =
        entry.path === currentPath || entry.path.startsWith(currentPath + '/')
      if (isWithin) void revealInTree(entry.path)
      if (!entry.isDirectory) setPreviewPath(entry.path)
    },
    [currentPath, revealInTree]
  )

  useEffect(() => {
    if (!previewPath) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPreviewPath(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewPath])

  const { textPreview, textError, quicklookPng, quicklookLoading } = usePreviewContent(
    source,
    previewPath
  )

  const canGoUp = useMemo(() => {
    const parent = parentPath(currentPath)
    return parent !== null && parent !== currentPath
  }, [currentPath])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (
        menuOpen ||
        aboutOpen ||
        settingsOpen ||
        confirmDeleteDomainId ||
        editingSection ||
        editingBookmark
      )
        return

      const cmd = e.metaKey || e.ctrlKey

      if (cmd && (e.key === '[' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        goBack()
        return
      }
      if (cmd && e.key === 'ArrowUp') {
        e.preventDefault()
        goUp()
        return
      }

      if (activePane === 'tabs') {
        if (e.key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const idx = domainState.order.indexOf(domainState.activeDomainId)
          if (idx > 0) void switchDomain(domainState.order[idx - 1])
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault()
          const idx = domainState.order.indexOf(domainState.activeDomainId)
          if (idx >= 0 && idx < domainState.order.length - 1) {
            void switchDomain(domainState.order[idx + 1])
          }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          setActivePane(sidebarOpen ? 'sidebar' : 'files')
        }
        return
      }

      if (activePane === 'sidebar') {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          if (navigableSidebarPaths.length === 0) return
          const idx = navigableSidebarPaths.indexOf(currentPath)
          const next =
            idx === -1
              ? navigableSidebarPaths[0]
              : navigableSidebarPaths[
                  Math.min(idx + 1, navigableSidebarPaths.length - 1)
                ]
          if (next && next !== currentPath) navigate(next)
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (navigableSidebarPaths.length === 0) {
            if (settings.displayDomainsAsTabs) setActivePane('tabs')
            return
          }
          const idx = navigableSidebarPaths.indexOf(currentPath)
          if (
            settings.displayDomainsAsTabs &&
            (idx === 0 || idx === -1)
          ) {
            setActivePane('tabs')
            return
          }
          const next = navigableSidebarPaths[Math.max(idx - 1, 0)]
          if (next && next !== currentPath) navigate(next)
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault()
          setActivePane('files')
        }
        return
      }

      if (activePane === 'files') {
        const cur = selectedPath
          ? rows.findIndex((r) => r.entry.path === selectedPath)
          : -1

        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          if (rows.length === 0) return
          const next = rows[Math.min(cur + 1, rows.length - 1)] ?? rows[0]
          setSelectedPath(next.entry.path)
          setPendingScroll(next.entry.path)
          if (previewPath && !next.entry.isDirectory) setPreviewPath(next.entry.path)
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (rows.length === 0) return
          const next = rows[Math.max(cur - 1, 0)] ?? rows[rows.length - 1]
          setSelectedPath(next.entry.path)
          setPendingScroll(next.entry.path)
          if (previewPath && !next.entry.isDirectory) setPreviewPath(next.entry.path)
        } else if (e.key === 'l' || e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault()
          const row = cur >= 0 ? rows[cur] : null
          if (row) onEntryActivate(row.entry)
        } else if (e.key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault()
          if (!sidebarOpen) setSidebarOpen(true)
          setActivePane('sidebar')
        } else if (e.key === ' ') {
          if (viewMode !== 'tree' || cur < 0) return
          const row = rows[cur]
          if (!row.entry.isDirectory) return
          e.preventDefault()
          void toggleExpand(row.entry.path)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    activePane,
    navigableSidebarPaths,
    selectedPath,
    rows,
    previewPath,
    currentPath,
    viewMode,
    sidebarOpen,
    menuOpen,
    aboutOpen,
    settingsOpen,
    confirmDeleteDomainId,
    editingSection,
    editingBookmark,
    navigate,
    goBack,
    goUp,
    onEntryActivate,
    toggleExpand,
    settings.displayDomainsAsTabs,
    domainState.order,
    domainState.activeDomainId,
    switchDomain
  ])

  return (
    <div className="app">
      <header className="toolbar">
        <div className="menu-wrapper">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={menuOpen ? 'active' : ''}
          >
            ☰
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu" role="menu">
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    addSection()
                    setMenuOpen(false)
                  }}
                >
                  Add new section
                </button>
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    createDomain()
                    setMenuOpen(false)
                  }}
                >
                  New domain…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    if (activeDomain) {
                      startEditingDomain(activeDomain)
                      if (!settings.displayDomainsAsTabs) setDomainMenuOpen(true)
                    }
                    setMenuOpen(false)
                  }}
                >
                  Rename current domain…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  disabled={domainState.order.length <= 1}
                  onClick={() => {
                    if (activeDomain && domainState.order.length > 1) {
                      setConfirmDeleteDomainId(activeDomain.id)
                    }
                    setMenuOpen(false)
                  }}
                >
                  Delete current domain…
                </button>
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  Settings…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setAboutOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  About Wadsworth
                </button>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-label="Toggle sidebar"
          className={sidebarOpen ? 'active' : ''}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="1.5"
              y="2.5"
              width="11"
              height="9"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <line
              x1="5.5"
              y1="2.5"
              x2="5.5"
              y2="11.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
        {!settings.displayDomainsAsTabs && (
        <div className="menu-wrapper">
          <button
            type="button"
            className={`domain-button ${domainMenuOpen ? 'active' : ''}`}
            onClick={() => setDomainMenuOpen((v) => !v)}
            title="Switch domain"
            aria-haspopup="menu"
            aria-expanded={domainMenuOpen}
          >
            {editingDomain && editingDomain === activeDomain?.id ? (
              <input
                className="domain-button-input"
                value={editingDomainName}
                autoFocus
                onChange={(e) => setEditingDomainName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') commitEditingDomain()
                  else if (e.key === 'Escape') cancelEditingDomain()
                }}
                onBlur={commitEditingDomain}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="domain-name">{activeDomain?.name ?? 'Domain'}</span>
                <span className="domain-caret">▾</span>
              </>
            )}
          </button>
          {domainMenuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setDomainMenuOpen(false)} />
              <div className="menu domain-menu" role="menu">
                {domainState.order.map((id) => {
                  const d = domainState.domains[id]
                  if (!d) return null
                  const isActive = id === domainState.activeDomainId
                  return editingDomain === id ? (
                    <input
                      key={id}
                      className="domain-edit-input"
                      value={editingDomainName}
                      autoFocus
                      onChange={(e) => setEditingDomainName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditingDomain()
                        else if (e.key === 'Escape') cancelEditingDomain()
                      }}
                      onBlur={commitEditingDomain}
                    />
                  ) : (
                    <button
                      key={id}
                      type="button"
                      className={`menu-item domain-item ${isActive ? 'active' : ''}`}
                      role="menuitem"
                      onDoubleClick={() => startEditingDomain(d)}
                      onClick={() => {
                        if (!isActive) void switchDomain(id)
                        setDomainMenuOpen(false)
                      }}
                    >
                      <span className="domain-item-check">{isActive ? '✓' : ''}</span>
                      <span className="domain-item-name">{d.name}</span>
                    </button>
                  )
                })}
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    createDomain()
                    setDomainMenuOpen(false)
                  }}
                >
                  + New domain…
                </button>
              </div>
            </>
          )}
        </div>
        )}
        <button
          type="button"
          onClick={goBack}
          disabled={history.length === 0}
          title="Back"
          aria-label="Back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goUp}
          disabled={!canGoUp}
          title="Up to parent folder"
          aria-label="Up"
        >
          ↑
        </button>
        <button type="button" onClick={goHome} title="Home folder" aria-label="Home">
          ⌂
        </button>
        <div className="segmented" role="group" aria-label="View mode">
          <button
            type="button"
            className={viewMode === 'flat' ? 'active' : ''}
            onClick={() => setViewMode('flat')}
            title="Flat view"
          >
            Flat
          </button>
          <button
            type="button"
            className={viewMode === 'tree' ? 'active' : ''}
            onClick={() => setViewMode('tree')}
            title="Tree view"
          >
            Tree
          </button>
        </div>
        <button
          type="button"
          onClick={collapseAll}
          disabled={viewMode !== 'tree' || expanded.size === 0}
          title="Collapse all folders"
        >
          ⇱
        </button>
        <label className="toggle" title="Show files and folders starting with a dot">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
        <input
          className="path"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setHistory((h) => [...h, currentPath])
              void switchToFolder(pathInput)
            }
          }}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => currentPath && void source.openExternal(currentPath)}
          disabled={!currentPath}
          title={
            window.api.platform === 'darwin'
              ? 'Reveal in Finder'
              : window.api.platform === 'win32'
                ? 'Open in Explorer'
                : 'Open in file manager'
          }
          aria-label="Open in system file manager"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M11 7.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 2.5h3v3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11.5 2.5L6 8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="search-group">
          <input
            className="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('')
            }}
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <div className="segmented" role="group" aria-label="Search scope">
            <button
              type="button"
              className={searchScope === 'folder' ? 'active' : ''}
              onClick={() => setSearchScope('folder')}
              title="Search inside the current folder"
            >
              Here
            </button>
            <button
              type="button"
              className={searchScope === 'everywhere' ? 'active' : ''}
              onClick={() => setSearchScope('everywhere')}
              title="Search the entire Mac"
            >
              Mac
            </button>
          </div>
        </div>
      </header>

      {settings.displayDomainsAsTabs && (
        <DomainTabs
          domainState={domainState}
          active={activePane === 'tabs'}
          editingId={editingDomain}
          editingName={editingDomainName}
          setEditingName={setEditingDomainName}
          onActivate={() => setActivePane('tabs')}
          onSwitch={(id) => void switchDomain(id)}
          onStartEditing={startEditingDomain}
          onCommitEditing={commitEditingDomain}
          onCancelEditing={cancelEditingDomain}
          onCreate={createDomain}
          onRequestDelete={setConfirmDeleteDomainId}
        />
      )}

      {error && <div className="error">{error}</div>}

      <div className={`body ${previewPath ? 'split' : ''}`}>
        {sidebarOpen && (
          <Sidebar
            sections={sections}
            active={activePane === 'sidebar'}
            currentPath={currentPath}
            currentlyBookmarked={currentlyBookmarked}
            editingSection={editingSection}
            editingBookmark={editingBookmark}
            editingLabel={editingLabel}
            dragOverBookmark={dragOverBookmark}
            dragOverSection={dragOverSection}
            setEditingLabel={setEditingLabel}
            setDragOverBookmark={setDragOverBookmark}
            setDragOverSection={setDragOverSection}
            onActivate={() => setActivePane('sidebar')}
            onToggleSectionCollapsed={toggleSectionCollapsed}
            onStartEditingSection={startEditingSection}
            onCommitEditingSection={commitEditingSection}
            onCancelEditingSection={cancelEditingSection}
            onAddBookmarkToSection={addBookmarkToSection}
            onRemoveSection={removeSection}
            onStartEditingBookmark={startEditingBookmark}
            onCommitEditingBookmark={commitEditingBookmark}
            onCancelEditingBookmark={cancelEditingBookmark}
            onRemoveBookmark={removeBookmark}
            onMoveSection={moveSection}
            onMoveBookmark={moveBookmark}
            onNavigate={navigate}
          />
        )}
        <div
          className={`left ${activePane === 'files' ? 'pane-active' : ''}`}
          onMouseDown={() => setActivePane('files')}
        >
          <div className="listing">
            <div className="row header">
              <span className="col-name">Name</span>
              <span className="col-size">Size</span>
              <span className="col-date">Modified</span>
            </div>
            {loading && entries.length === 0 ? (
              <div className="empty">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="empty">Empty folder</div>
            ) : rows.length === 0 ? (
              <div className="empty">
                {hiddenCount} hidden item{hiddenCount === 1 ? '' : 's'} — toggle
                &ldquo;Show hidden&rdquo; to view
              </div>
            ) : (
              rows.map(({ entry, depth }) => {
                const isOpen = expanded.has(entry.path)
                return (
                  <div
                    key={entry.path}
                    data-row-path={entry.path}
                    className={`row ${selectedPath === entry.path ? 'selected' : ''}`}
                    onClick={() => onEntryClick(entry)}
                    onDoubleClick={() => onEntryActivate(entry)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onEntryActivate(entry)
                    }}
                  >
                    <span className="col-name" style={{ paddingLeft: depth * 16 }}>
                      {viewMode === 'tree' ? (
                        entry.isDirectory ? (
                          <span
                            className="caret"
                            role="button"
                            aria-label={isOpen ? 'Collapse' : 'Expand'}
                            onClick={(e) => {
                              e.stopPropagation()
                              void toggleExpand(entry.path)
                            }}
                          >
                            {isOpen ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                          </span>
                        ) : (
                          <span className="caret-spacer" />
                        )
                      ) : null}
                      <span className="icon">
                        <FileTypeIcon
                          path={entry.path}
                          isDirectory={entry.isDirectory}
                          expanded={isOpen}
                        />
                      </span>
                      <span className="name-stack">
                        <span className="name-line">{entry.name}</span>
                      </span>
                    </span>
                    <span className="col-size">
                      {entry.isDirectory ? '—' : formatSize(entry.size)}
                    </span>
                    <span className="col-date">{formatDate(entry.modifiedMs)}</span>
                  </div>
                )
              })
            )}
          </div>

          {inSearch && (
            <div className="search-pane">
              <div className="search-pane-header">
                <span>
                  Search results
                  {searchLoading
                    ? ' (searching…)'
                    : ` (${searchRows.length}${
                        searchRows.length === 500 ? '+' : ''
                      })`}
                </span>
                <span className="search-pane-scope">
                  {searchScope === 'folder' ? 'in this folder' : 'across Mac'}
                </span>
              </div>
              <div className="listing search-listing">
                {searchLoading && searchRows.length === 0 ? (
                  <div className="empty">Searching…</div>
                ) : searchRows.length === 0 ? (
                  <div className="empty">No results for &ldquo;{searchQuery}&rdquo;</div>
                ) : (
                  searchRows.map((entry) => {
                    const isWithin =
                      entry.path === currentPath ||
                      entry.path.startsWith(currentPath + '/')
                    return (
                      <div
                        key={entry.path}
                        className={`row ${
                          selectedPath === entry.path ? 'selected' : ''
                        } ${isWithin ? '' : 'outside'}`}
                        onClick={() => onSearchResultClick(entry)}
                        onDoubleClick={() => onSearchResultDoubleClick(entry)}
                        tabIndex={0}
                      >
                        <span className="col-name">
                          <span className="icon">
                            <FileTypeIcon path={entry.path} isDirectory={entry.isDirectory} />
                          </span>
                          <span className="name-stack">
                            <span className="name-line">{entry.name}</span>
                            <span className="name-sub" title={entry.path}>
                              {dirname(entry.path)}
                            </span>
                          </span>
                        </span>
                        <span className="col-size">
                          {entry.isDirectory ? '—' : formatSize(entry.size)}
                        </span>
                        <span className="col-date">{formatDate(entry.modifiedMs)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {previewPath && (
          <div
            className="divider"
            onMouseDown={startResize}
            title="Drag to resize"
            role="separator"
            aria-orientation="vertical"
          />
        )}

        {previewPath && (
          <PreviewPane
            previewPath={previewPath}
            width={previewWidth}
            source={source}
            effectiveTheme={effectiveTheme}
            content={{ textPreview, textError, quicklookPng, quicklookLoading }}
            markdownView={markdownView}
            setMarkdownView={setMarkdownView}
            onClose={() => setPreviewPath(null)}
          />
        )}
      </div>

      <StatusBar
        viewMode={viewMode}
        visibleCount={visibleEntries.length}
        rowCount={rows.length}
        hiddenCount={hiddenCount}
        showHidden={showHidden}
        selectedPath={selectedPath}
      />

      {confirmDeleteDomainId && (
        <ConfirmDeleteDomainModal
          domainName={domainState.domains[confirmDeleteDomainId]?.name ?? ''}
          onCancel={() => setConfirmDeleteDomainId(null)}
          onConfirm={() => {
            const id = confirmDeleteDomainId
            setConfirmDeleteDomainId(null)
            if (id) deleteDomain(id)
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  )
}

export default App
