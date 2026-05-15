import type { Settings, ThemePref } from '../../types'

type Props = {
  settings: Settings
  onChange: (updater: (s: Settings) => Settings) => void
  onClose: () => void
}

const THEME_OPTIONS: ThemePref[] = ['system', 'light', 'dark']

export function SettingsModal({ settings, onChange, onClose }: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="settings-list">
          <label className="settings-row">
            <input
              type="checkbox"
              checked={settings.displayDomainsAsTabs}
              onChange={(e) =>
                onChange((s) => ({ ...s, displayDomainsAsTabs: e.target.checked }))
              }
            />
            <span>Display domains as tabs</span>
          </label>
          <div className="settings-group">
            <span className="settings-group-label">Appearance</span>
            <div className="settings-radio-group">
              {THEME_OPTIONS.map((opt) => (
                <label key={opt} className="settings-radio">
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === opt}
                    onChange={() => onChange((s) => ({ ...s, theme: opt }))}
                  />
                  <span>
                    {opt === 'system' ? 'Match system' : opt[0].toUpperCase() + opt.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
