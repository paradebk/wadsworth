import { useEffect, useState } from 'react'

export type UseModals = {
  menuOpen: boolean
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  aboutOpen: boolean
  setAboutOpen: React.Dispatch<React.SetStateAction<boolean>>
  settingsOpen: boolean
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
  shortcutsOpen: boolean
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>
  domainMenuOpen: boolean
  setDomainMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  confirmDeleteDomainId: string | null
  setConfirmDeleteDomainId: React.Dispatch<React.SetStateAction<string | null>>
}

/**
 * Bundles the open/close state of every modal-ish surface in the app:
 *  - hamburger menu
 *  - About dialog
 *  - Settings dialog
 *  - Domain dropdown (only when tabs setting is off)
 *  - Confirm-delete-domain dialog
 *
 * Wires up a single Escape-key listener that closes whichever ones are open.
 */
export function useModals(): UseModals {
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [domainMenuOpen, setDomainMenuOpen] = useState(false)
  const [confirmDeleteDomainId, setConfirmDeleteDomainId] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (
      !menuOpen &&
      !aboutOpen &&
      !domainMenuOpen &&
      !settingsOpen &&
      !shortcutsOpen &&
      !confirmDeleteDomainId
    )
      return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setAboutOpen(false)
        setDomainMenuOpen(false)
        setSettingsOpen(false)
        setShortcutsOpen(false)
        setConfirmDeleteDomainId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, aboutOpen, domainMenuOpen, settingsOpen, shortcutsOpen, confirmDeleteDomainId])

  return {
    menuOpen,
    setMenuOpen,
    aboutOpen,
    setAboutOpen,
    settingsOpen,
    setSettingsOpen,
    shortcutsOpen,
    setShortcutsOpen,
    domainMenuOpen,
    setDomainMenuOpen,
    confirmDeleteDomainId,
    setConfirmDeleteDomainId
  }
}
