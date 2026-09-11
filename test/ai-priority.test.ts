/**
 * The priority and speed aware AI patch (overnight Branch 2).
 *
 * Part 1, the data: `MoveView.priority` is the dex bracket, and the speed
 * helper orders two bodies the way the engine does for the three layers it
 * models — stat, stage, paralysis — and refuses to guess a tie.
 *
 * Part 2, the rule: five fixed positions from the prompt, each asserting the
 * branch the pick came from as well as the pick, and the control that a board
 * with no priority move is scored exactly as the pre-patch AI scored it.
 *
 * Part 3, the axes: `AI_VERSION` moved and a pre-patch log is refused naming
 * it; `RUN_LOG_VERSION` and `contentHash` did not move; one seed plays to one
 * log twice.
 */
import { describe, expect, it } from 'vitest';

import { AI_VERSION, bestOf, decide, greedyAiPolicy, scoreChoices } from '../src/core/battle/ai';
import { createBattle, type BattleSession } from '../src/core/battle/driver';
import { effectiveSpeed, orderOf, speedView, turnOrderOf } from '../src/core/battle/speed';
import { CONTENT_HASH } from '../src/core/contentHash';
import { assertReplayable, currentVersions, isReplayable, playRun, RUN_LOG_VERSION, scriptedRunPolicy } from '../src/core/run';
import type { ActiveView, BattleView, RunLog, TeamSpec } from '../src/core/types';

function start(p1: TeamSpec, p2: TeamSpec, seed = 'PRIO'): BattleSession {
  return createBattle({ teams: { p1, p2 }, seed });
}

/** A view with one side's HP pinned, the way the existing AI tests do it. */
function withHp(view: BattleView, me: number, foe: number): BattleView {
  return {
    ...view,
    me: { ...view.me, hp: me, hpFraction: me / Math.max(1, view.me.maxHp) },
    foe: { ...view.foe, hp: foe, hpFraction: foe / Math.max(1, view.foe.maxHp) },
  };
}

// ---------------------------------------------------------------------------
// Part 1: the data
// ---------------------------------------------------------------------------

describe('MoveView.priority', () => {
  it('is the dex bracket, for a sweep of brackets, and survives the trim', () => {
    const view = start(
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Extreme Speed', 'Counter', 'Thunder Wave'], level: 50 }],
      [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }],
    ).viewFor('p1');
    const byName = new Map(view.moves.map((move) => [move.name, move.priority]));
    expect(byName.get('Quick Attack')).toBe(1);
    expect(byName.get('Extreme Speed')).toBe(2);
    expect(byName.get('Counter')).toBe(-5);
    // A status move sits in the ordinary bracket; a priority rule must not
    // mistake "no damage" for "no bracket" or the other way round.
    expect(byName.get('Thunder Wave')).toBe(0);
    expect(view.moves.every((move) => Number.isInteger(move.priority))).toBe(true);
  });

  it('is a plain 0 on an ordinary attack, on both sides of the field', () => {
    const session = start(
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 }],
      [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }],
    );
    expect(session.viewFor('p1').moves[0]?.priority).toBe(0);
    expect(session.viewFor('p2').moves[0]?.priority).toBe(0);
  });
});

describe('the speed helper', () => {
  const body = (overrides: Partial<ActiveView>): ActiveView => ({
    species: 'Ditto',
    name: 'Ditto',
    level: 50,
    types: ['Normal'],
    hp: 100,
    maxHp: 100,
    hpFraction: 1,
    status: null,
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    fainted: false,
    baseSpeed: 100,
    ability: null,
    ...overrides,
  });

  it('orders a faster body before a slower one', () => {
    expect(orderOf(speedView(body({ baseSpeed: 130 }), body({ baseSpeed: 30 })))).toBe('first');
    expect(orderOf(speedView(body({ baseSpeed: 30 }), body({ baseSpeed: 130 })))).toBe('second');
  });

  it('applies stat stages the way the engine does', () => {
    // +1 is x1.5 and -1 is /1.5, floored; the table is stats.ts's.
    expect(effectiveSpeed(body({ baseSpeed: 100, statStages: { ...body({}).statStages, spe: 1 } }))).toBe(150);
    expect(effectiveSpeed(body({ baseSpeed: 100, statStages: { ...body({}).statStages, spe: -1 } }))).toBe(66);
    expect(effectiveSpeed(body({ baseSpeed: 100, statStages: { ...body({}).statStages, spe: 6 } }))).toBe(400);
    // A stage flips the order a bare stat would give.
    const slowButBoosted = body({ baseSpeed: 80, statStages: { ...body({}).statStages, spe: 1 } });
    expect(orderOf(speedView(slowButBoosted, body({ baseSpeed: 100 })))).toBe('first');
  });

  it('applies paralysis after stages', () => {
    expect(effectiveSpeed(body({ baseSpeed: 100, status: 'par' }))).toBe(50);
    // Stage first, then the halving, floored at each step: 100 -> 150 -> 75.
    expect(effectiveSpeed(body({ baseSpeed: 100, status: 'par', statStages: { ...body({}).statStages, spe: 1 } }))).toBe(75);
    expect(orderOf(speedView(body({ baseSpeed: 100, status: 'par' }), body({ baseSpeed: 60 })))).toBe('second');
    // A non-speed status leaves Speed alone.
    expect(effectiveSpeed(body({ baseSpeed: 100, status: 'brn' }))).toBe(100);
  });

  it('never guesses a tie', () => {
    expect(orderOf(speedView(body({ baseSpeed: 100 }), body({ baseSpeed: 100 })))).toBe('unknown');
    // A tie reached two different ways is still a tie.
    const halved = body({ baseSpeed: 200, status: 'par' });
    expect(orderOf(speedView(halved, body({ baseSpeed: 100 })))).toBe('unknown');
    expect(turnOrderOf({ speed: { me: 7, foe: 7 } })).toBe('unknown');
  });

  it('is what the view carries, read off the sim for both sides', () => {
    // Snorlax base Speed 30, Jolteon 130: at level 50 with the fixed spread,
    // 50 and 150. The view's numbers are the helper's numbers.
    const view = start(
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Body Slam'], level: 50 }],
      [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Thunderbolt'], level: 50 }],
    ).viewFor('p1');
    expect(view.me.baseSpeed).toBe(50);
    expect(view.foe.baseSpeed).toBe(150);
    expect(view.speed).toEqual({ me: effectiveSpeed(view.me), foe: effectiveSpeed(view.foe) });
    expect(turnOrderOf(view)).toBe('second');
    expect(view.speed.me).toBeLessThan(view.speed.foe);
  });
});

// ---------------------------------------------------------------------------
// Part 2: the rule, against fixed positions
// ---------------------------------------------------------------------------

/** Slower than Jolteon by a hundred points; Quick Attack in slot 1, Body Slam in slot 2. */
const SLOW_WITH_PRIORITY: TeamSpec = [
  { species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Body Slam'], level: 50 },
];
/** The same two moves on the faster body. */
const FAST_WITH_PRIORITY: TeamSpec = [
  { species: 'Jolteon', ability: 'Volt Absorb', moves: ['Quick Attack', 'Body Slam'], level: 50 },
];
const JOLTEON: TeamSpec = [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Thunderbolt'], level: 50 }];
const SNORLAX: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 }];

const slot = (view: BattleView, name: string): number => view.moves.find((move) => move.name === name)!.slot;

describe('the priority rule, against fixed positions', () => {
  it('(a) slower, facing a knockout, holding a priority move in range: picks it', async () => {
    const base = start(SLOW_WITH_PRIORITY, JOLTEON, 'POS-A').viewFor('p1');
    expect(turnOrderOf(base)).toBe('second');
    const view = withHp(base, 1, 1);

    const decision = decide(view);
    expect(decision.branch).toBe('priority-escape');
    expect(decision.choice).toEqual({ kind: 'move', slot: slot(view, 'Quick Attack') });
    // The reason, not only the slot: staying in is lethal and the move lands first.
    expect(scoreChoices(view).find((entry) => entry.move)?.risk).toBeGreaterThanOrEqual(1);
    expect(await greedyAiPolicy(view)).toEqual(decision.choice);
  });

  it('(b) same position, the priority move does not knock out: still picks it over the bigger hit', () => {
    const base = start(SLOW_WITH_PRIORITY, JOLTEON, 'POS-B').viewFor('p1');
    const view = withHp(base, 1, base.foe.maxHp);

    const scored = scoreChoices(view);
    const quick = scored.find((entry) => entry.move?.name === 'Quick Attack')!;
    const slam = scored.find((entry) => entry.move?.name === 'Body Slam')!;
    expect(quick.kills).toBe(false);
    expect(slam.offense).toBeGreaterThan(quick.offense);
    // The greedy pick alone is the bigger hit, which is tackling into the knockout.
    expect(bestOf(scored).choice).toEqual(slam.choice);

    const decision = decide(view);
    expect(decision.branch).toBe('priority-escape');
    expect(decision.choice).toEqual(quick.choice);
    expect(decision.greedy).toEqual(slam.choice);
  });

  it('(c) faster, identical moves: picks the higher-damage move as before', () => {
    const base = start(FAST_WITH_PRIORITY, SNORLAX, 'POS-C').viewFor('p1');
    expect(turnOrderOf(base)).toBe('first');
    const view = withHp(base, 1, base.foe.maxHp);

    const decision = decide(view);
    expect(decision.branch).toBe('greedy');
    expect(decision.choice).toEqual({ kind: 'move', slot: slot(view, 'Body Slam') });
    expect(decision.choice).toEqual(bestOf(scoreChoices(view)).choice);
  });

  it('(d) two knockout moves, one with priority: picks the priority one', () => {
    const base = start(FAST_WITH_PRIORITY, SNORLAX, 'POS-D').viewFor('p1');
    const view = withHp(base, base.me.maxHp, 1);

    const scored = scoreChoices(view);
    expect(scored.filter((entry) => entry.move).every((entry) => entry.kills)).toBe(true);
    // Greedy alone takes the bigger hit; the rule takes the one that lands first.
    expect(bestOf(scored).move?.name).toBe('Body Slam');

    const decision = decide(view);
    expect(decision.branch).toBe('priority-kill');
    expect(decision.choice).toEqual({ kind: 'move', slot: slot(view, 'Quick Attack') });
  });

  it('(e) no priority move at all: the pick is the pre-patch greedy pick, every turn', async () => {
    // Two ordinary kits played out by the AI on both sides; at every decision
    // the rule's answer is the greedy answer and it says so.
    const session = start(
      [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Earthquake', 'Rest', 'Curse'], level: 50 }],
      [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald', 'Ice Beam', 'Recover', 'Toxic'], level: 50 }],
      'POS-E',
    );
    let decisions = 0;
    for (let turn = 0; turn < 20 && !session.ended; turn++) {
      for (const side of ['p1', 'p2'] as const) {
        const view = session.viewFor(side);
        if (!view.awaitingChoice) continue;
        expect(view.moves.every((move) => move.priority === 0)).toBe(true);
        const decision = decide(view);
        expect(decision.branch).toBe('greedy');
        expect(decision.choice).toEqual(bestOf(scoreChoices(view)).choice);
        decisions++;
        session.submit(side, decision.choice);
      }
    }
    expect(decisions).toBeGreaterThan(4);
  });

  it('does not fire on a forced switch, which has no moves to order', () => {
    const session = start(
      [
        { species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 },
        { species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack'], level: 50 },
      ],
      [{ species: 'Groudon', ability: 'Drought', moves: ['Earthquake'], level: 100 }],
      'FORCED-PRIO',
    );
    session.submit('p1', { kind: 'move', slot: 1 });
    session.submit('p2', { kind: 'move', slot: 1 });
    const view = session.viewFor('p1');
    expect(view.forceSwitch).toBe(true);
    expect(decide(view)).toMatchObject({ branch: 'greedy', choice: { kind: 'switch', slot: 2 } });
  });
});

// ---------------------------------------------------------------------------
// Part 3: the axes
// ---------------------------------------------------------------------------

describe('the version axes', () => {
  /*
   * **Updated by the AI tiers patch, not deleted.** This assertion pinned
   * `gymrun-ai-3-priority` as the string the priority patch moved to, and the
   * AI tiers patch moved it again — first to `-4` for the unknown-ability fix
   * (`ai.ts`, `UNKNOWN_ABILITY`). What the test is *for* is unchanged and is
   * what still runs: `AI_VERSION` moved when the AI's ranking moved, and a log
   * recorded on the previous string is refused by name with both values in the
   * message. The pre-patch log below is still a `-2` one, because a log two
   * versions old is refused on the same axis for the same reason and keeping
   * it is one fewer thing to re-edit next time.
   */
  it('moved AI_VERSION, and refuses a pre-patch log naming aiVersion and both values', () => {
    expect(AI_VERSION).toBe('gymrun-ai-4-ability');
    const prePatch: RunLog = {
      seed: 'PRE-PRIORITY',
      versions: { ...currentVersions(), aiVersion: 'gymrun-ai-2-switching' },
      decisions: [],
    };
    expect(isReplayable(prePatch)).toBe(false);
    expect(() => assertReplayable(prePatch)).toThrow(/mismatch on aiVersion/);
    expect(() => assertReplayable(prePatch)).toThrow(/gymrun-ai-2-switching/);
    expect(() => assertReplayable(prePatch)).toThrow(/gymrun-ai-4-ability/);
  });

  it('moved nothing else: RUN_LOG_VERSION and contentHash are the Branch 1 values, literally', () => {
    expect(RUN_LOG_VERSION).toBe('gymrun-run-13/gymrun-0.3.0');
    expect(CONTENT_HASH).toBe('b022fc4e4fdd36cb235a58b23d4690180da9488da9081726fc25ea705a66bebf');
  });

  it('is deterministic within the build: one seed, one log, twice', async () => {
    const first = await playRun('PRIORITY-DET', scriptedRunPolicy(greedyAiPolicy));
    const second = await playRun('PRIORITY-DET', scriptedRunPolicy(greedyAiPolicy));
    expect(JSON.stringify(second.log)).toBe(JSON.stringify(first.log));
    expect(second.outcome).toBe(first.outcome);
    expect(second.state.history.map((visit) => visit.result)).toEqual(first.state.history.map((visit) => visit.result));
  });
});
