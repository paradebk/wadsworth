# State Model

How state flows through Wadsworth, where each piece lives, and the
non-obvious lifecycle rules.

## The big picture

State is split across three tiers:

1. **Hooks** own cohesive slices of state. Each hook is the source of
   truth for its slice and (usually) its persistence.
2. **App.tsx** owns small remaining state plus the **cross-cutting
   orchestrations** — operations that mutate state owned by multiple
   hooks at once.
3. **Components** are stateless from this model's perspective. They
   take props and call callbacks. Local state inside a component is
   fine (e.g., a hover state, an animation timer) but never the source
   of truth for anything app-level.

## The hooks

| Hook | What it owns | Where persisted |
|---|---|---|
| `useTheme(themePref)` | Effective theme (light/dark), system listener, applies `data-theme` and swaps highlight.js stylesheet | — (theme pref is in `useSettings`) |
| `useSettings()` | Global UI preferences (theme, displayDomainsAsTabs) | `wadsworth:settings` |
| `useMarkdownView()` | Rendered vs Source toggle for `.md` files | `wadsworth:markdownView` |
| `useDomainState()` | The full `domainState` object: domains, sections, folder-states, last-path per domain, plus editing-domain-name state | `wadsworth:domainState` |
| `useBookmarks(sections, setSections, currentPath)` | Section + bookmark CRUD on top of `useDomainState`; inline-rename state; drag-over visual state | (delegates to domain state) |
| `useTreeExpansion(source, currentPath)` | `expanded` set, `treeChildren` cache, `toggleExpand`, `collapseAll`, rehydration effect | — (in-memory; restored from folder-state) |
| `useSearch(source, currentPath)` | Search query / scope / results / loading + debounced execution | — (session only) |
| `usePreviewContent(source, previewPath)` | Text fetch + QuickLook thumbnail fetch for the current preview | — (session only) |
| `usePreviewWidth()` | Preview pane width + splitter mousedown→drag handler | `wadsworth:previewWidth` |
| `useModals()` | Open/close state for menu / about / settings / confirm-delete / domain-dropdown + unified Escape listener | — (session only) |
| `useKeyboardNav(config)` | Global Vim-style key handler with all per-pane and global bindings | — (no state of its own) |

## What stays in App.tsx

The state and behavior that doesn't fit any single hook:

### Inline state in App.tsx

These are small enough that a hook would be overkill, or they're tied
to the orchestration logic that has to stay in App.tsx anyway:

- `currentPath`, `entries`, `history`, `loading`, `error` — current
  folder navigation state
- `previewPath` — what's open in the preview pane (per-folder
  persisted via the auto-save effect)
- `selectedPath`, `pendingScroll` — file pane selection and
  scroll-into-view request
- `pathInput` — the path bar's local input state (decoupled from
  `currentPath` so typing doesn't navigate)
- `sidebarOpen`, `showHidden`, `viewMode` — small persisted prefs
- `activePane` — which pane has keyboard focus

### Cross-cutting orchestrations in App.tsx

These touch state owned by multiple hooks at once, so they can't
cleanly live inside any of them:

| Function | What it does |
|---|---|
| `switchToFolder(path)` | Save current folder's expanded/selected/preview into domain state; resolve target path; restore target folder's saved state; load directory |
| `navigate(path)` | Push history; call `switchToFolder` |
| `goBack()` | Pop history; call `switchToFolder` |
| `goUp()` | Compute parent path; navigate to it |
| `goHome()` | Get home from source; navigate to it |
| `switchDomain(id)` | Snapshot current state into current domain; flip `activeDomainId`; restore new domain's last-path with its folder state; load directory |
| `createDomain()` | Create domain entry; call `switchDomain`; start renaming |
| `revealInTree(path)` | Switch view mode to tree if needed; expand each parent of the target path; select target; scroll into view |
| `onEntryClick(entry)` | Set selectedPath; if preview open and entry is file, swap preview |
| `onEntryActivate(entry)` | Navigate into folder, or open file in preview |
| `onSearchResultClick(entry)` / `onSearchResultDoubleClick(entry)` | Reveal in tree if within current path; activate if double-click |

### Effects in App.tsx

- **Init load** — on mount, restore last path from active domain
- **Per-folder auto-save** — whenever `currentPath`, `expanded`,
  `selectedPath`, or `previewPath` changes, save into
  `domainState.folderStates[currentPath]`. Suppressed by
  `inTransitRef.current` during navigation.
- **Path input sync** — `pathInput` mirrors `currentPath` after every
  successful navigation
- **Sidebar open persistence**
- **viewMode / showHidden persistence**
- **Sidebar scroll-into-view** — when the active sidebar bookmark
  changes, scroll its DOM node into view
- **Preview Escape** — Escape closes the preview pane

## The save effect — the most important detail to understand

```ts
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
```

This effect is what makes Wadsworth feel like it "remembers everything."
On *every* change to the current folder's expanded set, selected file,
or open preview, the active domain's `folderStates[currentPath]` is
updated, and that map is persisted to localStorage by
`useDomainState`'s own effect.

### Why `inTransitRef`

The naive version of this effect would cause a subtle bug during
`switchToFolder` and `switchDomain`. Both of those functions:

1. Save the CURRENT folder's state into the current domain
2. Call setters to RESTORE the target folder's state
3. Eventually call `loadDirectory(real)` which sets `currentPath`

Between step 2 and step 3, the React state contains the *target's*
expanded/selected/preview but still has the *source's* `currentPath`.
Without `inTransitRef`, the save effect would fire here and write the
target's state into the source's `folderStates[currentPath]` — wrong
folder.

`inTransitRef` is set to true at the start of `switchToFolder` /
`switchDomain` and cleared at the end (after `loadDirectory` has set
the new `currentPath`). The save effect bails when this ref is set.

### What this means for adding new per-folder state

If you add a new piece of state that should be remembered per folder
(say, the current text encoding for a preview, or a per-folder sort
order):

1. Add the field to `FolderState` in `types.ts`.
2. Add it to the auto-save effect in App.tsx.
3. Add it to the restore step in `switchToFolder` and `switchDomain`.
4. Default it sensibly in the restore step when the saved entry is
   absent (folder visited for the first time).

Forgetting step 3 or step 4 will cause the new state to leak across
folders during transit.

## The Source abstraction

State that depends on the source — folder contents, search results,
file content for preview — flows through the `Source` interface
(`src/renderer/src/sources/Source.ts`). The current implementation is
`FileSystemSource` which delegates to the existing IPC handlers in
`src/main/index.ts`.

The hooks that consume a Source take it as a parameter:

- `useSearch(source, currentPath)`
- `useTreeExpansion(source, currentPath)`
- `usePreviewContent(source, previewPath)`

The orchestrations in App.tsx also call the source directly for
operations like `source.resolvePath`, `source.defaultPath`,
`source.list`. The source instance is currently a module-level
singleton:

```ts
import { fileSystemSource } from './sources/FileSystemSource'
const source: Source = fileSystemSource
```

When we add a second source (the eventual plugin point), the natural
next step is a small registry mapping `Source.id` → instance, and
App.tsx picks the active source based on some user input (sidebar
section type, domain configuration, etc.). The Source interface itself
should not need to change.

## Persistence keys

All localStorage keys are defined in
[`state/storageKeys.ts`](../src/renderer/src/state/storageKeys.ts).
Never hardcode a key string anywhere else.

| Key | Owner | Content |
|---|---|---|
| `wadsworth:domainState` | `useDomainState` | The whole domain object tree |
| `wadsworth:settings` | `useSettings` | Theme pref, displayDomainsAsTabs |
| `wadsworth:markdownView` | `useMarkdownView` | `'rendered'` or `'raw'` |
| `wadsworth:previewWidth` | `usePreviewWidth` | Number (pixels) |
| `wadsworth:sidebarOpen` | App.tsx | `'true'` or `'false'` |
| `wadsworth:viewMode` | App.tsx | `'flat'` or `'tree'` |
| `wadsworth:showHidden` | App.tsx | `'true'` or `'false'` |

Plus older keys still present for backward-compat migration in
`useDomainState`:

| Key | Status |
|---|---|
| `wadsworth:lastPath` | Migrated into `domainState.lastPath` |
| `wadsworth:bookmarks` | Migrated into default domain's first section |
| `wadsworth:sections` | Migrated into default domain's sections |
| `wadsworth:folderStates` | Migrated into default domain's folderStates |

The migration runs once on first read and leaves the old keys in place
for safety. They can be removed in a future cleanup once everyone has
upgraded past the migration boundary.

## State outside the renderer

Window position / size / maximized state is persisted by the **main**
process to `~/Library/Application Support/Wadsworth/window-state.json`
(macOS path; equivalent locations on Windows/Linux). The validator
checks that the saved bounds intersect a currently-connected display
before restoring — protects against "you unplugged the monitor" cases.

## Adding new state — decision tree

```
Is the state related to an existing hook's responsibility?
├── Yes → add it to that hook
└── No → Is it cohesive enough to be its own hook?
    ├── Yes → make a new hook in src/renderer/src/hooks/
    └── No → Does it cross-cut existing hooks?
        ├── Yes → orchestration in App.tsx
        └── No → inline state in App.tsx

Does it need to persist?
├── No → done; useState
└── Yes → Is it per-folder?
    ├── Yes → add to FolderState + save effect + restore in switchToFolder/switchDomain
    └── No → add a key to state/storageKeys.ts and persist in the owning hook
```
