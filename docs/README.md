# Wadsworth Developer Documentation

This folder is the deep technical orientation for developers — and AI
assistants — working on Wadsworth. It complements the repository-root
documents:

| Root doc | Audience |
|---|---|
| [README.md](../README.md) | End users: what is it, how do I install it |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | New contributors: code layout, abstractions |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Anyone opening a PR: workflow, conventions |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community participation |

The files in this folder go deeper than `ARCHITECTURE.md` and are
intentionally split into smaller pages so an AI assistant with a limited
context window can load only the page relevant to the task.

## Where to start

| If you're about to… | Read these first |
|---|---|
| Make any change at all | [orientation.md](orientation.md) — anchor doc |
| Add or modify a feature | [product-philosophy.md](product-philosophy.md), [orientation.md](orientation.md) |
| Touch state, hooks, or persistence | [state-model.md](state-model.md) |
| Decide whether a state slice should be a hook | [state-model.md](state-model.md), [cookbook.md](cookbook.md) |
| Add a new file-type preview | [cookbook.md](cookbook.md) → "Adding a preview type" |
| Add a new Source (database, MCP, etc.) | [cookbook.md](cookbook.md) → "Adding a Source" |
| Understand a Wadsworth-specific term | [glossary.md](glossary.md) |
| Match the project's code style | [conventions.md](conventions.md) |

## The shape of the docs

```
docs/
├── README.md                # this file — index
├── orientation.md           # the anchor: what to know before touching anything
├── product-philosophy.md    # what Wadsworth IS, isn't, and why
├── state-model.md           # how state flows; hooks; persistence; orchestrations
├── conventions.md           # code style, hook patterns, component patterns
├── glossary.md              # Wadsworth-specific terms (Domain, Source, FolderState, …)
└── cookbook.md              # walkthroughs for common change types
```

Every page is self-contained. You should not need to load more than 2–3
pages plus `ARCHITECTURE.md` to make most changes.

## A note on the "AI assistant" audience

These docs are written so a Claude / GPT / Cursor / Cody instance with
no prior context on the project can be productive after reading 3–4
files. If you're a human, you'll get there faster, but the docs aren't
written *down* to AI — they're written to "any new contributor whose
context is fresh." The two audiences turn out to overlap heavily.
