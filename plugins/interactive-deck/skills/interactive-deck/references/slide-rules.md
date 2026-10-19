# Slide rules

A deck is a sequence of conclusions. Each slide earns its place by stating one, showing it on
the stage, and letting the reader poke at it.

## 1. One conclusion per slide, as the title

The title is a sentence the reader could repeat to someone else. It is never a topic name.

| ✗ topic | ✓ conclusion |
|---|---|
| Test architecture | Unit tests guard the parser; one end-to-end run guards the upload flow |
| Performance | Caching dependencies cut the nightly build from 52 to 14 minutes |
| Findings | The beta found three crashes, all in the import screen |

If a slide has two conclusions, it is two slides. If it has none, cut it.

## 2. Every slide declares four things

Write these in the outline, then build exactly them:

- **標題 / Title** — the conclusion (rule 1).
- **舞台 / Stage** — what is drawn: an SVG flowchart, a 3D scene, or cards.
- **互動 / Interaction** — what the reader switches → what on the stage changes.
  ✗ "toggle views" ✓ "pick a run → the camera flies to its bar and the HUD shows its time".
- **資料 / Data** — the numbers or steps in the left column, each with a source.

## 3. Data is sourced, dropped, or marked

- Every number comes from something run or read in this session: a command's output, a file,
  an API result, a measurement. Put the source in a `<p class="src">` line under the table.
- A number the user did not give and you cannot measure: drop it, or show it with
  `<span class="illus">示意</span>` (`illustrative` in English decks) next to it.
- Never round a measured value into a nicer one. `14.3 min` stays `14.3 min`.

## 4. Every action has a visible text button

- Scenarios are chips in the left column, never only a click on the stage.
- Keyboard: ← → / PageUp PageDown change slides, Home / End jump, 1–9 go to a slide.
- `window.deck` exposes the same actions to scripts (see engine-api.md).

## 5. Motion is a tween, never a cut

- 3D: change the camera with `stage.flyTo`; svg: give the slide `svgFocus` so the viewBox
  pans. The engine skips both under `prefers-reduced-motion`.
- Flowcharts are SVG. 3D is Three.js. Both load from cdnjs (already wired in the template).

## 6. Readable everywhere

- Light and dark themes both pass: no hard-coded colours, use the tokens (`var(--accent)`,
  classes `pass` / `fail` / `warn`, `stage.color('--accent')`).
- Under 820 px the deck stacks text → stage → rail. SVGs keep a 640 px minimum width and
  scroll sideways inside the stage; keep important nodes in the left 640 units.
- SVG text stays inside its node: size nodes for the longest label, ≤ 12 CJK characters or
  ≤ 22 Latin characters on a 160-unit node.

## The outline (shown to the user before building)

One line per slide, numbered:

```
01 · <conclusion title> · stage: <what is drawn> · scenarios: <a / b / c> · data: <source>
```

Example:

```
01 · 三個服務中，搜尋的回應時間是其他兩個的兩倍以上 · stage: 3D bars, height = p95 · scenarios: 全部 / 搜尋 / 購物車 / 登入 · data: monitoring export latency.csv
02 · 逾時的請求會重試一次，第二次仍失敗才回錯誤 · stage: SVG request flow · scenarios: 一次成功 / 重試後成功 / 重試仍失敗 · data: gateway/retry.yaml
```

Wait for the user's approval of this list before writing any HTML.
