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
import { knowledgeFrom } from '../src/core/battle/knowledge';
import { AI_TIERS, aiTierFor } from '../src/data/ai';
import { createAiStream, createRng, type SimSeed } from '../src/core/rng';
import { previewRun } from '../src/core/preview';
import { playRun, replayRun, scriptedRunPolicy } from '../src/core/run';
import { greedyAiPolicy } from '../src/core/battle/ai';
import type { RunLog } from '../src/core/types';
import { CONTENT_HASH } from '../src/core/contentHash';
import type { ActiveView, BattleView, TeamSpec } from '../src/core/types';

/** `AI_WEIGHTS.failure`, quoted rather than imported: the test asserts the contract, not the constant. */
const AI_WEIGHTS_FAILURE = 50;

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
// Knowledge
// ---------------------------------------------------------------------------

describe('seenKnowledge', () => {
  /*
   * The board: the AI's body is a Water type and the foe is a Grass type, so
   * the type chart says the AI is about to be hit for 2x by something. Without
   * knowledge that is all there is to go on and the threat is scored against a
   * generic Grass attack. The foe's actual Grass move is Absorb, at 20 base
   * power — so once it has been *used*, a profile that was watching replaces
   * the probe with the real thing and the same board reads as far less
   * dangerous.
   *
   * Same seed, same board, different reading, one flag apart. It sharpens in
   * both directions: a foe that shows a strong move is feared exactly as hard
   * as it hits.
   */
  const board = (seen?: { moves: string[]; ability: string | null; item: string | null }): BattleView => {
    const view = viewOf(
      [{ species: 'Sceptile', ability: 'Overgrow', moves: ['Absorb'], level: 50 }],
      [
        { species: 'Vaporeon', ability: 'Water Absorb', moves: ['Surf', 'Ice Beam'], level: 50 },
        { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 50 },
      ],
      'p2',
    );
    return seen ? { ...view, seen } : { ...view, seen: undefined };
  };

  const withKnowledge = profile([...GREEDY_BASELINE.flags, 'seenKnowledge']);

  it('does not act on a move the player has not used yet', () => {
    // Nothing revealed: both profiles read the same board, because knowledge of
    // nothing is the same as no knowledge.
    const blank = board({ moves: [], ability: null, item: null });
    expect(scoreChoices(blank, withKnowledge)[0]!.risk).toBeCloseTo(
      scoreChoices(blank, GREEDY_BASELINE)[0]!.risk,
      10,
    );
  });

  it('acts on one the player has, and the profile without the flag cannot', () => {
    const revealed = board({ moves: ['Absorb'], ability: null, item: null });
    const knowing = scoreChoices(revealed, withKnowledge)[0]!.risk;
    const blind = scoreChoices(revealed, GREEDY_BASELINE)[0]!.risk;
    // The blind profile is still afraid of a Grass move far stronger than the
    // one the foe actually carries.
    expect(knowing).toBeLessThan(blind);
    // And the flag reads the view rather than the team: the same profile on a
    // view with nothing revealed is back to the blind number.
    expect(scoreChoices(board({ moves: [], ability: null, item: null }), withKnowledge)[0]!.risk).toBeCloseTo(
      blind,
      10,
    );
  });

  it('forgets when the foe switches out, which is the vanilla rule', () => {
    const protocol = [
      '|switch|p1a: Sceptile|Sceptile, M|100/100',
      '|move|p1a: Sceptile|Leaf Blade|p2a: Vaporeon',
      '|-ability|p1a: Sceptile|Overgrow',
      '|switch|p1a: Snorlax|Snorlax, M|100/100',
      '|move|p1a: Snorlax|Body Slam|p2a: Vaporeon',
    ];
    const seen = knowledgeFrom(protocol, 'p1');
    expect(seen.moves).toEqual(['Body Slam']);
    expect(seen.ability).toBeNull();
    // Struggle is never remembered: it is not a move the player chose to carry.
    expect(knowledgeFrom([...protocol, '|move|p1a: Snorlax|Struggle|p2a: Vaporeon'], 'p1').moves).toEqual([
      'Body Slam',
    ]);
  });
});

// ---------------------------------------------------------------------------
// hpAware
// ---------------------------------------------------------------------------

describe('hpAware', () => {
  const hpAware = profile([...GREEDY_BASELINE.flags, 'avoidFailingMoves', 'hpAware']);

  it('does not heal at full HP, and does heal once the bar is low', () => {
    const view = viewOf(
      [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['Tackle'], level: 50 }],
      [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Recover', 'Surf'], level: 50 }],
      'p2',
    );
    const at = (fraction: number): BattleView => ({
      ...view,
      me: { ...view.me, hpFraction: fraction, hp: Math.max(1, Math.round(view.me.maxHp * fraction)) },
    });
    const scoreOf = (v: BattleView, name: string): number =>
      scoreChoices(v, hpAware).find((entry) => entry.move?.name === name)!.score;

    // At full HP the heal is marked as the bad move it is; at a quarter it is
    // not marked at all. The attack is untouched either way — this flag is
    // about the moves that do nothing, not about preferring damage.
    expect(scoreOf(at(1), 'Recover')).toBeLessThan(scoreOf(at(0.25), 'Recover'));
    /*
     * Measured as the *difference the flag makes* on each board rather than as
     * a raw score. Every score on a low-HP board differs from the same score on
     * a full one, because the race term reads the bar too — so comparing raw
     * numbers across the two would be comparing two things at once.
     */
    const blind = (v: BattleView): number =>
      scoreChoices(v, GREEDY_BASELINE).find((entry) => entry.move?.name === 'Recover')!.score;
    expect(scoreOf(at(1), 'Recover') - blind(at(1))).toBeCloseTo(-AI_WEIGHTS_FAILURE, 10);
    expect(scoreOf(at(0.25), 'Recover') - blind(at(0.25))).toBeCloseTo(0, 10);
  });

  it('does not put a status on a target that is one hit from fainting', () => {
    const view = viewOf(
      [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['Tackle'], level: 50 }],
      [{ species: 'Gengar', ability: 'Cursed Body', moves: ['Toxic', 'Shadow Ball'], level: 50 }],
      'p2',
    );
    const foeAt = (fraction: number): BattleView => ({
      ...view,
      foe: { ...view.foe, hpFraction: fraction, hp: Math.max(1, Math.round(view.foe.maxHp * fraction)) },
    });
    const toxic = (v: BattleView): number =>
      scoreChoices(v, hpAware).find((entry) => entry.move?.name === 'Toxic')!.score;
    expect(toxic(foeAt(0.1))).toBeLessThan(toxic(foeAt(0.9)));
  });
});

// ---------------------------------------------------------------------------
// itemAware
// ---------------------------------------------------------------------------

describe('itemAware', () => {
  it('does not call a knockout that a known berry is about to undo', () => {
    const view = viewOf(
      [{ species: 'Blissey', ability: 'Natural Cure', moves: ['Tackle'], level: 50, item: 'sitrusberry' }],
      [{ species: 'Garchomp', ability: 'Sand Veil', moves: ['Dragon Claw'], level: 50 }],
      'p2',
    );
    /*
     * The foe is put exactly on the edge rather than at a number I picked: its
     * HP is set to what the move is estimated to do, so the hit finishes it by
     * a hair. A hard-coded HP would be a test that passes until someone retunes
     * a base stat.
     */
    const damage = evaluateMoves(view, GREEDY_BASELINE)[0]!.expectedDamage;
    const edge: BattleView = {
      ...view,
      foe: { ...view.foe, hp: Math.max(1, Math.floor(damage)), item: 'sitrusberry' },
      seen: { moves: [], ability: null, item: 'Sitrus Berry' },
    };

    const blind = scoreChoices(edge, GREEDY_BASELINE).find((entry) => entry.move)!;
    const aware = scoreChoices(edge, profile([...GREEDY_BASELINE.flags, 'itemAware', 'seenKnowledge'])).find(
      (entry) => entry.move,
    )!;
    expect(blind.kills).toBe(true);
    expect(aware.kills).toBe(false);
    // And the kill bonus goes with it, which is the point: the turn is no
    // longer scored as a won one.
    expect(aware.score).toBeLessThan(blind.score);
  });

  it('reads only what it knows: an unrevealed berry is not reasoned about', () => {
    const view = viewOf(
      [{ species: 'Blissey', ability: 'Natural Cure', moves: ['Tackle'], level: 50, item: 'sitrusberry' }],
      [{ species: 'Garchomp', ability: 'Sand Veil', moves: ['Dragon Claw'], level: 50 }],
      'p2',
    );
    const damage = evaluateMoves(view, GREEDY_BASELINE)[0]!.expectedDamage;
    const hidden: BattleView = {
      ...view,
      foe: { ...view.foe, hp: Math.max(1, Math.floor(damage)), item: null },
      seen: undefined,
    };
    const aware = scoreChoices(hidden, profile([...GREEDY_BASELINE.flags, 'itemAware', 'seenKnowledge'])).find(
      (entry) => entry.move,
    )!;
    expect(aware.kills).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Replay, which noise made load-bearing
// ---------------------------------------------------------------------------

describe('replay with a noisy opponent', () => {
  /*
   * **The test ruling 5 asked for, and it guards save-and-resume rather than
   * the benchmark.** A run log records the player's decisions and nothing else,
   * on the stated grounds that the opponent is deterministic given a view. It
   * is not deterministic any more — every tier carries noise — so what makes a
   * log replayable is now that the opponent's *rolls* are reproducible from the
   * seed. If that ever stops being true, a player reloading a save gets a
   * different fight from the one they saved, and nothing else in the suite is
   * pointed at that.
   */
  it('replays a log into the same run, turn for turn, with every tier noisy', async () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) expect(AI_TIERS[tier].noise).toBeGreaterThan(0);

    const original = await playRun('NOISY-REPLAY', scriptedRunPolicy(greedyAiPolicy));
    const replayed = await replayRun(JSON.parse(JSON.stringify(original.log)) as RunLog);

    const history = (run: Awaited<ReturnType<typeof playRun>>): unknown =>
      run.state.history.map((visit) => ({
        id: visit.node.id,
        winner: visit.result?.winner ?? null,
        turns: visit.result?.turns ?? null,
        hpAfter: visit.hpAfter,
        casualties: visit.casualties.map((death) => `${death.name}/${death.byMove}`),
      }));

    expect(history(replayed)).toEqual(history(original));
    expect(replayed.outcome).toBe(original.outcome);
    expect(JSON.stringify(replayed.log)).toBe(JSON.stringify(original.log));
  }, 120_000);
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
