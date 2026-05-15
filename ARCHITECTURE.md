# Architecture

This document describes the code layout, the core abstractions, and the
extension points that will support future plugins and additional source
types.

## High-level

Wadsworth is an Electron app with a main process (Node) and a renderer
process (Chromium + React). The main process owns OS access: filesystem
reads, shelling out to `mdfind` / `qlmanage`, window state, custom
URL protocol, and so on. The renderer is the UI — it knows nothing
about Node APIs and asks the main process for everything via IPC
exposed through `preload`.

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (React + TypeScript)                              │
│    ├── Components (sidebar, toolbar, preview, modals)       │
│    ├── State (domains, settings, navigation)                │
│    └── Source (abstraction over things that can be browsed) │
│           └── FileSystemSource ── window.api ──┐            │
└────────────────────────────────────────────────┼────────────┘
                                                 │ IPC
┌────────────────────────────────────────────────┼────────────┐
│  Main process (Node)                           │            │
│    fs reads · mdfind · qlmanage · windowing · custom protocol│
└─────────────────────────────────────────────────────────────┘
```

## Directory layout

```
src/
├── main/                    # Node main process: IPC handlers, windowing
│   └── index.ts
├── preload/                 # Bridge: exposes typed window.api to renderer
│   ├── index.ts
│   └── index.d.ts
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx                  # React entry, iconify collection load
        ├── App.tsx                   # Orchestrator: top-level state & composition
        │
        ├── types.ts                  # Domain types (Section, Domain, FolderState, …)
        │
        ├── utils/                    # Pure helpers, no React, no state
        │   ├── path.ts               # basename, dirname, parentPath
        │   ├── format.ts             # formatSize, formatDate
        │   ├── fileTypes.ts          # isPdf, isImage, isText, isMarkdown, …
        │   └── appFileUrl.ts         # wadsworth-file:// URL builder
        │
        ├── state/
        │   └── storageKeys.ts        # All localStorage keys in one place
        │
        ├── sources/                  # The extensibility seam
        │   ├── Source.ts             # interface  ←── plugins implement this
        │   └── FileSystemSource.ts   # built-in: local filesystem via window.api
        │
        ├── preview/
        │   └── languageForFile.ts    # CodeMirror language pack selection
        │
        ├── icons/
        │   └── FileTypeIcon.tsx      # Icon component + extension/basename map
        │
        ├── components/
        │   ├── StatusBar.tsx
        │   └── modals/
        │       ├── AboutModal.tsx
        │       ├── SettingsModal.tsx
        │       └── ConfirmDeleteDomainModal.tsx
        │
        └── assets/
            ├── base.css              # CSS variables, theme tokens
            └── main.css              # Layout & component styles
```

## Core abstraction: `Source`

[`sources/Source.ts`](src/renderer/src/sources/Source.ts) is the
interface every browsable backing implements. The UI talks to a `Source`,
not to `window.api` directly. Adding a new backing (a database, a remote
file server, an MCP server, a cloud drive) is a matter of implementing
this interface.

```ts
interface Source {
  readonly id: string
  readonly name: string

  list(path: string): Promise<DirEntry[]>
  resolvePath(path: string): Promise<string>
  defaultPath(): Promise<string>
  readText(path: string): Promise<TextFile>
  search(query: string, scope: string | null): Promise<DirEntry[]>
  thumbnailPreview(path: string): Promise<string | null>
  openExternal(path: string): Promise<void>
}
```

Today there's exactly one implementation,
[`FileSystemSource`](src/renderer/src/sources/FileSystemSource.ts),
which delegates to the existing IPC. `App.tsx` imports a singleton:

```ts
import { fileSystemSource } from './sources/FileSystemSource'
const source: Source = fileSystemSource
```

When we add a second source (a database, an MCP server, etc.) the next
step is a small registry that maps `Source.id` → `Source` instance, and
the UI dispatches calls based on the active source. The interface itself
shouldn't need to change.

## State management

State lives in `App.tsx` as plain React `useState` and `useEffect`. It
hasn't been extracted into custom hooks or a state library yet because
the app fits in head and the orchestration is still mostly linear. A
future refactor will likely split state into hooks:

- `useDomainState` — domains, sections, folder-states, switching
- `useNavigation` — currentPath, history, navigate / goBack / goUp
- `useTreeExpansion` — expanded set, treeChildren cache, lazy loading
- `useSearch` — search query/scope/results with debounce
- `usePreview` — preview state for PDF / image / text / QuickLook
- `useKeyboard` — global key handler with pane awareness
- `useTheme` — light / dark / system with system listener

When `App.tsx` exceeds what fits in head, that's the trigger.

## Persistence

All persistent state lives in `localStorage` (renderer side, single
user, no syncing). Keys are defined in
[`state/storageKeys.ts`](src/renderer/src/state/storageKeys.ts). The
two top-level keys are:

- `wadsworth:domainState` — the *workspace* state. Domains, sections of
  bookmarks within each domain, per-folder state (tree expansion,
  selected file, open preview) per domain. This is the bulk of what the
  app remembers.
- `wadsworth:settings` — global UI preferences (theme, "display domains
  as tabs").

Plus a handful of smaller per-UI keys (sidebar open, preview pane
width, view mode, etc.).

Window position / size / maximize state is persisted by the *main*
process to `~/Library/Application Support/Wadsworth/window-state.json`.

## Theming

Themes are declared as CSS custom properties on `:root` (dark) and
`:root[data-theme="light"]` (light) in
[`base.css`](src/renderer/src/assets/base.css). Setting the
`data-theme` attribute on the `<html>` element flips the entire app.

The `theme` user preference is `system` | `light` | `dark`. In `system`
mode the renderer listens to `window.matchMedia('(prefers-color-scheme: dark)')`
and tracks live OS changes.

CodeMirror and `highlight.js` themes are switched in lockstep with the
app theme — CodeMirror via its `theme` prop, `highlight.js` via
dynamically injecting one of the two CSS-as-string imports.

## Build & distribution

- `npm run dev` — Electron dev mode with a separate `userData` dir so
  it can run alongside the installed copy.
- `npm run install:mac` — full build + reinstall to `/Applications` using
  `ditto` (which preserves the ad-hoc code signature).
- `npm run build:mac` / `build:win` / `build:linux` — produce platform
  installers locally.
- GitHub Actions in `.github/workflows/build.yml` runs the matrix on
  every push to `main` and uploads artifacts to a draft GitHub Release.

## Plugin model (future)

The intended plugin model uses the `Source` interface as the primary
extension point. A plugin will be able to:

1. Implement `Source` and register it with a `SourceRegistry`.
2. Optionally register custom preview handlers for new content types
   (the next interface to add: `PreviewHandler`).
3. Optionally register sidebar adornments (icons, badges, contextual
   actions).

Plugin loading is not yet implemented. The current refactor establishes
the *seams* — the interfaces and the directory layout — so that the
loader can be added without re-shaping the rest of the codebase.
