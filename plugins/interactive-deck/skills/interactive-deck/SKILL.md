---
name: interactive-deck
description: Use when the user asks for an interactive deck, slides, a presentation, or a results walkthrough as a web page, HTML file or artifact (互動簡報、投影片、簡報、成果報告頁) — not a .pptx. Produces one self-contained HTML deck with a live SVG/Three.js stage driven by scenario buttons, built from real data only and screenshot-verified before it is shared.
---

# Interactive Deck

## Overview

A deck here is a sequence of **conclusions**. Each slide states one in its title, shows it on a
stage (SVG flowchart, 3D scene or cards), and lets the reader switch scenarios to see what
changes. Everything ships as one HTML file built from a fixed engine template, so layout,
theming, navigation and the `window.deck` API are the same every time; only the content varies.

Paths below are relative to this skill's base directory (shown when the skill loads):

| File | What it is |
|---|---|
| `assets/deck-template.html` | engine + a 3-slide demo deck — start every deck from a copy |
| `assets/verify_deck.mjs` | Playwright check: screenshots + layout defects |
| `references/slide-rules.md` | how to write a slide, the outline format — **read before the outline** |
| `references/engine-api.md` | slide fields, `data-s`, `stage` API, `window.deck` — **read before building** |
| `references/three-examples.md` | three complete 3D scenes (tiles, bars, building) — read when a slide is 3D |

## Workflow

Do these in order. Steps 2 and 4 are gates.

### 1. Gather the data

Collect every number and step the deck will show by running commands, reading files or calling
tools in this session. Keep a note of where each came from; it goes on the slide. A value
you cannot source is dropped or marked illustrative (slide-rules §3). Never invent a number.

### 2. Outline → wait for approval

Read `references/slide-rules.md`, then show the user one line per slide in its outline format
(`NN · conclusion · stage · scenarios · data source`). **Stop and wait.** Build nothing until
the user approves; apply their cuts and rewording first.

### 3. Fill the template

1. Copy `assets/deck-template.html` into your scratch/temp directory as `<topic>-deck.html`.
2. Read `references/engine-api.md` (and `three-examples.md` for 3D slides).
3. Edit **only** `<title>`, the `DECK:LAYERS` region and the `DECK` script region. Replace all
   demo content. Never edit the ENGINE regions — if the engine cannot do something, say so in
   your report instead of patching it.
4. Set `LANG` to the conversation's language (`'zh-TW'` or `'en'`); write all slide text in it.

### 4. Verify → fix → repeat until clean

```bash
node <skill dir>/assets/verify_deck.mjs <deck.html> --out <scratch>/shots
```

- Exit 2 means it could not run: check the printed reason. If it says Playwright is not found,
  install it in a scratch directory, never in the user's
  project: `cd <scratch> && npm i playwright && npx playwright install chromium`, then re-run
  with `PLAYWRIGHT_DIR=<scratch>/node_modules/playwright`.
- Exit 1 prints one `FAIL <check> <where> <detail>` line per defect. Fix every one.
  `WARN net-error` lines (CDN or fonts unreachable from this machine) are not defects; never
  remove the template's CDN `<script>` or fonts `<link>` to silence them.
- Exit 0 is necessary, not sufficient. **Read the screenshots.** Minimum set, no skipping a
  slide: for **every** slide, its first scenario at `1440-light`, `1440-dark` and `390-light`;
  plus every scenario of 3D slides at `1440-light`. With N slides that is at least 3·N images. Look for: camera too close or labels cut off, objects hiding each other,
  unreadable dark-mode colours, a focus that does not land on the thing the hint names, empty
  stage areas. Fix and re-run.

Report which screenshots you read. "Verifier passed" alone is not verification.

### 5. Publish and report

- If an Artifact tool is available, publish the HTML file with it (icon `slides`). Otherwise
  give the user the file's absolute path.
- Report: the link or path; the slide list (number + title); how to drive it (keys, chips,
  `window.deck.go(n)`, `setScenario(id)`, `setTheme('dark')`); what verification covered
  (shot count, widths, themes, which screenshots you read, what you fixed).

## Hard rules

| Rule | Why |
|---|---|
| Outline approval before any HTML | Cutting a slide in the outline costs a line; after building it costs the slide |
| No invented numbers; mark illustrative ones | The deck is shown to people who will act on it |
| Edit only DECK regions | The engine is what makes every deck work the same; patches drift |
| Read screenshots before publishing | Half of real layout bugs (camera, overlap behind 3D labels) pass the automated checks |
| Titles are conclusions | A topic title makes the reader do the summarising |

## Common mistakes

- **Building a slide per topic** ("Architecture", "Results") → rewrite each as the sentence it proves.
- **Scenarios that change only the data table** → each scenario must change something on the stage
  (`data-s`, `svgFocus`, `three`, `onScenario`).
- **One giant 3D scene that every slide reuses** → 3D only where depth or scale is the point; use SVG
  for flows and cards for lists.
- **Fixing a verifier failure by loosening the check** → fix the deck.
