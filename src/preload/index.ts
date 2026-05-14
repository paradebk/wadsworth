import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type DirEntry = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedMs: number
}

export type TextFile = {
  content: string
  truncated: boolean
  totalSize: number
}

const api = {
  platform: process.platform,
  getHome: (): Promise<string> => ipcRenderer.invoke('fs:home'),
  realpath: (path: string): Promise<string> => ipcRenderer.invoke('fs:realpath', path),
  listDirectory: (path: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:list', path),
  openPath: (path: string): Promise<string> => ipcRenderer.invoke('fs:open', path),
  revealInFolder: (path: string): Promise<void> => ipcRenderer.invoke('fs:reveal', path),
  readText: (path: string): Promise<TextFile> => ipcRenderer.invoke('fs:readText', path),
  quicklookPreview: (path: string): Promise<string | null> =>
    ipcRenderer.invoke('os:quicklook', path),
  search: (query: string, scopePath: string | null): Promise<DirEntry[]> =>
    ipcRenderer.invoke('os:search', query, scopePath)
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
