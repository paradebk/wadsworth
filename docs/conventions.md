# Code Conventions

How to write code that fits in. These are not "best practices in
general" — they're the specific shape this codebase has settled on.
Match it.

## TypeScript

- **Strict mode is on.** No `any`. Find the right type, even if it
  takes ten minutes longer.
- **Two-space indent, single quotes, no semicolons.** Prettier config
  enforces. `npm run format` will normalize.
- **`type` over `interface`** for everything except when implementing.
  Interfaces are used for the `Source` extensibility surface; types
  are used for everything else.
- **Avoid type assertions** (`as Foo`). They hide real type problems.
  The existing code has a few `(updater as Function)` casts in the
  `setSections` / `setFolderStates` wrappers — those are the
  grandfathered exceptions. Don't add more.
- **Functions return types explicitly** for exports. Inline functions
  can rely on inference.
- **Discriminated unions over flag soup.** Prefer
  `{ kind: 'pdf', path: string } | { kind: 'text', content: string }`
  to `{ isPdf?: boolean; isText?: boolean; ... }`.

## React

- **Hooks own state, components consume props.** Components don't
  reach into hooks. The exception is the modal-state context, where
  components consume hooks they themselves spawned (small surface).
- **`useCallback` for handlers passed as props** or used in effect
  dependency arrays. For one-shot inline handlers, inline arrow
  functions are fine.
- **`useMemo` for derived state**, especially when the derivation is
  non-trivial (sorting, filtering, mapping).
- **Functional setters when state depends on previous state**:

  ```ts
  // Good
  setExpanded((prev) => {
    const next = new Set(prev)
    next.add(path)
    return next
  })

  // Bad — race-prone if multiple updates land in the same batch
  setExpanded(new Set([...expanded, path]))
  ```

- **One `useEffect` per concern.** If an effect's body has two
  unrelated `if` branches, it's two effects.
- **Dependency arrays are exhaustive.** Use the eslint hook-deps rule.
  If you have a reason to omit a dep, comment why.
- **Don't pass setters around unnecessarily.** If a component only
  needs to read the value, pass the value. If it needs to write, pass
  a focused callback (`onChange(value)`) rather than the raw setter.

## File organization

- **One concept per file.** A component file exports its component
  type and the component itself, nothing else. A hook file exports
  the hook and its return type, nothing else.
- **Folder boundaries match concerns.** Avoid `utils/index.ts`
  barrels — they obscure where things come from. Import by full path.
- **Don't reach across boundaries.** Components don't import from
  hooks of unrelated concerns. The composition happens in `App.tsx`.

## Comments

- **Explain why, not what.** The code says what; the comment says why
  it's that way (constraint, performance, surprising behavior).
- **JSDoc on exported hooks and the `Source` interface.** Includes the
  contract and the cross-cutting interactions.
- **Don't restate the type.** `// the user's name (string)` is noise.
- **`// FIXME(why)` over `// TODO`.** TODOs accumulate; FIXMEs at
  least explain themselves.

## Imports

- **External first, internal second**, separated by a blank line.
- **`type` imports** are explicitly marked: `import type { Foo } from`.
- **Don't barrel.** Import from the source file, not from a re-export.

## State

- **Hooks return objects, not tuples.** Tuples are fine for two
  closely related values (`[value, setValue]`) but anything with three
  or more fields gets a named object.

  ```ts
  // Good
  return { query, scope, results, loading, setQuery, setScope }

  // Bad
  return [query, scope, results, loading, setQuery, setScope]
  ```

- **Don't synthesize state from props in components.** If a component
  has a piece of state that's derived from a prop, either derive it
  with `useMemo` or pass the derived value down.
- **Persisted state goes through `state/storageKeys.ts`.** Never
  hardcode a key.

## CSS

- **CSS variables for colors and spacing.** Defined in `base.css`
  for both themes. Component styles in `main.css` use the variables.
- **Class names are descriptive of structure, not appearance.**
  `.sidebar-item` not `.gray-box`.
- **No CSS-in-JS, no Tailwind, no CSS modules** (yet). Single
  `main.css` is the convention. May be revisited if it gets unwieldy.

## Naming

- **Functions are verbs**: `loadDirectory`, `switchDomain`, `setExpanded`.
- **State is nouns**: `currentPath`, `selectedPath`, `entries`.
- **Booleans read as questions**: `sidebarOpen`, `loading`, `isWithin`.
- **Hooks are `useXxx`** — no exceptions.
- **Handlers are `onXxx`** when passed as props; `handleXxx` for
  local-only handlers.
- **Setter wrappers match the value name**: `setExpanded` not
  `updateExpanded` or `changeExpanded`.

## Error handling

- **Catch narrowly.** Don't wrap the whole function in a try/catch.
- **Silent catches are sometimes correct** (e.g., a permission-denied
  on one file shouldn't kill the directory listing) but always
  comment why.
- **Don't `throw` from React event handlers** unless you're sure an
  Error Boundary will catch it. Today there are no Error Boundaries,
  so don't.
- **No `process.exit` from main process** except for genuinely
  unrecoverable startup errors.

## Async patterns

- **`async`/`await`, not `.then()` chains** for new code. The
  occasional `.then` exists for cases where we explicitly want to
  fire-and-forget without making the surrounding function async.
- **`void` to mark intentional un-awaited promises**:

  ```ts
  // Explicit fire-and-forget
  void source.openExternal(previewPath)
  ```

- **Cancellation flags inside effects**:

  ```ts
  useEffect(() => {
    let cancelled = false
    void doWork().then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => { cancelled = true }
  }, [deps])
  ```

## Testing

- **There are no tests yet.** This is a known gap. If you add tests,
  they go in `src/renderer/src/**/__tests__/` mirroring the folder
  structure. Use Vitest (already a Vite project, so this is the
  zero-config choice).
- **Until there are tests, verify by running**: `npm run dev` for
  immediate feedback, `npm run install:mac` for the production build.

## Anti-patterns to avoid

- **`useEffect` that calls `setState` based on a prop changing,
  resulting in a render loop.** If you need to derive state from
  props, do it in render with `useMemo`.
- **Modifying mutable objects in state.** Always replace, never
  mutate. `setMap((prev) => new Map(prev).set(k, v))`, not
  `prev.set(k, v); setMap(prev)`.
- **Conditional hooks.** Hooks must be called in the same order every
  render. No `if (condition) useFoo()`. Use the hook unconditionally
  and gate inside its effect.
- **Storing functions in state.** If you find yourself wanting to do
  this, you probably want a ref instead.
- **Premature abstraction.** A second instance of a pattern is when
  to consider abstracting. The third makes it required. The first is
  just code.

## When to refactor

Refactor when:
- You're about to add a third instance of an inlined pattern (extract it)
- A file exceeds ~500 lines and has cohesive subsections (split it)
- A prop list exceeds ~10 items (consider sub-components or a context)
- A function exceeds ~50 lines with no clear sub-blocks (split it)

Don't refactor:
- "Just because it's old" — old code that works is fine
- Without a corresponding behavior verification (typecheck + manual run minimum)
- In the same PR as a feature change. Refactor PRs and feature PRs
  are different categories.
