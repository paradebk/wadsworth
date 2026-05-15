import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
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
import { basename } from '../utils/path'

export function languageForFile(path: string): Extension | null {
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
