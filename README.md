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

## Requirements

`feature-flow` delegates to skills from two other plugins, so install these first:

- **`superpowers`**
- **`mattpocock-skills`**

Both are available from the official Claude Code plugins marketplace.

`spec-style-d` has no plugin dependencies. Rendering diagrams needs Python with
[Playwright](https://playwright.dev/python/) and Chromium (`playwright install chromium`).

## Install

```
/plugin marketplace add kkeevin123456/kevin-claude-plugins
/plugin install feature-flow@kevin-claude-plugins
/plugin install spec-style-d@kevin-claude-plugins
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
