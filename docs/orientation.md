# Orientation

If you read only one doc before making a change, read this one. It's the
anchor.

## What Wadsworth is, in one sentence

**Wadsworth is a personal, read-only file browser focused on fast
document retrieval — for users who organize their work around a custom
taxonomy rather than the filesystem's defaults.**

Every design decision flows from that sentence. When in doubt about
whether a change fits, ask whether it reinforces it.

## What Wadsworth is *not*

Knowing the negatives is more important than knowing the positives,
because the failure mode for this project is "creeping toward an
everything-app." We explicitly do not:

- **Manage files.** No copy, move, rename, delete, drag-to-organize.
  Finder / Explorer / Nautilus handle that fine. We open externally
  when needed.
- **Author non-text content.** No image editing, no spreadsheet editing,
  no PDF annotation. We *view* these things.
- **Execute against external systems.** No API testing (Postman),
  no SSH client, no command runner, no terminal. If an operation
  produces side effects on a service outside your filesystem, it's
  out of scope.
- **Sync, collaborate, or share.** No cloud sync, no multi-user, no
  real-time collaboration, no team workspaces. Single user, local-only,
  zero servers.
- **Manage tasks, calendars, or workflows.** Wadsworth is for
  retrieving stuff, not for getting stuff done.

The one explicit exception to "read-only": **markdown editing** is
allowed because the workflow is "view → maybe edit → view again" and the
file is yours sitting on your disk. That's a narrow carve-out and should
not be generalized to "we also edit other things."

## What Wadsworth *is* good at

- Custom semantic sidebar (Clients, Vendors, Projects — your taxonomy,
  not the filesystem's)
- Multiple workspaces ("domains") that switch instantly with all their
  state intact
- Per-folder state preservation (tree expansion, selection, preview)
  across restarts
- Fast Spotlight-powered search with reveal-in-tree
- Inline preview for PDFs (Chromium viewer), images, code with syntax
  highlighting, rendered markdown, and OS QuickLook fallback for
  Office/etc.
- Vim-style keyboard navigation across panes
- Light/dark themes with system following

## The architecture in 30 seconds

- **Electron**: Node main process for OS access, Chromium renderer for UI.
- **React + TypeScript** in the renderer.
- **Source interface** abstracts "things that can be browsed." Today
  only `FileSystemSource`; future: database, MCP server, etc.
- **Hooks own state slices** (`useDomainState`, `useNavigation` etc.).
  App.tsx composes them and holds cross-cutting orchestrations only.
- **Components consume hooks via props** (top-down). No global store,
  no context for state (theme uses CSS variables instead).
- **Persistence is `localStorage`** (renderer side) plus a small JSON
  file for window state (main side).

For the full picture, see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Hard rules for contributors (including AI assistants)

1. **Never push directly to `main`.** Always branch + PR.
2. **CI must pass.** The PR-build workflow runs typecheck and packages
   for macOS, Windows, and Linux. All three must be green.
3. **Don't `npm install` random packages** unless the feature genuinely
   needs them. Every dep is supply chain risk and bundle weight.
4. **Don't add features that don't reinforce the one-sentence pivot.**
   If you find yourself proposing one, stop and re-read the negatives
   list above.
5. **Don't introduce global stores** (Redux/Zustand/Jotai). We use
   React state + hooks. The complexity hasn't justified the upgrade.
6. **Don't use `any` to silence TypeScript.** Find the right type. The
   existing code has a handful of `(updater as Function)` casts in
   setter wrappers — don't add more.
7. **Don't add cloud anything.** No telemetry, no analytics, no remote
   config, no auto-update servers we operate. Wadsworth is local.
8. **Don't break behavior in refactors.** Refactors are zero-behavior-
   change by definition. If you're changing behavior, that's a feature
   PR, not a refactor PR — label it correctly.

## What "done" looks like for a feature

A feature is done when:

- The TypeScript checker is happy (`npm run typecheck` clean).
- The production build succeeds on all three platforms (CI matrix green).
- The feature works in `npm run dev` and in the installed `.app`.
- New persisted state is keyed via `state/storageKeys.ts`, not hardcoded.
- New state is owned by a hook or has a justified reason to be inline
  in `App.tsx`.
- The PR description has a "what / why / risk / how to verify" body.

## Key files to know

When making nontrivial changes, you will frequently touch or read:

| File | Why |
|---|---|
| `src/renderer/src/App.tsx` | Orchestrator. Holds top-level state and cross-cutting logic. |
| `src/renderer/src/types.ts` | All shared types (Domain, Section, DirEntry, etc.). |
| `src/renderer/src/state/storageKeys.ts` | All localStorage keys. Use the constant, never hardcode. |
| `src/renderer/src/sources/Source.ts` | The extensibility interface. |
| `src/renderer/src/hooks/` | All state-and-behavior slices. |
| `src/renderer/src/components/` | All UI components. |
| `src/renderer/src/utils/` | Pure helpers (path, format, fileTypes). |
| `src/main/index.ts` | Main process: IPC handlers, window creation, custom protocol. |
| `src/preload/index.ts` | Bridge that exposes `window.api` to the renderer. |

## Where the trapdoors are

1. **State-update timing during navigation.** `switchToFolder` and
   `switchDomain` snapshot state into the per-folder save before
   restoring the target's state. There's an `inTransitRef` that
   suppresses the auto-save effect during the transition. **If you add
   state that's persisted per-folder, you must make the save effect
   aware of it or the transit guards will leak data into the wrong
   folder.**

2. **The `Source` abstraction is one-directional.** App talks to a
   Source, not vice versa. Sources are stateless from the app's
   perspective. Don't try to subscribe to source events; poll or
   re-list on demand.

3. **CodeMirror language packs are bundle-heavy.** Adding new ones is
   easy but expensive. Check if the language is already in the
   `languageForFile` switch before importing more.

4. **`window.api.platform` is just `process.platform`** exposed through
   preload. Compare with `'darwin'`, `'win32'`, `'linux'` literals.

5. **The custom `wadsworth-file://` protocol** uses a sentinel hostname
   `local` (e.g. `wadsworth-file://local/Users/foo/bar.pdf`) because
   Chromium's URL parser eats the leading slash when the host is empty.
   If you add new content types served through this protocol, use the
   `toAppFileUrl` helper rather than building URLs by hand.

6. **macOS-only assumptions exist.** `mdfind` for search, `qlmanage`
   for QuickLook fallback, the `wadsworth-file://` protocol, the
   hidden-inset title bar. Search currently doesn't work on Windows /
   Linux. Don't assume cross-platform parity without checking.

## Once you've read this

Pick the next doc based on what you're doing:

- [product-philosophy.md](product-philosophy.md) — if the change might
  stretch the pivot
- [state-model.md](state-model.md) — if you're touching state, hooks,
  or persistence
- [cookbook.md](cookbook.md) — if you're doing one of the standard
  change patterns (add a hook, add a component, add a Source)
- [conventions.md](conventions.md) — if you want to match the project's
  style closely
- [glossary.md](glossary.md) — if a term you're seeing is unclear
