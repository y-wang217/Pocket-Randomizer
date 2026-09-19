/**
 * The per-segment node count curve, and the guarantees that have to survive it.
 *
 * **Stage 4.8, item 3.** A segment used to be the same length at gym 8 as at gym
 * 1, so a run did not physically grow. `tuning.stepsPerSegment` is a table now,
 * one row per segment, and the whole risk of that change is in one sentence from
 * the prompt: *every 4.6a composition guarantee holds at every length.*
 *
 * ## Why this is its own file
 *
 * `test/generation.test.ts` checks the rules on segment 0 and
 * `test/locales.test.ts` checks them per route across a run, which between them
 * already cover the guarantees — at whatever lengths real seeds happen to draw.
 * That is the gap. A curve's *ends* are where a fix-up breaks, and a sweep over
 * real seeds only visits a length if the table offers it. So this file drives the
 * generator at **every length the curve can produce, and a few it cannot**, and
 * asserts the guarantees as functions of length rather than as the constants they
 * were written as.
 *
 * The rest floor is the one guarantee that became length-relative, and it is the
 * one this file exists for. The other two are absolute per segment — one wild
 * step, one event — and are asserted to *stay* absolute, because "scale it with
 * length" is the plausible wrong change.
 */
import { describe, expect, it } from 'vitest';

import { createRun, SEGMENTS_PER_RUN } from '../src/core/run';
import { DEFAULT_TUNING, restFloorFor, stepsRangeFor, type Tuning } from '../src/data/tuning';

const SEEDS = Array.from({ length: 24 }, (_unused, i) => `CURVE-${i}`);

/** A step that is exactly the wild-versus-trainer choice, in either order. */
function isBattleChoice(step: { options: readonly { kind: string }[] }): boolean {
  const kinds = step.options.map((option) => option.kind);
  return kinds.length === 2 && kinds.includes('wild') && kinds.includes('trainer');
}

/**
 * Where a route's battle pair starts, or null if it has none.
 *
 * Read off the finished route rather than off the generator, so it is the
 * player's view of the rule: two steps, next to each other, each offering a
 * fight either way. A route that happens to draw one such step is not a pair.
 */
function battlePairAt(route: { steps: readonly { options: readonly { kind: string }[] }[] }): number | null {
  for (let i = 0; i + 1 < route.steps.length; i++) {
    const first = route.steps[i];
    const second = route.steps[i + 1];
    if (first && second && isBattleChoice(first) && isBattleChoice(second)) return i;
  }
  return null;
}

/** Tuning whose every segment is exactly `steps` long. */
function atLength(steps: number): Tuning {
  return {
    ...DEFAULT_TUNING,
    stepsPerSegment: Array.from({ length: SEGMENTS_PER_RUN }, () => ({ min: steps, max: steps })),
  };
}

/** Every distinct length the shipped curve can draw, ascending. */
const CURVE_LENGTHS = [
  ...new Set(
    Array.from({ length: SEGMENTS_PER_RUN }, (_unused, segment) => {
      const { min, max } = stepsRangeFor(DEFAULT_TUNING, segment);
      return Array.from({ length: max - min + 1 }, (_u, i) => min + i);
    }).flat(),
  ),
].sort((a, b) => a - b);

// ---------------------------------------------------------------------------
// The curve itself
// ---------------------------------------------------------------------------

describe('the step curve', () => {
  it('has a row for every segment a run has', () => {
    expect(DEFAULT_TUNING.stepsPerSegment).toHaveLength(SEGMENTS_PER_RUN);
  });

  it('never gets shorter as the run goes on', () => {
    for (let segment = 1; segment < SEGMENTS_PER_RUN; segment++) {
      const before = stepsRangeFor(DEFAULT_TUNING, segment - 1);
      const now = stepsRangeFor(DEFAULT_TUNING, segment);
      expect(now.min, `segment ${segment} min fell`).toBeGreaterThanOrEqual(before.min);
      expect(now.max, `segment ${segment} max fell`).toBeGreaterThanOrEqual(before.max);
    }
  });

  it('actually grows, or the item did nothing', () => {
    const first = stepsRangeFor(DEFAULT_TUNING, 0);
    const last = stepsRangeFor(DEFAULT_TUNING, SEGMENTS_PER_RUN - 1);
    expect(last.min).toBeGreaterThan(first.min);
    expect(last.max).toBeGreaterThan(first.max);
  });

  it('leaves the opening segments where 4.6c measured them', () => {
    // So a benchmark move in the early rows means something other than item 3.
    expect(stepsRangeFor(DEFAULT_TUNING, 0)).toEqual({ min: 4, max: 5 });
    expect(stepsRangeFor(DEFAULT_TUNING, 1)).toEqual({ min: 4, max: 5 });
  });

  it('stays well short of the length Stage 1 measured as an attrition countdown', () => {
    /*
     * Six to eight was sized for Stage 1's single segment and eight of those was
     * rejected. The guard is on the run's total rather than on one row, because
     * that is the quantity that failed.
     */
    const meanSteps = Array.from({ length: SEGMENTS_PER_RUN }, (_unused, segment) => {
      const { min, max } = stepsRangeFor(DEFAULT_TUNING, segment);
      return (min + max) / 2;
    }).reduce((sum, n) => sum + n, 0);
    expect(meanSteps).toBeGreaterThan(36);
    expect(meanSteps, 'the run is approaching the length Stage 1 rejected').toBeLessThan(52);
  });

  it('clamps a segment index past the table rather than returning nothing', () => {
    const last = stepsRangeFor(DEFAULT_TUNING, SEGMENTS_PER_RUN - 1);
    expect(stepsRangeFor(DEFAULT_TUNING, SEGMENTS_PER_RUN)).toEqual(last);
    expect(stepsRangeFor(DEFAULT_TUNING, 999)).toEqual(last);
    expect(stepsRangeFor(DEFAULT_TUNING, -4)).toEqual(stepsRangeFor(DEFAULT_TUNING, 0));
  });
});

// ---------------------------------------------------------------------------
// The rest floor, which is the guarantee that became length-relative
// ---------------------------------------------------------------------------

describe('the rest floor', () => {
  /*
   * **The density half of this floor is deleted, 2026-09-19.**
   *
   * `restStepsPerGuarantee` guaranteed a second rest on any six-step route,
   * which is 100% of segments 5 and 6 — precisely the double rest
   * `kindCapPerRoute` now exists to make rare. A floor that mandates what a
   * ceiling forbids is not a tuning disagreement, so the density went and the
   * guarantee stayed. The two tests that pinned the density are replaced by
   * the one below that pins its absence; `generation.md` section 52.
   */
  it('is the guarantee, at every length, and nothing more', () => {
    for (let steps = 1; steps <= 12; steps++) {
      expect(restFloorFor(DEFAULT_TUNING, steps), `${steps} steps`).toBe(DEFAULT_TUNING.minRestSteps);
    }
  });

  it('never mandates what the cap forbids', () => {
    const cap = DEFAULT_TUNING.kindCapPerRoute.rest ?? Infinity;
    for (const steps of CURVE_LENGTHS) {
      expect(restFloorFor(DEFAULT_TUNING, steps), `${steps} steps`).toBeLessThanOrEqual(cap);
      // And strictly below it, which is what makes the second rest a thing the
      // route may offer rather than a thing it must.
      expect(restFloorFor(DEFAULT_TUNING, steps), `${steps} steps`).toBeLessThan(cap);
    }
  });

  it('never asks for more rests than the segment has steps', () => {
    // A floor above the step count would make `ensureKind` unsatisfiable, and the
    // symptom is a segment quietly shipping fewer rests than the rule claims.
    for (let steps = 1; steps <= 12; steps++) {
      expect(restFloorFor(DEFAULT_TUNING, steps), `${steps} steps`).toBeLessThanOrEqual(steps);
    }
  });

  it('never asks for a rest a segment has no legal step for', () => {
    /*
     * Rests may not appear before `restEarliestStep`, so the steps that can carry
     * one are fewer than the steps there are. A floor above *that* is the real
     * unsatisfiable case and the one a curve makes reachable.
     */
    for (const steps of CURVE_LENGTHS) {
      const legal = Math.max(0, steps - DEFAULT_TUNING.restEarliestStep);
      expect(restFloorFor(DEFAULT_TUNING, steps), `${steps} steps`).toBeLessThanOrEqual(legal);
    }
  });
});

// ---------------------------------------------------------------------------
// Every guarantee, at every length
// ---------------------------------------------------------------------------

describe('the 4.6a composition guarantees hold at every length in the curve', () => {
  for (const steps of CURVE_LENGTHS) {
    it(`holds at ${steps} steps a segment`, () => {
      const tuning = atLength(steps);
      for (const seed of SEEDS) {
        for (const segment of createRun(seed, tuning).segments) {
          for (const route of segment.routes) {
            const where = `${seed} s${segment.index} ${route.locale} @${steps}`;
            expect(route.steps, where).toHaveLength(steps);

            // One reachable wild encounter: every option on its step is wild, so
            // it is taken whatever the player picks.
            const unavoidableWild = route.steps.filter((step) =>
              step.options.every((option) => option.kind === 'wild'),
            );
            expect(unavoidableWild.length, `${where} wild steps`).toBe(
              tuning.wildStepsPerSegment,
            );

            const offering = (kind: string): number =>
              route.steps.filter((step) => step.options.some((option) => option.kind === kind)).length;

            expect(offering('event'), `${where} events`).toBeGreaterThanOrEqual(
              tuning.minEventSteps,
            );
            /*
             * **The rest floor, which a battle pair trades down.**
             *
             * `restFloorFor` is a guarantee (`minRestSteps`) and a density
             * target taken together. A route carrying the final segment's
             * battle pair has four of its steps claimed before the rest pass
             * runs, so the density target and the pair compete for the same
             * steps; `enforceComposition` resolves that in the pair's favour
             * and drops the route to the guarantee. Asserted here as the two
             * separate rules they are, because a single number would hide
             * which one a regression broke.
             */
            expect(offering('rest'), `${where} rests`).toBeGreaterThanOrEqual(
              battlePairAt(route) === null ? restFloorFor(tuning, steps) : tuning.minRestSteps,
            );
            // And the guarantee holds on every route, paired or not. There is
            // no route anywhere in the curve with nowhere to heal.
            expect(offering('rest'), `${where} rest guarantee`).toBeGreaterThanOrEqual(
              tuning.minRestSteps,
            );

            // Still never before the earliest step, at any length.
            route.steps.forEach((step, index) => {
              if (index >= tuning.restEarliestStep) return;
              expect(
                step.options.some((option) => option.kind === 'rest'),
                `${where} rest at step ${index}`,
              ).toBe(false);
            });

            // The gym is still the end, and still not an option on a step.
            expect(
              route.steps.some((step) => step.options.some((option) => option.kind === 'gym')),
              `${where} gym offered as a step`,
            ).toBe(false);
          }
        }
      }
    });
  }

  it('keeps the wild step absolute rather than scaling it with length', () => {
    // The plausible wrong change. One guaranteed wild encounter per segment is a
    // per-segment fact: it is the capture the segment owes the player, not a rate.
    for (const steps of CURVE_LENGTHS) {
      const tuning = atLength(steps);
      for (const seed of SEEDS.slice(0, 8)) {
        for (const segment of createRun(seed, tuning).segments) {
          for (const route of segment.routes) {
            const unavoidable = route.steps.filter((step) =>
              step.options.every((option) => option.kind === 'wild'),
            );
            expect(unavoidable.length, `${seed} @${steps}`).toBe(1);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The curve as the player meets it
// ---------------------------------------------------------------------------

describe('a real run down the shipped curve', () => {
  it('gives later segments more steps than earlier ones, on every seed', () => {
    for (const seed of SEEDS) {
      const run = createRun(seed);
      for (const segment of run.segments) {
        const range = stepsRangeFor(DEFAULT_TUNING, segment.index);
        for (const route of segment.routes) {
          expect(route.steps.length, `${seed} s${segment.index}`).toBeGreaterThanOrEqual(range.min);
          expect(route.steps.length).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });

  it('draws a length per route rather than one per segment', () => {
    /*
     * Each locale's route is keyed separately, so two routes in one segment may
     * differ in length. Asserted because the opposite — one length shared by a
     * segment's routes — would mean the step draw had moved off the route key,
     * and the road through the Cave would depend on what was offered beside it.
     */
    const lengths = new Set<string>();
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        if (segment.routes.length < 2) continue;
        lengths.add(segment.routes.map((route) => route.steps.length).join('/'));
      }
    }
    expect([...lengths].some((pattern) => new Set(pattern.split('/')).size > 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The battle pair
// ---------------------------------------------------------------------------

/**
 * Two consecutive steps in the final segment, each a wild-versus-trainer
 * choice, on every route of every seed.
 *
 * The rule is a floor on *pressure* rather than on variety, which is what makes
 * it the only guarantee in `enforceComposition` that cares where its steps are:
 * two fights separated by a rest is not the thing being guaranteed. So the
 * assertions below are about adjacency, about the kinds on the two steps, and
 * about the segments that must *not* have one — a pair that leaked into segment
 * 3 would be a run whose back half arrived early.
 */
describe('the final segment carries a battle pair', () => {
  it('places two adjacent wild-or-trainer steps in the covered segment, on every route', () => {
    const from = DEFAULT_TUNING.battlePairFromSegment;
    expect(from, 'the knob is set; this whole block is about the segment it names').not.toBeNull();
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        if (from === null || segment.index < from) continue;
        for (const route of segment.routes) {
          const at = battlePairAt(route);
          expect(at, `${seed} s${segment.index} ${route.locale}`).not.toBeNull();
        }
      }
    }
  });

  it('offers a fight either way across the pair, and nothing else', () => {
    const from = DEFAULT_TUNING.battlePairFromSegment ?? SEGMENTS_PER_RUN;
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        if (segment.index < from) continue;
        for (const route of segment.routes) {
          const at = battlePairAt(route);
          if (at === null) throw new Error(`${seed} s${segment.index} ${route.locale}: no pair`);
          for (const step of [route.steps[at], route.steps[at + 1]]) {
            const kinds = (step?.options ?? []).map((option) => option.kind).sort();
            // Not "contains no rest": the whole option set, so a third option
            // of any kind fails here rather than being argued about later.
            expect(kinds, `${seed} s${segment.index} ${route.locale}`).toEqual(['trainer', 'wild']);
          }
        }
      }
    }
  });

  it('puts the wild on either side of the choice rather than always first', () => {
    /*
     * The orientation is drawn, so over 24 seeds both arrangements appear. A
     * fixed order would be a decision the player could stop reading after the
     * first run — the same reason `distinctKindsPerStep` exists.
     */
    const from = DEFAULT_TUNING.battlePairFromSegment ?? SEGMENTS_PER_RUN;
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        if (segment.index < from) continue;
        for (const route of segment.routes) {
          const at = battlePairAt(route);
          if (at === null) continue;
          for (const step of [route.steps[at], route.steps[at + 1]]) {
            seen.add((step?.options ?? []).map((option) => option.kind).join('>'));
          }
        }
      }
    }
    expect(seen).toEqual(new Set(['wild>trainer', 'trainer>wild']));
  });

  it('leaves every earlier segment alone', () => {
    /*
     * A pair *can* occur by draw anywhere — two steps that both happen to roll
     * wild and trainer is a legal roll — so this is not "no earlier segment has
     * one". It is that they are rare rather than universal, which is what
     * distinguishes a guarantee from a coincidence: if the rule had leaked, the
     * covered fraction below would be 1.
     */
    const from = DEFAULT_TUNING.battlePairFromSegment ?? SEGMENTS_PER_RUN;
    let routes = 0;
    let paired = 0;
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        if (segment.index >= from) continue;
        for (const route of segment.routes) {
          routes++;
          if (battlePairAt(route) !== null) paired++;
        }
      }
    }
    expect(routes).toBeGreaterThan(100);
    expect(paired / routes, 'earlier segments are not guaranteed a pair').toBeLessThan(0.5);
  });
});
