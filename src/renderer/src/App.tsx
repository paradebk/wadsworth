import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import hljsDark from 'highlight.js/styles/github-dark.css?inline'
import hljsLight from 'highlight.js/styles/github.css?inline'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { Icon } from '@iconify/react'
import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { rust } from '@codemirror/lang-rust'
import { csharp, kotlin, scala } from '@codemirror/legacy-modes/mode/clike'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { go } from '@codemirror/legacy-modes/mode/go'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { perl } from '@codemirror/legacy-modes/mode/perl'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import type { DirEntry, TextFile } from '../../preload'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let val = bytes / 1024
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`
}

function formatDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function parentPath(path: string): string | null {
  if (path === '/' || path === '') return null
  const trimmed = path.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx <= 0) return '/'
  return trimmed.slice(0, idx)
}

function dirname(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx <= 0) return '/'
  return trimmed.slice(0, idx)
}

const SHOW_HIDDEN_KEY = 'wadsworth:showHidden'
const PREVIEW_WIDTH_KEY = 'wadsworth:previewWidth'
const VIEW_MODE_KEY = 'wadsworth:viewMode'
const LAST_PATH_KEY = 'wadsworth:lastPath'
const FOLDER_STATES_KEY = 'wadsworth:folderStates'
const DOMAIN_STATE_KEY = 'wadsworth:domainState'
const SETTINGS_KEY = 'wadsworth:settings'
const MARKDOWN_VIEW_KEY = 'wadsworth:markdownView'
const BOOKMARKS_KEY = 'wadsworth:bookmarks'
const SECTIONS_KEY = 'wadsworth:sections'
const SIDEBAR_OPEN_KEY = 'wadsworth:sidebarOpen'
const MIN_PREVIEW_WIDTH = 250
const MIN_LISTING_WIDTH = 250

type ViewMode = 'flat' | 'tree'
type SearchScope = 'folder' | 'everywhere'
type Row = { entry: DirEntry; depth: number }
type Bookmark = { path: string; label: string }
type Section = { id: string; name: string; bookmarks: Bookmark[]; collapsed?: boolean }
type FolderState = {
  expanded: string[]
  selectedPath: string | null
  previewPath: string | null
}
type Domain = {
  id: string
  name: string
  sections: Section[]
  folderStates: Record<string, FolderState>
  lastPath: string | null
}
type DomainState = {
  domains: Record<string, Domain>
  activeDomainId: string
  order: string[]
}
type ThemePref = 'system' | 'light' | 'dark'
type Settings = {
  displayDomainsAsTabs: boolean
  theme: ThemePref
}

function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  return idx === -1 ? trimmed : trimmed.slice(idx + 1)
}

function isPdf(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'
])

function isImage(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return false
  return IMAGE_EXTS.has(path.slice(dot + 1).toLowerCase())
}

const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg', 'env',
  'xml', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
  'py', 'rb', 'php', 'pl', 'lua', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'go', 'rs', 'java', 'kt', 'swift', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'sql',
  'r', 'scala', 'clj', 'ex', 'exs', 'dockerfile'
])

const TEXT_BASENAMES = new Set([
  'readme', 'license', 'licence', 'makefile', 'dockerfile', 'changelog',
  'notice', 'authors', 'contributors', 'copying',
  '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.prettierrc', '.env'
])

function isText(path: string): boolean {
  const name = basename(path).toLowerCase()
  if (TEXT_BASENAMES.has(name)) return true
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  return TEXT_EXTS.has(ext)
}

function isMarkdown(path: string): boolean {
  const p = path.toLowerCase()
  return p.endsWith('.md') || p.endsWith('.markdown')
}

const EXT_ICON_MAP: Record<string, string> = {
  // Programming languages
  cs: 'file-type-csharp',
  csproj: 'file-type-csproj',
  sln: 'file-type-sln',
  ts: 'file-type-typescript',
  tsx: 'file-type-reactts',
  js: 'file-type-js',
  mjs: 'file-type-js',
  cjs: 'file-type-js',
  jsx: 'file-type-reactjs',
  py: 'file-type-python',
  rb: 'file-type-ruby',
  go: 'file-type-go',
  rs: 'file-type-rust',
  java: 'file-type-java',
  kt: 'file-type-kotlin',
  scala: 'file-type-scala',
  swift: 'file-type-swift',
  c: 'file-type-c',
  h: 'file-type-cheader',
  cpp: 'file-type-cpp',
  cc: 'file-type-cpp',
  hpp: 'file-type-cppheader',
  cxx: 'file-type-cpp',
  m: 'file-type-objectivec',
  mm: 'file-type-objectivecpp',
  php: 'file-type-php',
  pl: 'file-type-perl',
  lua: 'file-type-lua',
  r: 'file-type-r',
  dart: 'file-type-dart',
  ex: 'file-type-elixir',
  exs: 'file-type-elixir',
  erl: 'file-type-erlang',
  clj: 'file-type-clojure',
  cljs: 'file-type-clojure',
  hs: 'file-type-haskell',
  ml: 'file-type-ocaml',
  fs: 'file-type-fsharp',
  vb: 'file-type-vb',
  ps1: 'file-type-powershell',
  sh: 'file-type-shell',
  bash: 'file-type-shell',
  zsh: 'file-type-shell',
  fish: 'file-type-shell',
  bat: 'file-type-bat',
  cmd: 'file-type-bat',

  // Web
  html: 'file-type-html',
  htm: 'file-type-html',
  css: 'file-type-css',
  scss: 'file-type-scss',
  sass: 'file-type-sass',
  less: 'file-type-less',
  vue: 'file-type-vue',
  svelte: 'file-type-svelte',

  // Data / config
  json: 'file-type-json',
  jsonc: 'file-type-json',
  json5: 'file-type-json',
  yaml: 'file-type-yaml',
  yml: 'file-type-yaml',
  toml: 'file-type-toml',
  xml: 'file-type-xml',
  ini: 'file-type-ini',
  conf: 'file-type-config',
  cfg: 'file-type-config',
  env: 'file-type-dotenv',
  csv: 'file-type-csv',
  tsv: 'file-type-csv',
  sql: 'file-type-sql',

  // Docs / text
  md: 'file-type-markdown',
  markdown: 'file-type-markdown',
  rst: 'file-type-restructuredtext',
  tex: 'file-type-tex',
  txt: 'file-type-text',
  log: 'file-type-log',

  // Office
  docx: 'file-type-word',
  doc: 'file-type-word',
  xlsx: 'file-type-excel',
  xls: 'file-type-excel',
  pptx: 'file-type-powerpoint',
  ppt: 'file-type-powerpoint',
  odt: 'file-type-word',
  ods: 'file-type-excel',
  odp: 'file-type-powerpoint',

  // PDF
  pdf: 'file-type-pdf2',

  // Images
  png: 'file-type-image',
  jpg: 'file-type-image',
  jpeg: 'file-type-image',
  gif: 'file-type-image',
  webp: 'file-type-image',
  bmp: 'file-type-image',
  ico: 'file-type-image',
  avif: 'file-type-image',
  svg: 'file-type-svg',
  tiff: 'file-type-image',
  tif: 'file-type-image',
  heic: 'file-type-image',
  psd: 'file-type-photoshop2',
  ai: 'file-type-illustrator',
  sketch: 'file-type-sketch',
  fig: 'file-type-figma',

  // Audio / video
  mp3: 'file-type-audio',
  wav: 'file-type-audio',
  flac: 'file-type-audio',
  ogg: 'file-type-audio',
  m4a: 'file-type-audio',
  aac: 'file-type-audio',
  mp4: 'file-type-video',
  mov: 'file-type-video',
  avi: 'file-type-video',
  mkv: 'file-type-video',
  webm: 'file-type-video',

  // Archives
  zip: 'file-type-zip',
  tar: 'file-type-zip',
  gz: 'file-type-zip',
  tgz: 'file-type-zip',
  bz2: 'file-type-zip',
  '7z': 'file-type-zip',
  rar: 'file-type-zip',

  // Build / package
  lock: 'file-type-lock',

  // Fonts
  ttf: 'file-type-font',
  otf: 'file-type-font',
  woff: 'file-type-font',
  woff2: 'file-type-font'
}

const BASENAME_ICON_MAP: Record<string, string> = {
  'package.json': 'file-type-node',
  'package-lock.json': 'file-type-node',
  'tsconfig.json': 'file-type-tsconfig',
  'tsconfig.node.json': 'file-type-tsconfig',
  'tsconfig.web.json': 'file-type-tsconfig',
  'vite.config.ts': 'file-type-vite',
  'vite.config.js': 'file-type-vite',
  '.gitignore': 'file-type-git',
  '.gitattributes': 'file-type-git',
  'dockerfile': 'file-type-docker',
  '.dockerignore': 'file-type-docker',
  'docker-compose.yml': 'file-type-docker',
  'docker-compose.yaml': 'file-type-docker',
  'makefile': 'file-type-makefile',
  'readme.md': 'file-type-readme',
  'license': 'file-type-license',
  '.prettierrc': 'file-type-prettier',
  '.prettierrc.yaml': 'file-type-prettier',
  '.prettierrc.yml': 'file-type-prettier',
  '.prettierrc.json': 'file-type-prettier',
  '.prettierignore': 'file-type-prettier',
  '.eslintrc': 'file-type-eslint',
  '.eslintrc.json': 'file-type-eslint',
  '.eslintrc.js': 'file-type-eslint',
  'eslint.config.js': 'file-type-eslint',
  'eslint.config.mjs': 'file-type-eslint',
  '.editorconfig': 'file-type-editorconfig',
  '.env': 'file-type-dotenv',
  '.env.local': 'file-type-dotenv',
  '.env.development': 'file-type-dotenv',
  '.env.production': 'file-type-dotenv'
}

function FileTypeIcon({
  path,
  isDirectory,
  expanded
}: {
  path: string
  isDirectory: boolean
  expanded?: boolean
}): React.JSX.Element {
  if (isDirectory) {
    return expanded ? (
      <FolderOpen size={15} className="icon-folder" />
    ) : (
      <Folder size={15} className="icon-folder" />
    )
  }
  const name = basename(path).toLowerCase()
  const byName = BASENAME_ICON_MAP[name]
  if (byName) {
    return <Icon icon={`vscode-icons:${byName}`} width={15} height={15} />
  }
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  const iconName = EXT_ICON_MAP[ext] ?? 'default-file'
  return <Icon icon={`vscode-icons:${iconName}`} width={15} height={15} />
}

function hasBuiltinPreview(path: string): boolean {
  return isPdf(path) || isImage(path) || isText(path)
}

function languageForFile(path: string): Extension | null {
  const name = basename(path).toLowerCase()
  if (name === 'dockerfile') return StreamLanguage.define(dockerFile)
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'json':
    case 'jsonc':
      return json()
    case 'html':
    case 'htm':
    case 'vue':
    case 'svelte':
      return html()
    case 'css':
    case 'scss':
    case 'less':
      return css()
    case 'md':
    case 'markdown':
      return markdown()
    case 'py':
      return python()
    case 'c':
    case 'cc':
    case 'cpp':
    case 'h':
    case 'hpp':
      return cpp()
    case 'java':
      return java()
    case 'php':
      return php()
    case 'sql':
      return sql()
    case 'xml':
      return xml()
    case 'yaml':
    case 'yml':
      return yaml()
    case 'rs':
      return rust()
    case 'cs':
      return StreamLanguage.define(csharp)
    case 'kt':
      return StreamLanguage.define(kotlin)
    case 'scala':
      return StreamLanguage.define(scala)
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return StreamLanguage.define(shell)
    case 'rb':
      return StreamLanguage.define(ruby)
    case 'go':
      return StreamLanguage.define(go)
    case 'swift':
      return StreamLanguage.define(swift)
    case 'toml':
      return StreamLanguage.define(toml)
    case 'lua':
      return StreamLanguage.define(lua)
    case 'ps1':
      return StreamLanguage.define(powerShell)
    case 'pl':
      return StreamLanguage.define(perl)
    default:
      return null
  }
}

function toAppFileUrl(path: string): string {
  return 'wadsworth-file://local' + path.split('/').map(encodeURIComponent).join('/')
}

function App(): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHidden, setShowHidden] = useState<boolean>(
    () => localStorage.getItem(SHOW_HIDDEN_KEY) === 'true'
  )
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) === 'tree' ? 'tree' : 'flat')
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [treeChildren, setTreeChildren] = useState<Map<string, DirEntry[]>>(() => new Map())
  const [pathInput, setPathInput] = useState('')
  const inTransitRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('folder')
  const [searchResults, setSearchResults] = useState<DirEntry[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [domainState, setDomainState] = useState<DomainState>(() => {
    try {
      const raw = localStorage.getItem(DOMAIN_STATE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DomainState
        if (parsed.domains && parsed.activeDomainId && parsed.order) return parsed
      }
    } catch {
      // Corrupt — fall through to migration.
    }
    // Migrate from old global keys.
    let migratedSections: Section[] = [
      { id: 'default', name: 'Bookmarks', bookmarks: [] }
    ]
    try {
      const sectionsRaw = localStorage.getItem(SECTIONS_KEY)
      if (sectionsRaw) migratedSections = JSON.parse(sectionsRaw) as Section[]
      else {
        const bookmarksRaw = localStorage.getItem(BOOKMARKS_KEY)
        if (bookmarksRaw) {
          const old = JSON.parse(bookmarksRaw) as Bookmark[]
          migratedSections = [{ id: 'default', name: 'Bookmarks', bookmarks: old }]
        }
      }
    } catch {
      // Old keys corrupt — start fresh.
    }
    let migratedFolderStates: Record<string, FolderState> = {}
    try {
      const fsRaw = localStorage.getItem(FOLDER_STATES_KEY)
      if (fsRaw) migratedFolderStates = JSON.parse(fsRaw) as Record<string, FolderState>
    } catch {
      // Corrupt — start fresh.
    }
    const migratedLastPath = localStorage.getItem(LAST_PATH_KEY)
    const defaultDomain: Domain = {
      id: 'default',
      name: 'Default',
      sections: migratedSections,
      folderStates: migratedFolderStates,
      lastPath: migratedLastPath
    }
    return {
      domains: { default: defaultDomain },
      activeDomainId: 'default',
      order: ['default']
    }
  })
  const activeDomain = domainState.domains[domainState.activeDomainId]
  const sections = activeDomain?.sections ?? []
  const folderStates = activeDomain?.folderStates ?? {}

  const updateActiveDomain = useCallback(
    (updater: (d: Domain) => Domain) => {
      setDomainState((prev) => {
        const cur = prev.domains[prev.activeDomainId]
        if (!cur) return prev
        return {
          ...prev,
          domains: { ...prev.domains, [prev.activeDomainId]: updater(cur) }
        }
      })
    },
    []
  )

  type Updater<T> = T | ((prev: T) => T)
  const setSections = useCallback(
    (u: Updater<Section[]>) => {
      updateActiveDomain((d) => ({
        ...d,
        sections: typeof u === 'function' ? (u as (p: Section[]) => Section[])(d.sections) : u
      }))
    },
    [updateActiveDomain]
  )
  const setFolderStates = useCallback(
    (u: Updater<Record<string, FolderState>>) => {
      updateActiveDomain((d) => ({
        ...d,
        folderStates:
          typeof u === 'function'
            ? (u as (p: Record<string, FolderState>) => Record<string, FolderState>)(
                d.folderStates
              )
            : u
      }))
    },
    [updateActiveDomain]
  )
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false'
  )
  const [editingBookmark, setEditingBookmark] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [dragOverBookmark, setDragOverBookmark] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [domainMenuOpen, setDomainMenuOpen] = useState(false)
  const [confirmDeleteDomainId, setConfirmDeleteDomainId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(() => {
    const defaults: Settings = { displayDomainsAsTabs: false, theme: 'system' }
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>
        return { ...defaults, ...parsed }
      }
    } catch {
      // Corrupt — fall through.
    }
    return defaults
  })

  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    if (settings.theme === 'light') return 'light'
    if (settings.theme === 'dark') return 'dark'
    return systemDark ? 'dark' : 'light'
  }, [settings.theme, systemDark])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', window.api.platform)
  }, [])

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
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const [markdownView, setMarkdownView] = useState<'rendered' | 'raw'>(
    () => (localStorage.getItem(MARKDOWN_VIEW_KEY) === 'raw' ? 'raw' : 'rendered')
  )
  useEffect(() => {
    localStorage.setItem(MARKDOWN_VIEW_KEY, markdownView)
  }, [markdownView])
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [editingDomainName, setEditingDomainName] = useState('')
  const [activePane, setActivePane] = useState<'sidebar' | 'files' | 'tabs'>(
    () => (localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false' ? 'sidebar' : 'files')
  )

  useEffect(() => {
    if (!settings.displayDomainsAsTabs && activePane === 'tabs') {
      setActivePane(sidebarOpen ? 'sidebar' : 'files')
    }
  }, [settings.displayDomainsAsTabs, activePane, sidebarOpen])

  useEffect(() => {
    if (
      !menuOpen &&
      !aboutOpen &&
      !domainMenuOpen &&
      !settingsOpen &&
      !confirmDeleteDomainId
    )
      return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setAboutOpen(false)
        setDomainMenuOpen(false)
        setSettingsOpen(false)
        setConfirmDeleteDomainId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, aboutOpen, domainMenuOpen, settingsOpen, confirmDeleteDomainId])

  useEffect(() => {
    localStorage.setItem(DOMAIN_STATE_KEY, JSON.stringify(domainState))
  }, [domainState])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen))
  }, [sidebarOpen])

  const currentlyBookmarked = useMemo(
    () => sections.some((s) => s.bookmarks.some((b) => b.path === currentPath)),
    [sections, currentPath]
  )

  const navigableSidebarPaths = useMemo(
    () => sections.flatMap((s) => (s.collapsed ? [] : s.bookmarks.map((b) => b.path))),
    [sections]
  )

  useEffect(() => {
    if (inTransitRef.current) return
    if (!currentPath) return
    updateActiveDomain((d) => ({
      ...d,
      folderStates: {
        ...d.folderStates,
        [currentPath]: {
          expanded: [...expanded],
          selectedPath,
          previewPath
        }
      },
      lastPath: currentPath
    }))
  }, [currentPath, expanded, selectedPath, previewPath, updateActiveDomain])

  useEffect(() => {
    setPathInput(currentPath)
  }, [currentPath])

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])
  const [previewWidth, setPreviewWidth] = useState<number>(() => {
    const v = parseInt(localStorage.getItem(PREVIEW_WIDTH_KEY) ?? '', 10)
    return Number.isFinite(v) && v >= MIN_PREVIEW_WIDTH ? v : 600
  })

  useEffect(() => {
    localStorage.setItem(PREVIEW_WIDTH_KEY, String(previewWidth))
  }, [previewWidth])

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = previewWidth
      const onMove = (m: MouseEvent): void => {
        const delta = startX - m.clientX
        const max = Math.max(MIN_PREVIEW_WIDTH, window.innerWidth - MIN_LISTING_WIDTH)
        const next = Math.max(MIN_PREVIEW_WIDTH, Math.min(max, startW + delta))
        setPreviewWidth(next)
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
    [previewWidth]
  )

  useEffect(() => {
    localStorage.setItem(SHOW_HIDDEN_KEY, String(showHidden))
  }, [showHidden])

  const visibleEntries = useMemo(
    () => (showHidden ? entries : entries.filter((e) => !e.name.startsWith('.'))),
    [entries, showHidden]
  )
  const hiddenCount = entries.length - visibleEntries.length

  const inSearch = searchResults !== null
  const searchRows = useMemo<DirEntry[]>(() => {
    if (searchResults === null) return []
    return showHidden ? searchResults : searchResults.filter((e) => !e.name.startsWith('.'))
  }, [searchResults, showHidden])

  const rows = useMemo<Row[]>(() => {
    if (viewMode === 'flat') {
      return visibleEntries.map((entry) => ({ entry, depth: 0 }))
    }
    const filter = (list: DirEntry[]): DirEntry[] =>
      showHidden ? list : list.filter((e) => !e.name.startsWith('.'))
    const walk = (list: DirEntry[], depth: number): Row[] => {
      const out: Row[] = []
      for (const entry of filter(list)) {
        out.push({ entry, depth })
        if (entry.isDirectory && expanded.has(entry.path)) {
          const sub = treeChildren.get(entry.path)
          if (sub) out.push(...walk(sub, depth + 1))
        }
      }
      return out
    }
    return walk(entries, 0)
  }, [viewMode, entries, visibleEntries, expanded, treeChildren, showHidden])

  useEffect(() => {
    if (!pendingScroll) return
    const el = document.querySelector(`[data-row-path="${CSS.escape(pendingScroll)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      setPendingScroll(null)
    }
  }, [pendingScroll, rows])

  useEffect(() => {
    if (activePane !== 'sidebar' || !currentPath) return
    const el = document.querySelector(
      `[data-sidebar-path="${CSS.escape(currentPath)}"]`
    )
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activePane, currentPath])

  useEffect(() => {
    if (activePane !== 'files' || rows.length === 0) return
    const stillThere = selectedPath && rows.some((r) => r.entry.path === selectedPath)
    if (!stillThere) {
      setSelectedPath(rows[0].entry.path)
      setPendingScroll(rows[0].entry.path)
    }
  }, [activePane, rows, selectedPath])

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const real = await window.api.realpath(path).catch(() => path)
      const result = await window.api.listDirectory(real)
      setEntries(result)
      setCurrentPath(real)
      return real
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const switchToFolder = useCallback(
    async (newPath: string): Promise<void> => {
      inTransitRef.current = true

      if (currentPath && currentPath !== newPath) {
        setFolderStates((prev) => ({
          ...prev,
          [currentPath]: {
            expanded: [...expanded],
            selectedPath,
            previewPath
          }
        }))
      }

      const real = await window.api.realpath(newPath).catch(() => newPath)
      const target = folderStates[real]
      setExpanded(new Set(target?.expanded ?? []))
      setSelectedPath(target?.selectedPath ?? null)
      setPreviewPath(target?.previewPath ?? null)
      setTreeChildren(new Map())
      setSearchQuery('')

      await loadDirectory(real)
      inTransitRef.current = false
    },
    [currentPath, expanded, selectedPath, previewPath, folderStates, loadDirectory]
  )

  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    void (async () => {
      const home = await window.api.getHome()
      const saved = activeDomain?.lastPath
      if (saved && saved !== home) {
        try {
          await window.api.listDirectory(saved)
          await switchToFolder(saved)
          return
        } catch {
          // Saved folder is gone or unreadable — fall through to home.
        }
      }
      await switchToFolder(home)
    })()
  }, [switchToFolder, activeDomain])


  useEffect(() => {
    if (!currentPath) return
    const toFetch = [...expanded].filter(
      (p) =>
        (p === currentPath || p.startsWith(currentPath + '/')) && !treeChildren.has(p)
    )
    if (toFetch.length === 0) return
    let cancelled = false
    void Promise.all(
      toFetch.map(async (p) => {
        try {
          return { path: p, children: await window.api.listDirectory(p) }
        } catch {
          return { path: p, children: null as DirEntry[] | null }
        }
      })
    ).then((results) => {
      if (cancelled) return
      const succeeded = results.filter(
        (r): r is { path: string; children: DirEntry[] } => r.children !== null
      )
      const failed = results.filter((r) => r.children === null).map((r) => r.path)
      if (succeeded.length > 0) {
        setTreeChildren((prev) => {
          const next = new Map(prev)
          for (const s of succeeded) next.set(s.path, s.children)
          return next
        })
      }
      if (failed.length > 0) {
        setExpanded((prev) => {
          const next = new Set(prev)
          for (const p of failed) next.delete(p)
          return next
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentPath, expanded, treeChildren])

  const navigate = useCallback(
    (path: string) => {
      setHistory((h) => [...h, currentPath])
      void switchToFolder(path)
    },
    [currentPath, switchToFolder]
  )

  const goBack = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    void switchToFolder(prev)
  }, [history, switchToFolder])

  const goUp = useCallback(() => {
    const parent = parentPath(currentPath)
    if (parent && parent !== currentPath) navigate(parent)
  }, [currentPath, navigate])

  const goHome = useCallback(async () => {
    const home = await window.api.getHome()
    if (home !== currentPath) navigate(home)
  }, [currentPath, navigate])

  const onEntryActivate = useCallback(
    (entry: DirEntry) => {
      if (entry.isDirectory) {
        navigate(entry.path)
      } else {
        setPreviewPath(entry.path)
      }
    },
    [navigate]
  )

  const onEntryClick = useCallback(
    (entry: DirEntry) => {
      setSelectedPath(entry.path)
      if (previewPath && !entry.isDirectory) {
        setPreviewPath(entry.path)
      }
    },
    [previewPath]
  )

  const toggleExpand = useCallback(
    async (path: string): Promise<void> => {
      if (expanded.has(path)) {
        setExpanded((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
        return
      }
      if (!treeChildren.has(path)) {
        try {
          const ch = await window.api.listDirectory(path)
          setTreeChildren((prev) => new Map(prev).set(path, ch))
        } catch {
          return
        }
      }
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(path)
        return next
      })
    },
    [expanded, treeChildren]
  )

  const collapseAll = useCallback(() => setExpanded(new Set()), [])

  const addSection = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setSections((prev) => [...prev, { id, name: 'New Section', bookmarks: [] }])
    setEditingSection(id)
    setEditingLabel('New Section')
  }, [])

  const removeSection = useCallback(
    (id: string) => {
      setSections((prev) => prev.filter((s) => s.id !== id))
      if (editingSection === id) setEditingSection(null)
    },
    [editingSection]
  )

  const toggleSectionCollapsed = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
    )
  }, [])

  const startEditingSection = useCallback((s: Section) => {
    setEditingSection(s.id)
    setEditingLabel(s.name)
  }, [])

  const commitEditingSection = useCallback(() => {
    if (editingSection === null) return
    setSections((prev) =>
      prev.map((s) =>
        s.id === editingSection ? { ...s, name: editingLabel.trim() || 'Untitled' } : s
      )
    )
    setEditingSection(null)
  }, [editingSection, editingLabel])

  const addBookmarkToSection = useCallback(
    (sectionId: string) => {
      if (!currentPath) return
      if (sections.some((s) => s.bookmarks.some((b) => b.path === currentPath))) return
      const label = basename(currentPath) || currentPath
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, bookmarks: [...s.bookmarks, { path: currentPath, label }] }
            : s
        )
      )
    },
    [currentPath, sections]
  )

  const removeBookmark = useCallback(
    (path: string) => {
      setSections((prev) =>
        prev.map((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.path !== path) }))
      )
      if (editingBookmark === path) setEditingBookmark(null)
    },
    [editingBookmark]
  )

  const startEditingBookmark = useCallback((b: Bookmark) => {
    setEditingBookmark(b.path)
    setEditingLabel(b.label)
  }, [])

  const commitEditingBookmark = useCallback(() => {
    if (editingBookmark === null) return
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        bookmarks: s.bookmarks.map((b) =>
          b.path === editingBookmark
            ? { ...b, label: editingLabel.trim() || basename(b.path) || b.path }
            : b
        )
      }))
    )
    setEditingBookmark(null)
  }, [editingBookmark, editingLabel])

  const cancelEditingBookmark = useCallback(() => {
    setEditingBookmark(null)
  }, [])

  const cancelEditingSection = useCallback(() => {
    setEditingSection(null)
  }, [])

  const moveBookmark = useCallback(
    (path: string, targetSectionId: string, targetPath: string | null) => {
      setSections((prev) => {
        let moving: Bookmark | undefined
        const without = prev.map((s) => {
          const idx = s.bookmarks.findIndex((b) => b.path === path)
          if (idx === -1) return s
          moving = s.bookmarks[idx]
          return { ...s, bookmarks: s.bookmarks.filter((_, i) => i !== idx) }
        })
        if (!moving) return prev
        return without.map((s) => {
          if (s.id !== targetSectionId) return s
          const next = [...s.bookmarks]
          const insertAt =
            targetPath === null
              ? next.length
              : Math.max(
                  0,
                  next.findIndex((b) => b.path === targetPath)
                )
          next.splice(insertAt, 0, moving!)
          return { ...s, bookmarks: next }
        })
      })
    },
    []
  )

  const switchDomain = useCallback(
    async (newDomainId: string): Promise<void> => {
      if (newDomainId === domainState.activeDomainId) return
      const target = domainState.domains[newDomainId]
      if (!target) return
      inTransitRef.current = true

      // Save current folder state into current domain before switching.
      if (currentPath) {
        setDomainState((prev) => {
          const cur = prev.domains[prev.activeDomainId]
          if (!cur) return prev
          return {
            ...prev,
            domains: {
              ...prev.domains,
              [prev.activeDomainId]: {
                ...cur,
                folderStates: {
                  ...cur.folderStates,
                  [currentPath]: {
                    expanded: [...expanded],
                    selectedPath,
                    previewPath
                  }
                },
                lastPath: currentPath
              }
            },
            activeDomainId: newDomainId
          }
        })
      } else {
        setDomainState((prev) => ({ ...prev, activeDomainId: newDomainId }))
      }

      const targetPath = target.lastPath ?? (await window.api.getHome())
      const real = await window.api.realpath(targetPath).catch(() => targetPath)
      const fs = target.folderStates[real]
      setExpanded(new Set(fs?.expanded ?? []))
      setSelectedPath(fs?.selectedPath ?? null)
      setPreviewPath(fs?.previewPath ?? null)
      setTreeChildren(new Map())
      setSearchQuery('')
      await loadDirectory(real)
      inTransitRef.current = false
    },
    [domainState, currentPath, expanded, selectedPath, previewPath, loadDirectory]
  )

  const createDomain = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const name = 'New domain'
    setDomainState((prev) => ({
      ...prev,
      domains: {
        ...prev.domains,
        [id]: {
          id,
          name,
          sections: [{ id: 'default', name: 'Bookmarks', bookmarks: [] }],
          folderStates: {},
          lastPath: null
        }
      },
      order: [...prev.order, id]
    }))
    // Switch on next tick so the new domain is in state.
    setTimeout(() => {
      void switchDomain(id)
      setEditingDomain(id)
      setEditingDomainName(name)
    }, 0)
  }, [switchDomain])

  const startEditingDomain = useCallback((d: Domain) => {
    setEditingDomain(d.id)
    setEditingDomainName(d.name)
  }, [])

  const commitEditingDomain = useCallback(() => {
    if (!editingDomain) return
    const name = editingDomainName.trim() || 'Untitled'
    setDomainState((prev) => {
      const d = prev.domains[editingDomain]
      if (!d) return prev
      return {
        ...prev,
        domains: { ...prev.domains, [editingDomain]: { ...d, name } }
      }
    })
    setEditingDomain(null)
  }, [editingDomain, editingDomainName])

  const cancelEditingDomain = useCallback(() => setEditingDomain(null), [])

  const deleteDomain = useCallback(
    (id: string) => {
      setDomainState((prev) => {
        if (prev.order.length <= 1) return prev
        const remaining = prev.order.filter((x) => x !== id)
        const { [id]: _removed, ...domains } = prev.domains
        void _removed
        const nextActive = prev.activeDomainId === id ? remaining[0] : prev.activeDomainId
        return { domains, order: remaining, activeDomainId: nextActive }
      })
    },
    []
  )

  const moveSection = useCallback(
    (sourceId: string, targetId: string, before: boolean) => {
      if (sourceId === targetId) return
      setSections((prev) => {
        const srcIdx = prev.findIndex((s) => s.id === sourceId)
        const tgtIdx = prev.findIndex((s) => s.id === targetId)
        if (srcIdx === -1 || tgtIdx === -1) return prev
        const next = [...prev]
        const [moved] = next.splice(srcIdx, 1)
        let insertAt = before ? tgtIdx : tgtIdx + 1
        if (srcIdx < tgtIdx) insertAt -= 1
        next.splice(insertAt, 0, moved)
        return next
      })
    },
    []
  )

  const revealInTree = useCallback(
    async (targetPath: string): Promise<void> => {
      const isWithin =
        targetPath === currentPath || targetPath.startsWith(currentPath + '/')
      if (!isWithin) return

      setViewMode('tree')

      const rel = targetPath.slice(currentPath.length + 1)
      const segments = rel ? rel.split('/') : []
      const parents: string[] = []
      let acc = currentPath
      for (let i = 0; i < segments.length - 1; i++) {
        acc = acc + '/' + segments[i]
        parents.push(acc)
      }

      const updates: Array<[string, DirEntry[]]> = []
      for (const p of parents) {
        if (!treeChildren.has(p)) {
          try {
            const ch = await window.api.listDirectory(p)
            updates.push([p, ch])
          } catch {
            return
          }
        }
      }
      if (updates.length > 0) {
        setTreeChildren((prev) => {
          const next = new Map(prev)
          for (const [k, v] of updates) next.set(k, v)
          return next
        })
      }
      if (parents.length > 0) {
        setExpanded((prev) => {
          const next = new Set(prev)
          for (const p of parents) next.add(p)
          return next
        })
      }
      setSelectedPath(targetPath)
      setPendingScroll(targetPath)
    },
    [currentPath, treeChildren]
  )

  const onSearchResultClick = useCallback(
    (entry: DirEntry) => {
      setSelectedPath(entry.path)
      const isWithin =
        entry.path === currentPath || entry.path.startsWith(currentPath + '/')
      if (isWithin) void revealInTree(entry.path)
      if (previewPath && !entry.isDirectory) setPreviewPath(entry.path)
    },
    [currentPath, previewPath, revealInTree]
  )

  const onSearchResultDoubleClick = useCallback(
    (entry: DirEntry) => {
      const isWithin =
        entry.path === currentPath || entry.path.startsWith(currentPath + '/')
      if (isWithin) void revealInTree(entry.path)
      if (!entry.isDirectory) setPreviewPath(entry.path)
    },
    [currentPath, revealInTree]
  )

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    const handle = setTimeout(async () => {
      const scope = searchScope === 'folder' ? currentPath : null
      try {
        const results = await window.api.search(searchQuery, scope)
        if (!cancelled) setSearchResults(results)
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [searchQuery, searchScope, currentPath])

  useEffect(() => {
    if (!previewPath) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPreviewPath(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewPath])

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
    window.api.readText(previewPath).then(
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
  }, [previewPath])

  useEffect(() => {
    if (!previewPath || hasBuiltinPreview(previewPath)) {
      setQuicklookPng(null)
      setQuicklookLoading(false)
      return
    }
    let cancelled = false
    setQuicklookPng(null)
    setQuicklookLoading(true)
    window.api.quicklookPreview(previewPath).then(
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
  }, [previewPath])

  const canGoUp = useMemo(() => {
    const parent = parentPath(currentPath)
    return parent !== null && parent !== currentPath
  }, [currentPath])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (
        menuOpen ||
        aboutOpen ||
        settingsOpen ||
        confirmDeleteDomainId ||
        editingSection ||
        editingBookmark
      )
        return

      const cmd = e.metaKey || e.ctrlKey

      if (cmd && (e.key === '[' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        goBack()
        return
      }
      if (cmd && e.key === 'ArrowUp') {
        e.preventDefault()
        goUp()
        return
      }

      if (activePane === 'tabs') {
        if (e.key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const idx = domainState.order.indexOf(domainState.activeDomainId)
          if (idx > 0) void switchDomain(domainState.order[idx - 1])
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault()
          const idx = domainState.order.indexOf(domainState.activeDomainId)
          if (idx >= 0 && idx < domainState.order.length - 1) {
            void switchDomain(domainState.order[idx + 1])
          }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          setActivePane(sidebarOpen ? 'sidebar' : 'files')
        }
        return
      }

      if (activePane === 'sidebar') {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          if (navigableSidebarPaths.length === 0) return
          const idx = navigableSidebarPaths.indexOf(currentPath)
          const next =
            idx === -1
              ? navigableSidebarPaths[0]
              : navigableSidebarPaths[
                  Math.min(idx + 1, navigableSidebarPaths.length - 1)
                ]
          if (next && next !== currentPath) navigate(next)
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (navigableSidebarPaths.length === 0) {
            if (settings.displayDomainsAsTabs) setActivePane('tabs')
            return
          }
          const idx = navigableSidebarPaths.indexOf(currentPath)
          if (
            settings.displayDomainsAsTabs &&
            (idx === 0 || idx === -1)
          ) {
            setActivePane('tabs')
            return
          }
          const next = navigableSidebarPaths[Math.max(idx - 1, 0)]
          if (next && next !== currentPath) navigate(next)
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault()
          setActivePane('files')
        }
        return
      }

      if (activePane === 'files') {
        const cur = selectedPath
          ? rows.findIndex((r) => r.entry.path === selectedPath)
          : -1

        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          if (rows.length === 0) return
          const next = rows[Math.min(cur + 1, rows.length - 1)] ?? rows[0]
          setSelectedPath(next.entry.path)
          setPendingScroll(next.entry.path)
          if (previewPath && !next.entry.isDirectory) setPreviewPath(next.entry.path)
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (rows.length === 0) return
          const next = rows[Math.max(cur - 1, 0)] ?? rows[rows.length - 1]
          setSelectedPath(next.entry.path)
          setPendingScroll(next.entry.path)
          if (previewPath && !next.entry.isDirectory) setPreviewPath(next.entry.path)
        } else if (e.key === 'l' || e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault()
          const row = cur >= 0 ? rows[cur] : null
          if (row) onEntryActivate(row.entry)
        } else if (e.key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault()
          if (!sidebarOpen) setSidebarOpen(true)
          setActivePane('sidebar')
        } else if (e.key === ' ') {
          if (viewMode !== 'tree' || cur < 0) return
          const row = rows[cur]
          if (!row.entry.isDirectory) return
          e.preventDefault()
          void toggleExpand(row.entry.path)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    activePane,
    navigableSidebarPaths,
    selectedPath,
    rows,
    previewPath,
    currentPath,
    viewMode,
    sidebarOpen,
    menuOpen,
    aboutOpen,
    settingsOpen,
    confirmDeleteDomainId,
    editingSection,
    editingBookmark,
    navigate,
    goBack,
    goUp,
    onEntryActivate,
    toggleExpand,
    settings.displayDomainsAsTabs,
    domainState.order,
    domainState.activeDomainId,
    switchDomain
  ])

  return (
    <div className="app">
      <header className="toolbar">
        <div className="menu-wrapper">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={menuOpen ? 'active' : ''}
          >
            ☰
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu" role="menu">
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    addSection()
                    setMenuOpen(false)
                  }}
                >
                  Add new section
                </button>
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    createDomain()
                    setMenuOpen(false)
                  }}
                >
                  New domain…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    if (activeDomain) {
                      startEditingDomain(activeDomain)
                      if (!settings.displayDomainsAsTabs) setDomainMenuOpen(true)
                    }
                    setMenuOpen(false)
                  }}
                >
                  Rename current domain…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  disabled={domainState.order.length <= 1}
                  onClick={() => {
                    if (activeDomain && domainState.order.length > 1) {
                      setConfirmDeleteDomainId(activeDomain.id)
                    }
                    setMenuOpen(false)
                  }}
                >
                  Delete current domain…
                </button>
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  Settings…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setAboutOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  About Wadsworth
                </button>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-label="Toggle sidebar"
          className={sidebarOpen ? 'active' : ''}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="1.5"
              y="2.5"
              width="11"
              height="9"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <line
              x1="5.5"
              y1="2.5"
              x2="5.5"
              y2="11.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
        {!settings.displayDomainsAsTabs && (
        <div className="menu-wrapper">
          <button
            type="button"
            className={`domain-button ${domainMenuOpen ? 'active' : ''}`}
            onClick={() => setDomainMenuOpen((v) => !v)}
            title="Switch domain"
            aria-haspopup="menu"
            aria-expanded={domainMenuOpen}
          >
            {editingDomain && editingDomain === activeDomain?.id ? (
              <input
                className="domain-button-input"
                value={editingDomainName}
                autoFocus
                onChange={(e) => setEditingDomainName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') commitEditingDomain()
                  else if (e.key === 'Escape') cancelEditingDomain()
                }}
                onBlur={commitEditingDomain}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="domain-name">{activeDomain?.name ?? 'Domain'}</span>
                <span className="domain-caret">▾</span>
              </>
            )}
          </button>
          {domainMenuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setDomainMenuOpen(false)} />
              <div className="menu domain-menu" role="menu">
                {domainState.order.map((id) => {
                  const d = domainState.domains[id]
                  if (!d) return null
                  const isActive = id === domainState.activeDomainId
                  return editingDomain === id ? (
                    <input
                      key={id}
                      className="domain-edit-input"
                      value={editingDomainName}
                      autoFocus
                      onChange={(e) => setEditingDomainName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditingDomain()
                        else if (e.key === 'Escape') cancelEditingDomain()
                      }}
                      onBlur={commitEditingDomain}
                    />
                  ) : (
                    <button
                      key={id}
                      type="button"
                      className={`menu-item domain-item ${isActive ? 'active' : ''}`}
                      role="menuitem"
                      onDoubleClick={() => startEditingDomain(d)}
                      onClick={() => {
                        if (!isActive) void switchDomain(id)
                        setDomainMenuOpen(false)
                      }}
                    >
                      <span className="domain-item-check">{isActive ? '✓' : ''}</span>
                      <span className="domain-item-name">{d.name}</span>
                    </button>
                  )
                })}
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    createDomain()
                    setDomainMenuOpen(false)
                  }}
                >
                  + New domain…
                </button>
              </div>
            </>
          )}
        </div>
        )}
        <button
          type="button"
          onClick={goBack}
          disabled={history.length === 0}
          title="Back"
          aria-label="Back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goUp}
          disabled={!canGoUp}
          title="Up to parent folder"
          aria-label="Up"
        >
          ↑
        </button>
        <button type="button" onClick={goHome} title="Home folder" aria-label="Home">
          ⌂
        </button>
        <div className="segmented" role="group" aria-label="View mode">
          <button
            type="button"
            className={viewMode === 'flat' ? 'active' : ''}
            onClick={() => setViewMode('flat')}
            title="Flat view"
          >
            Flat
          </button>
          <button
            type="button"
            className={viewMode === 'tree' ? 'active' : ''}
            onClick={() => setViewMode('tree')}
            title="Tree view"
          >
            Tree
          </button>
        </div>
        <button
          type="button"
          onClick={collapseAll}
          disabled={viewMode !== 'tree' || expanded.size === 0}
          title="Collapse all folders"
        >
          ⇱
        </button>
        <label className="toggle" title="Show files and folders starting with a dot">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
        <input
          className="path"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setHistory((h) => [...h, currentPath])
              void switchToFolder(pathInput)
            }
          }}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => currentPath && void window.api.openPath(currentPath)}
          disabled={!currentPath}
          title={
            window.api.platform === 'darwin'
              ? 'Reveal in Finder'
              : window.api.platform === 'win32'
                ? 'Open in Explorer'
                : 'Open in file manager'
          }
          aria-label="Open in system file manager"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M11 7.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 2.5h3v3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11.5 2.5L6 8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="search-group">
          <input
            className="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('')
            }}
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <div className="segmented" role="group" aria-label="Search scope">
            <button
              type="button"
              className={searchScope === 'folder' ? 'active' : ''}
              onClick={() => setSearchScope('folder')}
              title="Search inside the current folder"
            >
              Here
            </button>
            <button
              type="button"
              className={searchScope === 'everywhere' ? 'active' : ''}
              onClick={() => setSearchScope('everywhere')}
              title="Search the entire Mac"
            >
              Mac
            </button>
          </div>
        </div>
      </header>

      {settings.displayDomainsAsTabs && (
        <div
          className={`domain-tabs ${activePane === 'tabs' ? 'pane-active' : ''}`}
          onMouseDown={() => setActivePane('tabs')}
        >
          {domainState.order.map((id) => {
            const d = domainState.domains[id]
            if (!d) return null
            const isActive = id === domainState.activeDomainId
            return editingDomain === id ? (
              <input
                key={id}
                className="domain-tab-input"
                value={editingDomainName}
                autoFocus
                onChange={(e) => setEditingDomainName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditingDomain()
                  else if (e.key === 'Escape') cancelEditingDomain()
                }}
                onBlur={commitEditingDomain}
              />
            ) : (
              <div
                key={id}
                role="button"
                tabIndex={0}
                className={`domain-tab ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (!isActive) void switchDomain(id)
                }}
                onDoubleClick={() => startEditingDomain(d)}
                title={d.name}
              >
                <span className="domain-tab-name">{d.name}</span>
                {domainState.order.length > 1 && (
                  <button
                    type="button"
                    className="domain-tab-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteDomainId(id)
                    }}
                    title="Delete domain"
                    aria-label="Delete domain"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
          <button
            type="button"
            className="domain-tab-add"
            onClick={createDomain}
            title="New domain"
            aria-label="New domain"
          >
            +
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className={`body ${previewPath ? 'split' : ''}`}>
        {sidebarOpen && (
          <aside
            className={`sidebar ${activePane === 'sidebar' ? 'pane-active' : ''}`}
            onMouseDown={() => setActivePane('sidebar')}
          >
            <div className="sidebar-list">
              {sections.map((section) => (
                <div className="sidebar-section" key={section.id}>
                  <div
                    className={`sidebar-section-header ${
                      dragOverSection === section.id ? 'drag-over' : ''
                    }`}
                    draggable={editingSection !== section.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-wadsworth-section', section.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverSection(section.id)
                    }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverSection(null)
                      const types = e.dataTransfer.types
                      if (types.includes('application/x-wadsworth-section')) {
                        const sourceId = e.dataTransfer.getData(
                          'application/x-wadsworth-section'
                        )
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        const before = e.clientY < rect.top + rect.height / 2
                        moveSection(sourceId, section.id, before)
                        return
                      }
                      const path =
                        e.dataTransfer.getData('application/x-wadsworth-bookmark') ||
                        e.dataTransfer.getData('text/plain')
                      if (path) moveBookmark(path, section.id, null)
                    }}
                  >
                    <button
                      type="button"
                      className="section-caret"
                      onClick={() => toggleSectionCollapsed(section.id)}
                      aria-label={section.collapsed ? 'Expand section' : 'Collapse section'}
                    >
                      {section.collapsed ? (
                        <ChevronRight size={11} />
                      ) : (
                        <ChevronDown size={11} />
                      )}
                    </button>
                    {editingSection === section.id ? (
                      <input
                        className="sidebar-input section-input"
                        value={editingLabel}
                        autoFocus
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditingSection()
                          else if (e.key === 'Escape') cancelEditingSection()
                        }}
                        onBlur={commitEditingSection}
                      />
                    ) : (
                      <span
                        className="section-name"
                        onDoubleClick={() => startEditingSection(section)}
                        title="Double-click to rename"
                      >
                        {section.name}
                      </span>
                    )}
                    <div className="section-actions">
                      <button
                        type="button"
                        className="section-action"
                        onClick={() => addBookmarkToSection(section.id)}
                        disabled={!currentPath || currentlyBookmarked}
                        title="Add current folder to this section"
                        aria-label="Add current folder"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="section-action section-remove"
                        onClick={() => removeSection(section.id)}
                        title="Remove section"
                        aria-label="Remove section"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {!section.collapsed && (
                    <div className="sidebar-section-items">
                      {section.bookmarks.length === 0 ? (
                        <div className="sidebar-empty-inline">No bookmarks</div>
                      ) : (
                        section.bookmarks.map((b) =>
                          editingBookmark === b.path ? (
                            <input
                              key={b.path}
                              className="sidebar-input"
                              value={editingLabel}
                              autoFocus
                              onChange={(e) => setEditingLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditingBookmark()
                                else if (e.key === 'Escape') cancelEditingBookmark()
                              }}
                              onBlur={commitEditingBookmark}
                            />
                          ) : (
                            <div
                              key={b.path}
                              data-sidebar-path={b.path}
                              className={`sidebar-item ${
                                currentPath === b.path ? 'active' : ''
                              } ${dragOverBookmark === b.path ? 'drag-over' : ''}`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  'application/x-wadsworth-bookmark',
                                  b.path
                                )
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragOver={(e) => {
                                if (
                                  !e.dataTransfer.types.includes(
                                    'application/x-wadsworth-bookmark'
                                  )
                                ) {
                                  return
                                }
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                                setDragOverBookmark(b.path)
                              }}
                              onDragLeave={() => setDragOverBookmark(null)}
                              onDrop={(e) => {
                                if (
                                  !e.dataTransfer.types.includes(
                                    'application/x-wadsworth-bookmark'
                                  )
                                ) {
                                  return
                                }
                                e.preventDefault()
                                e.stopPropagation()
                                const path = e.dataTransfer.getData(
                                  'application/x-wadsworth-bookmark'
                                )
                                if (path && path !== b.path) {
                                  moveBookmark(path, section.id, b.path)
                                }
                                setDragOverBookmark(null)
                              }}
                              onClick={() => navigate(b.path)}
                              onDoubleClick={() => startEditingBookmark(b)}
                              title={b.path}
                            >
                              <span className="sidebar-label">{b.label}</span>
                              <button
                                type="button"
                                className="sidebar-remove"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeBookmark(b.path)
                                }}
                                title="Remove bookmark"
                                aria-label="Remove bookmark"
                              >
                                ×
                              </button>
                            </div>
                          )
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
        <div
          className={`left ${activePane === 'files' ? 'pane-active' : ''}`}
          onMouseDown={() => setActivePane('files')}
        >
          <div className="listing">
            <div className="row header">
              <span className="col-name">Name</span>
              <span className="col-size">Size</span>
              <span className="col-date">Modified</span>
            </div>
            {loading && entries.length === 0 ? (
              <div className="empty">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="empty">Empty folder</div>
            ) : rows.length === 0 ? (
              <div className="empty">
                {hiddenCount} hidden item{hiddenCount === 1 ? '' : 's'} — toggle
                &ldquo;Show hidden&rdquo; to view
              </div>
            ) : (
              rows.map(({ entry, depth }) => {
                const isOpen = expanded.has(entry.path)
                return (
                  <div
                    key={entry.path}
                    data-row-path={entry.path}
                    className={`row ${selectedPath === entry.path ? 'selected' : ''}`}
                    onClick={() => onEntryClick(entry)}
                    onDoubleClick={() => onEntryActivate(entry)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onEntryActivate(entry)
                    }}
                  >
                    <span className="col-name" style={{ paddingLeft: depth * 16 }}>
                      {viewMode === 'tree' ? (
                        entry.isDirectory ? (
                          <span
                            className="caret"
                            role="button"
                            aria-label={isOpen ? 'Collapse' : 'Expand'}
                            onClick={(e) => {
                              e.stopPropagation()
                              void toggleExpand(entry.path)
                            }}
                          >
                            {isOpen ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                          </span>
                        ) : (
                          <span className="caret-spacer" />
                        )
                      ) : null}
                      <span className="icon">
                        <FileTypeIcon
                          path={entry.path}
                          isDirectory={entry.isDirectory}
                          expanded={isOpen}
                        />
                      </span>
                      <span className="name-stack">
                        <span className="name-line">{entry.name}</span>
                      </span>
                    </span>
                    <span className="col-size">
                      {entry.isDirectory ? '—' : formatSize(entry.size)}
                    </span>
                    <span className="col-date">{formatDate(entry.modifiedMs)}</span>
                  </div>
                )
              })
            )}
          </div>

          {inSearch && (
            <div className="search-pane">
              <div className="search-pane-header">
                <span>
                  Search results
                  {searchLoading
                    ? ' (searching…)'
                    : ` (${searchRows.length}${
                        searchRows.length === 500 ? '+' : ''
                      })`}
                </span>
                <span className="search-pane-scope">
                  {searchScope === 'folder' ? 'in this folder' : 'across Mac'}
                </span>
              </div>
              <div className="listing search-listing">
                {searchLoading && searchRows.length === 0 ? (
                  <div className="empty">Searching…</div>
                ) : searchRows.length === 0 ? (
                  <div className="empty">No results for &ldquo;{searchQuery}&rdquo;</div>
                ) : (
                  searchRows.map((entry) => {
                    const isWithin =
                      entry.path === currentPath ||
                      entry.path.startsWith(currentPath + '/')
                    return (
                      <div
                        key={entry.path}
                        className={`row ${
                          selectedPath === entry.path ? 'selected' : ''
                        } ${isWithin ? '' : 'outside'}`}
                        onClick={() => onSearchResultClick(entry)}
                        onDoubleClick={() => onSearchResultDoubleClick(entry)}
                        tabIndex={0}
                      >
                        <span className="col-name">
                          <span className="icon">
                            <FileTypeIcon path={entry.path} isDirectory={entry.isDirectory} />
                          </span>
                          <span className="name-stack">
                            <span className="name-line">{entry.name}</span>
                            <span className="name-sub" title={entry.path}>
                              {dirname(entry.path)}
                            </span>
                          </span>
                        </span>
                        <span className="col-size">
                          {entry.isDirectory ? '—' : formatSize(entry.size)}
                        </span>
                        <span className="col-date">{formatDate(entry.modifiedMs)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {previewPath && (
          <div
            className="divider"
            onMouseDown={startResize}
            title="Drag to resize"
            role="separator"
            aria-orientation="vertical"
          />
        )}

        {previewPath && (
          <div className="preview" style={{ width: previewWidth }}>
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
                onClick={() => void window.api.openPath(previewPath)}
                title="Open externally"
              >
                Open externally
              </button>
              <button
                type="button"
                onClick={() => setPreviewPath(null)}
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
        )}
      </div>

      <footer className="statusbar">
        <span className="statusbar-left">
          {viewMode === 'flat'
            ? `${visibleEntries.length} item${visibleEntries.length === 1 ? '' : 's'}`
            : `${rows.length} shown`}
          {hiddenCount > 0 && !showHidden ? ` · ${hiddenCount} hidden` : ''}
        </span>
        <span className="statusbar-right" title={selectedPath ?? ''}>
          {selectedPath ?? ''}
        </span>
      </footer>

      {confirmDeleteDomainId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteDomainId(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete domain?</h2>
            <p>
              This will permanently delete the{' '}
              <strong>
                &ldquo;{domainState.domains[confirmDeleteDomainId]?.name}&rdquo;
              </strong>{' '}
              domain and everything inside it — every section, every bookmark, and the
              saved state of every folder you&rsquo;ve visited in it.
            </p>
            <p>
              This cannot be undone. Other domains are not affected.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setConfirmDeleteDomainId(null)}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-destructive"
                onClick={() => {
                  const id = confirmDeleteDomainId
                  setConfirmDeleteDomainId(null)
                  if (id) deleteDomain(id)
                }}
              >
                Delete domain
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className="settings-list">
              <label className="settings-row">
                <input
                  type="checkbox"
                  checked={settings.displayDomainsAsTabs}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, displayDomainsAsTabs: e.target.checked }))
                  }
                />
                <span>Display domains as tabs</span>
              </label>
              <div className="settings-group">
                <span className="settings-group-label">Appearance</span>
                <div className="settings-radio-group">
                  {(['system', 'light', 'dark'] as ThemePref[]).map((opt) => (
                    <label key={opt} className="settings-radio">
                      <input
                        type="radio"
                        name="theme"
                        checked={settings.theme === opt}
                        onChange={() => setSettings((s) => ({ ...s, theme: opt }))}
                      />
                      <span>{opt === 'system' ? 'Match system' : opt[0].toUpperCase() + opt.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {aboutOpen && (
        <div className="modal-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Wadsworth</h2>
            <p className="modal-subtitle">A personal read-only file browser for macOS.</p>
            <p>
              Wadsworth is built for fast retrieval: a custom sidebar, instant Spotlight
              search with in-tree reveal, and a persistent preview pane that renders PDFs,
              images, text, and anything the OS knows how to QuickLook.
            </p>
            <p>
              It is the foundation of a personal information system — eventually meant to
              manage clients, businesses, locations, and the documents that come with each.
            </p>
            <p className="modal-meta">Version 1.0.0</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setAboutOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
