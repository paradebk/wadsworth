# Product Philosophy

The pivot, the discipline, and the OpenSquiggly lessons that shape every
"yes" and "no" on the roadmap.

## The pivot

> **Wadsworth is a personal, read-only file browser focused on fast
> document retrieval — for users who organize their work around a custom
> taxonomy rather than the filesystem's defaults.**

If a proposed change doesn't reinforce this sentence, it doesn't ship.
That sounds rigid but it's the discipline that protects the project
from becoming an everything-app.

## The target audience

Wadsworth is for people with a **body of files they access by mental
model, not by filesystem layout**:

- Bookkeepers managing client documents
- Lawyers managing case files
- Researchers managing reference papers
- Designers managing client deliverables
- Developers managing code, notes, screenshots, and reference docs
- Anyone with a deep, well-organized but rarely-browsed personal
  archive (taxes, IDs, contracts, medical records, vehicle docs,
  home docs)

The unifying property: their work product lives in files, and they
retrieve from that body of files often enough that "navigate 8 levels
deep in Finder every time" is a real cost.

Wadsworth is **not** for casual users who just want to peek at
Downloads. The default OS file browsers are fine for that. Wadsworth
trades discoverability for power-user efficiency.

## What we say yes to

A feature is a candidate for the roadmap if it makes one or more of the
following statements true:

- "It makes retrieving a document faster."
- "It makes the user's custom taxonomy more expressive."
- "It surfaces more useful information about a file without opening it."
- "It removes a reason the user has to context-switch to another tool."

Examples that pass:

- **Markdown editing in-place.** Removes the "switch to Obsidian to
  fix a typo" context-switch. Stays within "your files; your disk."
- **Photo grid view.** Surfaces more useful info about an image folder
  than a row listing does.
- **Database table preview (read-only).** Same pattern as file preview,
  applied to tabular sources.
- **Annotations / notes on files.** Makes the taxonomy more expressive
  (this folder means *this thing*; this file's note adds context).

## What we say no to

The patterns that fail the test, and what to redirect them to:

| Proposal | Why we don't | What to use instead |
|---|---|---|
| File copy / move / rename / delete | Not retrieval; it's management. Adds enormous scope (undo, conflict resolution, drag-drop, trash, permissions). | Finder / Explorer / Nautilus |
| API testing (Postman-like) | Executes against external services with side effects. Wrong category entirely. | Postman, Insomnia, Bruno |
| Task management / to-do lists | Not retrieval; it's planning. Bottomless feature space. | Things, Todoist, OmniFocus |
| Calendar / scheduling | Same — not retrieval. | Apple Calendar, Fantastical |
| Real-time collaboration | Requires servers, multi-tenancy, auth — categorically different product. | Notion, Google Drive, Dropbox |
| Chat / messaging | Off-mission. | Slack, Discord, iMessage |
| Email client | Off-mission. Email is a service-bound workflow. | Mail.app, Outlook, Spark |
| Full IDE features (debugger, terminal) | Off-mission. | VS Code, JetBrains |
| Plugin marketplace | Premature. We have the seam (`Source` interface) but no users yet. | Just keep the seam working. |
| Telemetry / analytics | Local-first means local-only. No phone-home. | Don't add it. |

When someone proposes one of these (or you find yourself wanting to),
the right response is "that's a great feature for [other tool]." It's
not a rejection of the idea; it's an acknowledgment that no single tool
should try to be all tools.

## The OpenSquiggly lessons

Wadsworth is the successor to an earlier project (OpenSquiggly) that
tried to solve "unified browse of distributed documentation" at
enterprise scale. It stalled because the scope kept expanding —
multi-tenancy, auth, on-prem deployment, search ranking, SSO, doc
ingestion across N source-control providers — each individually
reasonable, collectively too much for one developer to ship.

The lessons that informed Wadsworth's scope discipline:

1. **Single-user beats multi-tenant.** No auth, no identity, no
   permissions, no billing, no team workspaces. You'd be shocked how
   much of a SaaS codebase is dedicated to multi-tenancy infrastructure
   that has nothing to do with the actual product value.

2. **Local beats cloud.** No servers means no ops, no DevOps, no
   on-call, no AWS bill, no compliance review, no DDoS protection, no
   data-residency conversations. The user owns their data because it's
   already on their disk.

3. **Read-only beats read-write.** Editing produces side effects.
   Side effects need conflict resolution, undo, optimistic locking,
   crash recovery for partial writes, integrity checks. Read-only is
   *categorically* simpler. The one editing exception (markdown) is
   defensible because the failure mode is small (lose your most recent
   typing) and the user controls when to save.

4. **Narrow beats broad.** "Aggregates documentation from any Git repo"
   sounds focused but is actually open-ended (every doc site is a
   slightly different format, every repo has slightly different
   ingestion needs). "Browses files on your local disk" is narrower
   and tractable.

5. **Scope creep is the sum of individually-reasonable decisions.**
   Every feature added to OpenSquiggly was defensible in isolation.
   The accumulation killed the project. Apply that filter aggressively
   to Wadsworth.

## Comparison with adjacent tools

Knowing what Wadsworth is NOT compared to is more useful than knowing
what it IS:

| Tool | What it does | How Wadsworth differs |
|---|---|---|
| **Finder / Explorer / Nautilus** | Default file manager | Narrower, no file ops, but with semantic sidebar and stateful memory |
| **Path Finder, ForkLift, Marta** | Finder replacements | Those add MORE file management; we deliberately add LESS |
| **Obsidian, Logseq** | Note-taking with graph | We're a file browser that edits markdown nicely; not a knowledge-graph tool |
| **Dash, Zeal** | Documentation browser | They aggregate public docs; we organize your own files |
| **Spacedrive** | "File explorer of the future" | They're cross-platform and feature-rich; we're focused on retrieval workflow |
| **Spotlight / Alfred** | Quick launchers | We're a *persistent* interface; they're transient |

## The litmus test

When considering a feature, ask:

1. Does it help the user retrieve their stuff faster, or surface more
   information about their stuff?
2. Does it stay on the consume/view side of the line, or does it
   produce side effects on external systems?
3. Does it preserve "local, single-user, read-mostly," or does it
   require expanding into auth/multi-tenancy/cloud?
4. Could a reasonable bookkeeper, lawyer, or document-heavy
   professional use it?

If three or four are "yes," it's a candidate. If two or fewer, it
probably belongs in a different tool.

## When this philosophy is wrong

This is an opinionated product. The philosophy is wrong if you're
building for an audience whose work is producing rather than retrieving.
A photographer who *makes* photos all day will be poorly served by a
read-only photo viewer. A spreadsheet power user will be poorly served
by read-only `.xlsx` previewing.

Those users are not Wadsworth's audience. Don't try to convert them.
The product exists because *retrieval-heavy* users are underserved by
the existing tools. Stay focused on them.
