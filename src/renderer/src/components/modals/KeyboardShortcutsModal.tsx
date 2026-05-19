type Props = {
  onClose: () => void
}

type ShortcutRow = { key: string; action: string }

function Section({
  title,
  rows
}: {
  title: string
  rows: ShortcutRow[]
}): React.JSX.Element {
  return (
    <div className="shortcuts-section">
      <h3 className="shortcuts-section-title">{title}</h3>
      <table className="shortcuts-table">
        <tbody>
          {rows.map(({ key, action }) => (
            <tr key={key}>
              <td className="shortcuts-key">{key}</td>
              <td className="shortcuts-action">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function KeyboardShortcutsModal({ onClose }: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-shortcuts"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard Shortcuts</h2>
        <div className="shortcuts-grid">
          <Section
            title="Global"
            rows={[
              { key: '/', action: 'Focus search' },
              { key: '; or ?', action: 'Show this dialog' },
              { key: '⌘[ or ⌘←', action: 'Go back' },
              { key: '⌘↑', action: 'Go to parent folder' },
            ]}
          />
          <Section
            title="File Pane"
            rows={[
              { key: 'j or ↓', action: 'Next file' },
              { key: 'k or ↑', action: 'Previous file' },
              { key: 'Enter or →', action: 'Open file or drill into folder' },
              { key: 'h or ←', action: 'Back to sidebar' },
              { key: 'Space', action: 'Expand / collapse folder (tree view)' },
              { key: 'Ctrl-F', action: 'Page down' },
              { key: 'Ctrl-B', action: 'Page up' },
            ]}
          />
          <Section
            title="Sidebar"
            rows={[
              { key: 'j or ↓', action: 'Next bookmark' },
              { key: 'k or ↑', action: 'Previous bookmark' },
              { key: 'l or →', action: 'Move to file pane' },
            ]}
          />
          <Section
            title="Tab Bar"
            rows={[
              { key: 'h or ←', action: 'Previous domain' },
              { key: 'l or →', action: 'Next domain' },
              { key: 'j or ↓', action: 'Move to sidebar' },
            ]}
          />
        </div>
        <div className="modal-actions">
          <button type="button" autoFocus onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
