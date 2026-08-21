---
description: Run the opinionated feature-development pipeline — brainstorm, size-branch (wayfinder / grill-with-docs), plan, parallel subagents, review + verify.
argument-hint: <describe the feature to build>
---

# Feature Flow

You are running the **feature-flow** pipeline: a disciplined funnel that takes a
feature idea from divergent thinking all the way to reviewed, verified code.

The feature to build: **$ARGUMENTS**

(If the description above is empty, ask the user what feature they want to build
before starting Step 1.)

## How to run it

Work the steps **in order**. Announce each step as you enter it
(e.g. "Step 1 — invoking superpowers:brainstorming"). Each step's skill sets the
approach; follow that skill exactly. Do not skip ahead, and do not start writing
implementation code until Step 3's plan exists.

### Step 1 — Diverge
Invoke **`superpowers:brainstorming`** to explore intent, requirements, and design.
Do this before any code or file exploration.

### Step 2 — Converge (branch on size)
Decide whether this feature is **large** (spans more than one agent session / many
open decisions / cross-repo) or **small** (fits in a single session). If it is not
obvious, ask the user.

- **Large / multi-session →** invoke **`mattpocock-skills:wayfinder`**: chart the
  effort as a shared map of decision tickets and resolve them one at a time until
  the route is clear.
- **Small / one-session →** invoke **`mattpocock-skills:grill-with-docs`**: a
  relentless interview that sharpens the plan/design and captures ADRs + a glossary
  as it goes.

Both are `disable-model-invocation` skills, so invoke them explicitly here.

### Step 3 — Plan
Invoke **`superpowers:writing-plans`** to turn the settled spec/decisions into a
step-by-step, executable implementation plan.

### Step 4 — Execute in parallel
Invoke **`superpowers:subagent-driven-development`** (or
`superpowers:dispatching-parallel-agents`) to execute the plan. Parallelize
independent work — **one lane per git repo** — and **tier the model per task**
(stronger models for reasoning/backend/toolchain, lighter models for mechanical
edits; the most capable model for the final review). Send independent subagents in
a single message so they run concurrently.

### Step 5 — Review + verify (never skip)
1. Invoke **`superpowers:requesting-code-review`** to review the work against the
   plan and requirements.
2. Invoke **`superpowers:verification-before-completion`** — run the real
   build/lint/test/e2e commands and confirm the output **before** claiming the work
   is done. Execution alone is not "done".

## Ground rules
- **Do not auto-commit or push.** Make edits and verify, then stop for the user to
  stage/commit — unless the change was pre-agreed. Never push unless asked.
- Keep the user in the loop between phases; each step's skill has its own approval
  gates — honor them.

## Dependencies
This command orchestrates skills from two other plugins, which must be installed:
- **`superpowers`** — provides brainstorming, writing-plans, subagent-driven-development, requesting-code-review, verification-before-completion.
- **`mattpocock-skills`** — provides wayfinder and grill-with-docs.

If either is missing, tell the user which plugin to install before continuing.
