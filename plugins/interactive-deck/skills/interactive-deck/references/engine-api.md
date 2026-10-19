# Engine API

`assets/deck-template.html` is one file in four parts:

| Part | Marker | Edit? |
|---|---|---|
| Styles | `/* ===== ENGINE — do not edit (styles) =====` | no |
| `<title>` | in `<head>` | yes — the deck's name, 2–4 words |
| Layers | `<!-- DECK:LAYERS:BEGIN -->` … `<!-- DECK:LAYERS:END -->` | yes |
| Deck script | `// ===== DECK:BEGIN =====` … `// ===== DECK:END =====` | yes |
| Engine script | `// ===== ENGINE — do not edit =====` | no |

Replace the demo content inside the DECK regions; leave everything else byte-for-byte.

## Deck script globals

```js
const LANG = 'zh-TW';            // or 'en' — chrome strings (buttons, headings) follow it
const SLIDES = [ /* slide objects */ ];
function buildScene(stage) { }   // only if some slide has mode: 'three'
```

`tbl(rows, head?)` and `$(selector)` are available inside slide functions (they run after the
engine loads). `tbl` renders a `<table>`; cells that look like numbers (`1.4 min`, `42`,
`87 %`) get monospace.

## Slide object

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | unique; also the `data-slide` of its layer. Slide and scenario ids use only letters, digits, `-`, `_` |
| `chapter` | yes | bottom-rail label; consecutive slides may share one |
| `mode` | yes | `'three'` (3D stage), `'svg'` or `'html'` (a layer) |
| `title` | yes | one conclusion sentence (slide-rules §1) |
| `lede` | yes | one or two sentences of context |
| `caption` | yes | `Stage: <what is drawn>` — shown at the stage's bottom |
| `hint` | yes | `<action> → <b>what changes</b>` |
| `scenarios` | yes | `[{ id, label }]`, at least one; the first is the default |
| `data(sc)` | yes | HTML for the data block; usually `tbl(...)` plus a `<p class="src">` |
| `svgFocus` | no | `{ [scenarioId]: [x, y, w, h] }` — viewBox per scenario, tweened |
| `onScenario(sc, layer)` | no | custom DOM updates (fill a result node, filter cards) |
| `hud(sc)` | no | short text in the stage's top-right box; empty hides it |
| `three(sc, stage)` | `three` slides | focus objects and move the camera for this scenario |

Order the engine runs on every scenario change: data block → chip state → `data-s` toggles →
`onScenario` → `svgFocus` tween → `hud` → `three` (or a background orbit on non-3D slides).

## Layers (svg / html slides)

```html
<div class="layer" data-slide="flow">
  <svg viewBox="0 0 900 540" role="img" aria-labelledby="t-flow">
    <title id="t-flow">One sentence describing the diagram</title>
    …
  </svg>
</div>
```

- Draw on a 900 × 540 viewBox, space-separated (`viewBox="0 0 900 540"`). `svgFocus` works only on
  `svg` slides whose layer contains an `<svg>`.
- Give each marker a unique id per layer (`ah-flow`, `ah-speed`).
- `html` slides put `.cards` > `.card` (`.k` key row, `.v` value, `.w` note) inside the layer.
  Cards grow with their content; never give them a fixed height.

### `data-s`: what lights up per scenario

Any element with `data-s="a b"` gets class `on` in scenarios `a` and `b` and `off` (faded)
in all others. Elements without `data-s` are always normal.

`off` **fades, it does not hide** — an off element still occupies its space and its text is
still drawn. So never stack alternatives in one spot (one text per scenario at the same
x/y, or two boxes on top of each other): the verifier reports them as `svg-text-overlap`.
Use one element and rewrite it in `onScenario` instead:

```js
onScenario: (sc) => { $('#resT').textContent = { ok: '200 · 回傳結果', fail: '504 · 回錯誤' }[sc]; },
```

SVG vocabulary (all theme-aware):

| Class | Use |
|---|---|
| `g > rect.node` + `text.t` + `text.s` | a box with a bold line and a muted line |
| `rect.pill` | start/end terminal |
| `rect.band` | a background group |
| `path.edge` (`.dash`) | connector; `marker-end="url(#ah-…)"` |
| `rect.lblbg` + `text.lbl` | edge label on a stage-coloured backing |
| `g.pass` / `g.fail` / `g.warn` | colour the node green / red / amber when it is `on` |

## `stage` — 3D infrastructure

`buildScene(stage)` runs once after Three.js loads. Each `three(sc, stage)` call gets the same
object.

| Member | Meaning |
|---|---|
| `stage.THREE` | the Three.js namespace (r128) |
| `stage.scene`, `stage.camera` | the scene and perspective camera |
| `stage.narrow` | `true` when the stage is narrower than 560 px — pull the camera back |
| `stage.color('--token')` | a `THREE.Color` from a CSS token |
| `stage.label(text, sub?)` | a text sprite (add it to the scene yourself); repaints on theme change. Fits ≈ 9 CJK or 16 Latin characters per line — longer text is clipped and the verifier cannot see it |
| `stage.flyTo(pos, look)` | tween the camera to `pos`, looking at `look` (both `Vector3`) |
| `stage.focus(objects, hitSet?)` | colour meshes: no `hitSet` → all base tint; otherwise members of `hitSet` accent, the rest muted |
| `stage.onTheme(fn)` | re-apply colours you set yourself when the theme changes |

The engine adds lights and a ground grid sized to the scene, hides labels on non-3D slides,
and orbits the camera slowly behind svg/html slides. If Three.js fails to load, 3D slides show
a flat stage and everything else still works.

See `three-examples.md` for three complete scenes.

## `window.deck`

| Call | Returns |
|---|---|
| `deck.go(n \| id)` | slide id; `n` is 0-based |
| `deck.next()`, `deck.prev()` | slide id |
| `deck.setScenario(id)` | `true`, or `false` if the current slide has no such scenario |
| `deck.current()` | `{ index, id, scenario }` |
| `deck.slides()` | `[{ index, id, chapter, mode, title, scenarios: [id] }]` |
| `deck.setTheme('system' \| 'light' \| 'dark')` | the theme now applied |

`#s3` in the URL opens slide 3.
