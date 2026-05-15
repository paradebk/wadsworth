import type { Domain, DomainState } from '../types'

type Props = {
  domainState: DomainState
  active: boolean
  editingId: string | null
  editingName: string
  setEditingName: (s: string) => void
  onActivate: () => void
  onSwitch: (id: string) => void
  onStartEditing: (d: Domain) => void
  onCommitEditing: () => void
  onCancelEditing: () => void
  onCreate: () => void
  onRequestDelete: (id: string) => void
}

export function DomainTabs({
  domainState,
  active,
  editingId,
  editingName,
  setEditingName,
  onActivate,
  onSwitch,
  onStartEditing,
  onCommitEditing,
  onCancelEditing,
  onCreate,
  onRequestDelete
}: Props): React.JSX.Element {
  return (
    <div
      className={`domain-tabs ${active ? 'pane-active' : ''}`}
      onMouseDown={onActivate}
    >
      {domainState.order.map((id) => {
        const d = domainState.domains[id]
        if (!d) return null
        const isActive = id === domainState.activeDomainId
        return editingId === id ? (
          <input
            key={id}
            className="domain-tab-input"
            value={editingName}
            autoFocus
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitEditing()
              else if (e.key === 'Escape') onCancelEditing()
            }}
            onBlur={onCommitEditing}
          />
        ) : (
          <div
            key={id}
            role="button"
            tabIndex={0}
            className={`domain-tab ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (!isActive) onSwitch(id)
            }}
            onDoubleClick={() => onStartEditing(d)}
            title={d.name}
          >
            <span className="domain-tab-name">{d.name}</span>
            {domainState.order.length > 1 && (
              <button
                type="button"
                className="domain-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  onRequestDelete(id)
                }}
                title="Delete domain"
                aria-label="Delete domain"
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        className="domain-tab-add"
        onClick={onCreate}
        title="New domain"
        aria-label="New domain"
      >
        +
      </button>
    </div>
  )
}
