# Contributing to Wadsworth

Thanks for your interest in Wadsworth. This document covers how to set up
a dev environment, the conventions the project uses, and how to get a
change merged.

## Code of conduct

By participating in this project you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md). It applies to issues, pull
requests, discussions, and any other project space.

## Getting started

Prerequisites: **Node.js 22** or later, and **npm**.

```bash
git clone git@github.com:paradebk/wadsworth.git
cd wadsworth
npm install
npm run dev
```

The dev process uses its own user-data directory so it can run alongside
an installed copy of Wadsworth without state conflicts.

## Project structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for a tour of the codebase — the
directory layout, the `Source` extension point, the hook organization,
and how state and persistence are split up.

The short version:

- `src/main/` is the Electron main process (Node).
- `src/preload/` is the IPC bridge.
- `src/renderer/src/` is the React app:
  - `hooks/` — state and behavior slices
  - `components/` — UI pieces
  - `sources/` — the abstraction over things-that-can-be-browsed
  - `utils/`, `state/`, `preview/`, `icons/` — supporting modules

## Workflow

1. **Find or open an issue.** For non-trivial changes, please open an
   issue first so we can agree on the approach before you spend time on
   it.
2. **Create a branch.** Branch off `main` with a descriptive name:
   `feat/sidebar-resize`, `fix/preview-leak`, `refactor/use-foo`,
   `docs/keyboard-reference`. We don't enforce a prefix scheme but a
   short prefix helps.
3. **Make focused commits.** One logical change per commit, with a clear
   message. Imperative present tense: "Add X" not "Added X."
4. **Run the checks locally** before pushing:

   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```

5. **Open a pull request** against `main`. CI will build the project on
   macOS, Windows, and Linux automatically. Your PR description should
   cover:
   - What changed
   - Why
   - Any risk you see
   - How to verify (a short checklist of things to click)
6. **Respond to review.** Push fixup commits rather than force-pushing
   so reviewers can see what changed since their last read. Squash on
   merge is fine.

## Coding conventions

- **TypeScript strict mode.** No `any` if you can avoid it; no
  `as any` casts that hide a real type problem. The existing code has a
  small number of `(updater as Function)` casts in setter wrappers —
  don't add more.
- **Hooks own their state slice.** If you're adding a feature that needs
  new persistent state, the natural home is a hook in `src/renderer/src/hooks/`,
  not a new `useState` in `App.tsx`.
- **New file types in the browser? Source goes through `Source.ts`.**
  If you want Wadsworth to browse a new kind of thing (a database, an
  MCP server, a cloud drive), implement the `Source` interface. Don't
  branch on type in `App.tsx`.
- **Two-space indentation, single quotes, no semicolons** (mostly — see
  the prettier config). `npm run format` will normalize.
- **Comments explain *why*, not *what*.** If the code is non-obvious,
  the comment should say what assumption or constraint led you to write
  it that way.

## Reporting bugs

Open an issue with:

- What you did (steps to reproduce)
- What you expected
- What happened instead
- Your platform and Wadsworth version (Settings → About)
- Any console output from DevTools (Cmd+Opt+I / Ctrl+Shift+I)

If the bug involves the renderer crashing, please also include the path
where it happened — if it's a folder Wadsworth has trouble reading, the
folder structure is the most useful detail.

## Suggesting features

Open an issue describing the use case before writing code. Wadsworth has
a deliberately narrow scope (read-only document retrieval, not file
management) — proposals that broaden it should make the case for why.

## Questions

If you're not sure whether a change fits the project, open a GitHub
Discussion or a draft PR with the question in the description.
