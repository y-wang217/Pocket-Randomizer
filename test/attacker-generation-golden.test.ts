/**
 * Attacker generation, frozen before Defender Mode v0 touched `src/`.
 *
 * ## What it is for
 *
 * The defender prompt (`docs/spec/gymrun-defender-mode-v0-fun-test.md`) says
 * attacker mode must still run and asks for proof that "its generation is
 * unchanged apart from version and hash fields". `test/sim-fixture.test.ts`
 * cannot carry that alone: it covers three played runs, the nodes they
 * visited and nothing else, and its header stamps all four version axes, so
 * the bumps this branch makes force a re-mint of it anyway.
 *
 * This file is the other half. It hashes the **whole** generated map —
 * `starterOptions` and every segment, every route including the ones nobody
 * walks, every team, sim seed, offer, shop, event and acquisition — for 200
 * seeds under `DEFAULT_TUNING`, and it carries no version field at all. So it
 * is minted once, before the first change to `src/` on the branch, and it is
 * **never** re-minted on that branch. A defender change that moves a single
 * attacker draw, including through a shared data table, turns it red.
 *
 * ## Minting it
 *
 *   GYMRUN_WRITE_ATTACKER_GOLDEN=1 npx vitest run test/attacker-generation-golden.test.ts
 *
 * Only on a branch whose purpose is to change attacker generation, with the
 * axis that covers that change moving in the same commit.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRun } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';

const FIXTURE = join(process.cwd(), 'test', 'fixtures', 'attacker-generation-golden.json');
const SEED_COUNT = 200;
const SEED_PREFIX = 'ATTACKER-GOLDEN-';

function mapHash(seed: string): string {
  const run = createRun(seed, DEFAULT_TUNING);
  const json = JSON.stringify({ starterOptions: run.starterOptions, segments: run.segments });
  return createHash('sha256').update(json).digest('hex');
}

describe('attacker generation is frozen', () => {
  it(`hashes ${SEED_COUNT} whole maps identically to the pre-defender mint`, () => {
    const hashes: Record<string, string> = {};
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = `${SEED_PREFIX}${i}`;
      hashes[seed] = mapHash(seed);
    }
    if (process.env.GYMRUN_WRITE_ATTACKER_GOLDEN) {
      writeFileSync(FIXTURE, `${JSON.stringify({ seedPrefix: SEED_PREFIX, seedCount: SEED_COUNT, hashes }, null, 2)}\n`);
      return;
    }
    const frozen = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { hashes: Record<string, string> };
    const moved = Object.keys(frozen.hashes).filter((seed) => frozen.hashes[seed] !== hashes[seed]);
    expect(moved, `attacker maps moved for ${moved.length} seeds, first ${moved[0] ?? ''}`).toEqual([]);
    expect(Object.keys(hashes)).toEqual(Object.keys(frozen.hashes));
  });
});
