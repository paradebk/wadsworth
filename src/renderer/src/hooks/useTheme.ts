import { useEffect, useMemo, useState } from 'react'
import hljsDark from 'highlight.js/styles/github-dark.css?inline'
import hljsLight from 'highlight.js/styles/github.css?inline'
import type { ThemePref } from '../types'

/**
 * Resolves the user's theme preference (system/light/dark) into the effective
 * theme (light/dark), watches OS appearance changes when in `system` mode,
 * applies the `data-theme` attribute to the document, and swaps the
 * highlight.js stylesheet in lockstep.
 */
export function useTheme(themePref: ThemePref): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    if (themePref === 'light') return 'light'
    if (themePref === 'dark') return 'dark'
    return systemDark ? 'dark' : 'light'
  }, [themePref, systemDark])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    const id = 'wadsworth-hljs-theme'
    let styleEl = document.getElementById(id) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = id
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = effectiveTheme === 'light' ? hljsLight : hljsDark
  }, [effectiveTheme])

  return effectiveTheme
}
