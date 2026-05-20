import { app, shell, screen, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join, basename } from 'path'
import { homedir } from 'os'
import { promises as fs, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const execFileP = promisify(execFile)

// Default to the X11 (XWayland) backend on Linux. Electron otherwise selects
// Wayland on Wayland sessions, and some compositors — notably Cosmic — hang
// window creation there indefinitely.
//
// The Ozone platform is locked in during Chromium's early startup, *before*
// this module runs, so `app.commandLine.appendSwitch('ozone-platform', …)`
// here is too late to have any effect. The only reliable way to set it is as
// a real process argument. So when no platform was specified, relaunch once
// with `--ozone-platform=x11` appended — the relaunched process reads it
// during early init, exactly as if the user had typed it.
//
// The flag on the relaunched process doubles as the loop guard: the second
// run sees `hasSwitch('ozone-platform')` and skips the relaunch. Users who
// want native Wayland can pass `--ozone-platform=wayland` themselves.
if (
  process.platform === 'linux' &&
  !is.dev &&
  !app.commandLine.hasSwitch('ozone-platform') &&
  !process.env.ELECTRON_OZONE_PLATFORM_HINT
) {
  app.relaunch({ args: process.argv.slice(1).concat('--ozone-platform=x11') })
  app.exit(0)
}

if (is.dev) {
  app.setPath('userData', join(app.getPath('userData'), 'dev'))
  app.setName(`${app.getName()} (dev)`)
}

const MAX_SEARCH_RESULTS = 500
const SEARCH_TIMEOUT_MS = 30_000
const SEARCH_MAX_BUFFER = 16 * 1024 * 1024

/**
 * Turn a list of absolute paths into DirEntry rows. Paths that can't be
 * stat'd (race / permission denied / broken symlinks) are silently dropped.
 */
async function statPaths(paths: string[]): Promise<DirEntry[]> {
  const entries = await Promise.all(
    paths.map(async (p): Promise<DirEntry | null> => {
      try {
        const st = await fs.stat(p)
        return {
          name: basename(p),
          path: p,
          isDirectory: st.isDirectory(),
          size: st.size,
          modifiedMs: st.mtimeMs
        }
      } catch {
        return null
      }
    })
  )
  return entries.filter((e): e is DirEntry => e !== null)
}

/**
 * macOS: Spotlight via `mdfind`. Searches filename AND indexed content
 * (PDFs, Office docs, source code, etc.). Indexed, instant.
 */
async function mdfindSearch(query: string, scopePath: string | null): Promise<DirEntry[]> {
  const args: string[] = []
  if (scopePath) args.push('-onlyin', scopePath)
  args.push(query)
  try {
    const { stdout } = await execFileP('mdfind', args, {
      maxBuffer: SEARCH_MAX_BUFFER,
      timeout: SEARCH_TIMEOUT_MS
    })
    return statPaths(stdout.split('\n').filter(Boolean).slice(0, MAX_SEARCH_RESULTS))
  } catch {
    return []
  }
}

/**
 * Linux: `find <scope> -iname '*<query>*'`. Filename-only, NOT content.
 * Bounded by `-maxdepth` so a runaway `/` search can't run forever.
 *
 * Content search on Linux would need a separate indexer (ripgrep, recoll,
 * tracker, etc.). Out of scope for now.
 */
async function findSearch(query: string, scopePath: string | null): Promise<DirEntry[]> {
  const root = scopePath ?? homedir()
  try {
    const { stdout } = await execFileP(
      'find',
      [root, '-maxdepth', '15', '-iname', `*${query}*`],
      { maxBuffer: SEARCH_MAX_BUFFER, timeout: SEARCH_TIMEOUT_MS }
    )
    return statPaths(stdout.split('\n').filter(Boolean).slice(0, MAX_SEARCH_RESULTS))
  } catch {
    // ETIMEDOUT or non-zero exit (e.g. permission errors on subtrees) —
    // return whatever stdout we collected before the timeout, if any.
    return []
  }
}

/**
 * Windows: PowerShell `Get-ChildItem -Recurse -Filter '*<query>*'`.
 * Filename-only, NOT content. Slower than macOS Spotlight.
 *
 * Could be upgraded to query the Windows Search Index via OLE DB on the
 * Search.CollatorDSO provider — that index covers content too. Significant
 * complexity for a v1; deferred.
 */
async function windowsSearch(query: string, scopePath: string | null): Promise<DirEntry[]> {
  const root = scopePath ?? homedir()
  // Escape single quotes for PowerShell string literals by doubling.
  const safeRoot = root.replace(/'/g, "''")
  const safeQuery = query.replace(/'/g, "''")
  const script =
    `Get-ChildItem -LiteralPath '${safeRoot}' -Recurse -Filter '*${safeQuery}*' ` +
    `-Force -ErrorAction SilentlyContinue ` +
    `| Select-Object -First ${MAX_SEARCH_RESULTS} ` +
    `| ForEach-Object { $_.FullName }`
  try {
    const { stdout } = await execFileP(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { maxBuffer: SEARCH_MAX_BUFFER, timeout: SEARCH_TIMEOUT_MS }
    )
    return statPaths(stdout.split(/\r?\n/).filter(Boolean).slice(0, MAX_SEARCH_RESULTS))
  } catch {
    return []
  }
}

/**
 * Cross-platform filename search. Dispatches to the platform-native tool.
 * macOS gets indexed content+name search; Windows/Linux get non-indexed
 * filename search via PowerShell / find.
 */
async function nativeSearch(
  query: string,
  scopePath: string | null
): Promise<DirEntry[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  if (process.platform === 'darwin') return mdfindSearch(trimmed, scopePath)
  if (process.platform === 'win32') return windowsSearch(trimmed, scopePath)
  return findSearch(trimmed, scopePath)
}

async function quicklookPreview(filePath: string): Promise<string | null> {
  if (process.platform !== 'darwin') return null
  const cacheDir = join(app.getPath('temp'), 'wadsworth-ql')
  await fs.mkdir(cacheDir, { recursive: true })

  const hash = createHash('sha1').update(filePath).digest('hex').slice(0, 16)
  const cachedPng = join(cacheDir, `${hash}.png`)

  try {
    const [srcStat, cacheStat] = await Promise.all([fs.stat(filePath), fs.stat(cachedPng)])
    if (cacheStat.mtimeMs >= srcStat.mtimeMs) return cachedPng
  } catch {
    // No cache or source missing — fall through to (re)generate.
  }

  const workDir = join(cacheDir, `${hash}.work`)
  await fs.rm(workDir, { recursive: true, force: true })
  await fs.mkdir(workDir, { recursive: true })
  try {
    await execFileP('qlmanage', ['-t', '-s', '2048', '-o', workDir, filePath], {
      timeout: 30_000
    })
    const produced = (await fs.readdir(workDir)).find((f) => f.toLowerCase().endsWith('.png'))
    if (!produced) return null
    await fs.rename(join(workDir, produced), cachedPng)
    return cachedPng
  } catch {
    return null
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

type WindowState = {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const DEFAULT_STATE: WindowState = { width: 1000, height: 700, maximized: false }

function windowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    const raw = readFileSync(windowStatePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WindowState>
    const merged: WindowState = { ...DEFAULT_STATE, ...parsed }
    if (
      typeof merged.x === 'number' &&
      typeof merged.y === 'number' &&
      !isOnSomeDisplay({ x: merged.x, y: merged.y, width: merged.width, height: merged.height })
    ) {
      delete merged.x
      delete merged.y
    }
    return merged
  } catch {
    return DEFAULT_STATE
  }
}

function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(windowStatePath(), JSON.stringify(state))
  } catch {
    // Best-effort: ignore write failures.
  }
}

function isOnSomeDisplay(bounds: { x: number; y: number; width: number; height: number }): boolean {
  return screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return (
      bounds.x < wa.x + wa.width &&
      bounds.x + bounds.width > wa.x &&
      bounds.y < wa.y + wa.height &&
      bounds.y + bounds.height > wa.y
    )
  })
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'wadsworth-file',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

export type DirEntry = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedMs: number
}

async function listDirectory(dirPath: string): Promise<DirEntry[]> {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true })
  const entries = await Promise.all(
    dirents.map(async (d) => {
      const full = join(dirPath, d.name)
      let size = 0
      let modifiedMs = 0
      try {
        const st = await fs.stat(full)
        size = st.size
        modifiedMs = st.mtimeMs
      } catch {
        // Permission denied or broken symlink — keep zero defaults.
      }
      return {
        name: d.name,
        path: full,
        isDirectory: d.isDirectory(),
        size,
        modifiedMs
      } satisfies DirEntry
    })
  )
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return entries
}

function createWindow(): void {
  const state = loadWindowState()
  const mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    show: false,
    title: is.dev ? 'Wadsworth (dev)' : 'Wadsworth',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (state.maximized) mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', () => {
    const maximized = mainWindow.isMaximized()
    const bounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds()
    saveWindowState({ ...bounds, maximized })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.wadsworth')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle('wadsworth-file', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  ipcMain.handle('fs:home', () => homedir())
  ipcMain.handle('fs:realpath', (_evt, p: string) => fs.realpath(p))
  ipcMain.handle('fs:list', (_evt, dirPath: string) => listDirectory(dirPath))
  ipcMain.handle('fs:open', (_evt, targetPath: string) => shell.openPath(targetPath))
  ipcMain.handle('fs:reveal', (_evt, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })
  ipcMain.handle('os:quicklook', (_evt, targetPath: string) => quicklookPreview(targetPath))
  ipcMain.handle(
    'os:search',
    (_evt, query: string, scopePath: string | null) => nativeSearch(query, scopePath)
  )
  ipcMain.handle('fs:readText', async (_evt, targetPath: string) => {
    const MAX = 2 * 1024 * 1024
    const st = await fs.stat(targetPath)
    if (st.size <= MAX) {
      const content = await fs.readFile(targetPath, 'utf8')
      return { content, truncated: false, totalSize: st.size }
    }
    const fh = await fs.open(targetPath, 'r')
    try {
      const buf = Buffer.alloc(MAX)
      const { bytesRead } = await fh.read(buf, 0, MAX, 0)
      return {
        content: buf.subarray(0, bytesRead).toString('utf8'),
        truncated: true,
        totalSize: st.size
      }
    } finally {
      await fh.close()
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
