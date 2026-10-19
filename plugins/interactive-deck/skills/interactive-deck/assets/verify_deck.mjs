#!/usr/bin/env node
// Drives window.deck through every slide × scenario × theme × width, screenshots each state,
// and fails on layout defects. Exit 0 clean, 1 defects, 2 cannot run (bad arguments or no Playwright).
// A resource that fails to load (CDN or fonts offline) is a WARN line, not a failure.
//
// Usage: node verify_deck.mjs <deck.html> [--out <dir>] [--quick]
//   --quick  only the first scenario of each slide
// Playwright is resolved from $PLAYWRIGHT_DIR (path to node_modules/playwright), then the
// current directory, then this script's directory.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const file = args.find((a, i) => !a.startsWith('--') && !(outIdx >= 0 && i === outIdx + 1));
const out = resolve(outIdx >= 0 ? args[outIdx + 1] : 'deck-shots');
const quick = args.includes('--quick');
if (!file || !existsSync(file)) {
  console.error('usage: verify_deck.mjs <deck.html> [--out dir] [--quick]');
  process.exit(2);
}

function loadPlaywright() {
  const bases = [
    process.env.PLAYWRIGHT_DIR && dirname(process.env.PLAYWRIGHT_DIR),
    process.cwd(),
    dirname(fileURLToPath(import.meta.url)),
  ].filter(Boolean);
  for (const b of bases) {
    try { return createRequire(join(b, 'x.js'))('playwright'); } catch { /* try next */ }
  }
  return null;
}
const pw = loadPlaywright();
if (!pw) {
  console.error('playwright not found. In a scratch dir: npm i playwright && npx playwright install chromium,'
    + ' then set PLAYWRIGHT_DIR=<that dir>/node_modules/playwright');
  process.exit(2);
}

const SIZES = [[1440, 900], [390, 844]];
const THEMES = ['light', 'dark'];
const fails = [];
const warns = new Set();
let shots = 0;
mkdirSync(out, { recursive: true });

let browser;
try { browser = await pw.chromium.launch(); } catch (e) {
  console.error('chromium launch failed: ' + e.message);
  process.exit(2);
}

// Runs in the page: returns [[check, detail], ...] for the current state.
function inspect() {
  const r = [];
  const box = (el) => el.getBoundingClientRect();
  const label = (el) => `"${el.textContent.trim().slice(0, 40)}"`;
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) r.push(['h-scroll', `scrollWidth ${de.scrollWidth} > ${de.clientWidth}`]);

  const layer = document.querySelector('.layer.active');
  const texts = layer
    ? [...layer.querySelectorAll('svg text')].filter((t) => t.getClientRects().length && t.textContent.trim())
    : [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = box(texts[i]), b = box(texts[j]);
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 1 && iy > 1) r.push(['svg-text-overlap', `${label(texts[i])} × ${label(texts[j])}`]);
    }
  }
  for (const t of texts) {
    const g = t.parentElement;
    const shapes = g ? [...g.children].filter((c) => c.matches('rect.node, rect.pill, polygon.node, circle.node')) : [];
    if (shapes.length !== 1) continue;
    const a = box(t), b = box(shapes[0]);
    if (a.left < b.left - 2 || a.right > b.right + 2 || a.top < b.top - 2 || a.bottom > b.bottom + 2) {
      r.push(['svg-text-outside', label(t)]);
    }
  }
  for (const c of document.querySelectorAll('.card')) {
    if (!c.getClientRects().length) continue;
    if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) r.push(['card-overflow', label(c)]);
  }
  const tx = document.querySelector('.text');
  if (tx && tx.scrollWidth > tx.clientWidth + 1) r.push(['text-overflow', `scrollWidth ${tx.scrollWidth} > ${tx.clientWidth}`]);
  return r;
}

for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/^Failed to load resource/.test(m.text())) warns.add(`WARN net-error ${w} - ${m.text()} ${m.location().url || ''}`.trim());
    else errs.push(m.text());
  });
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const slides = await page.evaluate(() => (window.deck ? window.deck.slides() : null));
  if (!slides) {
    fails.push(`FAIL js-error ${w} - window.deck missing ${errs.join(' | ')}`);
    await ctx.close();
    continue;
  }
  if (slides.some((s) => s.mode === 'three') && !(await page.evaluate(() => !!window.THREE))) {
    fails.push(`FAIL three-missing ${w} - a three slide exists but window.THREE is undefined`);
  }
  for (const theme of THEMES) {
    await page.evaluate((t) => window.deck.setTheme(t), theme);
    for (const s of slides) {
      for (const sc of quick ? s.scenarios.slice(0, 1) : s.scenarios) {
        await page.evaluate(([i, id]) => { window.deck.go(i); window.deck.setScenario(id); }, [s.index, sc]);
        await page.waitForTimeout(150);
        const nn = String(s.index + 1).padStart(2, '0');
        const tag = `${w}-${theme} s${nn}:${sc}`;
        await page.screenshot({ path: join(out, `${w}-${theme}-${nn}-${sc}.png`), fullPage: true });
        shots++;
        for (const e of errs.splice(0)) fails.push(`FAIL js-error ${tag} ${e}`);
        for (const [check, detail] of await page.evaluate(inspect)) fails.push(`FAIL ${check} ${tag} ${detail}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();

for (const wl of warns) console.log(wl);
const unique = [...new Set(fails)];
for (const f of unique) console.log(f);
if (unique.length) {
  console.log(`FAILED ${unique.length} issues, ${shots} shots → ${out}`);
  process.exit(1);
}
console.log(`OK ${shots} shots → ${out}`);
