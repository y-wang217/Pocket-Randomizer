/**
 * A relic cannot be lost.
 *
 * The design's strongest claim, and the one most likely to stop being true by
 * accident: a later stage adds a "lose an item" event, or a release path
 * starts clearing run fields, and nothing notices because relics are only
 * read in one place.
 *
 * So this is asserted two ways. The first is over the source: nothing outside
 * the one place that grants a relic ever writes `relics`. That catches the
 * whole class rather than the paths that exist today. The second plays real
 * runs and checks the held set only ever grows.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { applyRelicPassives } from '../src/core/relics';
import { RELIC_IDS } from '../src/data/relics';
import { DEFAULT_TUNING } from '../src/data/tuning';

const ROOT = new URL('..', import.meta.url).pathname;

/** Comments stripped, so prose about relics is not read as code that writes them. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('nothing writes the held set except the one grant', () => {
  it('has exactly one assignment to relics in src/', () => {
    /*
     * Two legitimate writes: `createRun` starts it empty, and `applyReward`
     * appends on a relic card. Anything else — a discard, a swap, a faint, a
     * release, an event outcome — writing this field is the bug this test
     * exists for, and the grep is crude on purpose because a targeted test
     * would only cover the paths someone thought of.
     */
    const writes = [
      ...new Set(
        walk(join(ROOT, 'src'))
          .filter((file) => /relics:\s*\[/.test(stripComments(readFileSync(file, 'utf8'))))
          .map((file) => relative(ROOT, file)),
      ),
    ];
    expect(writes.sort()).toEqual(['src/core/rewards.ts', 'src/core/run.ts']);
  });

  it('never filters, splices, pops or shifts the held set', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter((file) => /\brelics\s*\.\s*(filter|splice|pop|shift|slice)\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});

describe('across a real run', () => {
  /** Takes a relic whenever one is offered, and buys whatever it can. */
  function relicGreedy(): RunPolicy {
    return {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseNode: async (options) => {
        const elite = options.findIndex((option) => option.tier === 'elite');
        return elite === -1 ? 0 : elite;
      },
      chooseReward: async (offer) => {
        const relic = offer.options.findIndex((option) => option.kind === 'relic');
        return relic === -1 ? 0 : relic;
      },
    };
  }

  it('never shrinks, and never holds a duplicate', async () => {
    const seeds = ['PERM-1', 'PERM-2', 'PERM-3', 'PERM-4', 'PERM-5', 'PERM-6'];
    let everHeld = 0;

    for (const seed of seeds) {
      const seen: string[][] = [];
      await playRun(seed, relicGreedy(), DEFAULT_TUNING, {
        onState: (state) => seen.push([...state.relics]),
      });

      for (const [index, held] of seen.entries()) {
        expect(new Set(held).size, `${seed} holds a duplicate`).toBe(held.length);
        for (const id of held) expect(RELIC_IDS).toContain(id);
        const previous = seen[index - 1];
        if (previous) {
          // Monotonic: everything held a moment ago is still held.
          for (const id of previous) expect(held, `${seed} lost ${id}`).toContain(id);
        }
      }
      everHeld = Math.max(everHeld, seen.at(-1)?.length ?? 0);
    }

    expect(everHeld, 'no seed ever acquired a relic, so this asserted nothing').toBeGreaterThan(0);
  }, 120_000);
});

describe('backpack capacity', () => {
  it('is untouched by relics except through an explicit backpackSlots passive', () => {
    const pureCapability = RELIC_IDS.filter((id) => applyRelicPassives([id]).backpackSlots === 0);
    expect(pureCapability.length).toBeGreaterThan(0);
    expect(applyRelicPassives(pureCapability).backpackSlots).toBe(0);

    // And the one that does grant slots grants exactly what it says.
    expect(applyRelicPassives(['ironbound-gauntlet']).backpackSlots).toBe(1);
  });
});
