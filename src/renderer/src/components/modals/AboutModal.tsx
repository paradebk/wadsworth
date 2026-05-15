type Props = {
  onClose: () => void
}

export function AboutModal({ onClose }: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Wadsworth</h2>
        <p className="modal-subtitle">A personal read-only file browser for macOS.</p>
        <p>
          Wadsworth is built for fast retrieval: a custom sidebar, instant Spotlight
          search with in-tree reveal, and a persistent preview pane that renders PDFs,
          images, text, and anything the OS knows how to QuickLook.
        </p>
        <p>
          It is the foundation of a personal information system — eventually meant to
          manage clients, businesses, locations, and the documents that come with each.
        </p>
        <p className="modal-meta">Version 1.0.0</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
