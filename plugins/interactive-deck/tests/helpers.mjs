import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
export const VERIFY = join(here, '../skills/interactive-deck/assets/verify_deck.mjs');

// Runs the verifier on a deck file and returns its exit code and combined output.
export function run(file, extra = []) {
  const out = mkdtempSync(join(tmpdir(), 'deck-'));
  const r = spawnSync(process.execPath, [VERIFY, file, '--out', out, ...extra], { encoding: 'utf8', timeout: 300000 });
  return { code: r.status, out: r.stdout + r.stderr, dir: out };
}
