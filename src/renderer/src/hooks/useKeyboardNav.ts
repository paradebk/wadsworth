import { useEffect } from 'react'
import type { DirEntry, Row, ViewMode } from '../types'

type ActivePane = 'sidebar' | 'files' | 'tabs'

export type KeyboardNavConfig = {
  // Pane focus
  activePane: ActivePane
  setActivePane: (p: ActivePane) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void

  // Modal/edit suppression — when any of these is truthy, the global handler
  // bails out so the modal/inline-input retains its own keyboard handling.
  menuOpen: boolean
  aboutOpen: boolean
  settingsOpen: boolean
  confirmDeleteDomainId: string | null
  editingSection: string | null
  editingBookmark: string | null

  // Global shortcuts (Cmd+arrow)
  goBack: () => void
  goUp: () => void

  // Sidebar pane navigation
  navigableSidebarPaths: string[]
  currentPath: string
  navigate: (path: string) => void

  // Tab-bar pane navigation
  domainOrder: string[]
  activeDomainId: string
  switchDomain: (id: string) => void

  // File pane navigation
  rows: Row[]
  selectedPath: string | null
  setSelectedPath: (p: string | null) => void
  setPendingScroll: (p: string | null) => void
  previewPath: string | null
  setPreviewPath: (p: string | null) => void
  viewMode: ViewMode
  toggleExpand: (path: string) => void
  onEntryActivate: (e: DirEntry) => void

  // Settings affecting nav behavior
  displayDomainsAsTabs: boolean
}

/**
 * Sets up the global Vim-style keyboard navigation handler. Behavior matches
 * what was previously inline in App.tsx:
 *
 *   • `Cmd-[ / Cmd-Left`  – history back
 *   • `Cmd-Up`            – go to parent folder
 *
 * Per-pane bindings:
 *   • Sidebar:  j/k cycle bookmarks, l moves to files pane, k from top moves
 *               up to the tab bar (when tabs are enabled)
 *   • Tabs:     h/l switch domains, j moves down into sidebar/files
 *   • Files:    j/k move selection (auto-scrolls + swaps preview),
 *               l/Enter activate (drill into folder or open in preview),
 *               h moves focus back to sidebar,
 *               Space toggles tree expansion of the selected folder
 *
 * The handler ignores keys while the user is typing into an INPUT/TEXTAREA,
 * while a modal is open, or while a sidebar item is being renamed inline.
 */
export function useKeyboardNav(cfg: KeyboardNavConfig): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'TEXTAREA' || target.isContentEditable) return
        if (tag === 'INPUT') {
          const type = (target as HTMLInputElement).type
          // Let navigation keys pass through non-text inputs (checkbox, radio, etc.)
          // but still bail for anything the user might be typing into.
          if (type !== 'checkbox' && type !== 'radio') return
          target.blur()
        }
      }
      if (
        cfg.menuOpen ||
        cfg.aboutOpen ||
        cfg.settingsOpen ||
        cfg.confirmDeleteDomainId ||
        cfg.editingSection ||
        cfg.editingBookmark
      )
        return

      const cmd = e.metaKey || e.ctrlKey

      // Blur any focused toolbar/header control so it doesn't retain a focus
      // outline while keyboard navigation is active.
      const focusedEl = document.activeElement as HTMLElement | null
      if (focusedEl && focusedEl.tagName !== 'BODY') focusedEl.blur()

      if (cmd && (e.key === '[' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        cfg.goBack()
        return
      }
      if (cmd && e.key === 'ArrowUp') {
        e.preventDefault()
        cfg.goUp()
        return
      }

      if (cfg.activePane === 'tabs') {
        if (e.key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const idx = cfg.domainOrder.indexOf(cfg.activeDomainId)
          if (idx > 0) cfg.switchDomain(cfg.domainOrder[idx - 1])
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault()
          const idx = cfg.domainOrder.indexOf(cfg.activeDomainId)
          if (idx >= 0 && idx < cfg.domainOrder.length - 1) {
            cfg.switchDomain(cfg.domainOrder[idx + 1])
          }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          cfg.setActivePane(cfg.sidebarOpen ? 'sidebar' : 'files')
        }
        return
      }

      if (cfg.activePane === 'sidebar') {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          if (cfg.navigableSidebarPaths.length === 0) return
          const idx = cfg.navigableSidebarPaths.indexOf(cfg.currentPath)
          const next =
            idx === -1
              ? cfg.navigableSidebarPaths[0]
              : cfg.navigableSidebarPaths[
                  Math.min(idx + 1, cfg.navigableSidebarPaths.length - 1)
                ]
          if (next && next !== cfg.currentPath) cfg.navigate(next)
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (cfg.navigableSidebarPaths.length === 0) {
            if (cfg.displayDomainsAsTabs) cfg.setActivePane('tabs')
            return
          }
          const idx = cfg.navigableSidebarPaths.indexOf(cfg.currentPath)
          if (cfg.displayDomainsAsTabs && (idx === 0 || idx === -1)) {
            cfg.setActivePane('tabs')
            return
          }
          const next = cfg.navigableSidebarPaths[Math.max(idx - 1, 0)]
          if (next && next !== cfg.currentPath) cfg.navigate(next)
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault()
          cfg.setActivePane('files')
        }
        return
      }

      if (cfg.activePane === 'files') {
        const cur = cfg.selectedPath
          ? cfg.rows.findIndex((r) => r.entry.path === cfg.selectedPath)
          : -1

        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          if (cfg.rows.length === 0) return
          const next = cfg.rows[Math.min(cur + 1, cfg.rows.length - 1)] ?? cfg.rows[0]
          cfg.setSelectedPath(next.entry.path)
          cfg.setPendingScroll(next.entry.path)
          if (cfg.previewPath && !next.entry.isDirectory) cfg.setPreviewPath(next.entry.path)
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (cfg.rows.length === 0) return
          const next =
            cfg.rows[Math.max(cur - 1, 0)] ?? cfg.rows[cfg.rows.length - 1]
          cfg.setSelectedPath(next.entry.path)
          cfg.setPendingScroll(next.entry.path)
          if (cfg.previewPath && !next.entry.isDirectory) cfg.setPreviewPath(next.entry.path)
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault()
          const row = cur >= 0 ? cfg.rows[cur] : null
          if (row) cfg.onEntryActivate(row.entry)
        } else if (e.ctrlKey && (e.key === 'f' || e.key === 'b')) {
          e.preventDefault()
          if (cfg.rows.length === 0) return
          const container = document.querySelector('.listing') as HTMLElement | null
          const headerEl = container?.querySelector('.row.header') as HTMLElement | null
          const firstRowEl = container?.querySelector('.row:not(.header)') as HTMLElement | null
          const headerHeight = headerEl?.offsetHeight ?? 0
          const rowHeight = firstRowEl?.offsetHeight ?? 30
          const pageSize = container
            ? Math.max(1, Math.floor((container.clientHeight - headerHeight) / rowHeight))
            : 10
          const delta = e.key === 'f' ? pageSize : -pageSize
          const next = cfg.rows[Math.max(0, Math.min(cur + delta, cfg.rows.length - 1))]
          if (!next) return
          cfg.setSelectedPath(next.entry.path)
          cfg.setPendingScroll(next.entry.path)
          if (cfg.previewPath && !next.entry.isDirectory) cfg.setPreviewPath(next.entry.path)
        } else if (e.key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault()
          if (!cfg.sidebarOpen) cfg.setSidebarOpen(true)
          cfg.setActivePane('sidebar')
        } else if (e.key === ' ') {
          if (cfg.viewMode !== 'tree' || cur < 0) return
          const row = cfg.rows[cur]
          if (!row.entry.isDirectory) return
          e.preventDefault()
          cfg.toggleExpand(row.entry.path)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    cfg.activePane,
    cfg.navigableSidebarPaths,
    cfg.selectedPath,
    cfg.rows,
    cfg.previewPath,
    cfg.currentPath,
    cfg.viewMode,
    cfg.sidebarOpen,
    cfg.menuOpen,
    cfg.aboutOpen,
    cfg.settingsOpen,
    cfg.confirmDeleteDomainId,
    cfg.editingSection,
    cfg.editingBookmark,
    cfg.navigate,
    cfg.goBack,
    cfg.goUp,
    cfg.onEntryActivate,
    cfg.toggleExpand,
    cfg.displayDomainsAsTabs,
    cfg.domainOrder,
    cfg.activeDomainId,
    cfg.switchDomain,
    cfg.setActivePane,
    cfg.setSidebarOpen,
    cfg.setSelectedPath,
    cfg.setPendingScroll,
    cfg.setPreviewPath
  ])
}
