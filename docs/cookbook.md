# Cookbook

Concrete walkthroughs for the most common change patterns. Each
section is independent — load only the one relevant to your task.

---

## Adding a hook

When a piece of state has cohesive ownership (its own setters, its own
persistence, its own effects), extract it into a hook.

### Checklist

1. **Create the file** at `src/renderer/src/hooks/useXxx.ts`.
2. **Export a typed return shape**:
   ```ts
   export type UseXxx = {
     someState: Foo
     setSomeState: (v: Foo) => void
     someAction: () => void
   }
   ```
3. **Inside the hook**: `useState` with initial loader, `useEffect`
   for persistence, `useCallback` for actions.
4. **Add a storage key** to `state/storageKeys.ts` if anything
   persists.
5. **Import and call** from `App.tsx`, destructure what you need.
6. **Remove the old inline state** from `App.tsx`.
7. **Typecheck**: `npm run typecheck`. Fix any unused-import errors.
8. **Verify** by running `npm run dev`.

### Template

```ts
import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../state/storageKeys'

export type UseFoo = {
  value: string
  setValue: (v: string) => void
  reset: () => void
}

export function useFoo(): UseFoo {
  const [value, setValue] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.foo) ?? ''
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.foo, value)
  }, [value])

  const reset = useCallback(() => setValue(''), [])

  return { value, setValue, reset }
}
```

### When NOT to extract a hook

- The state is genuinely one variable used in one place
- The state participates in a cross-cutting orchestration (then it
  stays in App.tsx with the orchestration)
- The hook would need so many parameters that the parent has to know
  all of its internals anyway

---

## Adding a component

When a chunk of JSX exceeds ~50 lines or appears in more than one
place, extract it.

### Checklist

1. **Create a folder if it has multiple files**:
   `src/renderer/src/components/MyComponent/MyComponent.tsx`.
   For single-file components, drop directly into `components/`.
2. **Define the props type** in the same file, above the component:
   ```ts
   type Props = {
     value: string
     onChange: (v: string) => void
     readonly?: boolean
   }
   ```
3. **Export the component as a named function**:
   ```ts
   export function MyComponent(props: Props): React.JSX.Element { ... }
   ```
4. **Destructure props at the top** of the function body for
   readability.
5. **Receive callbacks, not setters.** If the parent needs to know
   when something happens, pass `onXxx(value)` rather than the raw
   `setXxx`.
6. **Replace the inline JSX in App.tsx** with the component call.
7. **Clean up unused imports** in App.tsx.

### Naming

- Components: `PascalCase` filename and export name (`Sidebar`,
  `PreviewPane`, `DomainTabs`)
- Props type: always `Props` (scoped to the file, doesn't leak)
- Folder vs single file: folders are reserved for components with
  helpers or sub-components alongside

### Anti-patterns

- Don't pass entire hook return objects as props. Take only the
  values and callbacks you need.
- Don't reach into Wadsworth state from the component via imports.
  All state comes through props.
- Don't add a `useState` inside a component for app-level state.
  Component-local state is fine for things like a hover or animation
  timer.

---

## Adding a Source

A `Source` is an implementation of the browse abstraction
(`sources/Source.ts`). Implement it when you want Wadsworth to browse
a new kind of backing — a database, a remote MCP server, a different
filesystem, etc.

### The interface

```ts
interface Source {
  readonly id: string                                  // unique identifier
  readonly name: string                                // human-readable name
  list(path: string): Promise<DirEntry[]>              // children of a path
  resolvePath(path: string): Promise<string>           // canonicalize
  defaultPath(): Promise<string>                       // initial path
  readText(path: string): Promise<TextFile>            // text content
  search(query: string, scope: string | null): Promise<DirEntry[]>
  thumbnailPreview(path: string): Promise<string | null>
  openExternal(path: string): Promise<void>
}
```

### Checklist

1. **Create** `src/renderer/src/sources/MyNewSource.ts`.
2. **Implement all eight methods.** For ones that don't apply, return
   sensible defaults (empty array, null, throw with a clear message
   if called).
3. **Export a singleton instance** at module bottom for use by
   `App.tsx`.
4. **Decide the path format.** Filesystem sources use absolute paths;
   network sources can invent their own scheme (e.g.,
   `mcp://server-name/category/page`).
5. **Wire up `App.tsx`** to use the new source. Right now this is
   manual (`const source: Source = mySource`). When plugin support
   exists, this becomes a registry lookup.

### Required behaviors

- **`list(path)`** must return entries in a consistent order. Sort
  alphabetically with folders first if there's no natural order.
- **`resolvePath(path)`** must return a canonical form. For
  filesystem, resolve symlinks. For others, normalize whatever
  conventions apply.
- **`defaultPath()`** is the path used when no saved path is
  available. For filesystem, this is `homedir()`.
- **`readText(path)`** should respect a size cap (the existing
  filesystem source caps at 2 MB) and return `{ truncated: true }`
  when it had to clip.
- **`search(query, scope)`** can return empty when not supported.
  Cross-platform parity is not enforced; document the limitation.
- **`thumbnailPreview(path)`** returns a file path to a PNG, or null
  if no preview is available. Implementers can use any local cache
  strategy.
- **`openExternal(path)`** should hand off to the OS or to the
  appropriate application. For filesystem, this is `shell.openPath`.

### Caveats

- The renderer cannot make network calls without main-process help.
  If your source needs HTTP/SQL/etc., add IPC handlers in `main/` and
  expose them via `preload/` — then your Source calls
  `window.api.xxx`.
- Don't add stateful subscriptions to the Source. The app polls; it
  doesn't subscribe.
- Don't assume the path delimiter is `/`. Use a helper if your source
  has a different convention.

---

## Adding a preview type

The preview pane (`components/PreviewPane/PreviewPane.tsx`) has
hard-coded branches for PDF / image / text / markdown / QuickLook
fallback. Adding a new content type means adding a detection
predicate, an optional content fetcher, and a render branch.

### Checklist

1. **Add a detection predicate** in `utils/fileTypes.ts`:
   ```ts
   export function isMyType(path: string): boolean {
     return /\.(myext|myotherext)$/i.test(path)
   }
   ```
2. **Decide if it's a built-in or fallback.** If we can render it
   without QuickLook (PDFs, images, text), add it to
   `hasBuiltinPreview`. If we need QuickLook, don't.
3. **Add a Source fetcher if content needs to be read.** For text and
   markdown, the existing `readText` already covers it. For binary
   content rendered via custom JS, you might need a new method —
   prefer reusing `readText` with appropriate handling rather than
   adding new IPC.
4. **Add the render branch** in `PreviewPane.tsx`. The branches are
   in a giant ternary. Find the right spot — built-ins go before
   the QuickLook fallback; specific types go before generic ones.
5. **Test** with a real file of that type.

### Examples in the codebase

- **PDF**: `isPdf(path)`, rendered via `<iframe>` pointing at
  `wadsworth-file://local{path}`. Chromium's PDF viewer handles it.
- **Image**: `isImage(path)`, rendered via `<img>` with object-fit:contain.
- **Text**: `isText(path)`, content fetched via `usePreviewContent`,
  rendered via CodeMirror with language pack from `languageForFile`.
- **Markdown**: special-cased inside the text branch; if
  `markdownView === 'rendered'`, uses `<ReactMarkdown>` with
  `remark-gfm` and `rehype-highlight`.
- **QuickLook fallback**: anything that isn't a built-in. Hits
  `source.thumbnailPreview` which on macOS shells to `qlmanage`.

---

## Updating CSS / styles

### Where styles live

- **`assets/base.css`**: CSS variables for both themes. Light theme
  is under `:root[data-theme='light']`, dark is the default (under
  `:root`).
- **`assets/main.css`**: All component styles. Single file by
  convention.

### Adding theme-aware colors

1. Define the new variable in `base.css` under both `:root` and
   `:root[data-theme='light']`.
2. Use the variable everywhere via `var(--my-new-color)`.
3. Never hardcode colors in `main.css`. The existing code has a few
   hardcoded blues — those are grandfathered.

### Adding a component-scoped class

1. Add the class in `main.css` at the same logical section as related
   classes (sidebar styles together, toolbar together, etc.).
2. Use the existing variables for colors, fonts, spacing.
3. Don't introduce new font sizes without reason. The defaults
   (11px / 12px / 13px / 14px) handle most cases.

---

## Adding a keyboard shortcut

Global keyboard navigation lives in `useKeyboardNav`. Per-pane
behavior is hardcoded inside the hook.

### Checklist

1. **Pick a binding** that doesn't conflict with existing ones (see
   the table in `README.md → Keyboard reference`).
2. **Decide which pane it belongs to** — Sidebar, Files, Tabs, or
   global (works regardless of active pane).
3. **Add the case** in `useKeyboardNav.ts` inside the appropriate
   `if (cfg.activePane === '...')` block.
4. **Update the README's keyboard reference** so users discover it.
5. **Add to the dependency array** if your new branch reads new state
   from `cfg`.

### Don't

- Don't capture keys when the user is typing in an input — the
  global handler bails on `tagName === 'INPUT' || 'TEXTAREA'`. Don't
  remove that guard.
- Don't capture single-letter keys without considering what happens
  if the user is in an input. (Tested via the guard above, but be
  defensive.)
- Don't add Cmd/Ctrl shortcuts that clash with OS standards (Cmd+W,
  Cmd+Q, Cmd+T, etc.).

---

## Adding a Settings option

Settings live in `useSettings` and the Settings modal in
`components/modals/SettingsModal.tsx`.

### Checklist

1. **Add the field** to `Settings` type in `types.ts`.
2. **Add a default** in `useSettings.ts` `DEFAULTS`.
3. **Add a row** in `SettingsModal.tsx`. Match the existing pattern
   (checkbox for booleans, radio group for enums).
4. **Consume it** wherever the behavior changes. The setting is read
   via `settings.myField` and written via
   `setSettings((s) => ({ ...s, myField: ... }))`.

### Settings vs per-folder vs per-domain

- **Settings** are global preferences (theme, display-domains-as-tabs).
- **Per-folder state** is what's expanded/selected/previewed for a
  specific folder.
- **Per-domain state** is the sections, bookmarks, and folder-states
  collected under one workspace.

Choose the right scope for your new option.

---

## Bumping a version

1. Update `version` in `package.json`.
2. Commit and push to `main`.
3. CI builds and uploads to a draft GitHub release tagged with the
   new version.
4. Review the draft and click **Publish release**.
5. macOS-installed copies don't auto-update (yet) — they need
   reinstall via `npm run install:mac` or by downloading the new DMG.

---

## What this cookbook doesn't cover

- Adding tests — no test framework is wired up yet
- Adding telemetry / analytics — we don't have any and that's intentional
- Cloud sync / multi-device — not built yet; revisitable later
- Auto-update infrastructure — present in artifacts but not wired in
- Plugin loading — interface seams exist but no loader yet
- File operations (copy, move, rename, delete, drag-and-drop) — future
  work, just hasn't landed

Each of those is a real future project. If you're tempted to take one
on, write a design doc and get it discussed before coding.
