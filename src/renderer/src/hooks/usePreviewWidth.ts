import { useCallback, useEffect, useState } from 'react'
import {
  STORAGE_KEYS,
  MIN_PREVIEW_WIDTH,
  MIN_LISTING_WIDTH
} from '../state/storageKeys'

export type UsePreviewWidth = {
  /** Current width in pixels. */
  width: number
  /** Attach to the divider element's `onMouseDown` to start a drag. */
  startResize: (e: React.MouseEvent) => void
}

/**
 * Persisted width of the preview pane plus the mousedown→drag handler for
 * the splitter. Clamps to keep both panes at least `MIN_*` pixels wide.
 */
export function usePreviewWidth(): UsePreviewWidth {
  const [width, setWidth] = useState<number>(() => {
    const v = parseInt(localStorage.getItem(STORAGE_KEYS.previewWidth) ?? '', 10)
    return Number.isFinite(v) && v >= MIN_PREVIEW_WIDTH ? v : 600
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.previewWidth, String(width))
  }, [width])

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      const onMove = (m: MouseEvent): void => {
        const delta = startX - m.clientX
        const max = Math.max(MIN_PREVIEW_WIDTH, window.innerWidth - MIN_LISTING_WIDTH)
        const next = Math.max(MIN_PREVIEW_WIDTH, Math.min(max, startW + delta))
        setWidth(next)
      }
      const onUp = (): void => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width]
  )

  return { width, startResize }
}
