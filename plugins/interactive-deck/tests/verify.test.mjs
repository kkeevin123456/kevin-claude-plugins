import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { run, VERIFY } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (n) => join(here, 'fixtures', n + '.html');

test('clean deck passes', () => {
  const r = run(fx('ok'));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^OK 8 shots/m);
});

for (const [name, check] of [
  ['jserror', 'js-error'], ['hscroll', 'h-scroll'], ['overlap', 'svg-text-overlap'],
  ['textout', 'svg-text-outside'], ['cardoverflow', 'card-overflow'], ['nothree', 'three-missing'],
]) {
  test(`${name} fails with ${check}`, () => {
    const r = run(fx(name));
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`^FAIL ${check} `, 'm'));
  });
}

test('--quick shoots first scenario only', () => {
  const r = run(fx('ok'), ['--quick']);
  assert.match(r.out, /^OK 4 shots/m);
});

test('missing file exits 2', () => {
  const r = run('/nonexistent.html');
  assert.equal(r.code, 2);
});

test('runs without --out (writes to ./deck-shots)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'noout-'));
  const r = spawnSync(process.execPath, [VERIFY, fx('ok'), '--quick'], { cwd, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(cwd, 'deck-shots')));
});

test('a failed network load is a warning, not a failure', () => {
  const r = run(fx('neterror'), ['--quick']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^WARN net-error /m);
  assert.doesNotMatch(r.out, /FAIL js-error/);
});
