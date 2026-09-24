---
name: writing-style-d-specs
description: Use when writing, regenerating, or updating a feature spec or design doc for a shipped feature — especially when the spec must serve both a human reader and an implementing agent, when a reviewer asks "where is the spec for this", or after finishing a feature or MR that changed observable behaviour.
---

# Writing Style-D Specs

## Overview

One canonical fact set, rendered twice. `fact-set.md` holds every numbered fact; a human file
and an AI file re-shape those same facts for different readers and may not contradict, add, or
drop any of them. Diagrams carry the branch logic so the prose can spend its words on **why**.

Named "Style D" because it fuses narrative (A) with flowchart (C): a narrative spine, with
diagrams doing the work that bullet lists would otherwise do badly.

## When to use

- A feature exists (or is about to) and needs a durable, reviewable description of its behaviour.
- You just finished a feature/MR — **the closing step is syncing the spec**, not a separate ask.
- An existing spec drifted from the code and needs regenerating.

Not for: internals design docs (those are a separate `<feature>-design.md`), API reference,
or a one-off explanation in chat.

## The three files

```
docs/spec/<feature>/
├── fact-set.md                  source of truth — F1…FN + a "what if" Q&A table
├── <feature>.human.zh.md        narrative, motivation-first, embeds rendered PNGs
├── <feature>.ai.en.md           contract-first, Mermaid inline, flat edge-case list
├── TODO.md                      only if something is genuinely deferred
└── diagrams/<name>.html + .png  diagram source + its render
```

| | human file | AI file |
|---|---|---|
| Reader | a person catching up | an agent about to implement |
| Opens with | why the feature exists | the contract |
| Diagrams | **rendered PNG** | **Mermaid** text |
| Edges | Q&A table, in prose | flat bullet list, for lookup |
| Ends with | fact-coverage checklist | one-line fact coverage |

## Hard rules

1. **Derive facts from the code, not from the previous spec.** Regenerating from the old spec
   copies its drift forward. Read the implementation; where it disagrees with the old spec, the
   code wins and the disagreement is worth calling out.
2. **h1 is the plain feature name.** No style suffix, no explanatory blockquote about Style D.
   (`fact-set.md`'s "source of truth" blockquote is functional — keep that one.)
3. **No person names.** Name the role or component. A genuinely deferred item goes in `TODO.md`
   with a pointer from the fact that defers it.
4. **Every fact gets an ID** (`F1`, `F2`, …) and both style files end with a checklist mapping
   their sections back to those IDs. An unmapped fact is a fact one of the readers never got.
5. **Diagrams ship rendered.** A Mermaid block in the human file is unfinished work — see
   [references/diagrams.md](references/diagrams.md).
6. **Read the rendered PNG before committing it.** Overlapping boxes and arrowheads pointing the
   wrong way are invisible in the source and obvious in the image.

## Workflow

1. Read the implementation. Collect facts; give each an ID.
2. Write `fact-set.md`, ending with 5–6 "what if" cases each answerable from the facts you listed.
3. Draw 1–2 diagrams (see [references/diagrams.md](references/diagrams.md)); render and **look at** them.
4. Write the human file, then the AI file, from the fact set only.
5. Check both coverage checklists mention every ID.

Full rules for each file: [references/style-rules.md](references/style-rules.md).

## Common mistakes

| Mistake | Why it bites |
|---|---|
| Regenerating from the old spec | Copies its drift forward; the point was to catch drift. |
| Facts only in the style files | Two readers now disagree and neither is authoritative. |
| A Mermaid block left in the human file | Reads as unfinished; house style is a rendered diagram. |
| Diagram committed unviewed | Overlaps and reversed arrows survive review. |
| Deferred work explained in spec prose | Spec prose is the contract; deferrals rot there. Use `TODO.md`. |
| Skipping the spec after a behaviour change | This is the drift. There is no later. |
