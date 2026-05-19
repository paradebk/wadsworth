import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirEntry, ViewMode, Row } from './types'
import { STORAGE_KEYS } from './state/storageKeys'
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
import { useTreeExpansion } from './hooks/useTreeExpansion'
import { usePreviewWidth } from './hooks/usePreviewWidth'
import { useKeyboardNav } from './hooks/useKeyboardNav'
import { useModals } from './hooks/useModals'

const source: Source = fileSystemSource

const SHOW_HIDDEN_KEY = STORAGE_KEYS.showHidden
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
  const {
    expanded,
    treeChildren,
    setExpanded,
    setTreeChildren,
    toggleExpand,
    collapseAll
  } = useTreeExpansion(source, currentPath)
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
  const {
    menuOpen,
    setMenuOpen,
    aboutOpen,
    setAboutOpen,
    settingsOpen,
    setSettingsOpen,
    domainMenuOpen,
    setDomainMenuOpen,
    confirmDeleteDomainId,
    setConfirmDeleteDomainId
  } = useModals()
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
  const { width: previewWidth, startResize } = usePreviewWidth()

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
    const el = document.querySelector(
      `[data-row-path="${CSS.escape(pendingScroll)}"]`
    ) as HTMLElement | null
    if (!el) return
    const container = el.closest('.listing') as HTMLElement | null
    if (!container) return
    const header = container.querySelector('.row.header') as HTMLElement | null
    const headerHeight = header ? header.offsetHeight : 0
    const { top: cTop, bottom: cBottom } = container.getBoundingClientRect()
    const { top: eTop, bottom: eBottom } = el.getBoundingClientRect()
    if (eTop < cTop + headerHeight) {
      container.scrollTop -= cTop + headerHeight - eTop
    } else if (eBottom > cBottom) {
      container.scrollTop += eBottom - cBottom
    }
    setPendingScroll(null)
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

  useKeyboardNav({
    activePane,
    setActivePane,
    sidebarOpen,
    setSidebarOpen: (v: boolean) => setSidebarOpen(v),
    menuOpen,
    aboutOpen,
    settingsOpen,
    confirmDeleteDomainId,
    editingSection,
    editingBookmark,
    goBack,
    goUp,
    navigableSidebarPaths,
    currentPath,
    navigate,
    domainOrder: domainState.order,
    activeDomainId: domainState.activeDomainId,
    switchDomain: (id) => void switchDomain(id),
    rows,
    selectedPath,
    setSelectedPath,
    setPendingScroll,
    previewPath,
    setPreviewPath,
    viewMode,
    toggleExpand: (p) => void toggleExpand(p),
    onEntryActivate,
    displayDomainsAsTabs: settings.displayDomainsAsTabs
  })

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
