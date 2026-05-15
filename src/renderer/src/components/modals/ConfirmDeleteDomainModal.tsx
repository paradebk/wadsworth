type Props = {
  domainName: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteDomainModal({
  domainName,
  onCancel,
  onConfirm
}: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Delete domain?</h2>
        <p>
          This will permanently delete the{' '}
          <strong>&ldquo;{domainName}&rdquo;</strong> domain and everything inside it —
          every section, every bookmark, and the saved state of every folder
          you&rsquo;ve visited in it.
        </p>
        <p>This cannot be undone. Other domains are not affected.</p>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="modal-destructive" onClick={onConfirm}>
            Delete domain
          </button>
        </div>
      </div>
    </div>
  )
}
