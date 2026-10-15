# kevin-claude-plugins

Kevin's personal [Claude Code](https://claude.com/claude-code) plugin marketplace.

## Plugins

### `feature-flow`

An opinionated feature-development pipeline. Running `/feature-flow` drives a
disciplined funnel from idea to reviewed, verified code:

1. **Brainstorm** — `superpowers:brainstorming` (diverge on intent & design)
2. **Converge (branch on size)**
   - Large / multi-session → `mattpocock-skills:wayfinder` (decision-ticket map)
   - Small / one-session → `mattpocock-skills:grill-with-docs` (interview + ADRs)
3. **Plan** — `superpowers:writing-plans`
4. **Execute in parallel** — `superpowers:subagent-driven-development`
   (one lane per repo, model-tiered)
5. **Review + verify** — `superpowers:requesting-code-review` →
   `superpowers:verification-before-completion`

`feature-flow` is a thin **orchestrator**: it drives real skills rather than
reimplementing them.

### `spec-style-d`

A house style for feature specs. One canonical **fact set** (`F1…FN`, plus a "what if" Q&A
table) is the source of truth; two style files render exactly those facts for different readers:

| File | Reader | Shape |
|---|---|---|
| `fact-set.md` | reviewers | numbered facts, one per ID |
| `<feature>.human.zh.md` | a person catching up | narrative, motivation-first, embeds rendered PNGs |
| `<feature>.ai.en.md` | an agent about to implement | contract-first, Mermaid, flat edge-case list |

Diagrams are hand-authored inline SVG (≤9 nodes, 1–2 focal, orthogonal connectors) rendered to
PNG with Playwright — the plugin ships the template, the palette, and the renderer.

The skill loads itself when you write, regenerate, or sync a spec. It enforces the parts that
rot first: facts derived from the code rather than from the previous spec, a fact-coverage
checklist in both style files, deferrals in `TODO.md` rather than in spec prose, and looking at
the rendered diagram before committing it.

### `herdr-handoff`

In-place session handoff for Claude Code running inside a herdr pane.
When a session's context is full, `/handoff-recap [what next]`:

1. writes a handoff doc to `/tmp/handoff-<topic>-<time>.md` (state, open items, suggested skills);
2. starts a small detached driver that waits for the session to go idle, sends `/clear`,
   then sends "Read the handoff doc … and continue the work it describes."

Same pane, same tab position, fresh context. The driver logs to `/tmp/herdr-handoff-recap.log`
and gives up after ~10 minutes of not seeing the agent go idle.

It also ships a `UserPromptSubmit` hook that, on the first prompt of each session, asks the model
to rename the herdr tab after the real topic, and to read a handoff/plan file first when the
prompt only points at one. Outside herdr (`$HERDR_TAB_ID` unset) the hook does nothing.

## Requirements

`feature-flow` delegates to skills from two other plugins, so install these first:

- **`superpowers`**
- **`mattpocock-skills`**

Both are available from the official Claude Code plugins marketplace.

`herdr-handoff` needs `herdr` on `PATH` (or at `~/.local/bin/herdr`), plus `jq`, `python3`
and `setsid`. In auto mode you may need an allow rule for the `setsid nohup …herdr-handoff-recap`
launch.

`spec-style-d` has no plugin dependencies. Rendering diagrams needs Python with
[Playwright](https://playwright.dev/python/) and Chromium (`playwright install chromium`).

## Install

```
/plugin marketplace add kkeevin123456/kevin-claude-plugins
/plugin install feature-flow@kevin-claude-plugins
/plugin install spec-style-d@kevin-claude-plugins
/plugin install herdr-handoff@kevin-claude-plugins
```

## Usage

```
/feature-flow build a rate-limiter for the login endpoint
```

Or just describe the feature and let the pipeline run:

```
/feature-flow
```

(it will ask what you want to build).

## License

MIT
