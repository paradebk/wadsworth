import { useEffect, useState } from 'react'
import type { DirEntry, SearchScope } from '../types'
import type { Source } from '../sources/Source'

export type UseSearch = {
  query: string
  scope: SearchScope
  results: DirEntry[] | null
  loading: boolean
  setQuery: (q: string) => void
  setScope: (s: SearchScope) => void
}

/**
 * Owns the search input state and debounced execution against the active
 * Source. Returns null results when the query is empty (i.e. "not in
 * search mode"), an empty array when there are no matches.
 */
export function useSearch(source: Source, currentPath: string): UseSearch {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('folder')
  const [results, setResults] = useState<DirEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(async () => {
      const effectiveScope = scope === 'folder' ? currentPath : null
      try {
        const r = await source.search(query, effectiveScope)
        if (!cancelled) setResults(r)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, scope, currentPath, source])

  return { query, scope, results, loading, setQuery, setScope }
}
