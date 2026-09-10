/**
 * The visual identity stages change pixels and nothing else, and this is the
 * check that says so.
 *
 * `docs/visual/baseline/` was recorded from `main` before Stage V0 began
 * (`scripts/visual/baseline.ts`). Every seeded run in it is replayed here,
 * headless, and compared byte for byte: the decision log, the outcome, every
 * visit, every casualty, the determinism seed's battle protocol, and a digest
 * of every file under `src/data/`. A presentation change cannot move any of
 * these. If one does, the change was not presentation.
 *
 * Deliberately not a snapshot the test can update. The baseline is written by
 * one script, on purpose, from a known commit; a test that rewrote it on
 * failure would be a test that passes by definition.
 */
import { describe, expect, it } from 'vitest';

import { buildBaseline, diffBaseline, readBaseline } from '../scripts/visual/baseline';

describe('the visual baseline', () => {
  it('is present', () => {
    const recorded = readBaseline();
    expect(recorded, 'run `npx vite-node scripts/visual/baseline.ts --write` on main first').not.toBeNull();
    expect(Object.keys(recorded?.files ?? {}).length).toBeGreaterThan(3);
  });

  it('is byte identical to a fresh recording', async () => {
    const recorded = readBaseline();
    if (!recorded) throw new Error('no baseline');
    const fresh = await buildBaseline();
    expect(diffBaseline(recorded, fresh)).toEqual([]);
  }, 120_000);
});
