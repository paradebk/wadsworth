# Glossary

Wadsworth-specific terms used throughout the codebase. If a word here
appears in a function or variable, this is what it means.

---

## Source-of-truth terms

### Domain
A self-contained **workspace**. Each domain has its own sidebar
configuration (sections + bookmarks), its own per-folder memory
(`folderStates`), and its own last-visited path. Users switch between
domains via the toolbar dropdown or the optional tab bar.

Conceptually: a domain is the "lens" the user is currently working
through. A bookkeeper might have a "Clients" domain and a "Personal"
domain with completely separate sidebars and remembered states.

In code: `type Domain = { id, name, sections, folderStates, lastPath }`.

### Section
A **named group of bookmarks** within a domain's sidebar. Sections
have an order, a name, and a collapsed/expanded state. Bookmarks
inside a section also have an order.

Conceptually: the headings in the sidebar — "GENERAL LINKS",
"CLIENTS", "PROJECTS", etc.

In code: `type Section = { id, name, bookmarks, collapsed? }`.

### Bookmark
A **saved folder path** within a section. Has a `path` and a
user-editable `label` (the displayed name in the sidebar; defaults to
the folder's basename when first added).

In code: `type Bookmark = { path, label }`.

### Source
The **extensibility interface** for "things that can be browsed."
Today there's exactly one implementation, `FileSystemSource`, but the
abstraction is in place for future implementations (database, MCP,
cloud drive, etc.).

In code: `interface Source { id, name, list(...), readText(...), search(...), ... }` in `sources/Source.ts`.

### FolderState
The **per-folder remembered state**: which sub-folders are expanded
in tree view, which file is selected, which file is open in the
preview pane. Stored per-domain, keyed by absolute path.

In code: `type FolderState = { expanded: string[], selectedPath, previewPath }`.

### DirEntry
The **representation of a file or folder** as returned by a Source.
Includes name, full path, isDirectory flag, size, modifiedMs.

In code: `type DirEntry = { name, path, isDirectory, size, modifiedMs }`.

### TextFile
The **fetched content of a text file** plus metadata about truncation
(text fetches are capped at 2 MB to avoid hanging on huge files).

In code: `type TextFile = { content, truncated, totalSize }`.

---

## UI-state terms

### activePane
Which of the three keyboard-focusable panes — `'sidebar'`, `'files'`,
or `'tabs'` — currently has keyboard focus. Drives:
- Which pane gets highlighted blue (vs. muted gray) for its selected item
- Which set of vim-style key bindings is active

In code: `'sidebar' | 'files' | 'tabs'`.

### pendingScroll
A **request to scroll a specific row into view** in the file pane.
Set by reveal-in-tree and by keyboard navigation. Consumed by an
effect that calls `el.scrollIntoView()` on the matching
`[data-row-path]` DOM node once it exists.

Stored as a string (the path of the row to scroll to). Cleared to
`null` after the scroll fires.

### inTransitRef
A **ref-flag that suppresses the per-folder auto-save effect during
navigation**. Set true at the start of `switchToFolder` /
`switchDomain`; cleared at the end. Prevents the save effect from
writing the target folder's restored state into the source folder's
slot during the transient render between "we just restored state" and
"we set `currentPath` to the new value."

See [state-model.md → The save effect](state-model.md) for the full
explanation.

### pathInput
The **path bar's local input state**. Decoupled from `currentPath` so
that typing in the path bar doesn't trigger navigation on every
keystroke — navigation only happens when the user presses Enter.
After successful navigation, an effect syncs `pathInput` back to
`currentPath`.

### viewMode
The **file listing mode** — `'flat'` (just the immediate folder) or
`'tree'` (recursive expansion). Persisted globally (not per-folder).

### editingDomain / editingSection / editingBookmark / editingLabel
The **inline-rename state**. When non-null, the corresponding item's
display is replaced with a text input. `editingLabel` holds the
current input value; the other three identify what's being edited.
Only one item is ever in edit mode at a time.

### dragOverBookmark / dragOverSection
The **drag-over visual state**. Set by `dragenter` / `dragover`
handlers so the row/header can be highlighted as a drop target. Set
back to `null` on `dragleave` or after the drop completes.

---

## Architectural terms

### Pane
One of the three top-level UI areas that can have keyboard focus:
- **Sidebar** — bookmarks list, on the left, optional
- **Files pane** — the folder listing (and optionally search results
  split below)
- **Tab bar** — when "Display domains as tabs" is enabled, the strip
  of domain tabs at the very top is also a focusable pane

The Preview pane on the right is not focusable in the same sense —
it's a content viewer, not a list to navigate.

### Cross-cutting orchestration
An **action that mutates state owned by multiple hooks at once**.
Examples: `switchToFolder` (touches navigation + tree expansion + file
selection + preview + search), `switchDomain` (touches domain state +
all of the above). These functions live in `App.tsx` because they
don't fit cleanly inside any single hook.

### Orchestrator
**App.tsx** in this codebase. It composes hooks, holds remaining
cross-cutting state, and renders the layout. It is not a "container
component" in the classic Redux sense — it's the wiring layer.

### Hook (in the Wadsworth sense)
A custom React hook that **owns a slice of state and its lifecycle**.
Most hooks also own their persistence to localStorage. The pattern is:

```ts
export function useThing(deps): UseThing {
  const [state, setState] = useState(loadInitial())
  useEffect(() => localStorage.setItem(KEY, serialize(state)), [state])
  // ... actions ...
  return { state, setState, action1, action2, ... }
}
```

### Preview handler
Not yet a formal abstraction. Today, the preview pane has hard-coded
branches for PDF / image / text / Markdown / QuickLook fallback. When
plugin support is added, this is the second extension point (after
`Source`) — a way to register custom renderers for new content types.

### Custom protocol
Wadsworth registers `wadsworth-file://` as an Electron custom
protocol. Local files are served through it (rather than `file://`)
so that Chromium's CSP and renderer security don't fight us. The host
is always the sentinel `local` — `wadsworth-file://local/Users/foo/bar.pdf`
— because Chromium's URL parser eats an empty hostname.

Helper: `toAppFileUrl(path)` in `utils/appFileUrl.ts`.

---

## Workflow terms

### `npm run dev`
**Dev mode.** Runs Electron with Vite HMR. Uses a separate userData
directory so it can run alongside the installed app without state
conflict.

### `npm run install:mac`
**Build and install in one step.** Runs `electron-builder --mac` then
removes any existing `/Applications/Wadsworth.app` and `ditto`s the
new one in place. `ditto` (not `cp`) is required because cp corrupts
the ad-hoc code signature.

### Domain dropdown vs domain tabs
Two UI variants of the **domain switcher**, toggleable in Settings.
The dropdown is compact and lives in the toolbar; the tabs are
prominent and sit in a tab bar below the toolbar. Internally, both
drive the same `switchDomain(id)` orchestration.

### CI matrix
GitHub Actions builds on **macOS, Windows, and Linux** for every push
to main (with publishing to a draft release) and for every PR (build
only, no publish). All three must pass before a PR is mergeable.

### The PR-build CI workflow
File: `.github/workflows/build.yml`. On `push: main`, publishes
artifacts. On `pull_request: main`, builds only. See the workflow file
for the conditional `--publish always|never` flag.

---

## Things that look like terms but aren't

### "Workspace"
Sometimes used informally to mean the same thing as Domain. In code
it's always `Domain`.

### "Vault"
Obsidian's word for what Wadsworth calls a Domain. Don't use "vault"
in this codebase — it implies single-app-locked storage, which
Wadsworth deliberately isn't.

### "Project"
Has no Wadsworth-specific meaning. Use "Domain" or "Section" depending
on which one you actually mean.

### "Index"
Used loosely for "the in-memory list of file paths" but Wadsworth
doesn't have a real file index yet (we walk the disk on demand via
`mdfind` etc.). Don't write code that assumes an index exists.

### "Tag"
Not implemented. File tagging is a possible future feature but not
currently a concept. Don't add code that branches on tags.
