import { useEffect, useState } from 'react'
import type { TextFile } from '../types'
import type { Source } from '../sources/Source'
import { hasBuiltinPreview, isText } from '../utils/fileTypes'

export type PreviewContent = {
  /** Text content for `.txt`-like files. Null while loading or not applicable. */
  textPreview: TextFile | null
  /** Error from the text-fetch attempt. */
  textError: string | null
  /** Path to a QuickLook PNG (or other thumbnail) for unrecognized types. */
  quicklookPng: string | null
  /** True while the QuickLook subprocess is generating the thumbnail. */
  quicklookLoading: boolean
}

/**
 * For a given preview path, fetches the right kind of content from the source:
 *  - text files → readText
 *  - everything that isn't PDF/image/text → thumbnailPreview (QuickLook on macOS)
 *
 * PDFs and images don't need fetching here — they're served straight via the
 * wadsworth-file:// protocol in the preview component.
 */
export function usePreviewContent(
  source: Source,
  previewPath: string | null
): PreviewContent {
  const [textPreview, setTextPreview] = useState<TextFile | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [quicklookPng, setQuicklookPng] = useState<string | null>(null)
  const [quicklookLoading, setQuicklookLoading] = useState(false)

  useEffect(() => {
    if (!previewPath || !isText(previewPath)) {
      setTextPreview(null)
      setTextError(null)
      return
    }
    let cancelled = false
    setTextPreview(null)
    setTextError(null)
    source.readText(previewPath).then(
      (r) => {
        if (!cancelled) setTextPreview(r)
      },
      (err: unknown) => {
        if (!cancelled) setTextError(err instanceof Error ? err.message : String(err))
      }
    )
    return () => {
      cancelled = true
    }
  }, [previewPath, source])

  useEffect(() => {
    if (!previewPath || hasBuiltinPreview(previewPath)) {
      setQuicklookPng(null)
      setQuicklookLoading(false)
      return
    }
    let cancelled = false
    setQuicklookPng(null)
    setQuicklookLoading(true)
    source.thumbnailPreview(previewPath).then(
      (png) => {
        if (!cancelled) {
          setQuicklookPng(png)
          setQuicklookLoading(false)
        }
      },
      () => {
        if (!cancelled) {
          setQuicklookPng(null)
          setQuicklookLoading(false)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [previewPath, source])

  return { textPreview, textError, quicklookPng, quicklookLoading }
}
