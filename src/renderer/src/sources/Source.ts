import type { DirEntry, TextFile } from '../types'

/**
 * A Source is anything browsable as a tree of entries.
 *
 * Wadsworth's UI doesn't care whether the entries come from a local
 * filesystem, a remote MCP server, a database treated as folders-of-tables,
 * a cloud drive, or a plugin's custom hierarchy. As long as the source
 * implements this interface, it can be plugged in.
 *
 * Implementations are expected to provide ALL methods. For capabilities
 * that don't apply (e.g. a source that has no notion of search), return
 * an empty result rather than throwing. This keeps the call sites in the
 * UI free of capability checks.
 */
export interface Source {
  /** Stable identifier — used as a namespace for paths across sources later. */
  readonly id: string

  /** Human-readable name shown in the UI when multiple sources are present. */
  readonly name: string

  /** List direct children of the given container path. */
  list(path: string): Promise<DirEntry[]>

  /** Resolve aliases / symlinks to a canonical path. May return the input if N/A. */
  resolvePath(path: string): Promise<string>

  /** Path of the source's default starting location (home for filesystems). */
  defaultPath(): Promise<string>

  /** Read text content for inline preview. */
  readText(path: string): Promise<TextFile>

  /**
   * Full-text / metadata search. Pass null scope for "anywhere".
   * Return `[]` for sources that don't support search.
   */
  search(query: string, scopePath: string | null): Promise<DirEntry[]>

  /**
   * Generate a thumbnail / preview image (e.g. via macOS QuickLook).
   * Return `null` if not supported or no preview available.
   */
  thumbnailPreview(path: string): Promise<string | null>

  /** Open the entry with the host OS's default application. */
  openExternal(path: string): Promise<void>
}
