import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirEntry, ViewMode, Row } from './types'
import { STORAGE_KEYS, MIN_PREVIEW_WIDTH, MIN_LISTING_WIDTH } from './state/storageKeys'
import { parentPath } from './utils/path'
import { fileSystemSource } from './sources/FileSystemSource'
import type { Source } from './sources/Source'
import { AboutModal } from './components/modals/AboutModal'
import { SettingsModal } from './components/modals/SettingsModal'
import { ConfirmDeleteDomainModal } from './components/modals/ConfirmDeleteDomainModal'
import { StatusBar } from './components/StatusBar'
import { PreviewPane } from './components/PreviewPane/PreviewPane'
import { DomainTabs } from './components/DomainTabs'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toolbar } from './components/Toolbar/Toolbar'
import { FilePane } from './components/FilePane/FilePane'
import { useTheme } from './hooks/useTheme'
import { useSearch } from './hooks/useSearch'
import { usePreviewContent } from './hooks/usePreviewContent'
import { useMarkdownView } from './hooks/useMarkdownView'
import { useSettings } from './hooks/useSettings'
import { useDomainState } from './hooks/useDomainState'
import { useBookmarks } from './hooks/useBookmarks'

const source: Source = fileSystemSource

const SHOW_HIDDEN_KEY = STORAGE_KEYS.showHidden
const PREVIEW_WIDTH_KEY = STORAGE_KEYS.previewWidth
const VIEW_MODE_KEY = STORAGE_KEYS.viewMode
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

  // Domain workspace state — sections, folder-states, last-path per domain.
  const {
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
  } = useDomainState()

  // Sections + bookmarks CRUD layered on top.
  const bookmarks = useBookmarks(sections, setSections, currentPath)
  const {
    addSection,
    removeSection,
    toggleSectionCollapsed,
    moveSection,
    editingSection,
    startEditingSection,
    commitEditingSection,
    cancelEditingSection,
    addBookmarkToSection,
    removeBookmark,
    moveBookmark,
    editingBookmark,
    startEditingBookmark,
    commitEditingBookmark,
    cancelEditingBookmark,
    editingLabel,
    setEditingLabel,
    dragOverBookmark,
    setDragOverBookmark,
    dragOverSection,
    setDragOverSection,
    currentlyBookmarked
  } = bookmarks

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false'
  )
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
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen))
  }, [sidebarOpen])

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
      <Toolbar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onAddSection={addSection}
        onCreateDomain={createDomain}
        onRenameCurrentDomain={() => {
          if (activeDomain) {
            startEditingDomain(activeDomain)
            if (!settings.displayDomainsAsTabs) setDomainMenuOpen(true)
          }
        }}
        onRequestDeleteCurrentDomain={() => {
          if (activeDomain && domainState.order.length > 1) {
            setConfirmDeleteDomainId(activeDomain.id)
          }
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        showDomainDropdown={!settings.displayDomainsAsTabs}
        domainState={domainState}
        activeDomain={activeDomain}
        domainMenuOpen={domainMenuOpen}
        setDomainMenuOpen={setDomainMenuOpen}
        editingDomain={editingDomain}
        editingDomainName={editingDomainName}
        setEditingDomainName={setEditingDomainName}
        onStartEditingDomain={startEditingDomain}
        onCommitEditingDomain={commitEditingDomain}
        onCancelEditingDomain={cancelEditingDomain}
        onSwitchDomain={(id) => void switchDomain(id)}
        goBack={goBack}
        goUp={goUp}
        goHome={goHome}
        canGoBack={history.length > 0}
        canGoUp={canGoUp}
        viewMode={viewMode}
        setViewMode={setViewMode}
        collapseAll={collapseAll}
        hasExpandedFolders={expanded.size > 0}
        showHidden={showHidden}
        setShowHidden={setShowHidden}
        pathInput={pathInput}
        setPathInput={setPathInput}
        onCommitPath={() => {
          setHistory((h) => [...h, currentPath])
          void switchToFolder(pathInput)
        }}
        currentPath={currentPath}
        onOpenCurrentExternal={() => currentPath && void source.openExternal(currentPath)}
        platform={window.api.platform}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchScope={searchScope}
        setSearchScope={setSearchScope}
      />

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
        <FilePane
          active={activePane === 'files'}
          onActivate={() => setActivePane('files')}
          loading={loading}
          entries={entries}
          rows={rows}
          viewMode={viewMode}
          expanded={expanded}
          hiddenCount={hiddenCount}
          selectedPath={selectedPath}
          onEntryClick={onEntryClick}
          onEntryActivate={onEntryActivate}
          onToggleExpand={(p) => void toggleExpand(p)}
          inSearch={inSearch}
          searchLoading={searchLoading}
          searchRows={searchRows}
          searchQuery={searchQuery}
          searchScope={searchScope}
          currentPath={currentPath}
          onSearchResultClick={onSearchResultClick}
          onSearchResultDoubleClick={onSearchResultDoubleClick}
        />

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
