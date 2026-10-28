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

**Open with the goal.** Your first message restates, in your own words, the
user's goal, the problem it solves, and the smallest change you expect to meet
it. Do not wait for confirmation. If the evidence rules out the requested change,
show the evidence and stop. Restate the goal in every subagent brief and at the
top of the final report.

**Steps go into the todo list verbatim.** Before Step 1, create one todo per
step and sub-step of this pipeline (Steps 1–5, including each numbered item of
Step 5), copied as written, before any task-specific todos. A step you decide
not to do stays in the list, marked `skip: <one-line reason>`. Never delete a
step from the list.

**Label every claim.** Each claim in a report carries its evidence or its label
in the same sentence: *measured* (you ran it and saw the output), *inferred*
(from reading code), or *guess*. Never hand the user a check you could run.

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

When a skill in Steps 1–2 would ask for approval section by section, present the
whole design in one message and ask for a single approval instead.

### Step 3 — Plan
Invoke **`superpowers:writing-plans`** to turn the settled spec/decisions into a
step-by-step, executable implementation plan.

**Decision gate (before asking for plan approval).** Output these three sections
and wait for the user's answer on section 2 before any implementation:
1. **Existing mechanisms to reuse** — how the codebase already solves the nearest
   equivalent problem, with `file:line`. Build something new only if nothing fits,
   and say why the existing path does not.
2. **Decisions that need sign-off** (at most 5) — each with options, your
   recommendation, and the evidence (repo convention, spec, prior MR). Always list
   cross-service transport, which layer owns the data, migrations, and where docs
   live; do not settle these silently.
3. **Out of scope** — what this change will not touch.

The user may take section 2 to their lead or reviewer; the plan is not approved
until they answer it.

Also write the **acceptance checks** into the plan, run by the agent, not the
user, in this form:
- **Done means** — one checkable condition per requirement, each with the exact
  command or browser steps that prove it and the output that counts as a pass.
  "It compiles", "tests pass" or "looks right" are not conditions.
- **Keep** — existing behaviour that must not change, each with the check that
  proves it still holds.

A check that cannot run, ends *inconclusive*, or runs on a different surface
than the user's (unit test instead of the real UI, mock instead of the real
backend) is not a pass. Report it as such.

For every test the plan adds, answer two questions in the plan:
1. Would it fail if the behaviour broke (wrong value, missing side effect,
   duplicated call)? If not, it proves nothing — rewrite it.
2. Would it still pass if only internals changed and observable behaviour did
   not? If not, it is coupled to the implementation — rewrite it.

Expected values must not be computed by the code under test or copied from its
output.

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
3. Run the plan's acceptance checks yourself. For UI changes, drive the real UI
   (e.g. Playwright) and capture screenshots; hand a step to the user only when it
   needs physical access or an environment you cannot reach, and say which.
4. **Independent verification.** Spawn a fresh subagent that did not write the
   code (the author checks what it meant to build, not what it built). Give it
   the goal, the plan's Done/Keep checks and access to the environment, not the
   implementers' reports. It runs every check itself and returns `PASS`,
   `PASS+NOTES` or `FAIL`, with the raw output for each check. Only `PASS` or
   `PASS+NOTES` may go out for review. Green CI or an approving bot review is
   not a verdict. If the code changes after the verdict (fix round, rebase
   that changes the patch — compare `git patch-id`), get a new verdict.
5. For a merge/pull request, "done" means CI green **and** mergeable **and** every
   review thread answered by a commit or reply. Do not skip hooks
   (`--no-verify`, `SKIP=`); if forced to, say so in the first line of the report.
6. After sending for review, watch the request yourself (e.g. with `Monitor` and a
   polling script) and address bot/reviewer comments as they arrive; notify the
   user only when it is ready or a comment needs their decision.
7. **Classify a CI failure before retrying it.**
   - Failure in code the diff never touches → check for a stale base first
     (`git merge-base --is-ancestor origin/<base> HEAD`). If stale, rebase; do not
     retry.
   - Looks like flake or infrastructure → retry **once**. An identical second
     failure means it is not flake: read the job log and treat it as real.
   - Failure in the diff's own code → fix it with a commit.

   Never retry blind more than once, and never push an unrelated change just to
   re-trigger CI.

## First run: recommended CLAUDE.md rules
Several steps above depend on rules the user sets in CLAUDE.md (what may be
committed or pushed without asking, which test environment to verify on, how to
watch reviews). Before Step 1, check the CLAUDE.md files loaded in this session.
If none of them covers commit/push permissions or a definition of done, tell the
user once, in one line, that a template is available at
https://github.com/kkeevin123456/kevin-claude-plugins/blob/main/plugins/feature-flow/CLAUDE.md.example
and continue with the conservative defaults below. Do not edit CLAUDE.md
yourself.

## Ground rules
- Follow the user's CLAUDE.md for commit/push permissions. If it says nothing,
  do not commit or push unless the change was pre-agreed.
- Approval gates are for decisions (design, the Step 3 decision gate, merging),
  not for routine steps the user has pre-authorized.

## Dependencies
This command orchestrates skills from two other plugins, which must be installed:
- **`superpowers`** — provides brainstorming, writing-plans, subagent-driven-development, requesting-code-review, verification-before-completion.
- **`mattpocock-skills`** — provides wayfinder and grill-with-docs.

If either is missing, tell the user which plugin to install before continuing.
