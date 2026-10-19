import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { run } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TPL = join(here, '../skills/interactive-deck/assets/deck-template.html');
const tmpFile = (name, html) => { const f = join(mkdtempSync(join(tmpdir(), 'tpl-')), name); writeFileSync(f, html); return f; };

test('demo deck passes the verifier', () => {
  const r = run(TPL);
  assert.equal(r.code, 0, r.out);
});

test('regions are fenced', () => {
  const s = readFileSync(TPL, 'utf8');
  for (const m of ['// ===== DECK:BEGIN =====', '// ===== DECK:END =====', '<!-- DECK:LAYERS:BEGIN -->', '<!-- DECK:LAYERS:END -->', 'ENGINE — do not edit']) {
    assert.ok(s.includes(m), m);
  }
});

test('offline: three.js blocked still renders without page errors', () => {
  const s = readFileSync(TPL, 'utf8').replace(/<script src="https:\/\/cdnjs[^"]+three[^"]+"><\/script>/, '');
  const r = run(tmpFile('offline.html', s), ['--quick']);
  assert.doesNotMatch(r.out, /FAIL js-error/, r.out); // three-missing is expected here
  assert.match(r.out, /FAIL three-missing/, r.out);   // proves the CDN tag was actually removed
});

test('deck with no three slides needs no buildScene and reports no three-missing', () => {
  const s = readFileSync(TPL, 'utf8')
    .replace(/(\/\/ ===== DECK:BEGIN =====)[\s\S]*?(\/\/ ===== DECK:END =====)/,
      `$1\nconst LANG = 'en';\nconst SLIDES = [{ id: 'only', chapter: 'One', mode: 'html', title: 'A single html slide works alone',
        lede: 'No 3D anywhere.', caption: 'cards', hint: 'nothing to switch', scenarios: [{ id: 'all', label: 'All' }],
        data: () => tbl([['a', 1]]) }];\n$2`)
    .replace(/(<!-- DECK:LAYERS:BEGIN -->)[\s\S]*?(<!-- DECK:LAYERS:END -->)/,
      '$1<div class="layer" data-slide="only"><div class="cards"><div class="card"><div class="v">ok</div></div></div></div>$2');
  const r = run(tmpFile('nothree.html', s));
  assert.equal(r.code, 0, r.out);
});

test('three-examples each build a passing deck', () => {
  const md = readFileSync(join(here, '../skills/interactive-deck/references/three-examples.md'), 'utf8');
  const tpl = readFileSync(TPL, 'utf8');
  for (const name of ['tiles', 'bars', 'building']) {
    const m = new RegExp(`<!-- example:${name} -->\\s*\`\`\`js\\n([\\s\\S]*?)\`\`\``).exec(md);
    assert.ok(m, `example ${name} missing`);
    const html = tpl
      .replace(/(\/\/ ===== DECK:BEGIN =====)[\s\S]*?(\/\/ ===== DECK:END =====)/, (_, a, b) => `${a}\nconst LANG = 'en';\n${m[1]}\n${b}`)
      .replace(/(<!-- DECK:LAYERS:BEGIN -->)[\s\S]*?(<!-- DECK:LAYERS:END -->)/, '$1$2');
    const r = run(tmpFile(`${name}.html`, html), ['--quick']);
    assert.equal(r.code, 0, `${name}\n${r.out}`);
  }
});
