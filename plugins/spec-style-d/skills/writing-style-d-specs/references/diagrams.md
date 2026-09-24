# Diagrams

A Style-D diagram is **hand-authored inline SVG in a standalone HTML file**, rendered to PNG.
Not Mermaid — Mermaid's auto-layout cannot hold a 9-node graph legible, and the human file
embeds the PNG. (The AI file keeps Mermaid: an agent reads the text, never the picture.)

Commit **both** the `.html` (the source you edit) and the `.png` (what the spec embeds).

## Constraints that keep them readable

- **≤9 nodes, ≤12 arrows.** More than that is two diagrams.
- **1–2 focal nodes**, accent-filled. Everything else is neutral. If three things are focal,
  nothing is.
- **4px grid.** Snap every x/y. Mismatched gaps read as sloppiness before content does.
- **Orthogonal connectors with rounded corners** (`Q` with an 8px radius), never diagonals.
- **Arrows are drawn before nodes** so a node always covers a line, never the reverse.
- **Arrow labels sit on a paper-filled `<rect>`** so the stroke does not run through the text.
- **The last segment of a path sets the arrowhead's direction** — end every connector with a
  straight run of ≥10px in the direction you want it pointing.
- **A legend**, below a hairline rule, naming every shape you used.

Shapes: trigger = pill (`rx` = half the height, grey fill), decision = diamond (`<polygon>`),
node/outcome = rounded rect (white), focal = rounded rect with the accent tint and accent stroke.

## Palette

The template's defaults; swap `--color-accent` / `--color-link` for your own house brand.

| Token | Value | Use |
|---|---|---|
| `--color-paper` | `#F2F5F7` | background, and the fill behind arrow labels |
| `--color-ink` | `#414B55` | node titles, node strokes |
| `--color-muted` | `#5F6B76` | body text, plain arrows |
| `--color-soft` | `#94A0AB` | conditions, caveats, trigger strokes |
| `--color-accent` | `#057FEB` | the focal path only |
| `--color-link` | `#005CAD` | a secondary emphasised path |
| `--color-rule` | `rgba(65,75,85,0.12)` | the legend hairline |

Type: Instrument Serif for the h1, Geist for node titles (12px/600), Geist Mono for every
sub-label (9px) and for the eyebrow and arrow labels (8px, `letter-spacing: 0.06–0.18em`).

## Making one

1. Copy `assets/diagram-template.html`, fill in the title, eyebrow, and `<desc>`.
2. Write a real `<desc>`: a full prose walkthrough of the graph. It is the accessibility text
   *and* the only part of the diagram a text-only reader gets.
3. Lay out on paper first — decide the columns and the vertical bands, then assign coordinates.
4. Render:

```bash
python3 assets/render_diagrams.py path/to/diagrams/
```

Needs Playwright with Chromium. Screenshots the `<svg>` element at `device_scale_factor=2`
with a transparent background, writing `<name>.png` beside each `<name>.html`.

5. **Open the PNG and look at it.** Every defect this style produces — overlapping boxes, an
   arrowhead pointing sideways, text wider than its box — is invisible in the SVG source and
   unmissable in the render. Fix, re-render, look again.
