import { useCallback, useMemo, useState } from 'react'
import type { Bookmark, Section } from '../types'
import { basename } from '../utils/path'

export type UseBookmarks = {
  // Section CRUD
  addSection: () => void
  removeSection: (id: string) => void
  toggleSectionCollapsed: (id: string) => void
  moveSection: (sourceId: string, targetId: string, before: boolean) => void
  // Section rename state + actions
  editingSection: string | null
  startEditingSection: (s: Section) => void
  commitEditingSection: () => void
  cancelEditingSection: () => void
  // Bookmark CRUD
  addBookmarkToSection: (sectionId: string) => void
  removeBookmark: (path: string) => void
  moveBookmark: (path: string, targetSectionId: string, targetPath: string | null) => void
  // Bookmark rename state + actions
  editingBookmark: string | null
  startEditingBookmark: (b: Bookmark) => void
  commitEditingBookmark: () => void
  cancelEditingBookmark: () => void
  // Shared rename input
  editingLabel: string
  setEditingLabel: (s: string) => void
  // Drag-over visual state
  dragOverBookmark: string | null
  setDragOverBookmark: (s: string | null) => void
  dragOverSection: string | null
  setDragOverSection: (s: string | null) => void
  // Derived
  currentlyBookmarked: boolean
}

/**
 * Sections + bookmarks CRUD on top of `useDomainState`. Receives the
 * `sections` list and the `setSections` wrapper from the parent hook plus the
 * current folder path (needed to add the current folder as a bookmark).
 */
export function useBookmarks(
  sections: Section[],
  setSections: (updater: Section[] | ((prev: Section[]) => Section[])) => void,
  currentPath: string
): UseBookmarks {
  // Rename inputs share one piece of state — only one row is in edit mode at a time.
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  // Drag-over highlighting for the drop target while a drag is in flight.
  const [dragOverBookmark, setDragOverBookmark] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)

  const currentlyBookmarked = useMemo(
    () => sections.some((s) => s.bookmarks.some((b) => b.path === currentPath)),
    [sections, currentPath]
  )

  // ── Sections ──────────────────────────────────────────────────────────────
  const addSection = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setSections((prev) => [...prev, { id, name: 'New Section', bookmarks: [] }])
    setEditingSection(id)
    setEditingLabel('New Section')
  }, [setSections])

  const removeSection = useCallback(
    (id: string) => {
      setSections((prev) => prev.filter((s) => s.id !== id))
      if (editingSection === id) setEditingSection(null)
    },
    [editingSection, setSections]
  )

  const toggleSectionCollapsed = useCallback(
    (id: string) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
      )
    },
    [setSections]
  )

  const startEditingSection = useCallback((s: Section) => {
    setEditingSection(s.id)
    setEditingLabel(s.name)
  }, [])

  const commitEditingSection = useCallback(() => {
    if (editingSection === null) return
    setSections((prev) =>
      prev.map((s) =>
        s.id === editingSection
          ? { ...s, name: editingLabel.trim() || 'Untitled' }
          : s
      )
    )
    setEditingSection(null)
  }, [editingSection, editingLabel, setSections])

  const cancelEditingSection = useCallback(() => setEditingSection(null), [])

  const moveSection = useCallback(
    (sourceId: string, targetId: string, before: boolean) => {
      if (sourceId === targetId) return
      setSections((prev) => {
        const srcIdx = prev.findIndex((s) => s.id === sourceId)
        const tgtIdx = prev.findIndex((s) => s.id === targetId)
        if (srcIdx === -1 || tgtIdx === -1) return prev
        const next = [...prev]
        const [moved] = next.splice(srcIdx, 1)
        let insertAt = before ? tgtIdx : tgtIdx + 1
        if (srcIdx < tgtIdx) insertAt -= 1
        next.splice(insertAt, 0, moved)
        return next
      })
    },
    [setSections]
  )

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const addBookmarkToSection = useCallback(
    (sectionId: string) => {
      if (!currentPath) return
      if (sections.some((s) => s.bookmarks.some((b) => b.path === currentPath))) return
      const label = basename(currentPath) || currentPath
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, bookmarks: [...s.bookmarks, { path: currentPath, label }] }
            : s
        )
      )
    },
    [currentPath, sections, setSections]
  )

  const removeBookmark = useCallback(
    (path: string) => {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          bookmarks: s.bookmarks.filter((b) => b.path !== path)
        }))
      )
      if (editingBookmark === path) setEditingBookmark(null)
    },
    [editingBookmark, setSections]
  )

  const startEditingBookmark = useCallback((b: Bookmark) => {
    setEditingBookmark(b.path)
    setEditingLabel(b.label)
  }, [])

  const commitEditingBookmark = useCallback(() => {
    if (editingBookmark === null) return
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        bookmarks: s.bookmarks.map((b) =>
          b.path === editingBookmark
            ? { ...b, label: editingLabel.trim() || basename(b.path) || b.path }
            : b
        )
      }))
    )
    setEditingBookmark(null)
  }, [editingBookmark, editingLabel, setSections])

  const cancelEditingBookmark = useCallback(() => setEditingBookmark(null), [])

  const moveBookmark = useCallback(
    (path: string, targetSectionId: string, targetPath: string | null) => {
      setSections((prev) => {
        let moving: Bookmark | undefined
        const without = prev.map((s) => {
          const idx = s.bookmarks.findIndex((b) => b.path === path)
          if (idx === -1) return s
          moving = s.bookmarks[idx]
          return { ...s, bookmarks: s.bookmarks.filter((_, i) => i !== idx) }
        })
        if (!moving) return prev
        return without.map((s) => {
          if (s.id !== targetSectionId) return s
          const next = [...s.bookmarks]
          const insertAt =
            targetPath === null
              ? next.length
              : Math.max(
                  0,
                  next.findIndex((b) => b.path === targetPath)
                )
          next.splice(insertAt, 0, moving!)
          return { ...s, bookmarks: next }
        })
      })
    },
    [setSections]
  )

  return {
    addSection,
    removeSection,
    toggleSectionCollapsed,
    moveSection,
    editingSection,
    startEditingSection,
    commitEditingSection,
    cancelEditingSection,
    addBookmarkToSection,
    removeBookmark,
    moveBookmark,
    editingBookmark,
    startEditingBookmark,
    commitEditingBookmark,
    cancelEditingBookmark,
    editingLabel,
    setEditingLabel,
    dragOverBookmark,
    setDragOverBookmark,
    dragOverSection,
    setDragOverSection,
    currentlyBookmarked
  }
}
