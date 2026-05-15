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
┌──────────────────────────────────────────────────────────────┐
│  Renderer (React + TypeScript)                               │
│    ├── Components (sidebar, toolbar, file pane, preview, …)  │
│    ├── Hooks (state + behavior slices)                       │
│    ├── Source (abstraction over things that can be browsed)  │
│    │     └── FileSystemSource ── window.api ──┐              │
│    └── App.tsx (orchestrator)                 │              │
└───────────────────────────────────────────────┼──────────────┘
                                                │ IPC
┌───────────────────────────────────────────────┼──────────────┐
│  Main process (Node)                          │              │
│    fs reads · mdfind · qlmanage · windowing · custom protocol│
└──────────────────────────────────────────────────────────────┘
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
        ├── main.tsx                 # React entry, iconify collection load
        ├── App.tsx                  # Orchestrator: composes hooks & components
        │
        ├── types.ts                 # Domain types (Section, Domain, FolderState, …)
        │
        ├── utils/                   # Pure helpers, no React, no state
        │   ├── path.ts              # basename, dirname, parentPath, isDescendant
        │   ├── format.ts            # formatSize, formatDate
        │   ├── fileTypes.ts         # isPdf, isImage, isText, isMarkdown, …
        │   └── appFileUrl.ts        # wadsworth-file:// URL builder
        │
        ├── state/
        │   └── storageKeys.ts       # All localStorage keys in one place
        │
        ├── sources/                 # The extensibility seam
        │   ├── Source.ts            # interface ←── plugins implement this
        │   └── FileSystemSource.ts  # built-in: local filesystem via window.api
        │
        ├── preview/
        │   └── languageForFile.ts   # CodeMirror language pack selection
        │
        ├── icons/
        │   └── FileTypeIcon.tsx     # Icon component + extension/basename map
        │
        ├── hooks/                   # State + behavior slices
        │   ├── useTheme.ts          # system/light/dark + data-theme + hljs swap
        │   ├── useSettings.ts       # global UI prefs, persisted
        │   ├── useDomainState.ts    # domains, sections, folder-states (persisted)
        │   ├── useBookmarks.ts      # section + bookmark CRUD on top of domain
        │   ├── useTreeExpansion.ts  # expanded set, treeChildren cache, rehydration
        │   ├── useSearch.ts         # debounced search against the active Source
        │   ├── usePreviewContent.ts # text + QuickLook fetch for the preview path
        │   ├── useMarkdownView.ts   # rendered vs source toggle for .md files
        │   ├── usePreviewWidth.ts   # resize-handle state for the preview pane
        │   ├── useModals.ts         # menu/about/settings/confirm + Escape closes
        │   └── useKeyboardNav.ts    # global hjkl + arrow-key navigation
        │
        ├── components/
        │   ├── Toolbar/Toolbar.tsx
        │   ├── Sidebar/Sidebar.tsx
        │   ├── FilePane/FilePane.tsx       # folder listing + search results split
        │   ├── PreviewPane/PreviewPane.tsx # PDF / image / text / markdown / QL
        │   ├── DomainTabs.tsx              # tab bar variant of the domain switcher
        │   ├── StatusBar.tsx
        │   └── modals/
        │       ├── AboutModal.tsx
        │       ├── SettingsModal.tsx
        │       └── ConfirmDeleteDomainModal.tsx
        │
        └── assets/
            ├── base.css             # CSS variables, theme tokens
            └── main.css             # Layout & component styles
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

State is organized as **a set of focused hooks** consumed by `App.tsx`.
Each hook owns one cohesive slice — either pure state (with persistence)
or a slice + the side effects that go with it.

| Hook | Owns |
|---|---|
| `useTheme(themePref)` | OS-dark listener, effective theme, applies `data-theme`, swaps the highlight.js stylesheet in lockstep. |
| `useSettings()` | Global UI preferences (theme, "display domains as tabs") + localStorage persistence. |
| `useDomainState()` | The persisted `domainState` (domains, sections, folder-states, last-path per domain). Exposes low-level `updateActiveDomain` / `setSections` / `setFolderStates` plus the editing-domain-name state. |
| `useBookmarks(sections, setSections, currentPath)` | Section + bookmark CRUD on top of `useDomainState`: add / remove / rename / reorder, inline rename state, drag-over visual state. |
| `useTreeExpansion(source, currentPath)` | Tree view's `expanded` set + `treeChildren` cache, `toggleExpand`, `collapseAll`, plus the rehydration effect that lazy-loads children for paths restored from a saved folder state. |
| `useSearch(source, currentPath)` | Search input query/scope/results/loading + debounced execution against the active Source. |
| `usePreviewContent(source, previewPath)` | Text-fetch + QuickLook-thumbnail fetch effects driven by the current preview path. |
| `useMarkdownView()` | Rendered vs Source toggle for `.md` files, persisted. |
| `usePreviewWidth()` | Preview pane's width + the splitter mousedown→drag handler. |
| `useModals()` | Open/close state for the hamburger menu, About / Settings / Confirm-Delete modals, and the domain dropdown. Plus a unified Escape-closes-everything listener. |
| `useKeyboardNav(config)` | The global Vim-style keyboard handler with all per-pane and global bindings. |

### What stays in App.tsx

The cross-cutting orchestrations that touch state owned by multiple
hooks at once:

- **`switchToFolder(path)`** — snapshot current folder state, restore the
  new folder's saved state, then `loadDirectory`. Touches expanded,
  selected, preview, and domain state simultaneously.
- **`switchDomain(id)`** — same idea but across domain boundaries.
- **`createDomain()`** — create + switch + start renaming.
- **`revealInTree(path)`** — fan-out across tree expansion + selection +
  scroll + view-mode change.
- **`navigate / goBack / goUp / goHome`** — thin wrappers around
  `switchToFolder` that also manage history.
- The **per-folder auto-save effect** that mirrors current expanded /
  selected / preview into `domainState.folderStates[currentPath]`.

The remaining inline state is the small surface that doesn't justify a
hook of its own yet — `currentPath`, `entries`, `history`, `error`,
`loading`, `pathInput`, `selectedPath`, `pendingScroll`, `previewPath`,
`sidebarOpen`, `showHidden`, `viewMode`, `activePane`.

## Persistence

All persistent renderer state lives in `localStorage`. Keys are defined in
[`state/storageKeys.ts`](src/renderer/src/state/storageKeys.ts). The
two top-level keys are:

- `wadsworth:domainState` — the *workspace* state. Domains, sections of
  bookmarks within each domain, per-folder state (tree expansion,
  selected file, open preview) per domain. This is the bulk of what the
  app remembers.
- `wadsworth:settings` — global UI preferences (theme, "display domains
  as tabs").

Plus a handful of smaller per-UI keys (sidebar open, preview pane
width, view mode, markdown view, show-hidden, last path).

Window position / size / maximize state is persisted by the *main*
process to `~/Library/Application Support/Wadsworth/window-state.json`.

## Theming

Themes are declared as CSS custom properties on `:root` (dark) and
`:root[data-theme="light"]` (light) in
[`base.css`](src/renderer/src/assets/base.css). Setting the
`data-theme` attribute on the `<html>` element flips the entire app —
this is what `useTheme` does in response to setting changes.

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
  every push to `main` (publishes to a draft GitHub Release) and on
  every pull request against `main` (build-only, no publish).

## Plugin model (future)

The intended plugin model uses the `Source` interface as the primary
extension point. A plugin will be able to:

1. Implement `Source` and register it with a `SourceRegistry`.
2. Optionally register custom preview handlers for new content types
   (the next interface to add: `PreviewHandler`).
3. Optionally register sidebar adornments (icons, badges, contextual
   actions).

Plugin loading is not yet implemented. The current architecture
establishes the *seams* — the interfaces and the directory layout — so
that the loader can be added without re-shaping the rest of the
codebase.
