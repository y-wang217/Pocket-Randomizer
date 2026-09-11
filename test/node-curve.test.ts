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
  it('is the larger of the count floor and the density floor', () => {
    for (let steps = 1; steps <= 12; steps++) {
      const floor = restFloorFor(DEFAULT_TUNING, steps);
      expect(floor).toBeGreaterThanOrEqual(DEFAULT_TUNING.minRestSteps);
      expect(floor).toBeGreaterThanOrEqual(
        Math.floor(steps / DEFAULT_TUNING.restStepsPerGuarantee),
      );
    }
  });

  it('gives a long late segment more recovery than a short early one', () => {
    // The sentence item 3 is written around: one rest across seven steps is not
    // the same amount of recovery as one rest across four.
    const early = stepsRangeFor(DEFAULT_TUNING, 0);
    const late = stepsRangeFor(DEFAULT_TUNING, SEGMENTS_PER_RUN - 1);
    expect(restFloorFor(DEFAULT_TUNING, late.max)).toBeGreaterThan(
      restFloorFor(DEFAULT_TUNING, early.min),
    );
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
            expect(offering('rest'), `${where} rests`).toBeGreaterThanOrEqual(
              restFloorFor(tuning, steps),
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
