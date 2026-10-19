# 3D examples

Three complete DECK regions that show how to write `buildScene(stage)` and a slide's
`three(sc, stage)`. They are **reference code, not components**: copy the pattern, then shape
the objects to what your slide has to show (spheres, a map, a pipeline, a rack…).

Each block is self-contained (LANG is added by the caller) and uses invented data. The test
suite splices each one into the template and runs the verifier on it, so they stay working.

Patterns all three share:

- Build every object once in `buildScene`; keep references in a module-level object
  (`ex.tiles`, `ex.bars`, `ex.floors`) so `three()` can find them.
- `three(sc, stage)` does two things only: `stage.focus(objects, hitSet)` and
  `stage.flyTo(cameraPos, lookAt)`. Use `stage.narrow` to pull the camera back on phones.
- Labels come from `stage.label(text, sub)` so they repaint on theme change.
- Anything coloured from a token outside `focus()` re-applies its colour in `stage.onTheme`.

## Tile grid — one tile per item, height = a count

<!-- example:tiles -->
```js
const ITEMS = [['Home', 4], ['Search', 6], ['Cart', 5], ['Profile', 7], ['Orders', 3], ['Help', 2], ['Admin', 4], ['Login', 1]];
const ex = { tiles: [] };
const tileH = (n) => 0.5 + n * 0.5;
const tilePos = (i) => [-5.4 + (i % 4) * 3.6, i < 4 ? -2.3 : 2.3];

function buildScene(stage) {
  ITEMS.forEach(([name, n], i) => {
    const [x, z] = tilePos(i), h = tileH(n);
    const m = new stage.THREE.Mesh(new stage.THREE.BoxGeometry(2.5, h, 2.5), new stage.THREE.MeshStandardMaterial({ roughness: 0.55 }));
    m.position.set(x, h / 2, z);
    stage.scene.add(m);
    ex.tiles.push(m);
    const lb = stage.label(name, String(n));
    lb.position.set(x, h + 0.85, z);
    stage.scene.add(lb);
  });
}

const SLIDES = [{
  id: 'tiles', chapter: 'Coverage', mode: 'three',
  title: 'Every page has tests; Profile has the most',
  lede: 'Tile height is the number of tests on that page.', caption: 'Stage: one tile per page',
  hint: 'Pick a page → <b>the camera moves to its tile</b>',
  scenarios: [{ id: 'all', label: 'All' }].concat(ITEMS.map(([n]) => ({ id: n.toLowerCase(), label: n }))),
  data: () => tbl(ITEMS, ['Page', 'Tests']),
  three: (sc, stage) => {
    const V = stage.THREE.Vector3;
    const i = ITEMS.findIndex(([n]) => n.toLowerCase() === sc);
    if (i < 0) { stage.focus(ex.tiles); stage.flyTo(new V(0, stage.narrow ? 22 : 14, stage.narrow ? 26 : 17), new V(0, 0.6, 0)); return; }
    const [x, z] = tilePos(i), h = tileH(ITEMS[i][1]);
    stage.focus(ex.tiles, new Set([ex.tiles[i]]));
    stage.flyTo(new V(x * 0.5, h + (stage.narrow ? 13 : 10), z + (stage.narrow ? 19 : 15)), new V(x, h * 0.4, z));
  },
}];
```

## Bar chart with a target band

<!-- example:bars -->
```js
const RUNS = [['Before', 420], ['Partial fix', 510], ['After', 90]];
const SEC_PER_UNIT = 50;
const ex = { bars: [], band: null };

function buildScene(stage) {
  const { THREE, scene } = stage;
  RUNS.forEach(([name, secs], i) => {
    const h = secs / SEC_PER_UNIT;
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 2.4), new THREE.MeshStandardMaterial({ roughness: 0.5 }));
    m.position.set((i - 1) * 3.5, h / 2, 0);
    scene.add(m);
    ex.bars.push(m);
    const lb = stage.label(`${secs} s`, name);
    lb.position.set(m.position.x, h + 0.9, 0);
    scene.add(lb);
  });
  // Target band 60–90 s: a translucent slab coloured from --accent, re-coloured on theme change.
  ex.band = new THREE.Mesh(new THREE.BoxGeometry(11.5, 30 / SEC_PER_UNIT, 3.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }));
  ex.band.position.set(0, 75 / SEC_PER_UNIT, 0);
  scene.add(ex.band);
  const paintBand = () => { ex.band.material.color = stage.color('--accent'); };
  paintBand();
  stage.onTheme(paintBand);
}

const SLIDES = [{
  id: 'speed', chapter: 'Speed', mode: 'three',
  title: 'Caching dependencies cut the suite from 7 minutes to 1.5',
  lede: 'Bar height is wall-clock time; the blue band is the 60–90 s target.', caption: 'Stage: one bar per run',
  hint: 'Pick a run → <b>the camera moves to its bar</b>',
  scenarios: RUNS.map(([n], i) => ({ id: 'r' + i, label: n })),
  data: (sc) => tbl(RUNS.map(([n, s], i) => [sc === 'r' + i ? `<b>${n}</b>` : n, `${s} s`]), ['Run', 'Time']),
  hud: (sc) => { const [n, s] = RUNS[+sc.slice(1)]; return `${n} · ${s} s`; },
  three: (sc, stage) => {
    const V = stage.THREE.Vector3, i = +sc.slice(1), b = ex.bars[i];
    stage.focus(ex.bars, new Set([b]));
    stage.flyTo(new V(b.position.x * 0.5, 8, stage.narrow ? 32 : 24), new V(b.position.x * 0.25, 5, 0));
  },
}];
```

## Building — stacked floors, the focused floor slides out

<!-- example:building -->
```js
const FLOORS = [['Lobby', 'Badge readers'], ['Floor 2', 'Open office'], ['Floor 3', 'Labs'], ['Floor 4', 'Server room'], ['Roof', 'Antennas']];
const FLOOR_H = 1.2;
const ex = { floors: [] };

function buildScene(stage) {
  const { THREE, scene } = stage;
  FLOORS.forEach(([name, what], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, FLOOR_H - 0.12, 4), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    m.position.set(0, i * FLOOR_H + FLOOR_H / 2, 0);
    scene.add(m);
    ex.floors.push(m);
    const lb = stage.label(name, what);
    lb.scale.set(2.6, 0.8, 1);
    lb.position.set(5.4, i * FLOOR_H + FLOOR_H / 2, 0);
    scene.add(lb);
  });
}

const SLIDES = [{
  id: 'building', chapter: 'Site', mode: 'three',
  title: 'Only the server room on floor 4 needs the stricter door policy',
  lede: 'Each floor is one zone. The focused floor slides out so you can see it.', caption: 'Stage: the building, one block per floor',
  hint: 'Pick a floor → <b>it slides out</b> and the camera turns to face it',
  scenarios: [{ id: 'all', label: 'All' }].concat(FLOORS.map(([n], i) => ({ id: 'f' + i, label: n }))),
  data: (sc) => tbl(FLOORS.map(([n, w], i) => [sc === 'f' + i ? `<b>${n}</b>` : n, w]), ['Floor', 'Contains']),
  three: (sc, stage) => {
    const V = stage.THREE.Vector3, i = sc === 'all' ? -1 : +sc.slice(1);
    ex.floors.forEach((m, j) => { m.position.z = j === i ? 1.2 : 0; });
    stage.focus(ex.floors, i < 0 ? undefined : new Set([ex.floors[i]]));
    const y = i < 0 ? FLOORS.length * FLOOR_H / 2 : i * FLOOR_H + FLOOR_H / 2;
    const a = i < 0 ? 0.6 : 0.25 + i * 0.12;
    const d = stage.narrow ? 22 : 15;
    stage.flyTo(new V(Math.sin(a) * d, y + 4, Math.cos(a) * d), new V(1.5, y, 0));
  },
}];
```
