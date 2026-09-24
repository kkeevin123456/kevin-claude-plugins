# Style-D file rules

## `fact-set.md`

Opens with the one blockquote this style keeps — it is functional, not meta-commentary:

```markdown
# <Feature> — Canonical Fact Set

> **Source of truth for the <feature> spec.** The `<feature>.*` style files render exactly
> these facts — only shape and audience change. Nothing in a style file may contradict, add, or
> drop a fact here. Each style file ends with a coverage checklist mapping back to these IDs.
>
> Content level: **feature behavior** (what it does and every edge), not internals.
> <one line locating it: the sibling spec it contrasts with, the companion design doc.>
```

Then lettered sections (`## A. What the feature is`, `## B. The invariant`, …), each holding
bolded facts `**F1** — …`. Rules:

- **One fact per ID.** If an ID needs "and also", it is two facts.
- **A fact states behaviour and, where it is surprising, its reason.** "X is cleared
  unconditionally" is half a fact; the half that survives review is *why* gating it would brick
  the box.
- **Group by question, not by layer.** Readers arrive asking "what does it clear?", not "what
  does the datastore do?".
- **Deliberate narrowings are facts.** What the feature pointedly does *not* do, and what was
  removed and why, is the part a reader cannot recover from the code.
- **Still-stubbed behaviour is a fact.** If the shipped code no-ops a step, say so — a spec
  describing the intended behaviour as current is worse than no spec.

Close with a `## The "what if" cases` table: `# | Question | Answer | From`, 5–6 rows, each
answer fully determined by the IDs in the `From` column. If an answer needs a fact you did not
write down, that fact is missing.

## `<feature>.human.zh.md`

- h1 = the plain feature name. Nothing after it.
- Traditional Chinese. Motivation first: why anyone needs this, before what it does.
- Sections are named after the question they answer ("清機到底清掉什麼"), not after components.
- Put the **reason** in a `> blockquote` and the mechanics in prose around it. The blockquote is
  where "why is it built this way" lives.
- Reference each diagram as `![alt](diagrams/<name>.png)` and let it carry the branching; the
  prose beside it explains the two or three decisions the picture cannot.
- Close with the Q&A table (same cases as the fact set, in the reader's language) and then the
  fact-coverage checklist: `- F1、F2 → <the section that carries them>`.

## `<feature>.ai.en.md`

- Same plain h1. English.
- Opens with `## Contract` — signatures, kinds, a table of variants — then the invariants that
  shape everything after.
- Pattern for every flow section: **the reasons in prose, then the authoritative graph.** State
  what the graph's shape cannot say, then show the ```mermaid block.
- Facts that are pure lookup go in flat bullets with their IDs in parentheses.
- Close with `## Edge cases (flat, for lookup)` — one line per case, ID-tagged — and a one-line
  `## Fact coverage` mapping every ID to a section.

## `TODO.md`

One bullet per deferred item, `**T1 — <short title>.**` then what blocks it and which fact
defers to it. The spec prose points here; it never explains the deferral itself.

## Keeping it alive

After any change to observable behaviour, grep the spec directory for the names and signatures
you touched — **including the diagram sources** (`.html` / `.mmd`) — update what matches, and
re-render any diagram whose labels changed. A change that makes an invariant *more* true may
need no edit; verify rather than assume.
