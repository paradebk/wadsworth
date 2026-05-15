import { useCallback, useEffect, useState } from 'react'
import type { DirEntry } from '../types'
import type { Source } from '../sources/Source'
import { isDescendant } from '../utils/path'

export type UseTreeExpansion = {
  expanded: Set<string>
  treeChildren: Map<string, DirEntry[]>
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>
  setTreeChildren: React.Dispatch<React.SetStateAction<Map<string, DirEntry[]>>>
  toggleExpand: (path: string) => Promise<void>
  collapseAll: () => void
}

/**
 * Owns the tree-view's expansion state: which folder paths are open and a
 * cache of their children. Lazy-fetches children on first expand, and
 * rehydrates them on startup when an expanded set is restored from a saved
 * folder-state.
 *
 * Cross-cutting orchestrations like switchToFolder / revealInTree drive this
 * hook directly via the exposed setExpanded / setTreeChildren — they need to
 * coordinate with selection state and the current path.
 */
export function useTreeExpansion(
  source: Source,
  currentPath: string
): UseTreeExpansion {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [treeChildren, setTreeChildren] = useState<Map<string, DirEntry[]>>(
    () => new Map()
  )

  // Rehydration: when `expanded` includes paths under the current root that we
  // don't yet have children for, fetch them in parallel. Pruning failed
  // fetches keeps the effect from looping if a path was deleted.
  useEffect(() => {
    if (!currentPath) return
    const toFetch = [...expanded].filter(
      (p) => isDescendant(p, currentPath) && !treeChildren.has(p)
    )
    if (toFetch.length === 0) return
    let cancelled = false
    void Promise.all(
      toFetch.map(async (p) => {
        try {
          return { path: p, children: await source.list(p) }
        } catch {
          return { path: p, children: null as DirEntry[] | null }
        }
      })
    ).then((results) => {
      if (cancelled) return
      const succeeded = results.filter(
        (r): r is { path: string; children: DirEntry[] } => r.children !== null
      )
      const failed = results.filter((r) => r.children === null).map((r) => r.path)
      if (succeeded.length > 0) {
        setTreeChildren((prev) => {
          const next = new Map(prev)
          for (const s of succeeded) next.set(s.path, s.children)
          return next
        })
      }
      if (failed.length > 0) {
        setExpanded((prev) => {
          const next = new Set(prev)
          for (const p of failed) next.delete(p)
          return next
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentPath, expanded, treeChildren, source])

  const toggleExpand = useCallback(
    async (path: string): Promise<void> => {
      if (expanded.has(path)) {
        setExpanded((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
        return
      }
      if (!treeChildren.has(path)) {
        try {
          const ch = await source.list(path)
          setTreeChildren((prev) => new Map(prev).set(path, ch))
        } catch {
          return
        }
      }
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(path)
        return next
      })
    },
    [expanded, treeChildren, source]
  )

  const collapseAll = useCallback(() => setExpanded(new Set()), [])

  return { expanded, treeChildren, setExpanded, setTreeChildren, toggleExpand, collapseAll }
}
