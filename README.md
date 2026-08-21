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

## Requirements

`feature-flow` delegates to skills from two other plugins, so install these first:

- **`superpowers`**
- **`mattpocock-skills`**

Both are available from the official Claude Code plugins marketplace.

## Install

```
/plugin marketplace add kkeevin123456/kevin-claude-plugins
/plugin install feature-flow@kevin-claude-plugins
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
