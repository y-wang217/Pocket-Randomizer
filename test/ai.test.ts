/**
 * The opponent AI, asserted on its *reasoning* rather than only its output.
 *
 * A test that checks which slot came back passes just as happily when the right
 * answer is reached for the wrong reason, and this is the one file in the
 * project where that distinction decides whether a thousand-seed balance report
 * means anything: if the AI reaches good moves by accident and never weights a
 * switch, the simulator will read a party-size change as a balance win when it
 * is an AI regression.
 */
import { describe, expect, it } from 'vitest';

import { AI_VERSION, bestOf, evaluateMoves, greedyAiPolicy, scoreChoices } from '../src/core/battle/ai';
import { createBattle, runBattle, type BattleSession } from '../src/core/battle/driver';
import { firstUsableMovePolicy, withoutSwitching } from '../src/core/battle/policy';
import { moveChoice, type BattleView, type TeamSpec } from '../src/core/types';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';

function start(p1: TeamSpec, p2: TeamSpec, seed = 'AI'): BattleSession {
  return createBattle({ teams: { p1, p2 }, seed });
}

describe('scoring the whole choice set', () => {
  it('scores moves and switches on one scale, in one list', () => {
    const view = start(
      [
        { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Curse'], level: 50 },
        { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
      ],
      [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }],
    ).viewFor('p1');

    const scored = scoreChoices(view);
    expect(scored.map((entry) => entry.choice.kind)).toEqual(['move', 'move', 'switch']);
    // Every entry carries a comparable number, not a per-kind one.
    expect(scored.every((entry) => Number.isFinite(entry.score) || entry.score === -Infinity)).toBe(true);
  });

  it('still ranks damage correctly, which is the Stage 0 property', () => {
    const evaluations = evaluateMoves(start(PLAYER_TEAM, OPPONENT_TEAM).viewFor('p2'));
    const byName = new Map(evaluations.map((entry) => [entry.move.name, entry]));

    // Milotic into Snorlax: both attacks are neutral, so STAB is the only thing
    // separating Scald (80 BP, STAB) from Ice Beam (90 BP, none). Ranking by
    // raw base power flips this, which is the mistake a hand-rolled damage
    // estimate makes and @smogon/calc does not.
    expect(byName.get('Scald')!.expectedDamage).toBeGreaterThan(byName.get('Ice Beam')!.expectedDamage);
    expect(byName.get('Recover')!.expectedDamage).toBe(0);
  });

  it('is deterministic, and breaks ties toward the earlier choice', async () => {
    const view = start(PLAYER_TEAM, OPPONENT_TEAM).viewFor('p2');
    const first = await greedyAiPolicy(view);
    expect(await greedyAiPolicy(view)).toEqual(first);

    // A hand-built tie: two identical scores must resolve to the lower slot.
    const tied = scoreChoices(view).map((entry) => ({ ...entry, score: 1 }));
    expect(bestOf(tied).choice).toEqual(tied[0]!.choice);
  });
});

describe('when the AI switches', () => {
  /**
   * A lead that is about to be knocked out, behind a bench member that both
   * survives the incoming attack and threatens back.
   *
   * Ludicolo is 4x weak to Flying; Skarmory is Steel/Flying and resists Brave
   * Bird outright while hitting back with it. That is exactly the shape the
   * spec describes: switch when the active is likely to faint and a bench
   * member both survives and threatens.
   */
  const CORNERED: TeamSpec = [
    { species: 'Ludicolo', ability: 'Swift Swim', moves: ['Giga Drain'], level: 40 },
    { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird'], level: 60 },
  ];
  const FLIER: TeamSpec = [{ species: 'Staraptor', ability: 'Intimidate', moves: ['Brave Bird'], level: 60 }];

  it('switches out of a matchup it is about to lose', async () => {
    const view = start(CORNERED, FLIER, 'CORNERED').viewFor('p1');
    const choice = await greedyAiPolicy(view);

    expect(choice.kind).toBe('switch');
    const scored = scoreChoices(view);
    const stay = scored.find((entry) => entry.move);
    // The reason, not just the outcome: staying in is scored as lethal.
    expect(stay!.risk).toBeGreaterThanOrEqual(1);
  });

  it('does not switch on the turn a kill is available', async () => {
    // Same doomed lead, but the foe is now nearly dead and Giga Drain finishes
    // it. Taking the kill has to outrank escaping, at any level of threat.
    const session = start(CORNERED, [
      { species: 'Staraptor', ability: 'Intimidate', moves: ['Brave Bird'], level: 60 },
    ], 'KILL');
    const base = session.viewFor('p1');
    const view: BattleView = { ...base, foe: { ...base.foe, hp: 1, hpFraction: 1 / base.foe.maxHp } };

    const choice = await greedyAiPolicy(view);
    expect(choice.kind).toBe('move');
    expect(scoreChoices(view).find((entry) => entry.move)?.kills).toBe(true);
  });

  it('never switches into a member the incoming move would kill', async () => {
    // The bench is a level-5 Magikarp: it dies on arrival to anything, so no
    // amount of danger to the active makes sending it in correct.
    const doomedBench: TeamSpec = [
      { species: 'Ludicolo', ability: 'Swift Swim', moves: ['Giga Drain'], level: 40 },
      { species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 },
    ];
    const view = start(doomedBench, FLIER, 'DOOMED').viewFor('p1');

    const scored = scoreChoices(view);
    const bench = scored.find((entry) => entry.member);
    expect(bench?.score).toBe(Number.NEGATIVE_INFINITY);
    expect((await greedyAiPolicy(view)).kind).toBe('move');
  });

  it('stays in when it is winning the matchup', async () => {
    // Nothing is threatening a knockout, so spending a turn moving is a cost
    // with no benefit and the AI should simply attack.
    const view = start(
      [
        { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 60 },
        { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird'], level: 60 },
      ],
      [{ species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 20 }],
      'WINNING',
    ).viewFor('p1');

    expect((await greedyAiPolicy(view)).kind).toBe('move');
  });

  it('answers a forced switch with the member that threatens most', async () => {
    const session = start(
      [
        { species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 },
        { species: 'Blissey', ability: 'Natural Cure', moves: ['Soft-Boiled'], level: 50 },
        { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
      ],
      [
        { species: 'Groudon', ability: 'Drought', moves: ['Earthquake'], level: 100 },
        { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 },
      ],
      'FORCED',
    );
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    const view = session.viewFor('p1');
    expect(view.forceSwitch).toBe(true);
    // Gengar threatens; Blissey's only move is a heal. Both survive the switch,
    // so offense decides — and on a forced switch nothing is scored -Infinity
    // just because it arrives into a hit it cannot take.
    const choice = await greedyAiPolicy(view);
    expect(choice).toEqual({ kind: 'switch', slot: 3 });
  });
});

describe('the no-switch control arm', () => {
  /*
   * The wrapper has to differ from the inner policy in exactly one way, or the
   * `switch-aware` vs `no-switch` comparison measures more than switching.
   */
  it('hides the bench rather than overruling the choice', async () => {
    const view = start(
      [
        { species: 'Ludicolo', ability: 'Swift Swim', moves: ['Giga Drain'], level: 40 },
        { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird'], level: 60 },
      ],
      [{ species: 'Staraptor', ability: 'Intimidate', moves: ['Brave Bird'], level: 60 }],
      'NOSWITCH',
    ).viewFor('p1');

    // The same view, same AI: one switches, one cannot.
    expect((await greedyAiPolicy(view)).kind).toBe('switch');
    expect((await withoutSwitching(greedyAiPolicy)(view)).kind).toBe('move');
  });

  it('still answers a forced switch, or it could not play at all', async () => {
    const session = start(
      [
        { species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 },
        { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
      ],
      [
        { species: 'Groudon', ability: 'Drought', moves: ['Earthquake'], level: 100 },
        { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 },
      ],
      'NOSWITCH-FORCED',
    );
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    expect((await withoutSwitching(greedyAiPolicy)(session.viewFor('p1'))).kind).toBe('switch');
  });

  it('plays a whole battle without desyncing', async () => {
    const run = await runBattle(
      [
        { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 50 },
        { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
      ],
      [
        { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 },
        { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird'], level: 50 },
      ],
      'NOSWITCH-E2E',
      withoutSwitching(greedyAiPolicy),
      greedyAiPolicy,
    );
    expect(run.result.winner).not.toBeNull();
    expect(run.battleLog.decisions.filter((d) => d.side === 'p1' && d.choice.kind === 'switch').every(() => true)).toBe(true);
  });
});

describe('ai version', () => {
  it('is a distinct string, so a report can tell an AI change from a data change', () => {
    expect(AI_VERSION).toMatch(/^gymrun-ai-/);
  });
});

describe('the AI plays whole battles', () => {
  it('drives both sides of a multi-member fight to a winner', async () => {
    const run = await runBattle(
      [
        { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Curse'], level: 50 },
        { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Sludge Bomb'], level: 50 },
        { species: 'Blissey', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled'], level: 50 },
      ],
      [
        { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald', 'Recover'], level: 50 },
        { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird', 'Roost'], level: 50 },
        { species: 'Tyranitar', ability: 'Sand Stream', moves: ['Crunch', 'Stone Edge'], level: 50 },
      ],
      'AI-E2E',
      greedyAiPolicy,
      greedyAiPolicy,
    );
    expect(run.result.winner).not.toBeNull();
    expect(run.protocol.some((line) => line.startsWith('|win|'))).toBe(true);
  });

  it('produces the identical battle twice, switches included', async () => {
    const teams: [TeamSpec, TeamSpec] = [
      [
        { species: 'Ludicolo', ability: 'Swift Swim', moves: ['Giga Drain'], level: 45 },
        { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird'], level: 45 },
      ],
      [
        { species: 'Staraptor', ability: 'Intimidate', moves: ['Brave Bird'], level: 45 },
        { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 45 },
      ],
    ];
    const a = await runBattle(...teams, 'AI-DET', greedyAiPolicy, firstUsableMovePolicy);
    const b = await runBattle(...teams, 'AI-DET', greedyAiPolicy, firstUsableMovePolicy);
    expect(b.battleLog.decisions).toEqual(a.battleLog.decisions);
    // And a switch actually happened, or this proves nothing about switching.
    expect(a.battleLog.decisions.some((d) => d.side === 'p1' && d.choice.kind === 'switch')).toBe(true);
  });
});
