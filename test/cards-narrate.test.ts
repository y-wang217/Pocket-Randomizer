/**
 * `npm run cards:narrate` speaks every rule of the grace and friendly fire
 * patch (`docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A7):
 * grace and Fast on each enemy's starting step, a Blast's friendly fire, a
 * play the faint left unplayed, and the scenario's grade total.
 *
 * The friendly fire log is a random-bot battle (seed FF646, bot seed
 * FFBOT646) saved at `cards-0.4.0`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { newLog } from '../src/core/cards/log';

const narrate = (file: string): string =>
  execFileSync(process.execPath, ['node_modules/vite-node/vite-node.mjs', 'scripts/cards-narrate.ts', '--', file], { encoding: 'utf8' });

describe('cards:narrate', () => {
  it('narrates grace, friendly fire, the unplayed card and the grade total', () => {
    const out = narrate('test/fixtures/card-battle-friendly-fire-log.json');
    expect(out).toContain('encounter skirmish (grade 5)');
    for (const id of ['e0', 'e1', 'e2']) expect(out).toContain(`grace: ${id} starts on a setup step`);
    expect(out).toContain('C Sword dasher takes 2 from Artillery (friendly fire): HP -2');
    expect(out).toContain('C Sword dasher has fainted: c14 Attack is not played');
    expect(out).toContain('encounter skirmish  grade 5');
  }, 60_000);

  it('narrates a Fast enemy starting on its attack step', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cards-narrate-'));
    const file = join(dir, 'pack.json');
    writeFileSync(file, JSON.stringify({ ...newLog('PACK1', 'the-pack', 'puppeteer'), actions: [{ type: 'start' }, { type: 'commit' }] }));
    const out = narrate(file);
    for (const id of ['e0', 'e1', 'e2']) expect(out).toContain(`${id} Hound is Fast: starts on an attack step`);
    expect(out).toContain('grace: e3 starts on a setup step');
    expect(out).toContain('encounter the-pack (grade 6)');
  }, 60_000);
});
