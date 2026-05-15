import { Folder, FolderOpen } from 'lucide-react'
import { Icon } from '@iconify/react'
import { basename } from '../utils/path'

/** Map file extensions to vscode-icons icon names. */
export const EXT_ICON_MAP: Record<string, string> = {
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

/** Map specific filenames to vscode-icons icon names. Wins over extension map. */
export const BASENAME_ICON_MAP: Record<string, string> = {
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

type Props = {
  path: string
  isDirectory: boolean
  expanded?: boolean
}

export function FileTypeIcon({ path, isDirectory, expanded }: Props): React.JSX.Element {
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
