import { useEffect, useState } from 'react'
import type { Row } from '../types'

export type UseFileSelection = {
  /** The path currently selected in the file pane (highlighted blue). */
  selectedPath: string | null
  setSelectedPath: React.Dispatch<React.SetStateAction<string | null>>
  /** When non-null, a `data-row-path="..."` element will be scrolled into view. */
  pendingScroll: string | null
  setPendingScroll: React.Dispatch<React.SetStateAction<string | null>>
}

/**
 * Owns "what's selected in the file pane" and the imperative scroll-into-view
 * mechanism. Auto-selects the first row when the pane gains focus with no
 * valid prior selection, and scrolls the pending row into view whenever it
 * exists in the DOM.
 */
export function useFileSelection(
  rows: Row[],
  activePane: 'sidebar' | 'files' | 'tabs'
): UseFileSelection {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)

  // Scroll the pending row into view once the DOM has it.
  useEffect(() => {
    if (!pendingScroll) return
    const el = document.querySelector(`[data-row-path="${CSS.escape(pendingScroll)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      setPendingScroll(null)
    }
  }, [pendingScroll, rows])

  // When the file pane is focused and either nothing is selected or the
  // selection points at a row no longer present, jump to the first row.
  useEffect(() => {
    if (activePane !== 'files' || rows.length === 0) return
    const stillThere = selectedPath && rows.some((r) => r.entry.path === selectedPath)
    if (!stillThere) {
      setSelectedPath(rows[0].entry.path)
      setPendingScroll(rows[0].entry.path)
    }
  }, [activePane, rows, selectedPath])

  return { selectedPath, setSelectedPath, pendingScroll, setPendingScroll }
}
