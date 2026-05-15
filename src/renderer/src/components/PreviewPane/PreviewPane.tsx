import CodeMirror from '@uiw/react-codemirror'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Source } from '../../sources/Source'
import { basename } from '../../utils/path'
import { formatSize } from '../../utils/format'
import { isPdf, isImage, isText, isMarkdown } from '../../utils/fileTypes'
import { toAppFileUrl } from '../../utils/appFileUrl'
import { languageForFile } from '../../preview/languageForFile'
import type { PreviewContent } from '../../hooks/usePreviewContent'
import type { MarkdownView } from '../../hooks/useMarkdownView'

type Props = {
  /** Path being previewed. The pane only renders when this is non-null. */
  previewPath: string
  /** Width in pixels (controlled by the parent's draggable splitter). */
  width: number
  /** Source the file came from — used for "Open externally". */
  source: Source
  /** Effective light/dark theme to drive CodeMirror's theme. */
  effectiveTheme: 'light' | 'dark'
  /** Fetched preview content for text and unrecognized (QuickLook) types. */
  content: PreviewContent
  /** Markdown view preference. */
  markdownView: MarkdownView
  setMarkdownView: (v: MarkdownView) => void
  /** Close the preview pane. */
  onClose: () => void
}

export function PreviewPane({
  previewPath,
  width,
  source,
  effectiveTheme,
  content,
  markdownView,
  setMarkdownView,
  onClose
}: Props): React.JSX.Element {
  const { textPreview, textError, quicklookPng, quicklookLoading } = content

  return (
    <div className="preview" style={{ width }}>
      <div className="preview-toolbar">
        <span className="preview-title" title={previewPath}>
          {basename(previewPath)}
        </span>
        {isMarkdown(previewPath) && (
          <div className="segmented" role="group" aria-label="Markdown view">
            <button
              type="button"
              className={markdownView === 'rendered' ? 'active' : ''}
              onClick={() => setMarkdownView('rendered')}
              title="Rendered markdown"
            >
              Rendered
            </button>
            <button
              type="button"
              className={markdownView === 'raw' ? 'active' : ''}
              onClick={() => setMarkdownView('raw')}
              title="Source"
            >
              Source
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => void source.openExternal(previewPath)}
          title="Open externally"
        >
          Open externally
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close preview (Esc)"
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>
      {isPdf(previewPath) ? (
        <iframe
          className="preview-frame"
          src={toAppFileUrl(previewPath)}
          title="PDF preview"
        />
      ) : isImage(previewPath) ? (
        <div className="preview-image-wrap">
          <img
            className="preview-image"
            src={toAppFileUrl(previewPath)}
            alt={basename(previewPath)}
          />
        </div>
      ) : isText(previewPath) ? (
        textError ? (
          <div className="preview-message preview-error">{textError}</div>
        ) : textPreview ? (
          <div className="preview-text-wrap">
            {isMarkdown(previewPath) && markdownView === 'rendered' ? (
              <div className="markdown-rendered">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {textPreview.content}
                </ReactMarkdown>
              </div>
            ) : (
              <CodeMirror
                value={textPreview.content}
                theme={effectiveTheme === 'light' ? 'light' : oneDark}
                extensions={(() => {
                  const lang = languageForFile(previewPath)
                  return lang ? [lang] : []
                })()}
                readOnly
                editable={false}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                  highlightSelectionMatches: false,
                  searchKeymap: false
                }}
                height="100%"
                style={{ flex: 1, minHeight: 0, fontSize: '12px' }}
              />
            )}
            {textPreview.truncated && (
              <div className="preview-message">
                Truncated — showing first 2 MB of {formatSize(textPreview.totalSize)}
              </div>
            )}
          </div>
        ) : (
          <div className="preview-message">Loading…</div>
        )
      ) : quicklookLoading ? (
        <div className="preview-message">Generating preview…</div>
      ) : quicklookPng ? (
        <div className="preview-image-wrap">
          <img
            className="preview-image"
            src={toAppFileUrl(quicklookPng)}
            alt={basename(previewPath)}
          />
        </div>
      ) : (
        <div className="preview-message">
          No preview available for this file type.
          <br />
          Use <strong>Open externally</strong> to view it.
        </div>
      )}
    </div>
  )
}
