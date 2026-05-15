import { useEffect, useState } from 'react'
import type { Settings } from '../types'
import { STORAGE_KEYS } from '../state/storageKeys'

const DEFAULTS: Settings = { displayDomainsAsTabs: false, theme: 'system' }

/** Top-level user preferences (theme, tabs vs dropdown, etc.), persisted to localStorage. */
export function useSettings(): [Settings, React.Dispatch<React.SetStateAction<Settings>>] {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>
        return { ...DEFAULTS, ...parsed }
      }
    } catch {
      // Corrupt — fall through.
    }
    return DEFAULTS
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  }, [settings])

  return [settings, setSettings]
}
