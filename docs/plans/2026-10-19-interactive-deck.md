# interactive-deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `interactive-deck` plugin: a skill, a single-file deck engine template, and a Playwright verifier that together reproduce a hand-directed interactive HTML deck.

**Architecture:** `deck-template.html` holds a fenced `ENGINE` region (layout, theme, rail, scenario plumbing, 3D stage infrastructure, `window.deck`) and a `DECK` region (SLIDES, SVG layers, `buildScene`). The engine is a generalisation of an existing hand-built deck (port source below). `verify_deck.mjs` drives `window.deck` through every slide × scenario × theme × width and fails on layout defects. `SKILL.md` sequences data gathering → outline approval → fill → verify → publish.

**Tech Stack:** HTML/CSS/vanilla JS, Three.js r128 (cdnjs), SVG, Node ≥ 20 (`node:test`), Playwright ≥ 1.40 (chromium).

**Spec:** `docs/specs/2026-10-19-interactive-deck-design.md`

**Port source (reference only, never copied into the repo):** a private hand-built 9-slide deck (kept outside the repo) — a 9-slide deck containing internal project content. Take structure and code from it; take **no text, names, numbers or ticket ids**.

**Local Playwright for development:** any existing `node_modules/playwright` (≥ 1.40, Chromium installed). Run tests with `PLAYWRIGHT_DIR=<path>/node_modules/playwright` and Node ≥ 20.

## Global Constraints

- Public repo: no company-internal names, hosts, ticket ids, people, or real project data anywhere under `plugins/interactive-deck/` or `docs/`. Synology blue `#057FEB` is allowed (spec D3).
- Default accent `--accent: #057FEB` light / `#3D9BFF` dark.
- External scripts only from `cdnjs.cloudflare.com`, pinned: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`. Fonts only from Google Fonts.
- One output HTML file per deck; engine and deck in the same file.
- Chrome strings dictionary: `zh-TW` and `en` (spec D6).
- Narrow breakpoint 820 px (stack vertically); stage `narrow` flag at < 560 px.
- `prefers-reduced-motion: reduce` ⇒ all tweens duration 0.
- Verifier exit codes: 0 clean, 1 failures, 2 Playwright unavailable / bad args.
- Plugin layout and `plugin.json` shape follow `plugins/spec-style-d/`.

## Review Focus

1. **Deck with zero `three` slides** — engine must not require `buildScene` or Three.js; verifier must not report `three-missing`. Pinned in Task 2 (`demo` has a test variant) and Task 1 fixture `ok.html` (no three slides).
2. **Three.js CDN blocked/offline** — `three` slides fall back to a flat stage, no page error. Pinned in Task 2 Step "offline fallback".
3. **Slide with a single scenario** — chip row still renders one pressed button; verifier iterates one scenario. Pinned in Task 2 demo slide 3.
4. **Long CJK titles at 390 px** — no horizontal page scroll. Pinned by verifier `h-scroll` on the demo deck, which includes a long zh title.
5. **Theme toggle after a 3D slide is shown** — labels repaint, no stale dark-on-dark text. Pinned in Task 2: verifier dark screenshots read by the implementer + `stage.onTheme` unit check.

---

## File map

| File | Responsibility |
|---|---|
| `plugins/interactive-deck/.claude-plugin/plugin.json` | plugin manifest |
| `plugins/interactive-deck/skills/interactive-deck/SKILL.md` | workflow + hard rules |
| `.../references/slide-rules.md` | how to write a slide |
| `.../references/engine-api.md` | SLIDES fields, `data-s`, `window.deck`, `stage` API |
| `.../references/three-examples.md` | tile grid, bar chart, building — reference `buildScene` code |
| `.../assets/deck-template.html` | engine + 3-slide fictional demo |
| `.../assets/verify_deck.mjs` | verifier |
| `plugins/interactive-deck/tests/helpers.mjs` | `run(file, extra)` — spawns the verifier |
| `plugins/interactive-deck/tests/verify.test.mjs` | verifier tests (`node --test`) |
| `plugins/interactive-deck/tests/fixtures/*.html` | minimal decks, one defect each |
| `plugins/interactive-deck/tests/template.test.mjs` | template + examples pass the verifier |
| `.claude-plugin/marketplace.json`, `README.md` | registry + docs |

---

### Task 1: Verifier (`verify_deck.mjs`) with fixture tests

**Files:**
- Create: `plugins/interactive-deck/skills/interactive-deck/assets/verify_deck.mjs`
- Create: `plugins/interactive-deck/tests/helpers.mjs`
- Create: `plugins/interactive-deck/tests/verify.test.mjs`
- Create: `plugins/interactive-deck/tests/fixtures/{ok,jserror,hscroll,overlap,textout,cardoverflow,nothree}.html`

**Interfaces:**
- Consumes (from any deck): `window.deck.slides() → [{index, id, mode, scenarios:[id]}]`, `deck.go(index)`, `deck.setScenario(id)`, `deck.setTheme('light'|'dark')`. Active SVG layer = `.layer.active`. Cards = `.card`. Text column = `.text`.
- Produces: CLI `node verify_deck.mjs <deck.html> [--out <dir>] [--quick]`; stdout lines `FAIL <check> <w>-<theme> s<NN>:<scenario> <detail>`; last line `OK <n> shots` or `FAILED <n> issues, <n> shots`. Check names: `js-error`, `three-missing`, `h-scroll`, `svg-text-overlap`, `svg-text-outside`, `card-overflow`, `text-overflow`. Screenshots `<out>/<w>-<theme>-<NN>-<scenario>.png`. `--quick` = first scenario of each slide only. Playwright resolved from `$PLAYWRIGHT_DIR`, then cwd, then script dir.

Note: `slides()` must expose `mode` — add it to the engine's `window.deck.slides()` in Task 2 (the source deck lacks it).

- [ ] **Step 1: Write the fixtures.** Each is a self-contained page with a minimal `window.deck`. Shared shell (`ok.html`):

```html
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font:14px sans-serif}.layer{display:none}.layer.active{display:block}.text{width:300px;overflow:auto}.card{width:200px;height:60px;overflow:hidden}</style></head><body>
<div class="text">Short text</div>
<div class="layer active" data-slide="a"><svg viewBox="0 0 400 200" width="400" height="200">
<g><rect class="node" x="10" y="10" width="180" height="60"/><text x="20" y="45">Node A</text></g>
<g><rect class="node" x="210" y="10" width="180" height="60"/><text x="220" y="45">Node B</text></g></svg></div>
<div class="card">fits</div>
<script>
const S=[{index:0,id:'a',mode:'svg',scenarios:['x','y']}];
window.deck={slides:()=>S,go:()=>'a',setScenario:()=>true,setTheme:t=>t};
</script></body></html>
```

Variants (copy `ok.html`, change only):
- `jserror.html`: add `<script>setTimeout(()=>{throw new Error('boom')},0)</script>`.
- `hscroll.html`: add `<div style="width:3000px;height:10px"></div>`.
- `overlap.html`: second `<text>` at `x="25" y="45"` inside the first `<g>` (two texts on top of each other).
- `textout.html`: first text becomes `<text x="20" y="45">A very long label that runs far past the node edge</text>`.
- `cardoverflow.html`: card content `<div style="height:200px">tall</div>`.
- `nothree.html`: `mode:'three'` and no Three.js script.

- [ ] **Step 2: Write the failing tests** — `tests/helpers.mjs` holds `run`, `tests/verify.test.mjs` the cases:

```js
// tests/helpers.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const VERIFY = join(here, '../skills/interactive-deck/assets/verify_deck.mjs');
export function run(file, extra = []) {
  const out = mkdtempSync(join(tmpdir(), 'deck-'));
  const r = spawnSync(process.execPath, [VERIFY, file, '--out', out, ...extra], { encoding: 'utf8', timeout: 180000 });
  return { code: r.status, out: r.stdout + r.stderr };
}

// tests/verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from './helpers.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const fx = (n) => join(here, 'fixtures', n + '.html');

test('clean deck passes', () => { const r = run(fx('ok')); assert.equal(r.code, 0, r.out); assert.match(r.out, /^OK 8 shots/m); });
for (const [name, check] of [
  ['jserror', 'js-error'], ['hscroll', 'h-scroll'], ['overlap', 'svg-text-overlap'],
  ['textout', 'svg-text-outside'], ['cardoverflow', 'card-overflow'], ['nothree', 'three-missing'],
]) test(`${name} fails with ${check}`, () => { const r = run(fx(name)); assert.equal(r.code, 1, r.out); assert.match(r.out, new RegExp(`^FAIL ${check} `, 'm')); });
test('--quick shoots first scenario only', () => { const r = run(fx('ok'), ['--quick']); assert.match(r.out, /^OK 4 shots/m); });
test('missing file exits 2', () => { const r = run('/nonexistent.html'); assert.equal(r.code, 2); });
```

- [ ] **Step 3: Run, expect FAIL** — `cd plugins/interactive-deck && PLAYWRIGHT_DIR=<path>/node_modules/playwright node --test tests/verify.test.mjs` → all fail (script missing).

- [ ] **Step 4: Implement `verify_deck.mjs`:**

```js
#!/usr/bin/env node
// Drives window.deck through every slide × scenario × theme × width, screenshots each state,
// and fails on layout defects. Exit 0 clean, 1 defects, 2 cannot run.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const outIdx = args.indexOf('--out');
const out = resolve(outIdx >= 0 ? args[outIdx + 1] : 'deck-shots');
const quick = args.includes('--quick');
if (!file || !existsSync(file)) { console.error('usage: verify_deck.mjs <deck.html> [--out dir] [--quick]'); process.exit(2); }

function loadPlaywright() {
  const bases = [process.env.PLAYWRIGHT_DIR && dirname(process.env.PLAYWRIGHT_DIR), process.cwd(), dirname(fileURLToPath(import.meta.url))].filter(Boolean);
  for (const b of bases) { try { return createRequire(join(b, 'x.js'))('playwright'); } catch {} }
  return null;
}
const pw = loadPlaywright();
if (!pw) { console.error('playwright not found: npm i playwright && npx playwright install chromium (in a scratch dir), then set PLAYWRIGHT_DIR=<that dir>/node_modules/playwright'); process.exit(2); }

const SIZES = [[1440, 900], [390, 844]];
const THEMES = ['light', 'dark'];
const fails = [];
let shots = 0;
mkdirSync(out, { recursive: true });

let browser;
try { browser = await pw.chromium.launch(); } catch (e) { console.error('chromium launch failed: ' + e.message); process.exit(2); }

for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const slides = await page.evaluate(() => window.deck ? window.deck.slides() : null);
  if (!slides) { fails.push(`FAIL js-error ${w} - window.deck missing`); await ctx.close(); continue; }
  if (slides.some((s) => s.mode === 'three') && !(await page.evaluate(() => !!window.THREE)))
    fails.push(`FAIL three-missing ${w} - a three slide exists but window.THREE is undefined`);
  for (const theme of THEMES) {
    await page.evaluate((t) => window.deck.setTheme(t), theme);
    for (const s of slides) {
      for (const sc of quick ? s.scenarios.slice(0, 1) : s.scenarios) {
        await page.evaluate(([i, sc]) => { window.deck.go(i); window.deck.setScenario(sc); }, [s.index, sc]);
        await page.waitForTimeout(150);
        const tag = `${w}-${theme} s${String(s.index + 1).padStart(2, '0')}:${sc}`;
        await page.screenshot({ path: join(out, `${w}-${theme}-${String(s.index + 1).padStart(2, '0')}-${sc}.png`) });
        shots++;
        for (const e of errs.splice(0)) fails.push(`FAIL js-error ${tag} ${e}`);
        const issues = await page.evaluate(() => {
          const r = [];
          const de = document.documentElement;
          if (de.scrollWidth > de.clientWidth + 1) r.push(['h-scroll', `scrollWidth ${de.scrollWidth} > ${de.clientWidth}`]);
          const layer = document.querySelector('.layer.active');
          const texts = layer ? [...layer.querySelectorAll('svg text')].filter((t) => t.getClientRects().length && t.textContent.trim()) : [];
          const box = (el) => el.getBoundingClientRect();
          for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
            const a = box(texts[i]), b = box(texts[j]);
            const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ix > 1 && iy > 1) r.push(['svg-text-overlap', `"${texts[i].textContent.trim()}" × "${texts[j].textContent.trim()}"`]);
          }
          for (const t of texts) {
            const g = t.parentElement;
            const rects = g ? [...g.children].filter((c) => c.matches('rect.node, rect.pill, polygon.node')) : [];
            if (rects.length !== 1) continue;
            const a = box(t), b = box(rects[0]);
            if (a.left < b.left - 2 || a.right > b.right + 2 || a.top < b.top - 2 || a.bottom > b.bottom + 2) r.push(['svg-text-outside', `"${t.textContent.trim()}"`]);
          }
          for (const c of document.querySelectorAll('.layer.active .card, .card')) {
            if (!c.getClientRects().length) continue;
            if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) r.push(['card-overflow', c.textContent.trim().slice(0, 40)]);
          }
          const tx = document.querySelector('.text');
          if (tx && tx.scrollWidth > tx.clientWidth + 1) r.push(['text-overflow', `scrollWidth ${tx.scrollWidth} > ${tx.clientWidth}`]);
          return r;
        });
        for (const [check, detail] of issues) fails.push(`FAIL ${check} ${tag} ${detail}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();
for (const f of [...new Set(fails)]) console.log(f);
if (fails.length) { console.log(`FAILED ${new Set(fails).size} issues, ${shots} shots → ${out}`); process.exit(1); }
console.log(`OK ${shots} shots → ${out}`);
```

Note on `card-overflow`: the template's `.card` must not set a fixed height (cards grow), so a real deck only trips this when a card is clipped by an explicit height or `overflow:hidden` — exactly the defect. Fixture `ok.html` fixes the card height but its content fits.

- [ ] **Step 5: Run, expect PASS** — same command as Step 3 → 9 tests pass. If `overlap`/`textout` false-positive on `ok.html`, widen the fixture node rects, not the tolerance.

- [ ] **Step 6: Commit**

```bash
git add plugins/interactive-deck/skills/interactive-deck/assets/verify_deck.mjs plugins/interactive-deck/tests
git commit -m "feat(interactive-deck): Playwright deck verifier with fixture tests"
```

---

### Task 2: Engine template (`deck-template.html`) + demo deck

**Files:**
- Create: `plugins/interactive-deck/skills/interactive-deck/assets/deck-template.html`
- Create: `plugins/interactive-deck/tests/template.test.mjs`

**Interfaces:**
- Consumes: Task 1 `run(file, extra)` from `tests/helpers.mjs`.
- Produces (documented in Task 3's `engine-api.md`): globals inside the DECK region — `const LANG = 'zh-TW' | 'en'`, `const SLIDES = [...]`, optional `function buildScene(stage)`; DOM `<div class="layer" data-slide="<id>">` blocks placed between `<!-- DECK:LAYERS:BEGIN -->` / `<!-- DECK:LAYERS:END -->`; script DECK region between `// ===== DECK:BEGIN =====` / `// ===== DECK:END =====`. Engine regions marked `ENGINE — do not edit`. Helpers available to DECK: `tbl(rows, head)`, `$(sel)`. `window.deck.slides()` returns `{index, id, chapter, mode, title, scenarios:[id]}`.

**Port map** (source line numbers refer to `source-deck.html`):

| Source | Template |
|---|---|
| `<style>` lines 1–200 (tokens, layout, svg vocabulary, cards, rail, media queries) | copy into ENGINE CSS; keep tokens; delete `.illus` only if unused by rules (keep — slide-rules uses it for `示意`) |
| `.deck` markup, `.text`, `.stage` with `#gl`, `.three-hud`, `.caption`, `.rail` | copy; the hard-coded layers are replaced by the DECK:LAYERS markers |
| hard-coded `PAGES`/`RUNS`/`FINDINGS`, the `station` object, per-id `if (s.id === ...)` branches in `applyScenario` | **drop** — replaced by `stage` API + `onScenario` |
| `tweenViewBox`, `ease`, `flyTo`/`loop`, `go`, `setScenario`, rail build, theme cycle, keyboard, swipe, `#sN` hash | copy, generalised as below |
| chrome strings (`上一頁`, `下一頁`, `主題：`, `互動`, `資料`, `舞台`) | move into `I18N[LANG]` |

- [ ] **Step 1: Write the failing test** — `tests/template.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { run } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TPL = join(here, '../skills/interactive-deck/assets/deck-template.html');

test('demo deck passes the verifier', () => { const r = run(TPL); assert.equal(r.code, 0, r.out); });
test('regions are fenced', () => {
  const s = readFileSync(TPL, 'utf8');
  for (const m of ['// ===== DECK:BEGIN =====', '// ===== DECK:END =====', '<!-- DECK:LAYERS:BEGIN -->', '<!-- DECK:LAYERS:END -->', 'ENGINE — do not edit'])
    assert.ok(s.includes(m), m);
});
test('offline: three.js blocked still renders without page errors', () => {
  const s = readFileSync(TPL, 'utf8').replace(/<script src="https:\/\/cdnjs[^"]+three[^"]+"><\/script>/, '');
  const f = join(mkdtempSync(join(tmpdir(), 'tpl-')), 'offline.html'); writeFileSync(f, s);
  const r = run(f, ['--quick']);
  assert.doesNotMatch(r.out, /FAIL js-error/, r.out);   // three-missing is expected and allowed here
});
```

- [ ] **Step 2: Run, expect FAIL** — `node --test tests/template.test.mjs` → file missing.

- [ ] **Step 3: Build the template.** ENGINE script (replaces the source's `station`/per-id logic):

```js
// ===== ENGINE — do not edit =====
const I18N = {
  'zh-TW': { prev: '← 上一頁', next: '下一頁 →', theme: '主題：', themes: { system: '系統', light: '淺色', dark: '深色' }, interact: '互動', data: '資料', stage: '舞台', nav: '章節導覽' },
  en: { prev: '← Prev', next: 'Next →', theme: 'Theme: ', themes: { system: 'System', light: 'Light', dark: 'Dark' }, interact: 'Interact', data: 'Data', stage: 'Stage', nav: 'Chapters' },
};
const tbl = (rows, head) => `<table>${head ? `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` : ''}${rows.map((r) => `<tr>${r.map((c) => `<td${typeof c === 'number' || /^[\d.]+ ?(s|ms|min|%)?$/.test(c) ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// stage: the 3D infrastructure handed to buildScene and to each slide's three(sc, stage)
function makeStage() {
  const themeCbs = [], sprites = [];
  const st = {
    THREE: window.THREE, scene: null, camera: null, renderer: null,
    get narrow() { return stageEl.clientWidth < 560; },
    color: (token) => new THREE.Color(css(token)),
    label(text, sub) { const sp = makeLabel(text, sub); sprites.push(sp); return sp; },
    flyTo, // (pos: Vector3, look: Vector3)
    focus(objs, hit) { // hit: Set of objects to emphasise; empty/undefined = none emphasised
      const base = st.color('--accent-tint'), acc = st.color('--accent'), soft = st.color('--soft');
      objs.forEach((m) => { m.material.color = !hit || !hit.size ? base : hit.has(m) ? acc : soft.clone().lerp(base, 0.6); });
    },
    onTheme(fn) { themeCbs.push(fn); },
    _repaint() { sprites.forEach((sp) => { const f = makeLabel(sp.userData.text, sp.userData.sub); sp.material.map.dispose(); sp.material.map = f.material.map; sp.material.needsUpdate = true; }); themeCbs.forEach((fn) => fn()); },
    _sprites: sprites,
  };
  return st;
}
```

Wiring rules (implement exactly):
- `initThree()` runs only if `window.THREE && typeof buildScene === 'function' && SLIDES.some(s => s.mode === 'three')`; it creates renderer/scene/camera/lights/grid as the source does, assigns them onto `stage`, then calls `buildScene(stage)`. Theme change → `stage._repaint()` + grid recolour.
- Otherwise the stage gets class `flat`, `#gl` is hidden, and `three(sc, stage)` hooks are skipped (Review Focus 1–2).
- `applyScenario(s)`: update `#dataBox` from `s.data(sc)`, chip `aria-pressed`, toggle `on`/`off` on `[data-s]` in the slide's layer, `tweenViewBox` if `s.svgFocus`, then `s.onScenario?.(sc, layer)`, then `if (stage.scene && s.three) s.three(sc, stage)`; `#hud` text = `s.hud?.(sc) ?? ''`, hidden when empty.
- Leaving a three slide hides all `stage._sprites` (`visible = s.mode === 'three'`).
- `window.deck.slides()` includes `mode`.
- Chrome strings come from `I18N[LANG] || I18N.en`.
- Remove the source's mobile `.layer svg { width: 760px }` hard width; use `min-width: 640px` so short SVGs are not stretched; keep `.layer { overflow: auto }` on narrow.
- `.card` has no fixed height.

DECK demo (fictional, `LANG = 'zh-TW'`), three slides:
1. `mode:'three'`, title `「三個服務中，搜尋服務的回應時間最長，是其他兩個的兩倍以上」` (long zh title on purpose — Review Focus 4), scenarios `all`, `search`, `cart`, `auth`; `buildScene` makes three bars (heights 420/180/150 ms, invented), `three` flies to the chosen bar with `stage.flyTo` and `stage.focus`; `hud` shows the value; data table marks values `<span class="illus">示意</span>`.
2. `mode:'svg'`, a 4-node request flow with `data-s` scenarios `ok`, `timeout`, `retry`, `svgFocus` per scenario, `pass`/`fail`/`warn` result node updated in `onScenario`.
3. `mode:'html'`, three `.card`s, **single scenario** `all` (Review Focus 3).

- [ ] **Step 4: Run, expect PASS** — `node --test tests/template.test.mjs`. Then Read the screenshots in the printed out dir: every slide in `1440-light`, `1440-dark`, `390-light`. Fix overlap, clipped labels, unreadable dark text, camera too close; re-run until clean and visually right.

- [ ] **Step 5: Commit**

```bash
git add plugins/interactive-deck/skills/interactive-deck/assets/deck-template.html plugins/interactive-deck/tests/template.test.mjs
git commit -m "feat(interactive-deck): single-file deck engine template with demo deck"
```

---

### Task 3: References (`slide-rules.md`, `engine-api.md`, `three-examples.md`)

**Files:**
- Create: `plugins/interactive-deck/skills/interactive-deck/references/slide-rules.md`
- Create: `plugins/interactive-deck/skills/interactive-deck/references/engine-api.md`
- Create: `plugins/interactive-deck/skills/interactive-deck/references/three-examples.md`
- Modify: `plugins/interactive-deck/tests/template.test.mjs` (examples test)

**Interfaces:**
- Consumes: Task 2 engine names exactly (`SLIDES`, `buildScene(stage)`, `stage.{THREE,scene,camera,narrow,color,label,flyTo,focus,onTheme}`, slide fields, `tbl`, `I18N`, region markers, `window.deck.*`).
- Produces: `three-examples.md` with three fenced ```js blocks, each preceded by a line `<!-- example:tiles -->`, `<!-- example:bars -->`, `<!-- example:building -->`, each a complete `buildScene` + matching `SLIDES` entry using invented data.

- [ ] **Step 1: Write the failing test** (append to `template.test.mjs`): for each example, splice its code into a copy of the template's DECK region (replace everything between the DECK markers with the example block plus `const LANG='en';`), write to tmp, `run(f, ['--quick'])`, assert exit 0.

```js
test('three-examples each build a passing deck', () => {
  const md = readFileSync(join(here, '../skills/interactive-deck/references/three-examples.md'), 'utf8');
  const tpl = readFileSync(TPL, 'utf8');
  for (const name of ['tiles', 'bars', 'building']) {
    const m = new RegExp(`<!-- example:${name} -->\\s*\`\`\`js\\n([\\s\\S]*?)\`\`\``).exec(md);
    assert.ok(m, `example ${name} missing`);
    const html = tpl.replace(/(\/\/ ===== DECK:BEGIN =====)[\s\S]*?(\/\/ ===== DECK:END =====)/, `$1\nconst LANG = 'en';\n${m[1]}\n$2`)
      .replace(/(<!-- DECK:LAYERS:BEGIN -->)[\s\S]*?(<!-- DECK:LAYERS:END -->)/, '$1$2');
    const f = join(mkdtempSync(join(tmpdir(), 'ex-')), `${name}.html`); writeFileSync(f, html);
    const r = run(f, ['--quick']); assert.equal(r.code, 0, `${name}\n${r.out}`);
  }
});
```

- [ ] **Step 2: Run, expect FAIL** (file missing).

- [ ] **Step 3: Write the three references.**
  - `slide-rules.md`: the six rules from spec §Slide rules, each with a one-line bad/good example (e.g. title `測試架構` ✗ → `CI 跑 mock 驗唯讀，本機跑真 backend 驗寫入` ✓); the per-slide declaration block (標題 / 舞台 / 互動 / 資料); the data rule (sourced or dropped or `<span class="illus">示意</span>`); the outline line format `NN · <conclusion> · stage: … · scenarios: a/b/c · data: <source>`.
  - `engine-api.md`: the slide-field table from the spec, `data-s` + `pass/fail/warn`, the `stage` API with signatures, `window.deck`, region markers, `I18N`, how to add a layer, what not to edit.
  - `three-examples.md`: `tiles` (grid of boxes, height = count, camera flies to a tile), `bars` (bars + target band, camera flies to a bar), `building` (stacked floors, each floor a scenario, focused floor lifts out 0.3 units and the camera orbits to it). Each one ≤ 60 lines, invented data, uses only `stage` API + `THREE`.

- [ ] **Step 4: Run, expect PASS**; Read one 1440-light screenshot per example.

- [ ] **Step 5: Commit**

```bash
git add plugins/interactive-deck/skills/interactive-deck/references plugins/interactive-deck/tests/template.test.mjs
git commit -m "docs(interactive-deck): slide rules, engine API, and 3D examples"
```

---

### Task 4: SKILL.md, manifest, marketplace, README

**Files:**
- Create: `plugins/interactive-deck/.claude-plugin/plugin.json`
- Create: `plugins/interactive-deck/skills/interactive-deck/SKILL.md`
- Modify: `.claude-plugin/marketplace.json` (append entry)
- Modify: `README.md` (add `### interactive-deck` section after `herdr-handoff`)

**Interfaces:**
- Consumes: file names from Tasks 1–3; verifier CLI and exit codes.
- Produces: skill name `interactive-deck`; plugin name `interactive-deck` (must equal the marketplace entry name).

- [ ] **Step 1: `plugin.json`**

```json
{
  "name": "interactive-deck",
  "description": "Single-file interactive HTML decks: one conclusion per slide, a live SVG/Three.js stage driven by scenario buttons, real data only, and a Playwright screenshot check before publishing.",
  "version": "1.0.0",
  "author": { "name": "kkeevin123456", "url": "https://github.com/kkeevin123456" },
  "license": "MIT"
}
```

- [ ] **Step 2: Marketplace entry**

```json
{
  "name": "interactive-deck",
  "displayName": "Interactive Deck",
  "description": "Single-file interactive HTML decks with a live SVG/Three.js stage, outline-first workflow, and Playwright layout verification.",
  "source": "./plugins/interactive-deck",
  "category": "documentation"
}
```

- [ ] **Step 3: SKILL.md** — frontmatter `name: interactive-deck`, `description:` starting "Use when the user asks for an interactive deck, slides, presentation or results walkthrough as a web page / HTML / artifact (互動簡報、投影片、簡報) — not a .pptx". Body (≤ 150 lines) with: the 5 workflow steps from the spec, each with its exact commands (copy template to scratchpad; `node <skill>/assets/verify_deck.mjs <deck> --out <scratch>/shots`; Playwright install fallback into scratchpad + `PLAYWRIGHT_DIR`); hard rules (outline approval gate; no invented numbers; edit only DECK regions; must Read screenshots, list which); publish rule D7 (Artifact tool with `icon: "slides"` when available; else print path); report format; pointers to the three references. Use `${CLAUDE_PLUGIN_ROOT}/skills/interactive-deck/assets/...` for paths.

- [ ] **Step 4: README section** — what it makes, the workflow in 5 lines, `window.deck` one-liner, how to run the verifier and its tests.

- [ ] **Step 5: Validate** — `python3 -c "import json;json.load(open('.claude-plugin/marketplace.json'));json.load(open('plugins/interactive-deck/.claude-plugin/plugin.json'))"`; grep public-safety: `grep -rniE '<internal hostnames|ticket prefixes|usernames>' plugins/interactive-deck docs` → no output.

- [ ] **Step 6: Commit**

```bash
git add plugins/interactive-deck .claude-plugin/marketplace.json README.md
git commit -m "feat(interactive-deck): skill, manifest, marketplace entry, README"
```

---

### Task 5: Pressure test with a fresh subagent

**Files:** none in the repo unless the test reveals a skill gap.

- [ ] **Step 1:** Install locally: add the plugin from the local marketplace path (`/plugin marketplace update kevin-claude-plugins` or point a fresh agent at the SKILL.md path directly).
- [ ] **Step 2:** Dispatch a fresh general-purpose subagent with only: "Read `<path>/SKILL.md` and follow it. Topic: a fictional team moved their nightly build from 52 min to 14 min by caching dependencies and sharding tests; numbers: before 52 min, after 14 min, cache hit rate 87 %, 6 shards. Stop after the outline and return it." Expect: an outline in the specified line format, no deck yet.
- [ ] **Step 3:** Continue the same subagent: "Outline approved. Build it, verify, and return the deck path and the verifier's last line. Do not publish." Expect: `OK … shots`, deck only edits DECK regions (diff against template outside markers is empty), numbers match the given ones, and the agent reports which screenshots it read.
- [ ] **Step 4:** Any deviation → fix the rule wording in SKILL.md/references, re-run Steps 2–3 with a new subagent. Commit fixes: `fix(interactive-deck): tighten skill after pressure test`.
- [ ] **Step 5:** Push `main` to origin (user-approved repo, personal marketplace).
