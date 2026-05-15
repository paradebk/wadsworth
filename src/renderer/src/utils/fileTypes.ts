import { basename } from './path'

export const IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif'
])

export const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg', 'env',
  'xml', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
  'py', 'rb', 'php', 'pl', 'lua', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'go', 'rs', 'java', 'kt', 'swift', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'sql',
  'r', 'scala', 'clj', 'ex', 'exs', 'dockerfile'
])

export const TEXT_BASENAMES = new Set([
  'readme', 'license', 'licence', 'makefile', 'dockerfile', 'changelog',
  'notice', 'authors', 'contributors', 'copying',
  '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.prettierrc', '.env'
])

export function isPdf(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

export function isImage(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return false
  return IMAGE_EXTS.has(path.slice(dot + 1).toLowerCase())
}

export function isText(path: string): boolean {
  const name = basename(path).toLowerCase()
  if (TEXT_BASENAMES.has(name)) return true
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  return TEXT_EXTS.has(ext)
}

export function isMarkdown(path: string): boolean {
  const p = path.toLowerCase()
  return p.endsWith('.md') || p.endsWith('.markdown')
}

export function hasBuiltinPreview(path: string): boolean {
  return isPdf(path) || isImage(path) || isText(path)
}
