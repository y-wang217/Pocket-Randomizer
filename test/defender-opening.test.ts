/**
 * Defender Mode v0, step 2: the mode flag, gym select, the draft, the type
 * lock, the IV table and trainer classes. Headless.
 *
 * `docs/spec/gymrun-defender-mode-v0-fun-test.md`. The prompt's tests 1, 2, 6
 * and 10 are the ones this step can hold in part; each `describe` names which.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createBattle, describeSpec, toPokemonSet } from '../src/core/battle/driver';
import { hpAtLevel } from '../src/core/battle/stats';
import { drawDoorClasses } from '../src/core/defender/classes';
import { generateDefenderDraft } from '../src/core/defender/draft';
import { chooseDraftPick, chooseGymType, draftOptions } from '../src/core/defender/opening';
import { carriesGymType, typeLockRefusal } from '../src/core/defender/typeLock';
import { generateClassTeam } from '../src/core/randomizer';
import { createRng } from '../src/core/rng';
import {
  assertReplayable,
  createRun,
  currentVersions,
  partyCapacity,
  phaseOf,
  playDefenderOpening,
  playRun,
  replayRunPolicy,
  scriptedRunPolicy,
  type RunPolicy,
} from '../src/core/run';
import type { PokemonSpec, RunDecision, RunLog } from '../src/core/types';
import { DEFENDER_DRAFT, DEFENDER_GYM_TYPES, DEFENDER_RANKS } from '../src/data/defender';
import { DAMAGING_MOVES } from '../src/data/movePools';
import { defenderOpponentIvs, DEFENDER_OPPONENT_IVS, starterLevel } from '../src/data/scaling';
import { typesOfSpecies } from '../src/data/speciesTypes';
import { TRAINER_CLASS_NAMES } from '../src/data/trainerClassCopy';
import { classesAtRank, TRAINER_CLASSES } from '../src/data/trainerClasses';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEEDS = Array.from({ length: 60 }, (_, i) => `DEFENDER-${i}`);
const DAMAGING = new Set(DAMAGING_MOVES.map((move) => move.name));

/** A policy answering the opening with fixed indices. Nothing else is asked. */
function openingPolicy(type: number, picks: readonly number[]): RunPolicy {
  let pick = 0;
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseGymType: async () => type,
    chooseDraftPick: async () => picks[pick++] ?? 0,
  };
}

async function openRun(seed: string, type: number, picks: readonly number[]) {
  const decisions: RunDecision[] = [];
  const state = await playDefenderOpening(createRun(seed, DEFAULT_TUNING, 'defender'), openingPolicy(type, picks), (d) =>
    decisions.push(d),
  );
  return { state, decisions };
}

describe('the draft (prompt test 2, the draft half)', () => {
  it('offers three picks of three, every option carrying the gym type, for every type and seed', () => {
    for (const seed of SEEDS) {
      const draft = generateDefenderDraft(createRng(seed));
      for (const type of DEFENDER_GYM_TYPES) {
        const picks = draft[type];
        expect(picks).toHaveLength(DEFENDER_DRAFT.picks);
        const species = picks.flat().map((spec) => spec.species);
        for (const pick of picks) expect(pick).toHaveLength(DEFENDER_DRAFT.options);
        for (const name of species) expect(typesOfSpecies(name), `${seed} ${type} ${name}`).toContain(type);
        // A draft never offers the same species twice across its picks.
        expect(new Set(species).size).toBe(species.length);
      }
    }
  });

  it('generates drafted mons the way a starter is: starter level, named, 31 IVs', () => {
    const draft = generateDefenderDraft(createRng('DRAFT-SHAPE'));
    for (const spec of Object.values(draft).flat(2)) {
      expect(spec.level).toBe(starterLevel());
      expect(spec.nickname).toBeTruthy();
      expect(spec.ivs).toBeUndefined();
      expect(spec.item).toBeUndefined();
    }
  });

  it('highlights exactly one damaging slot, or none for a mon with no damaging move', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      for (const spec of Object.values(generateDefenderDraft(createRng(seed))).flat(2)) {
        const damaging = spec.moves.flatMap((move, slot) => (DAMAGING.has(move) ? [slot] : []));
        if (damaging.length === 0) expect(spec.highlightSlot).toBeUndefined();
        else expect(damaging).toContain(spec.highlightSlot);
      }
    }
  });

  it('draws on randomizer keys only, and the same draft whichever type is later chosen', () => {
    const rng = createRng('DRAFT-ISOLATION');
    const draft = generateDefenderDraft(rng);
    expect(rng.map.totalDraws).toBe(0);
    expect(rng.battle.totalDraws).toBe(0);
    expect(rng.rewards.totalDraws).toBe(0);
    expect(rng.policy.totalDraws).toBe(0);
    // Every type's draft is drawn up front, so the run's draft is the same object
    // whatever the gym type decision says.
    expect(createRun('DRAFT-ISOLATION', DEFAULT_TUNING, 'defender').defender?.draft).toEqual(draft);
  });
});

describe('gym select and the opening', () => {
  it('builds a three-member party, all carrying the chosen type, inside the slot schedule', async () => {
    for (const [index, type] of DEFENDER_GYM_TYPES.entries()) {
      const { state } = await openRun(`OPEN-${type}`, index, [2, 0, 1]);
      expect(state.defender?.gymType).toBe(type);
      expect(state.party).toHaveLength(DEFENDER_DRAFT.picks);
      for (const member of state.party) expect(carriesGymType(member.spec, type)).toBe(true);
      expect(state.party.length).toBeLessThanOrEqual(partyCapacity(state));
      expect(phaseOf(state)).toBe('map');
      const draft = state.defender?.draft[type];
      expect(state.party.map((member) => member.spec)).toEqual([draft?.[0]?.[2], draft?.[1]?.[0], draft?.[2]?.[1]]);
    }
  });

  it('logs the gym type and every pick, in order, and nothing else', async () => {
    const { decisions } = await openRun('OPEN-LOG', 1, [0, 2, 1]);
    expect(decisions).toEqual([
      { kind: 'gymType', index: 1 },
      { kind: 'draft', index: 0 },
      { kind: 'draft', index: 2 },
      { kind: 'draft', index: 1 },
    ]);
  });

  it('refuses a second gym type, an out-of-range type, and an out-of-range pick', () => {
    const fresh = createRun('OPEN-REFUSE', DEFAULT_TUNING, 'defender');
    expect(phaseOf(fresh)).toBe('starter');
    expect(draftOptions(fresh)).toEqual([]);
    expect(() => chooseGymType(fresh, DEFENDER_GYM_TYPES.length)).toThrow(/out of range/);
    const typed = chooseGymType(fresh, 0);
    expect(() => chooseGymType(typed, 1)).toThrow(/already/);
    expect(() => chooseDraftPick(typed, DEFENDER_DRAFT.options)).toThrow(/out of range/);
  });

  it('opens the slot schedule one row ahead: three slots before any boss', () => {
    const state = createRun('OPEN-SLOTS', DEFAULT_TUNING, 'defender');
    expect(partyCapacity(state)).toBe(3);
    expect(partyCapacity(createRun('OPEN-SLOTS', DEFAULT_TUNING))).toBe(2);
  });
});

describe('the same seed and decisions give the same defender opening (prompt test 1, the opening)', () => {
  it('twice over, and through a replay of its own log', async () => {
    const first = await openRun('DETERMINISM', 2, [1, 1, 0]);
    const second = await openRun('DETERMINISM', 2, [1, 1, 0]);
    expect(second.state).toEqual(first.state);

    const log: RunLog = { seed: 'DETERMINISM', mode: 'defender', versions: currentVersions(), decisions: first.decisions };
    const replayed: RunDecision[] = [];
    const state = await playDefenderOpening(
      createRun('DETERMINISM', DEFAULT_TUNING, 'defender'),
      replayRunPolicy(log, undefined, 'defender'),
      (d) => replayed.push(d),
    );
    expect(replayed).toEqual(first.decisions);
    expect(state).toEqual(first.state);
  });
});

describe('the mode is recorded and guarded (prompt test 10, the guard)', () => {
  it('records the mode on the log, and step 2 stops loudly after the draft', async () => {
    let saved: RunLog | null = null;
    await expect(
      playRun('MODE-LOG', openingPolicy(0, [0, 0, 0]), DEFAULT_TUNING, {
        mode: 'defender',
        onDecision: (log) => {
          saved = log;
        },
      }),
    ).rejects.toThrow(/step 3/);
    expect(saved).not.toBeNull();
    const log = saved as unknown as RunLog;
    expect(log.mode).toBe('defender');
    expect(log.decisions.map((d) => d.kind)).toEqual(['gymType', 'draft', 'draft', 'draft']);
  });

  it('throws when a defender log is replayed as attacker, naming both modes', () => {
    const log: RunLog = { seed: 'MODE', mode: 'defender', versions: currentVersions(), decisions: [] };
    expect(() => replayRunPolicy(log)).toThrow(/recorded in defender mode, this replay is attacker mode/);
    expect(() => assertReplayable(log, 'defender')).not.toThrow();
  });

  it('throws when an attacker log is replayed as defender, and on a log with no mode', () => {
    const attacker: RunLog = { seed: 'MODE', mode: 'attacker', versions: currentVersions(), decisions: [] };
    expect(() => replayRunPolicy(attacker, undefined, 'defender')).toThrow(/recorded in attacker mode/);
    const bare = { seed: 'MODE', versions: currentVersions(), decisions: [] } as unknown as RunLog;
    expect(() => assertReplayable(bare)).toThrow(/recorded in \(none\) mode/);
  });

  it('stamps attacker logs as attacker', async () => {
    let mode: string | undefined;
    // Answer the starter, then stop the run at the first locale: one decision is
    // enough to see the stamp.
    const policy: RunPolicy = { ...scriptedRunPolicy(greedyAiPolicy), chooseLocale: () => Promise.reject(new Error('stop')) };
    await expect(
      playRun('MODE-ATTACKER', policy, DEFAULT_TUNING, {
        onDecision: (log) => {
          mode = log.mode;
        },
      }),
    ).rejects.toThrow('stop');
    expect(mode).toBe('attacker');
  });
});

describe('the type lock (prompt test 2, the exemption half)', () => {
  const fire = (species: string): Pick<PokemonSpec, 'species'> => ({ species });

  it('admits a mon carrying the type in either slot', () => {
    expect(typeLockRefusal([], fire('Charmander'), 'Fire', 0)).toBeNull();
    expect(typeLockRefusal([], fire('Talonflame'), 'Flying', 0)).toBeNull(); // Fire/Flying, Flying second
  });

  it('refuses an off-type mon with no exempt slot, naming it', () => {
    expect(typeLockRefusal([fire('Charmander')], fire('Squirtle'), 'Fire', 0)).toMatch(/Squirtle does not carry Fire/);
  });

  it('accepts one off-type mon into one exempt slot, and no more', () => {
    const party = [fire('Charmander'), fire('Vulpix')];
    expect(typeLockRefusal(party, fire('Squirtle'), 'Fire', 1)).toBeNull();
    const withOne = [...party, fire('Squirtle')];
    expect(typeLockRefusal(withOne, fire('Bulbasaur'), 'Fire', 1)).toMatch(/exempt slot is taken/);
    // A trade that replaces the off-type member frees the exemption it used.
    expect(typeLockRefusal(withOne, fire('Bulbasaur'), 'Fire', 1, 2)).toBeNull();
  });
});

describe('IVs (prompt test 6)', () => {
  it('carries the rank table: [0, 5, 10, 14, 18, 24, 26, 28]', () => {
    expect(DEFENDER_OPPONENT_IVS).toEqual([0, 5, 10, 14, 18, 24, 26, 28]);
    for (let rank = 0; rank < DEFENDER_RANKS; rank++) expect(defenderOpponentIvs(rank)).toBe(DEFENDER_OPPONENT_IVS[rank]);
  });

  it('gives every class-team member its rank IV, and the sim builds it with that IV', () => {
    for (let rank = 0; rank < DEFENDER_RANKS; rank++) {
      const team = generateClassTeam([], rank, 'normal', defenderOpponentIvs(rank), createRng(`IV-${rank}`).randomizer.at('t'));
      for (const spec of team) {
        expect(spec.ivs).toBe(DEFENDER_OPPONENT_IVS[rank]);
        expect(Object.values(toPokemonSet(spec).ivs)).toEqual(Array(6).fill(DEFENDER_OPPONENT_IVS[rank]));
      }
    }
  });

  it('builds a drafted mon at 31, and an attacker spec at 31 as before', () => {
    const drafted = generateDefenderDraft(createRng('IV-PLAYER')).Fire[0]![0]!;
    expect(Object.values(toPokemonSet(drafted).ivs)).toEqual(Array(6).fill(31));
    const attacker: PokemonSpec = { species: 'Rhydon', ability: 'Lightning Rod', moves: ['Earthquake'], level: 50 };
    expect(Object.values(toPokemonSet(attacker).ivs)).toEqual(Array(6).fill(31));
  });

  it('agrees with the engine: max HP, and the opponent stats the player is shown', () => {
    const zero: PokemonSpec = { species: 'Rhydon', ability: 'Lightning Rod', moves: ['Earthquake'], level: 50, ivs: 0 };
    // HP = floor((2*105 + 0 + 100) * 50 / 100 + 10) = 165, against 180 at 31.
    expect(hpAtLevel(105, 50, undefined, 0)).toBe(165);
    expect(describeSpec(zero).maxHp).toBe(165);

    const player: PokemonSpec = { species: 'Charmander', ability: 'Blaze', moves: ['Ember'], level: 50 };
    const session = createBattle({ teams: { p1: [player], p2: [zero] }, seed: 'iv-facts' });
    const shown = session.factsFor('p1').opponent;
    const engine = session.factsFor('p2').player;
    expect(shown?.stats).toEqual(engine?.stats);
    expect(shown?.stats.atk).toBe(135); // floor((260 + 0) * 0.5 + 5), against 150 at 31
  });
});

describe('trainer classes', () => {
  it('gives every rank at least two classes, so a door can always offer two different ones', () => {
    for (let rank = 0; rank < DEFENDER_RANKS; rank++) expect(classesAtRank(rank).length).toBeGreaterThanOrEqual(2);
  });

  it('follows the prompt\'s bands: single-type early, themed middle, untyped last', () => {
    for (const entry of classesAtRank(0)) expect(entry.types).toHaveLength(1);
    for (const entry of classesAtRank(DEFENDER_RANKS - 1)) expect(entry.types).toEqual([]);
    expect(new Set(TRAINER_CLASSES.map((entry) => entry.id)).size).toBe(TRAINER_CLASSES.length);
    // Every class has a name to show at the door, and every name a class.
    expect(Object.keys(TRAINER_CLASS_NAMES).sort()).toEqual(TRAINER_CLASSES.map((entry) => entry.id).sort());
  });

  it('draws two different classes at every door, both eligible at the rank', () => {
    for (const seed of SEEDS) {
      for (let rank = 0; rank < DEFENDER_RANKS; rank++) {
        const [a, b] = drawDoorClasses(rank, createRng(seed).randomizer.at(`door-${rank}`));
        expect(a.id).not.toBe(b.id);
        expect(classesAtRank(rank)).toContain(a);
        expect(classesAtRank(rank)).toContain(b);
      }
    }
  });

  it('fields a team whose every member carries one of the class types', () => {
    for (const entry of TRAINER_CLASSES.filter((c) => c.types.length > 0)) {
      for (const seed of SEEDS.slice(0, 15)) {
        const rank = entry.ranks.min;
        const team = generateClassTeam(entry.types, rank, 'normal', 0, createRng(seed).randomizer.at(entry.id));
        for (const spec of team) {
          expect(entry.types.some((type) => typesOfSpecies(spec.species).includes(type)), `${entry.id} ${spec.species}`).toBe(true);
        }
      }
    }
  });
});
