/**
 * The randomizer's seven promises.
 *
 * These are the Stage 2 spec's required tests, and they are grouped here rather
 * than spread across the suite because they are one argument: a seed is a run,
 * the randomizer cannot change that, and the ways it *would* change it are all
 * silent.
 *
 *   1. Determinism — the same seed rolls the same full run twice.
 *   2. Stream isolation — a draw in one system cannot move another's.
 *   3. Legality bypass — an illegal ability is accepted *and fires*.
 *   4. Moveset validity — no generated spec has zero damaging moves.
 *   5. Gym identity — every gym member is the leader's type.
 *   6. Version guard — a mismatched randomizer version refuses to replay.
 *   7. (The Stage 0 and Stage 1 suites, unchanged, in their own files.)
 *
 * Four and five are property tests over many seeds rather than examples. A
 * single-case assertion here would pass on the day it was written and say
 * nothing about the nine hundred and ninety-nine seeds it did not try, which is
 * the entire population this stage is about.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { runBattle } from '../src/core/battle/driver';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import { generateSegment, nodesOf } from '../src/core/encounters';
import {
  RANDOMIZER_VERSION,
  generateGymTeam,
  generateStarters,
  generateTrainerTeam,
  generateWildMon,
  generateWildTeam,
} from '../src/core/randomizer';
import { createRng, RNG_STREAMS, type Rng } from '../src/core/rng';
import { isBattleKind } from '../src/core/economy';
import { assertReplayable, createRun, isReplayable, RUN_LOG_VERSION } from '../src/core/run';
import type { PokemonSpec, RunLog, TeamSpec } from '../src/core/types';
import { GYMS } from '../src/data/gyms';
import { DAMAGING_MOVES } from '../src/data/movePools';
import { expectedPartySize, opponentTeamSize, SEGMENTS, starterLevel, TIER_MODIFIERS } from '../src/data/scaling';
import { PARTY_SIZE } from '../src/data/partyTuning';
import { SPECIES_POOL } from '../src/data/speciesPools';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEGMENT_INDEXES = SEGMENTS.map((row) => row.segment);
const damagingNames = new Set(DAMAGING_MOVES.map((move) => move.name));
const speciesByName = new Map(SPECIES_POOL.map((entry) => [entry.species, entry]));

/** Every Pokemon a run will ever generate, in generation order. */
function allSpecs(seed: string): PokemonSpec[] {
  const state = createRun(seed);
  return [
    ...state.starterOptions,
    ...state.segments.flatMap((segment) =>
      nodesOf(segment).flatMap((node) => node.encounter?.team ?? []),
    ),
  ];
}

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------

describe('1. determinism', () => {
  it('rolls an identical full run for the same seed, twice', () => {
    for (const seed of ['DET-A', 'DET-B', 'DET-C']) {
      // Deep equality over the whole run: starters, every segment, every option
      // the player will never take, every ability, every move, every level and
      // every sim seed. Anything unseeded anywhere inside the randomizer shows
      // up here.
      expect(createRun(seed)).toEqual(createRun(seed));
    }
  });

  it('rolls different runs for different seeds', () => {
    const runs = ['DIFF-1', 'DIFF-2', 'DIFF-3'].map((seed) => JSON.stringify(createRun(seed).segments));
    expect(new Set(runs).size).toBe(runs.length);
  });

  it('is a pure function of the stream, not of call order', () => {
    // The same stream position must produce the same Pokemon regardless of what
    // was generated before it in the process. A cached pool that got filtered
    // in place, or a module-level counter, would fail here and nowhere else.
    const first = generateWildMon(3, 'normal', createRng('PURE').randomizer);
    generateGymTeam(GYMS[0]!, 0, createRng('NOISE').randomizer);
    generateTrainerTeam(5, 'normal', createRng('MORE-NOISE').randomizer);
    expect(generateWildMon(3, 'normal', createRng('PURE').randomizer)).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// 2. Stream isolation
// ---------------------------------------------------------------------------

describe('2. stream isolation', () => {
  it('lets one stream be drained without moving any other', () => {
    // The failure this catches is the one that would bite silently: Stage 3
    // adds reward draws, and every seed recorded in Stage 2 quietly becomes a
    // different run. Asserted directly rather than trusted to the construction.
    for (const drained of RNG_STREAMS) {
      const busy = createRng('ISOLATE');
      for (let i = 0; i < 5_000; i++) busy[drained].nextUint32();

      const quiet = createRng('ISOLATE');
      for (const other of RNG_STREAMS) {
        if (other === drained) continue;
        const a = Array.from({ length: 8 }, () => busy[other].nextUint32());
        const b = Array.from({ length: 8 }, () => quiet[other].nextUint32());
        expect(a, `draining ${drained} moved ${other}`).toEqual(b);
      }
    }
  });

  it('leaves the map and the battles untouched when the randomizer draws more', () => {
    // The same assertion at the level a player would notice it: a run whose
    // rewards stream has been consumed must still have the same map shape and
    // the same battle PRNG seeds.
    const shapeOf = (rng: Rng): string =>
      JSON.stringify(
        [0, 1].map((index) => {
          const segment = generateSegment(index, rng, DEFAULT_TUNING);
          return {
            steps: segment.steps.map((step) => step.options.map((option) => option.kind)),
            seeds: nodesOf(segment).map((node) => node.encounter?.simSeed ?? null),
          };
        }),
      );

    const plain = createRng('ISOLATE-RUN');
    const withRewards = createRng('ISOLATE-RUN');
    for (let i = 0; i < 1_000; i++) withRewards.rewards.nextUint32();

    expect(shapeOf(withRewards)).toBe(shapeOf(plain));
  });

  it('draws every randomizer roll from the randomizer stream and nowhere else', () => {
    const rng = createRng('ISOLATE-SOURCE');
    const before = Object.fromEntries(RNG_STREAMS.map((name) => [name, rng[name].draws]));

    generateWildTeam(4, 'normal', rng.randomizer);
    generateTrainerTeam(4, 'normal', rng.randomizer);
    generateGymTeam(GYMS[4]!, 4, rng.randomizer);
    generateStarters(3, starterLevel(), rng.randomizer);

    expect(rng.randomizer.draws).toBeGreaterThan(before['randomizer'] ?? 0);
    for (const name of RNG_STREAMS) {
      if (name === 'randomizer') continue;
      expect(rng[name].draws, `${name} was drawn from`).toBe(before[name]);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Legality bypass
// ---------------------------------------------------------------------------

describe('3. legality bypass', () => {
  it('accepts an ability the species cannot legally have, and fires it', async () => {
    // Rhydon is Ground/Rock and takes Earthquake for neutral damage. Levitate
    // is not one of its abilities in any generation. If the validator were
    // running, this team would be rejected; if the ability were being quietly
    // corrected to a legal one, Earthquake would connect. It does not, and the
    // protocol names Levitate as the reason.
    const grounded: TeamSpec = [
      { species: 'Rhydon', ability: 'Levitate', moves: ['Rock Slide'], level: 50 },
    ];
    const digger: TeamSpec = [
      { species: 'Golem', ability: 'Sturdy', moves: ['Earthquake'], level: 50 },
    ];

    const run = await runBattle(grounded, digger, 'BYPASS', firstUsableMovePolicy, firstUsableMovePolicy);
    expect(run.protocol.some((line) => line.includes('|-immune|'))).toBe(true);
    expect(run.protocol.some((line) => line.includes('[from] ability: Levitate'))).toBe(true);
  });

  it('gives generated Pokemon abilities their species cannot have', () => {
    // The property, rather than one arranged case: across a sample of seeds the
    // randomizer must be handing out abilities from the whole pool. A
    // randomizer that quietly fell back to legal abilities would show a much
    // smaller set here.
    const abilities = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      for (const spec of allSpecs(`BYPASS-${seed}`)) abilities.add(spec.ability);
    }
    expect(abilities.size).toBeGreaterThan(100);
  });

  it('plays a whole battle between two fully randomized teams', async () => {
    // The end-to-end version: the engine takes what the randomizer produces,
    // whatever it produces, and reaches a result.
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(`BYPASS-BATTLE-${seed}`);
      const run = await runBattle(
        generateTrainerTeam(6, 'normal', rng.randomizer),
        generateGymTeam(GYMS[6]!, 6, rng.randomizer),
        `BYPASS-BATTLE-${seed}`,
        greedyAiPolicy,
        greedyAiPolicy,
      );
      expect(run.result.turns).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Moveset validity
// ---------------------------------------------------------------------------

describe('4. moveset validity', () => {
  it('never generates a spec with zero damaging moves', () => {
    // A property test over every Pokemon of forty full runs — roughly two
    // thousand specs — not one arranged case. Four status moves is a dead
    // encounter, and a dead encounter in one node of one seed is exactly the
    // kind of thing a single example test never sees.
    let checked = 0;
    for (let seed = 0; seed < 40; seed++) {
      for (const spec of allSpecs(`MOVESET-${seed}`)) {
        checked++;
        const damaging = spec.moves.filter((move) => damagingNames.has(move));
        expect(damaging.length, `${spec.species} [${spec.moves.join(', ')}]`).toBeGreaterThan(0);
      }
    }
    expect(checked).toBeGreaterThan(1_000);
  });

  it('fills every slot, with no duplicates', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const spec of allSpecs(`SLOTS-${seed}`)) {
        expect(spec.moves, `${spec.species}`).toHaveLength(4);
        expect(new Set(spec.moves).size, `${spec.species} duplicates`).toBe(4);
      }
    }
  });

  it('gives all but a handful of specs a move of their own type', () => {
    // "Type-plausible" is the promise. It is not absolute — a species whose
    // types have no move in the segment's band falls back to open coverage —
    // so this asserts the rate rather than the rule, and a regression that
    // broke STAB selection would drop it off a cliff.
    let stab = 0;
    let total = 0;
    for (let seed = 0; seed < 20; seed++) {
      for (const spec of allSpecs(`STAB-${seed}`)) {
        const entry = speciesByName.get(spec.species);
        if (!entry) continue;
        total++;
        const types = new Set(entry.types);
        if (spec.moves.some((name) => {
          const move = DAMAGING_MOVES.find((candidate) => candidate.name === name);
          return move ? types.has(move.type) : false;
        })) {
          stab++;
        }
      }
    }
    expect(total).toBeGreaterThan(500);
    expect(stab / total).toBeGreaterThan(0.98);
  });

  it('keeps levels inside the curve, tier bonus included', () => {
    // The window is the segment's offset *plus the node's tier bonus*. Asserting
    // the bare offset would have been the Stage 2 test, and it is now wrong in
    // the direction that matters least — it would fail on a correct build and
    // pass on one that silently ignored tier.
    for (let seed = 0; seed < 10; seed++) {
      const state = createRun(`LEVELS-${seed}`);
      for (const segment of state.segments) {
        const row = SEGMENTS[segment.index]!;
        for (const node of nodesOf(segment)) {
          // Only fights have a level band; a shop has no opponent to bound.
          if (!isBattleKind(node.kind)) continue;
          const bonus = node.tier ? TIER_MODIFIERS[node.tier].level : 0;
          for (const member of node.encounter?.team ?? []) {
            const offset = row.levelOffset[node.kind];
            expect(member.level).toBeGreaterThanOrEqual(row.playerLevel + offset.min + bonus);
            expect(member.level).toBeLessThanOrEqual(row.playerLevel + offset.max + bonus);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Gym identity
// ---------------------------------------------------------------------------

describe('5. gym identity', () => {
  it('gives every gym member the type of its leader, across many seeds', () => {
    for (const gym of GYMS) {
      for (let seed = 0; seed < 60; seed++) {
        const team = generateGymTeam(gym, gym.segment, createRng(`GYM-${gym.id}-${seed}`).randomizer);
        expect(team.length).toBeGreaterThan(0);
        for (const member of team) {
          const entry = speciesByName.get(member.species);
          expect(entry, `${member.species} is not in the pool`).toBeDefined();
          expect(entry?.types, `${gym.leader} fielded ${member.species}`).toContain(gym.type);
        }
      }
    }
  });

  it('sizes gym teams from the curve, against the party the player actually has', () => {
    /*
     * The rule the spec is specific about: nothing hardcodes a gym's team size,
     * so raising the party moves the whole curve rather than leaving the back
     * half trivial.
     *
     * **This used to assert `>= PARTY_SIZE` at every gym, and that assertion
     * was the single largest balance error of Stage 4 written down as a test.**
     * A run does not start with a full party — it starts with one Pokemon and
     * acquires the rest — so sizing gym 1 against three aimed the opening at a
     * player who does not exist. The simulator measured the result as an
     * inverted curve: 74% clear at gym 1 rising to 96% at gym 8.
     *
     * So the floor is the party the curve *expects* at that segment, and the
     * back half is protected by its own assertion rather than by a premise that
     * happens to be false early on.
     */
    for (const gym of GYMS) {
      const expected = opponentTeamSize('gym', gym.segment, 'normal', gym.teamSize);
      expect(expected, `${gym.leader}`).toBeGreaterThanOrEqual(expectedPartySize(gym.segment));
      for (let seed = 0; seed < 5; seed++) {
        const team = generateGymTeam(gym, gym.segment, createRng(`SIZE-${gym.id}-${seed}`).randomizer);
        expect(team, `${gym.leader}`).toHaveLength(expected);
      }
    }

    // The back half is not trivial: once the player is expected to be at full
    // strength, the gym outnumbers them.
    const last = GYMS[GYMS.length - 1]!;
    expect(expectedPartySize(last.segment)).toBe(PARTY_SIZE);
    expect(opponentTeamSize('gym', last.segment, 'normal', last.teamSize)).toBeGreaterThan(PARTY_SIZE);
  });

  it('never outnumbers the player before they have had a chance to fill the party', () => {
    // The other half of the same rule, and the one the inverted curve violated:
    // an ordinary node in the opening segment must not field a full party
    // against a lone starter.
    for (const kind of ['wild', 'trainer'] as const) {
      expect(opponentTeamSize(kind, 0, 'normal')).toBeLessThanOrEqual(expectedPartySize(0));
    }
  });

  it('does not field the same species twice as often as chance would', () => {
    // Not a rule — a gym may legitimately double up — but a gym that always
    // did would mean the type pool had collapsed to one entry.
    const distinct = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      for (const member of generateGymTeam(GYMS[7]!, 7, createRng(`VARIETY-${seed}`).randomizer)) {
        distinct.add(member.species);
      }
    }
    expect(distinct.size).toBeGreaterThan(5);
  });

  it('never rolls a pseudo-legendary into the first gym', () => {
    // The spec's own example of what band filtering is for.
    for (let seed = 0; seed < 60; seed++) {
      for (const member of generateGymTeam(GYMS[0]!, 0, createRng(`EARLY-${seed}`).randomizer)) {
        const entry = speciesByName.get(member.species);
        expect(entry?.band, `${member.species} at gym 1`).toBeLessThanOrEqual(1);
        expect(entry?.bst ?? 0, `${member.species} at gym 1`).toBeLessThanOrEqual(420);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Version guard
// ---------------------------------------------------------------------------

describe('6. version guard', () => {
  const decisions: RunLog['decisions'] = [{ kind: 'starter', index: 0 }];

  it('refuses to replay a log recorded on a different randomizer', () => {
    const stale: RunLog = {
      seed: 'GUARD',
      version: RUN_LOG_VERSION,
      randomizerVersion: 'gymrun-randomizer-0',
      decisions,
    };
    expect(isReplayable(stale)).toBe(false);
    // The message has to name both versions. "Could not replay" sends a player
    // looking for a bug in their save; naming the mismatch sends them to the
    // release note that caused it.
    expect(() => assertReplayable(stale)).toThrow(/gymrun-randomizer-0/);
    expect(() => assertReplayable(stale)).toThrow(new RegExp(RANDOMIZER_VERSION));
  });

  it('refuses a log with no randomizer version at all', () => {
    // Every Stage 1 log. They are perfectly replayable as decision sequences
    // and would produce a completely different run, which is the whole reason
    // this check is separate from the engine version check.
    const stageOne = { seed: 'GUARD-OLD', version: RUN_LOG_VERSION, decisions } as unknown as RunLog;
    expect(isReplayable(stageOne)).toBe(false);
    expect(() => assertReplayable(stageOne)).toThrow(/randomizer/);
  });

  it('accepts a log recorded on this build', () => {
    const current: RunLog = {
      seed: 'GUARD-OK',
      version: RUN_LOG_VERSION,
      randomizerVersion: RANDOMIZER_VERSION,
      decisions,
    };
    expect(isReplayable(current)).toBe(true);
    expect(() => assertReplayable(current)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Segment coverage
// ---------------------------------------------------------------------------

describe('the curve, exercised', () => {
  it('generates something playable for every segment and node kind', () => {
    for (const segment of SEGMENT_INDEXES) {
      const rng = createRng(`CURVE-${segment}`);
      const teams: TeamSpec[] = [
        generateWildTeam(segment, 'normal', rng.randomizer),
        generateTrainerTeam(segment, 'normal', rng.randomizer),
        generateGymTeam(GYMS[segment]!, segment, rng.randomizer),
      ];
      for (const team of teams) {
        expect(team.length).toBeGreaterThan(0);
        for (const member of team) {
          expect(member.moves.length).toBe(4);
          expect(member.level).toBeGreaterThan(0);
          expect(member.ability.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('honours the tier parameter without spending extra draws on it', () => {
    // Stage 3 turns tiers on. When it does, a `hard` node must not consume a
    // different number of draws from a `normal` one, or every roll downstream
    // of the first non-normal node shifts.
    for (const segment of SEGMENT_INDEXES) {
      const normal = createRng(`TIER-${segment}`);
      const hard = createRng(`TIER-${segment}`);
      generateTrainerTeam(segment, 'normal', normal.randomizer);
      generateTrainerTeam(segment, 'hard', hard.randomizer);
      expect(hard.randomizer.draws, `segment ${segment}`).toBe(normal.randomizer.draws);
    }
  });

  it('makes a hard tier actually harder', () => {
    // And the parameter is not decorative: it moves levels up.
    let harder = 0;
    for (let seed = 0; seed < 20; seed++) {
      const normal = generateWildMon(2, 'normal', createRng(`TIER-LV-${seed}`).randomizer);
      const hard = generateWildMon(2, 'hard', createRng(`TIER-LV-${seed}`).randomizer);
      if (hard.level > normal.level) harder++;
    }
    expect(harder).toBe(20);
  });
});
