import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../state/storageKeys'

export type MarkdownView = 'rendered' | 'raw'

/** Persisted preference: render Markdown files or show their CodeMirror source. */
export function useMarkdownView(): [MarkdownView, (v: MarkdownView) => void] {
  const [view, setView] = useState<MarkdownView>(
    () => (localStorage.getItem(STORAGE_KEYS.markdownView) === 'raw' ? 'raw' : 'rendered')
  )
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.markdownView, view)
  }, [view])
  return [view, setView]
}
