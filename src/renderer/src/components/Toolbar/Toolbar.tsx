import type { Domain, DomainState, ViewMode, SearchScope } from '../../types'

type Props = {
  // Hamburger menu
  menuOpen: boolean
  setMenuOpen: (v: boolean) => void
  onAddSection: () => void
  onCreateDomain: () => void
  onRenameCurrentDomain: () => void
  onRequestDeleteCurrentDomain: () => void
  onOpenSettings: () => void
  onOpenAbout: () => void

  // Sidebar toggle
  sidebarOpen: boolean
  setSidebarOpen: (updater: (v: boolean) => boolean) => void

  // Domain dropdown
  showDomainDropdown: boolean
  domainState: DomainState
  activeDomain: Domain | undefined
  domainMenuOpen: boolean
  setDomainMenuOpen: (updater: boolean | ((v: boolean) => boolean)) => void
  editingDomain: string | null
  editingDomainName: string
  setEditingDomainName: (s: string) => void
  onStartEditingDomain: (d: Domain) => void
  onCommitEditingDomain: () => void
  onCancelEditingDomain: () => void
  onSwitchDomain: (id: string) => void

  // Navigation
  goBack: () => void
  goUp: () => void
  goHome: () => void
  canGoBack: boolean
  canGoUp: boolean

  // View mode
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  collapseAll: () => void
  hasExpandedFolders: boolean

  // Show hidden
  showHidden: boolean
  setShowHidden: (v: boolean) => void

  // Path bar
  pathInput: string
  setPathInput: (s: string) => void
  onCommitPath: () => void

  // Current folder for "Open in Finder"
  currentPath: string
  onOpenCurrentExternal: () => void
  platform: string

  // Search
  searchQuery: string
  setSearchQuery: (s: string) => void
  searchScope: SearchScope
  setSearchScope: (s: SearchScope) => void
}

export function Toolbar(props: Props): React.JSX.Element {
  const {
    menuOpen,
    setMenuOpen,
    onAddSection,
    onCreateDomain,
    onRenameCurrentDomain,
    onRequestDeleteCurrentDomain,
    onOpenSettings,
    onOpenAbout,
    sidebarOpen,
    setSidebarOpen,
    showDomainDropdown,
    domainState,
    activeDomain,
    domainMenuOpen,
    setDomainMenuOpen,
    editingDomain,
    editingDomainName,
    setEditingDomainName,
    onStartEditingDomain,
    onCommitEditingDomain,
    onCancelEditingDomain,
    onSwitchDomain,
    goBack,
    goUp,
    goHome,
    canGoBack,
    canGoUp,
    viewMode,
    setViewMode,
    collapseAll,
    hasExpandedFolders,
    showHidden,
    setShowHidden,
    pathInput,
    setPathInput,
    onCommitPath,
    currentPath,
    onOpenCurrentExternal,
    platform,
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope
  } = props

  return (
    <header className="toolbar">
      <div className="menu-wrapper">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
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
                  onAddSection()
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
                  onCreateDomain()
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
                  onRenameCurrentDomain()
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
                  onRequestDeleteCurrentDomain()
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
                  onOpenSettings()
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
                  onOpenAbout()
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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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

      {showDomainDropdown && (
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
                  if (e.key === 'Enter') onCommitEditingDomain()
                  else if (e.key === 'Escape') onCancelEditingDomain()
                }}
                onBlur={onCommitEditingDomain}
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
                        if (e.key === 'Enter') onCommitEditingDomain()
                        else if (e.key === 'Escape') onCancelEditingDomain()
                      }}
                      onBlur={onCommitEditingDomain}
                    />
                  ) : (
                    <button
                      key={id}
                      type="button"
                      className={`menu-item domain-item ${isActive ? 'active' : ''}`}
                      role="menuitem"
                      onDoubleClick={() => onStartEditingDomain(d)}
                      onClick={() => {
                        if (!isActive) onSwitchDomain(id)
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
                    onCreateDomain()
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
        disabled={!canGoBack}
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
        disabled={viewMode !== 'tree' || !hasExpandedFolders}
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
          if (e.key === 'Enter') onCommitPath()
        }}
        spellCheck={false}
      />

      <button
        type="button"
        onClick={onOpenCurrentExternal}
        disabled={!currentPath}
        title={
          platform === 'darwin'
            ? 'Reveal in Finder'
            : platform === 'win32'
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
          <path d="M11.5 2.5L6 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
  )
}
