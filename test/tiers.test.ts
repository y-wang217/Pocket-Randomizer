/**
 * Difficulty tiers: the three properties that have to hold before a reward pool
 * can be keyed off one.
 *
 *   1. Determinism — the same seed assigns the same tiers, twice.
 *   2. Stream isolation — tiers are drawn from `map`, so draining any other
 *      stream cannot move them, and drawing them cannot move anything else.
 *   3. Monotonicity — elite is stronger than hard is stronger than normal, in
 *      the metric `data/scaling.ts` defines and by a margin worth the risk.
 *
 * Three is the interesting one, and it is a *population* test rather than an
 * example. A single pair of encounters says nothing: a normal node can roll a
 * Snorlax and an elite node a Magikarp on the very next seed, because the tier
 * moves the window a species is drawn from and not the species. What has to be
 * monotonic is the distribution, which is what a player experiences over a run
 * and what the balance simulator measures.
 */
import { describe, expect, it } from 'vitest';

import { MAX_MOVE_BAND } from '../src/data/moveOverrides';

import { isBattleKind } from '../src/core/economy';
import { generateSegment, generateStarterOptions, nodesOf,
  routeStepsOf,
} from '../src/core/encounters';
import { generateTrainerTeam, generateWildTeam } from '../src/core/randomizer';
import { createRng, RNG_STREAMS } from '../src/core/rng';
import { createRun } from '../src/core/run';
import type { Tier } from '../src/core/types';
import {
  encounterPower,
  MAX_SPECIES_BAND,
  moveBandsFor,
  SEGMENT_COUNT,
  speciesBandsFor,
  TIER_MODIFIERS,
} from '../src/data/scaling';
import { TIER_INFO } from '../src/data/tierInfo';
import { DEFAULT_TUNING, tierWeightsFor, withTuning } from '../src/data/tuning';

const TIERS: readonly Tier[] = ['normal', 'hard', 'elite'];

/** Every tier assigned by a seed's whole map, node by node, in generation order. */
function tiersOf(seed: string, tuning = DEFAULT_TUNING): (Tier | null)[] {
  const state = createRun(seed, tuning);
  return state.segments.flatMap((segment) => nodesOf(segment).map((node) => node.tier));
}

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------

describe('tier determinism', () => {
  it('assigns the same tiers to the same seed, twice', () => {
    expect(tiersOf('TIER-SAME')).toEqual(tiersOf('TIER-SAME'));
  });

  it('assigns different tiers to different seeds', () => {
    // Not a strong property on its own — two seeds could agree by chance — but
    // a build that assigned tiers from something other than the stream would
    // fail it every time.
    expect(tiersOf('TIER-A')).not.toEqual(tiersOf('TIER-B'));
  });

  it('is a pure function of the stream, not of call order', () => {
    // A module-level counter or a pool filtered in place would fail here and
    // nowhere else: the same seed, generated after unrelated work.
    const first = tiersOf('TIER-PURE');
    tiersOf('TIER-NOISE');
    createRun('TIER-MORE-NOISE');
    expect(tiersOf('TIER-PURE')).toEqual(first);
  });

  it('draws every tier before the player decides anything', () => {
    // Eager, like the rest of the map. A tier drawn at node entry would depend
    // on the path taken and the seed would stop fixing the run.
    for (const segment of createRun('TIER-EAGER').segments) {
      for (const node of nodesOf(segment)) {
        if (!isBattleKind(node.kind) || node.kind === 'gym') expect(node.tier).toBeNull();
        else expect(TIERS).toContain(node.tier);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Stream isolation, in both directions
// ---------------------------------------------------------------------------

describe('tier stream isolation', () => {
  it('keeps tier assignment on the map stream and nowhere else', () => {
    // Drain every other stream to exhaustion-ish and the tiers must not move.
    // This is the assertion that a tier draw accidentally taken from
    // `randomizer` would fail — and taking it from `randomizer` is the
    // plausible mistake, because that is where the encounter it scales is
    // rolled.
    const baseline = tiersOf('TIER-ISOLATE');

    for (const drained of RNG_STREAMS) {
      if (drained === 'map') continue;
      const state = createRun('TIER-ISOLATE');
      const noisy = createRng('TIER-ISOLATE');
      for (let i = 0; i < 5_000; i++) noisy[drained].nextUint32();
      expect(
        state.segments.flatMap((segment) => nodesOf(segment).map((node) => node.tier)),
        `draining ${drained} moved the tiers`,
      ).toEqual(baseline);
    }
  });

  it('lets the tier weights be retuned without reshaping a single map', () => {
    /*
     * The other direction, and the one that matters for the next balance pass.
     *
     * A tier draw costs one `map` value per fight, and how many fights a step
     * has is decided *before* tiers are drawn. So moving `tierBands` — the knob
     * a tuning pass will reach for first — must change which tier each node
     * carries and change nothing else about the map: same segment lengths, same
     * option counts, same node kinds, same rest placement.
     *
     * The version that fails this is the one that drew tiers before the rest
     * fix-up, or that skipped the draw for a tier locked to weight zero. Both
     * would leave every recorded seed with a different *shape* after a change
     * that was supposed to be about risk appetite.
     */
    const shapeOf = (tuning: typeof DEFAULT_TUNING): unknown =>
      createRun('TIER-RETUNE', tuning).segments.map((segment) => ({
        steps: routeStepsOf(segment).map((step) => step.options.map((option) => `${option.id}:${option.kind}`)),
      }));

    const shipped = shapeOf(DEFAULT_TUNING);
    const eliteHeavy = shapeOf(
      withTuning({ tierBands: [{ throughSegment: 7, weights: { normal: 1, hard: 1, elite: 8 } }] }),
    );
    const noElite = shapeOf(
      withTuning({ tierBands: [{ throughSegment: 7, weights: { normal: 1, hard: 1, elite: 0 } }] }),
    );

    expect(eliteHeavy).toEqual(shipped);
    expect(noElite).toEqual(shipped);
    // ...and the tiers themselves genuinely moved, or the assertions above pass
    // because nothing was wired up at all.
    expect(
      tiersOf('TIER-RETUNE', withTuning({ tierBands: [{ throughSegment: 7, weights: { normal: 1, hard: 1, elite: 8 } }] })),
    ).not.toEqual(tiersOf('TIER-RETUNE'));
  });

  it('keeps every reward draw on the rewards stream and nowhere else', () => {
    /*
     * The Stage 3 half of the same invariant, asserted by moving the one knob
     * that changes how many reward draws a map takes.
     *
     * `allowSpeciesRewards` adds a whole reward kind to the elite pools, and
     * resolving a species entry rolls a species, an ability and four moves. If
     * any of that came off `randomizer` — which is where a species is *normally*
     * rolled, and therefore the plausible mistake — flipping the flag would
     * shift every encounter in the map. The map and battle streams must not
     * move either.
     */
    const positions = (tuning: typeof DEFAULT_TUNING): Record<string, number> => {
      const rng = createRng('TIER-REWARDS');
      generateStarterOptions(rng, tuning);
      for (let index = 0; index < SEGMENT_COUNT; index++) generateSegment(index, rng, tuning);
      // `totalDraws` rather than `draws`: since Stage 4.6a every draw here
      // lands on a keyed sub-stream, so the unkeyed counter reads zero on all
      // four and the three "did not move" assertions below would pass for the
      // wrong reason.
      return {
        map: rng.map.totalDraws,
        randomizer: rng.randomizer.totalDraws,
        battle: rng.battle.totalDraws,
        rewards: rng.rewards.totalDraws,
      };
    };

    /*
     * The lever is `shopStockSize`, and it changed in Stage 4.6b.
     *
     * It was `allowSpeciesRewards`, which added a whole reward kind — and the
     * species entry resolved a species, an ability and four moves, which is
     * exactly where a stray `randomizer` draw would have shown up. That flag is
     * deleted with the kind, so the knob is now the shelf: a bigger shop draws
     * more from `rewards` and must move nothing else.
     *
     * Both sides are named explicitly rather than one leaning on the default,
     * which is the lesson the old comment here recorded: `off` used to be
     * `DEFAULT_TUNING` and silently stopped testing anything the day the
     * default changed.
     */
    const off = positions(withTuning({ shopStockSize: { min: 2, max: 2 } }));
    const on = positions(withTuning({ shopStockSize: { min: 6, max: 6 } }));

    expect(on.map).toBe(off.map);
    expect(on.randomizer).toBe(off.randomizer);
    expect(on.battle).toBe(off.battle);
    // ...and the flag genuinely did something, or the three above pass because
    // nothing changed at all.
    expect(on.rewards).toBeGreaterThan(off.rewards!);
    expect(off.rewards).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Monotonic scaling
// ---------------------------------------------------------------------------

describe('tier scaling is monotonic', () => {
  /**
   * Mean encounter power for one tier at one segment, over many seeds.
   *
   * Each seed gets a fresh `Rng` per tier, so the three tiers are compared from
   * the same stream position and the difference between them is the tier and
   * nothing else.
   */
  function meanPower(segment: number, tier: Tier, kind: 'wild' | 'trainer', seeds = 250): number {
    let total = 0;
    for (let seed = 0; seed < seeds; seed++) {
      const rng = createRng(`POWER-${segment}-${seed}`);
      const team = kind === 'wild' ? generateWildTeam(segment, tier, rng.randomizer) : generateTrainerTeam(segment, tier, rng.randomizer);
      total += encounterPower(team);
    }
    return total / seeds;
  }

  it('orders normal < hard < elite at every segment, for both battle kinds', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      for (const kind of ['wild', 'trainer'] as const) {
        const [normal, hard, elite] = TIERS.map((tier) => meanPower(segment, tier, kind));
        const where = `segment ${segment} ${kind}`;
        expect(hard, `${where}: hard is not above normal`).toBeGreaterThan(normal!);
        expect(elite, `${where}: elite is not above hard`).toBeGreaterThan(hard!);
      }
    }
  });

  it('makes the gradient large enough to be worth a reward for', () => {
    // A tier that is 2% harder is not a risk, it is a rounding error, and no
    // reward pool can be tuned against it. The floor is deliberately low —
    // the *shape* is what this asserts; how steep it should be is what the
    // simulator decides in docs/balance.md.
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const normal = meanPower(segment, 'normal', 'wild');
      const elite = meanPower(segment, 'elite', 'wild');
      expect(elite / normal, `segment ${segment} elite is barely above normal`).toBeGreaterThan(1.15);
    }
  });

  it('never asks a pool for a band that does not exist', () => {
    // The failure this catches is a crash rather than a wrong number: at
    // segment 7 an un-clamped elite band shift asks for species band 6, the
    // filtered pool comes back empty, and `stream.pick` throws in the middle of
    // generating a map. Asserted on the windows directly, so it fails at the
    // cause rather than at a random seed that happened to reach it.
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      for (const tier of TIERS) {
        for (const band of speciesBandsFor(segment, tier)) {
          expect(band, `segment ${segment} ${tier} species band`).toBeGreaterThanOrEqual(0);
          expect(band, `segment ${segment} ${tier} species band`).toBeLessThanOrEqual(MAX_SPECIES_BAND);
        }
        for (const band of moveBandsFor(segment, tier)) {
          expect(band, `segment ${segment} ${tier} move band`).toBeGreaterThanOrEqual(0);
          expect(band, `segment ${segment} ${tier} move band`).toBeLessThanOrEqual(MAX_MOVE_BAND);
        }
      }
    }
  });

  it('keeps the band window as wide as the segment asked for, where there is room', () => {
    // Clamping alone would collapse segment 7's elite window onto band 4 — the
    // eighteen strongest species in the game — and every elite fight in the last
    // segment would start to look like the same fight. The widen-back-down rule
    // is what prevents that, and this is the assertion that it fires.
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const width = speciesBandsFor(segment, 'normal').length;
      for (const tier of TIERS) {
        expect(speciesBandsFor(segment, tier).length, `segment ${segment} ${tier}`).toBe(width);
      }
    }
  });

  it('spends the tier budget on different axes for hard and elite', () => {
    // The design claim written down as a test, because it is the thing a future
    // balance pass is most likely to undo by accident. `elite` fields more
    // Pokemon and pays for them with levels; if it ever exceeds `hard` on every
    // axis at once, the report can no longer attribute a change to an axis.
    expect(TIER_MODIFIERS.elite.team).toBeGreaterThan(TIER_MODIFIERS.hard.team);
    expect(TIER_MODIFIERS.elite.level).toBeLessThan(TIER_MODIFIERS.hard.level);
    expect(TIER_MODIFIERS.normal).toEqual({ level: 0, speciesBand: 0, moveBand: 0, team: 0 });
    // hard is a stat check, elite is a damage check plus a body. Different axes.
    expect(TIER_MODIFIERS.hard.moveBand).toBe(0);
    expect(TIER_MODIFIERS.elite.moveBand).toBeGreaterThan(TIER_MODIFIERS.hard.moveBand);
  });
});

// ---------------------------------------------------------------------------
// The tuning knobs behave as documented
// ---------------------------------------------------------------------------

describe('tier tuning', () => {
  it('reads the band row that covers the segment', () => {
    expect(tierWeightsFor(DEFAULT_TUNING, 0).elite).toBe(0);
    expect(tierWeightsFor(DEFAULT_TUNING, 1).elite).toBe(0);
    expect(tierWeightsFor(DEFAULT_TUNING, 2).elite).toBeGreaterThan(0);
    expect(tierWeightsFor(DEFAULT_TUNING, 7).elite).toBeGreaterThan(
      tierWeightsFor(DEFAULT_TUNING, 2).elite,
    );
  });

  it('falls back to the last row rather than throwing past the last segment', () => {
    // `SEGMENT_COUNT` is one number away from being nine. A run that crashed on
    // generation because the tier table was not extended with it would be a
    // worse failure than one that reused the back-half weights.
    expect(() => tierWeightsFor(DEFAULT_TUNING, SEGMENT_COUNT + 5)).not.toThrow();
  });

  it('drops the spread rule when the tuning says to, and only then', () => {
    // The comparison the simulator needs: independent per-node draws, so a
    // sweep can ask whether the spread is doing any work. With it off, some
    // step somewhere must repeat a tier — otherwise the flag is not wired.
    const flat = withTuning({ distinctTiersPerStep: false });
    let repeats = 0;
    for (let seed = 0; seed < 60; seed++) {
      for (const segment of createRun(`SPREAD-OFF-${seed}`, flat).segments) {
        for (const step of routeStepsOf(segment)) {
          const tiers = step.options.map((option) => option.tier).filter((tier) => tier !== null);
          if (tiers.length > 1 && new Set(tiers).size < tiers.length) repeats++;
        }
      }
    }
    expect(repeats).toBeGreaterThan(0);
  });
});

/**
 * The three lines the map shows for a tier.
 *
 * A missing entry renders as `undefined` on the node card, which is the most
 * important pixel in the game and the one place a silent gap is least
 * affordable — so the coverage is asserted rather than trusted to a
 * `Record<Tier, string>` that a later tier could be added around.
 *
 * The second test is the Part 4 rule at its narrowest point. These three lines
 * are the only copy in the game that describes options the player is actively
 * choosing between, which makes them the copy most likely to slide back into a
 * verdict — as `elite` did, reading "The best rewards in the game" from Stage 3
 * until Release 0.5. The vocabulary check over `src/ui` in
 * `test/boundaries.test.ts` is the general net; this is the specific one.
 */
describe('tier copy', () => {
  const TIERS: readonly Tier[] = ['normal', 'hard', 'elite'];

  it('covers every tier', () => {
    for (const tier of TIERS) {
      expect(TIER_INFO[tier], `no TIER_INFO entry for ${tier}`).toBeTruthy();
    }
    expect(Object.keys(TIER_INFO).sort()).toEqual([...TIERS].sort());
  });

  it('states attributes and never a verdict', () => {
    const verdict = /\b(best|better|worse|worst|strongest|weakest|superior|inferior|optimal|ideal|modest|recommend\w*)\b/i;
    for (const tier of TIERS) {
      expect(TIER_INFO[tier], `${tier} reads as a verdict`).not.toMatch(verdict);
    }
  });

  /*
   * Parallel shape, asserted rather than left to the next editor's eye.
   *
   * The whole repair was that three lines in three different grammars let one
   * of them editorialise without looking out of place. Two sentences each, the
   * second naming the reward band, is the shape that makes a superlative
   * visibly not belong.
   */
  it('keeps all three lines in one shape', () => {
    for (const tier of TIERS) {
      const line = TIER_INFO[tier] ?? '';
      expect(line, `${tier} does not open by naming the encounter`).toMatch(/^(One|Two) Pokemon,/);
      expect(line, `${tier} does not state the reward band`).toMatch(/Pays a move .*band/);
    }
  });
});
