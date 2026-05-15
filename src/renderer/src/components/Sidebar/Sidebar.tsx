import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Bookmark, Section } from '../../types'

type Props = {
  sections: Section[]
  active: boolean
  currentPath: string
  currentlyBookmarked: boolean
  editingSection: string | null
  editingBookmark: string | null
  editingLabel: string
  dragOverBookmark: string | null
  dragOverSection: string | null
  setEditingLabel: (s: string) => void
  setDragOverBookmark: (s: string | null) => void
  setDragOverSection: (s: string | null) => void
  onActivate: () => void
  onToggleSectionCollapsed: (id: string) => void
  onStartEditingSection: (s: Section) => void
  onCommitEditingSection: () => void
  onCancelEditingSection: () => void
  onAddBookmarkToSection: (id: string) => void
  onRemoveSection: (id: string) => void
  onStartEditingBookmark: (b: Bookmark) => void
  onCommitEditingBookmark: () => void
  onCancelEditingBookmark: () => void
  onRemoveBookmark: (path: string) => void
  onMoveSection: (sourceId: string, targetId: string, before: boolean) => void
  onMoveBookmark: (path: string, targetSectionId: string, targetPath: string | null) => void
  onNavigate: (path: string) => void
}

export function Sidebar(props: Props): React.JSX.Element {
  const {
    sections,
    active,
    currentPath,
    currentlyBookmarked,
    editingSection,
    editingBookmark,
    editingLabel,
    dragOverBookmark,
    dragOverSection,
    setEditingLabel,
    setDragOverBookmark,
    setDragOverSection,
    onActivate,
    onToggleSectionCollapsed,
    onStartEditingSection,
    onCommitEditingSection,
    onCancelEditingSection,
    onAddBookmarkToSection,
    onRemoveSection,
    onStartEditingBookmark,
    onCommitEditingBookmark,
    onCancelEditingBookmark,
    onRemoveBookmark,
    onMoveSection,
    onMoveBookmark,
    onNavigate
  } = props

  return (
    <aside
      className={`sidebar ${active ? 'pane-active' : ''}`}
      onMouseDown={onActivate}
    >
      <div className="sidebar-list">
        {sections.map((section) => (
          <div className="sidebar-section" key={section.id}>
            <div
              className={`sidebar-section-header ${
                dragOverSection === section.id ? 'drag-over' : ''
              }`}
              draggable={editingSection !== section.id}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-wadsworth-section', section.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverSection(section.id)
              }}
              onDragLeave={() => setDragOverSection(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverSection(null)
                const types = e.dataTransfer.types
                if (types.includes('application/x-wadsworth-section')) {
                  const sourceId = e.dataTransfer.getData('application/x-wadsworth-section')
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const before = e.clientY < rect.top + rect.height / 2
                  onMoveSection(sourceId, section.id, before)
                  return
                }
                const path =
                  e.dataTransfer.getData('application/x-wadsworth-bookmark') ||
                  e.dataTransfer.getData('text/plain')
                if (path) onMoveBookmark(path, section.id, null)
              }}
            >
              <button
                type="button"
                className="section-caret"
                onClick={() => onToggleSectionCollapsed(section.id)}
                aria-label={section.collapsed ? 'Expand section' : 'Collapse section'}
              >
                {section.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              </button>
              {editingSection === section.id ? (
                <input
                  className="sidebar-input section-input"
                  value={editingLabel}
                  autoFocus
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitEditingSection()
                    else if (e.key === 'Escape') onCancelEditingSection()
                  }}
                  onBlur={onCommitEditingSection}
                />
              ) : (
                <span
                  className="section-name"
                  onDoubleClick={() => onStartEditingSection(section)}
                  title="Double-click to rename"
                >
                  {section.name}
                </span>
              )}
              <div className="section-actions">
                <button
                  type="button"
                  className="section-action"
                  onClick={() => onAddBookmarkToSection(section.id)}
                  disabled={!currentPath || currentlyBookmarked}
                  title="Add current folder to this section"
                  aria-label="Add current folder"
                >
                  +
                </button>
                <button
                  type="button"
                  className="section-action section-remove"
                  onClick={() => onRemoveSection(section.id)}
                  title="Remove section"
                  aria-label="Remove section"
                >
                  ×
                </button>
              </div>
            </div>
            {!section.collapsed && (
              <div className="sidebar-section-items">
                {section.bookmarks.length === 0 ? (
                  <div className="sidebar-empty-inline">No bookmarks</div>
                ) : (
                  section.bookmarks.map((b) =>
                    editingBookmark === b.path ? (
                      <input
                        key={b.path}
                        className="sidebar-input"
                        value={editingLabel}
                        autoFocus
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onCommitEditingBookmark()
                          else if (e.key === 'Escape') onCancelEditingBookmark()
                        }}
                        onBlur={onCommitEditingBookmark}
                      />
                    ) : (
                      <div
                        key={b.path}
                        data-sidebar-path={b.path}
                        className={`sidebar-item ${
                          currentPath === b.path ? 'active' : ''
                        } ${dragOverBookmark === b.path ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/x-wadsworth-bookmark',
                            b.path
                          )
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e) => {
                          if (
                            !e.dataTransfer.types.includes(
                              'application/x-wadsworth-bookmark'
                            )
                          )
                            return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          setDragOverBookmark(b.path)
                        }}
                        onDragLeave={() => setDragOverBookmark(null)}
                        onDrop={(e) => {
                          if (
                            !e.dataTransfer.types.includes(
                              'application/x-wadsworth-bookmark'
                            )
                          )
                            return
                          e.preventDefault()
                          e.stopPropagation()
                          const path = e.dataTransfer.getData(
                            'application/x-wadsworth-bookmark'
                          )
                          if (path && path !== b.path) {
                            onMoveBookmark(path, section.id, b.path)
                          }
                          setDragOverBookmark(null)
                        }}
                        onClick={() => onNavigate(b.path)}
                        onDoubleClick={() => onStartEditingBookmark(b)}
                        title={b.path}
                      >
                        <span className="sidebar-label">{b.label}</span>
                        <button
                          type="button"
                          className="sidebar-remove"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveBookmark(b.path)
                          }}
                          title="Remove bookmark"
                          aria-label="Remove bookmark"
                        >
                          ×
                        </button>
                      </div>
                    )
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
