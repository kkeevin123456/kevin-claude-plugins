# interactive-deck — design

## Goal

A plugin that turns "make an interactive deck about X" into a single-file HTML deck of the same
quality as a hand-directed one: one conclusion per slide, a live stage that reacts to scenario
buttons, real numbers only, and a screenshot-verified layout in light, dark and phone widths.

Success: a fresh session given only a topic and its source material produces a deck that passes
`verify_deck.mjs` and the visual review, after one outline approval from the user.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Ship a skill **plus** an engine template and a Playwright verify script | Rules alone produce a different layout and different bugs every time |
| D2 | 3D scenes are written per deck; the engine ships 3D *infrastructure*, not fixed components | Needs vary (tiles, bars, a building, spheres); fixed components would not fit |
| D3 | Default accent is Synology blue `#057FEB` | Chosen house style; not confidential |
| D4 | The agent proposes an outline (one line per slide) and waits for approval before building | Cutting or rewording a slide is cheap at outline time, expensive after |
| D5 | One HTML file, split into a fenced `ENGINE` region (do not edit) and a `DECK` region (fill in) | One file publishes as an artifact and opens from `file://` |
| D6 | Deck text follows the conversation language; chrome strings come from a zh-TW / en dictionary | The deck is read by the user's audience, not by the agent |
| D7 | Publish with the Artifact tool when present; otherwise leave the HTML file and print its path | Other installers may not have the Artifact tool |

## Layout

```
plugins/interactive-deck/
├── .claude-plugin/plugin.json
└── skills/interactive-deck/
    ├── SKILL.md                 workflow + hard rules
    ├── references/
    │   ├── slide-rules.md       how to write a slide
    │   ├── engine-api.md        SLIDES fields, data-s rule, window.deck, stage API
    │   └── three-examples.md    tile grid, bar chart, building — reference code, not components
    └── assets/
        ├── deck-template.html   engine + a 3-slide fictional demo deck
        └── verify_deck.mjs      Playwright screenshot + layout checks
```

`marketplace.json` and the repo `README.md` gain an entry.

## Workflow (SKILL.md)

1. **Gather data.** Every number comes from a command, file or tool result in this session.
   A value the user did not give and the agent cannot measure is either dropped or marked
   `示意` / `illustrative` on the slide.
2. **Outline → approval.** One line per slide: conclusion title · what the stage draws ·
   scenarios · data source. Stop until the user approves.
3. **Fill the template.** Copy `deck-template.html` to the scratchpad, replace the `DECK`
   region only.
4. **Verify.** Run `verify_deck.mjs`; fix every failure; then Read the screenshots (at least
   every slide's first scenario in light, dark and narrow) and fix what looks wrong. Repeat
   until clean.
5. **Publish** (D7) and report: link, slide list, how to drive it (`window.deck`), what the
   verification covered.

## Slide rules (slide-rules.md)

- Title is one conclusion sentence, never a topic name.
- Each slide declares: stage (what is drawn), interaction (what the user switches → what on the
  stage changes), data (numbers or steps, sourced).
- Every operation has a visible text button; keyboard ←/→, PageUp/PageDown, Home/End, 1–9.
- Flowcharts are SVG; 3D is Three.js; both from CDN (cdnjs, pinned version).
- Slide/scenario changes tween the camera or SVG viewBox; no hard cuts. Honour
  `prefers-reduced-motion`.
- Light and dark themes both readable; under 820 px the deck stacks vertically.

## Engine API (engine-api.md)

Slide object:

| Field | Meaning |
|---|---|
| `id`, `chapter` | identity; chapters build the bottom rail |
| `mode` | `'three'` \| `'svg'` \| `'html'` — which stage layer shows |
| `title`, `lede`, `caption`, `hint` | conclusion; one-paragraph context; stage caption; "click X → Y changes" |
| `scenarios: [{id, label}]` | scenario buttons; first one is the default |
| `data(sc)` | HTML for the data block; helper `tbl(rows, head)` |
| `svgFocus: {sc: [x,y,w,h]}` | optional viewBox per scenario, tweened |
| `three(sc, stage)` | optional; camera + focus for this scenario |
| `onScenario(sc, layer)` | optional custom DOM updates for this slide |

SVG layers: `<div class="layer" data-slide="<id>">`. An element with `data-s="a b"` gets class
`on` in scenarios `a`/`b` and `off` otherwise; `pass` / `fail` / `warn` classes colour a focused
node.

3D: the deck defines `buildScene(stage)`, called once after Three.js loads. `stage` provides
`THREE`, `scene`, `camera`, `label(text, sub)` (sprite, repainted on theme change),
`color(token)`, `flyTo(pos, look)`, `focus(objects, hitSet)`, `onTheme(fn)`, `narrow`
(stage width < 560 px). If Three.js fails to load, `three` slides fall back to a flat stage and
the caption still renders.

`window.deck`: `go(n | id)`, `next()`, `prev()`, `setScenario(id)`, `current()`, `slides()`,
`setTheme('system' | 'light' | 'dark')`. `#sN` in the URL opens slide N.

## Verification (verify_deck.mjs)

`node verify_deck.mjs <deck.html> [--out <dir>]`

- Matrix: widths 1440×900 and 390×844 × themes light/dark × every slide × every scenario
  (driven through `window.deck`). Screenshots to `<out>/<width>-<theme>-<NN>-<scenario>.png`.
- Fails (exit 1) on: page error or console error; `window.THREE` missing; horizontal page
  scroll; overlapping SVG `<text>` boxes within the active layer; SVG text that leaves its
  enclosing node rect; `.card` or `.text` content overflow. Prints one line per failure.
- Exit 2 when Playwright/Chromium is unavailable; SKILL.md says to install it into the
  scratchpad (`npm i playwright && npx playwright install chromium`), never into the user's
  project.

## Testing the plugin

1. The template's demo deck passes `verify_deck.mjs` with zero failures.
2. A fresh subagent (writing-skills pressure test) given a fictional topic and data follows the
   workflow: outlines first, builds from the template, runs verification, and its deck passes.

## Out of scope

- PPTX/PDF export, speaker notes, voice control (the `window.deck` API makes it possible later).
- Any project-specific content in the public repo; the demo deck and examples use invented data.
