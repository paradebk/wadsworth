import type { Source } from './Source'
import type { DirEntry, TextFile } from '../types'

/**
 * The local-filesystem source. Delegates everything to the preload-exposed
 * window.api, which in turn shells out to Node fs / Electron shell / macOS
 * `mdfind` and `qlmanage` in the main process.
 */
export class FileSystemSource implements Source {
  readonly id = 'fs'
  readonly name = 'Local files'

  list(path: string): Promise<DirEntry[]> {
    return window.api.listDirectory(path)
  }

  resolvePath(path: string): Promise<string> {
    return window.api.realpath(path)
  }

  defaultPath(): Promise<string> {
    return window.api.getHome()
  }

  readText(path: string): Promise<TextFile> {
    return window.api.readText(path)
  }

  search(query: string, scopePath: string | null): Promise<DirEntry[]> {
    return window.api.search(query, scopePath)
  }

  thumbnailPreview(path: string): Promise<string | null> {
    return window.api.quicklookPreview(path)
  }

  openExternal(path: string): Promise<void> {
    return window.api.openPath(path).then(() => undefined)
  }
}

/** Singleton used by the app today. A registry can replace this later. */
export const fileSystemSource: Source = new FileSystemSource()
