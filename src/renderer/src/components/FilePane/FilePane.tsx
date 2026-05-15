import { ChevronRight, ChevronDown } from 'lucide-react'
import type { DirEntry, Row, ViewMode, SearchScope } from '../../types'
import { FileTypeIcon } from '../../icons/FileTypeIcon'
import { formatSize, formatDate } from '../../utils/format'
import { dirname } from '../../utils/path'
import { isDescendant } from '../../utils/path'

type Props = {
  /** Whether this pane has keyboard focus. */
  active: boolean
  onActivate: () => void

  /** Folder view data. */
  loading: boolean
  entries: DirEntry[]
  rows: Row[]
  viewMode: ViewMode
  expanded: Set<string>
  hiddenCount: number
  selectedPath: string | null
  onEntryClick: (e: DirEntry) => void
  onEntryActivate: (e: DirEntry) => void
  onToggleExpand: (path: string) => void

  /** Search pane data (rendered as a split below). */
  inSearch: boolean
  searchLoading: boolean
  searchRows: DirEntry[]
  searchQuery: string
  searchScope: SearchScope
  currentPath: string
  onSearchResultClick: (e: DirEntry) => void
  onSearchResultDoubleClick: (e: DirEntry) => void
}

export function FilePane(props: Props): React.JSX.Element {
  const {
    active,
    onActivate,
    loading,
    entries,
    rows,
    viewMode,
    expanded,
    hiddenCount,
    selectedPath,
    onEntryClick,
    onEntryActivate,
    onToggleExpand,
    inSearch,
    searchLoading,
    searchRows,
    searchQuery,
    searchScope,
    currentPath,
    onSearchResultClick,
    onSearchResultDoubleClick
  } = props

  return (
    <div
      className={`left ${active ? 'pane-active' : ''}`}
      onMouseDown={onActivate}
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
                          onToggleExpand(entry.path)
                        }}
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
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
                : ` (${searchRows.length}${searchRows.length === 500 ? '+' : ''})`}
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
                const within = isDescendant(entry.path, currentPath)
                return (
                  <div
                    key={entry.path}
                    className={`row ${
                      selectedPath === entry.path ? 'selected' : ''
                    } ${within ? '' : 'outside'}`}
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
  )
}
