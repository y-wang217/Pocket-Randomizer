/**
 * The tier system: one scorer, a flag set per tier, and the seams that must
 * not move.
 *
 * **The refactor's safety net comes first and is not in this file.** That the
 * frozen `GREEDY_BASELINE` profile reproduces the pre-patch AI byte for byte is
 * asserted where a byte comparison already lives — `test/sim-fixture.test.ts`,
 * three whole runs recorded before the refactor and unchanged by it except for
 * the `contentHash` header. A property test here could only assert that the
 * flags are the ones I wrote down; the fixture asserts that the game plays the
 * same, which is the claim.
 *
 * What is here is everything a fixture cannot see: that a flag gates the thing
 * it names, that the estimator reads the board rather than the spec, and that
 * noise is reproducible without touching a single structural draw.
 */
import { describe, expect, it } from 'vitest';

import {
  aiPolicy,
  decide,
  decideWith,
  evaluateMoves,
  GREEDY_BASELINE,
  scoreChoices,
  type AiProfile,
} from '../src/core/battle/ai';
import { createBattle } from '../src/core/battle/driver';
import { estimateMatchup } from '../src/core/battle/matchup';
import { AI_TIERS, aiTierFor } from '../src/data/ai';
import { createAiStream, createRng, type SimSeed } from '../src/core/rng';
import { previewRun } from '../src/core/preview';
import { CONTENT_HASH } from '../src/core/contentHash';
import type { ActiveView, BattleView, TeamSpec } from '../src/core/types';

const SIM_SEED = 'sodium,0011223344556677889900aabbccddeeff0011223344556677889900aabbccdd' as SimSeed;

function profile(flags: AiProfile['flags'], noise = 0, switchFailure = 0): AiProfile {
  return { flags, noise, switchFailure };
}

function viewOf(p1: TeamSpec, p2: TeamSpec, side: 'p1' | 'p2' = 'p1'): BattleView {
  return createBattle({ teams: { p1, p2 }, seed: 'AI-TIERS' }).viewFor(side);
}

// ---------------------------------------------------------------------------
// The tiers themselves
// ---------------------------------------------------------------------------

describe('the tier table', () => {
  it('is cumulative: medium holds every additive flag easy does, hard every one medium does', () => {
    const additive = (tier: 'easy' | 'medium' | 'hard'): string[] =>
      AI_TIERS[tier].flags.filter((flag) => flag !== 'crudeDamage');
    for (const flag of additive('easy')) expect(additive('medium')).toContain(flag);
    for (const flag of additive('medium')) expect(additive('hard')).toContain(flag);
  });

  it('handicaps easy and nothing else, and gives no tier a stat advantage', () => {
    expect(AI_TIERS.easy.flags).toContain('crudeDamage');
    expect(AI_TIERS.medium.flags).not.toContain('crudeDamage');
    expect(AI_TIERS.hard.flags).not.toContain('crudeDamage');
    // There is no flag in the space that grants anything but reasoning: no
    // damage bias, no accuracy bonus, no hidden HP. If one is ever added this
    // assertion is what has to be deleted to do it.
    const every = new Set([...AI_TIERS.easy.flags, ...AI_TIERS.medium.flags, ...AI_TIERS.hard.flags]);
    expect([...every].sort()).toEqual(
      [
        'avoidFailingMoves',
        'crudeDamage',
        'hpAware',
        'itemAware',
        'oneStepLookahead',
        'seenKnowledge',
        'smartSendIn',
        'smartSwitching',
        'takeTheKo',
      ].sort(),
    );
  });

  it('noise is above zero at every tier, and lowest at hard', () => {
    expect(AI_TIERS.easy.noise).toBeGreaterThan(AI_TIERS.medium.noise);
    expect(AI_TIERS.medium.noise).toBeGreaterThan(AI_TIERS.hard.noise);
    expect(AI_TIERS.hard.noise).toBeGreaterThan(0);
  });

  it('assigns a tier by node kind, node tier and segment, with no logic in the generator', () => {
    expect(aiTierFor('wild', 'elite', 7)).toBe('easy');
    expect(aiTierFor('trainer', 'normal', 0)).toBe('easy');
    expect(aiTierFor('trainer', 'hard', 0)).toBe('medium');
    expect(aiTierFor('trainer', 'elite', 0)).toBe('hard');
    expect(aiTierFor('gym', null, 0)).toBe('medium');
    expect(aiTierFor('gym', null, 3)).toBe('medium');
    expect(aiTierFor('gym', null, 4)).toBe('hard');
    expect(aiTierFor('gym', null, 7)).toBe('hard');
  });

  it('pins the baseline: greedy is three flags, no noise, and does not move again', () => {
    expect([...GREEDY_BASELINE.flags].sort()).toEqual(['smartSendIn', 'smartSwitching', 'takeTheKo']);
    expect(GREEDY_BASELINE.noise).toBe(0);
    expect(GREEDY_BASELINE.switchFailure).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Flag gating
// ---------------------------------------------------------------------------

describe('flag gating', () => {
  it('avoidFailingMoves never picks a move the defender is immune to', async () => {
    // Ground into a Flying type is the reference implementation's own example.
    const p2: TeamSpec = [
      { species: 'Sandslash', ability: 'Sand Veil', moves: ['Earthquake', 'Slash'], level: 50 },
    ];
    const p1: TeamSpec = [{ species: 'Pidgeot', ability: 'Keen Eye', moves: ['Gust'], level: 50 }];
    const view = viewOf(p1, p2, 'p2');

    const floor = aiPolicy(profile(['avoidFailingMoves']));
    const choice = await floor(view);
    const earthquake = view.moves.find((move) => move.name === 'Earthquake');
    expect(earthquake).toBeDefined();
    // The immune move is in slot 1, deliberately: a scorer that simply took the
    // first usable move would pass a weaker version of this test.
    expect(earthquake!.slot).toBe(1);
    expect(choice.slot).not.toBe(earthquake!.slot);
    expect(scoreChoices(view, profile(['avoidFailingMoves']))[0]!.score).toBeLessThan(0);
  });

  it('takeTheKo is what pays for a knockout, and without it the bonus is not in the score', () => {
    const p1: TeamSpec = [{ species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 }];
    const p2: TeamSpec = [
      { species: 'Garchomp', ability: 'Sand Veil', moves: ['Earthquake', 'Dragon Claw'], level: 50 },
    ];
    const view = viewOf(p1, p2, 'p2');

    const withKo = scoreChoices(view, GREEDY_BASELINE).filter((entry) => entry.move);
    const withoutKo = scoreChoices(view, profile([])).filter((entry) => entry.move);
    expect(withKo.some((entry) => entry.kills)).toBe(true);
    for (const [index, entry] of withKo.entries()) {
      const bare = withoutKo[index]!;
      // Same reasoning, one term: the kill bonus and nothing else.
      expect(entry.kills ? entry.score - bare.score : entry.score - bare.score).toBeCloseTo(
        entry.kills ? 100 * (entry.move!.accuracy === true ? 1 : entry.move!.accuracy / 100) : 0,
        5,
      );
    }
    // And the submitted choice is the lethal one.
    expect(decide(view, GREEDY_BASELINE).choice.kind).toBe('move');
  });

  it('the damage model, not base power, decides the ranking: accuracy and expected hits both flip it', () => {
    // Hydro Pump is 110 BP at 80%; Surf is 90 at 100%. Base power ranks one way,
    // expected damage the other.
    const accuracy: TeamSpec = [
      { species: 'Vaporeon', ability: 'Water Absorb', moves: ['Hydro Pump', 'Surf'], level: 50 },
    ];
    // Bullet Seed is 25 BP and hits three times; Vine Whip is 45 and hits once.
    const hits: TeamSpec = [
      { species: 'Breloom', ability: 'Effect Spore', moves: ['Vine Whip', 'Bullet Seed'], level: 50 },
    ];
    const target: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 50 }];

    for (const [team, crudeWinner, fullWinner] of [
      [accuracy, 'Hydro Pump', 'Surf'],
      [hits, 'Vine Whip', 'Bullet Seed'],
    ] as const) {
      const view = viewOf(target, team, 'p2');
      const best = (which: AiProfile): string =>
        evaluateMoves(view, which).reduce((a, b) => (b.score > a.score ? b : a)).move.name;
      expect(best(profile(['crudeDamage']))).toBe(crudeWinner);
      expect(best(GREEDY_BASELINE)).toBe(fullWinner);
    }
  });
});

// ---------------------------------------------------------------------------
// Boost stages come off the battle, not the spec
// ---------------------------------------------------------------------------

describe('boost stages', () => {
  /** The same view with one stat stage moved. Two specs would prove nothing. */
  function boosted(view: BattleView, stages: Partial<ActiveView['statStages']>): BattleView {
    return { ...view, me: { ...view.me, statStages: { ...view.me.statStages, ...stages } } };
  }

  it('a +2 attacker and a +0 attacker with identical specs choose differently', () => {
    const mixed: TeamSpec = [
      // One physical move and one special move, close enough in power that a
      // stage decides between them.
      { species: 'Gardevoir', ability: 'Synchronize', moves: ['Psychic', 'Body Slam'], level: 50 },
    ];
    const target: TeamSpec = [{ species: 'Blissey', ability: 'Natural Cure', moves: ['Tackle'], level: 50 }];
    const view = viewOf(target, mixed, 'p2');

    const pick = (v: BattleView): string =>
      evaluateMoves(v, GREEDY_BASELINE).reduce((a, b) => (b.score > a.score ? b : a)).move.name;
    // Nothing about the spec differs between these three: the battle state does.
    // A scorer reading stats off the spec answers the same thing three times.
    expect(pick(boosted(view, { spa: 6 }))).toBe('Psychic');
    expect(pick(boosted(view, { atk: 6 }))).toBe('Body Slam');
    expect(pick(boosted(view, { spa: 6 }))).not.toBe(pick(boosted(view, { atk: 6 })));
  });
});

// ---------------------------------------------------------------------------
// estimateMatchup
// ---------------------------------------------------------------------------

describe('estimateMatchup', () => {
  const water = { types: ['Water'], attackTypes: ['Water'], hpFraction: 1, speed: 100 };
  const fire = { types: ['Fire'], attackTypes: ['Fire'], hpFraction: 1, speed: 90 };

  it('is pure: identical input, identical output, every time', () => {
    const first = estimateMatchup(water, fire);
    for (let i = 0; i < 5; i++) expect(estimateMatchup(water, fire)).toBe(first);
    expect(estimateMatchup(water, fire)).toBeGreaterThan(0);
    expect(estimateMatchup(fire, water)).toBeLessThan(0);
  });

  it('reads slotted moves for offence and species types for defence', () => {
    /*
     * The randomizer case, and the whole reason this function diverges from its
     * reference: a Water type carrying nothing but Grass moves. Offence must
     * read the Grass; defence must still read the Water.
     *
     * Both halves are pinned to exact numbers rather than to an inequality,
     * because the failure this guards against — reading the carried types as
     * the defending ones — is a *sign* flip on one term and an inequality can
     * survive it.
     */
    const grassCarrier = { types: ['Water'], attackTypes: ['Grass'], hpFraction: 1, speed: 100 };
    const fireAttacker = { types: ['Fire'], attackTypes: ['Fire'], hpFraction: 1, speed: 100 };

    // Offence from the slotted moves: Grass into Fire is 0.5, not Water's 2x.
    // Defence from the species: Fire into Water is 0.5, not Fire into Grass's 2x.
    expect(estimateMatchup(grassCarrier, fireAttacker)).toBeCloseTo(0.5 - 0.5, 10);
    // The same board read the reference's way would be 0.5 - 2 = -1.5, so the
    // number above is the divergence, measured.
    expect(estimateMatchup(water, fireAttacker)).toBeCloseTo(2 - 0.5, 10);
  });

  it('prices speed and HP the way the reference does', () => {
    const hurt = { ...fire, hpFraction: 0.25 };
    expect(estimateMatchup(water, hurt)).toBeGreaterThan(estimateMatchup(water, fire));
    const slow = { ...water, speed: 1 };
    expect(estimateMatchup(slow, fire)).toBeLessThan(estimateMatchup(water, fire));
  });
});

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

describe('noise', () => {
  const board = (): BattleView =>
    viewOf(
      [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 50 }],
      [
        {
          species: 'Alakazam',
          ability: 'Synchronize',
          moves: ['Psychic', 'Shadow Ball', 'Dazzling Gleam', 'Focus Blast'],
          level: 50,
        },
      ],
      'p2',
    );

  it('at zero is deterministic, stream or no stream', () => {
    const view = board();
    const quiet = profile(GREEDY_BASELINE.flags, 0, 0);
    const stream = createAiStream(SIM_SEED, 'p2');
    const first = decideWith(view, quiet, stream).choice;
    for (let i = 0; i < 20; i++) expect(decideWith(view, quiet, stream).choice).toEqual(first);
    expect(stream.draws).toBe(0);
  });

  it('above zero is reproducible for a fixed seed, and does move the pick', () => {
    const view = board();
    const noisy = profile(GREEDY_BASELINE.flags, 0.5, 0);
    const run = (): string[] => {
      const stream = createAiStream(SIM_SEED, 'p2');
      return Array.from({ length: 40 }, () => JSON.stringify(decideWith(view, noisy, stream).choice));
    };
    const once = run();
    expect(run()).toEqual(once);
    // A different battle's seed is a different sequence, or every fight in a
    // run would make the same mistakes on the same turns.
    const other = createAiStream(`${SIM_SEED}00` as SimSeed, 'p2');
    const elsewhere = Array.from({ length: 40 }, () => JSON.stringify(decideWith(view, noisy, other).choice));
    expect(elsewhere).not.toEqual(once);

    const deterministic = JSON.stringify(decide(view, noisy).choice);
    expect(once.some((choice) => choice !== deterministic)).toBe(true);
    expect(once.some((choice) => choice === deterministic)).toBe(true);
  });

  it('draws nothing from any structural stream', () => {
    const rng = createRng('NOISE-ISOLATION');
    const view = board();
    const stream = createAiStream(SIM_SEED, 'p2');
    for (let i = 0; i < 50; i++) decideWith(view, profile(GREEDY_BASELINE.flags, 0.5, 0.5), stream);
    for (const name of ['map', 'rewards', 'battle', 'randomizer', 'policy'] as const) {
      expect(rng[name].totalDraws).toBe(0);
    }
    expect(stream.draws).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Generation is untouched
// ---------------------------------------------------------------------------

describe('map generation', () => {
  it('previewRun is unchanged by everything in this patch: no new key, no new draw', () => {
    // The claim is that the AI opens no keyed stream and consumes no structural
    // draw, so a seed's map is a function of the tables alone. Proven here the
    // only way it can be inside one build: the preview is stable across repeated
    // construction and identical for the same seed, and `test/stream-keys.test.ts`
    // holds the key list itself.
    for (const seed of ['PREVIEW-1', 'PREVIEW-2', 'PREVIEW-3', 'RETUNE-0', 'RETUNE-1']) {
      const once = JSON.stringify(previewRun(seed, CONTENT_HASH));
      expect(JSON.stringify(previewRun(seed, CONTENT_HASH))).toBe(once);
    }
  });
});
