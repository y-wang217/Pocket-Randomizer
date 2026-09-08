/**
 * Stage 4's protocol tests: the four request states, asserted against the sim
 * rather than against our model of it.
 *
 * Every assertion in this file that could be made against a `BattleView` *and*
 * against the protocol is made against the protocol. That is the point of the
 * file. The view is our translation of the request, and a test that only reads
 * the view is a test of the translation agreeing with itself — which is exactly
 * the bug this stage started with, where the view reported a switch as legal
 * and the engine refused it.
 */
import { describe, expect, it } from 'vitest';

import { createBattle, runBattle, type BattleSession } from '../src/core/battle/driver';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import {
  canSwitch,
  hasReserves,
  isWaiting,
  legalChoices,
  rejectionReason,
  usableSwitches,
} from '../src/core/battle/switching';
import { moveChoice, switchChoice, type Choice, type TeamSpec } from '../src/core/types';

/** A bulky lead with a bench behind it. */
const PARTY: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Curse'], level: 50 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Sludge Bomb'], level: 50 },
  { species: 'Blissey', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled'], level: 50 },
];

/** Nothing trapping, nothing unusual. The control opponent. */
const PLAIN: TeamSpec = [
  { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald', 'Recover'], level: 50 },
  { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird', 'Roost'], level: 50 },
];

/** Arena Trap, which the sim reports as `maybeTrapped` until it is revealed. */
const TRAPPER: TeamSpec = [{ species: 'Dugtrio', ability: 'Arena Trap', moves: ['Earthquake'], level: 50 }];

/** A lead that cannot survive one hit, so the faint lands on turn one. */
const GLASS: TeamSpec = [
  { species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
];

/** The same lead with nothing behind it: a faint here ends the battle. */
const GLASS_ALONE: TeamSpec = [{ species: 'Magikarp', ability: 'Swift Swim', moves: ['Splash'], level: 5 }];

/**
 * One-shots the glass leads above, and has a bench of its own.
 *
 * Earthquake rather than a stronger signature move because it never misses:
 * the first cut used Precipice Blades and the tests below became a coin flip on
 * its 85% accuracy, failing on some seeds and passing on others. A test of the
 * forced-switch protocol must not also be a test of an accuracy roll.
 */
const HAMMER: TeamSpec = [
  { species: 'Groudon', ability: 'Drought', moves: ['Earthquake'], level: 100 },
  { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 },
];

function start(p1: TeamSpec, p2: TeamSpec, seed = 'SWITCH'): BattleSession {
  return createBattle({ teams: { p1, p2 }, seed });
}

/** Protocol lines for one side, with the timestamps stripped. */
function lines(session: BattleSession, side: 'p1' | 'p2' = 'p1'): string[] {
  return session.protocolFor(side).filter((line) => !line.startsWith('|t:|'));
}

describe('forced switch', () => {
  it('asks for a switch and nothing else when the active faints with a bench left', () => {
    const session = start(GLASS, HAMMER);
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    expect(lines(session).some((line) => line.startsWith('|faint|p1a'))).toBe(true);

    const view = session.viewFor('p1');
    expect(view.forceSwitch).toBe(true);
    expect(view.awaitingChoice).toBe(true);
    // No move is legal, and the choice set says so rather than the caller
    // having to know that `moves` being empty means something.
    expect(view.moves).toEqual([]);
    expect(legalChoices(view).every((choice) => choice.kind === 'switch')).toBe(true);
    expect(rejectionReason(view, moveChoice(1))).toMatch(/wants a switch/);
  });

  it('answers the forced switch and puts the incoming member on the field', () => {
    const session = start(GLASS, HAMMER);
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    const forced = session.viewFor('p1');
    const gengar = usableSwitches(forced).find((member) => member.species === 'Gengar');
    expect(gengar).toBeDefined();
    session.submit('p1', switchChoice(gengar!.slot));

    expect(lines(session).some((line) => line.startsWith('|switch|p1a') && line.includes('Gengar'))).toBe(true);
    expect(session.viewFor('p1').me.species).toBe('Gengar');
    expect(session.ended).toBe(false);
  });

  it('is not a turn: the sim does not advance the turn counter to resolve it', () => {
    const session = start(GLASS, HAMMER);
    const before = session.turn;
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));
    // The faint happened during turn 1; the replacement is still part of it.
    expect(session.viewFor('p1').forceSwitch).toBe(true);
    expect(session.turn).toBe(before);
  });
});

describe('wipe', () => {
  it('ends the battle rather than asking for a switch when nothing is left', () => {
    const session = start(GLASS_ALONE, HAMMER);
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    expect(session.ended).toBe(true);
    expect(session.result?.winner).toBe('p2');
    expect(session.result?.cause).toBe('faint');
    expect(session.viewFor('p1').forceSwitch).toBe(false);
    expect(lines(session).some((line) => line.startsWith('|win|'))).toBe(true);
  });

  it('reports no reserves once the whole bench has fainted', () => {
    const session = start(GLASS_ALONE, HAMMER);
    expect(hasReserves(session.viewFor('p1'))).toBe(false);
    expect(canSwitch(session.viewFor('p1'))).toBe(false);
  });
});

describe('wait requests', () => {
  /*
   * The single most likely bug in this stage.
   *
   * While p1 resolves a forced switch, p2's request is `{wait: true}`. It is not
   * a turn and not an empty choice — answering it desyncs the battle, and the
   * symptom is not an error but a later turn resolving with the wrong action.
   */
  it('leaves the other side waiting, not choosing, during a forced switch', () => {
    const session = start(GLASS, HAMMER);
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    const waiting = session.viewFor('p2');
    expect(waiting.awaitingChoice).toBe(false);
    expect(isWaiting(waiting)).toBe(true);
    expect(waiting.moves).toEqual([]);
    expect(legalChoices(waiting)).toEqual([]);
  });

  it('refuses a choice submitted against a wait rather than desyncing', () => {
    const session = start(GLASS, HAMMER);
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    expect(() => session.submit('p2', moveChoice(1))).toThrow(/wait/);
  });

  it('plays through a mid-battle faint without desyncing, both sides benched', async () => {
    // The end-to-end version: a full battle where both sides have reserves, so
    // both sides meet forced switches and waits. A desync shows up here as a
    // thrown choice error or a battle that never ends.
    const run = await runBattle(GLASS, HAMMER, 'WAIT-E2E', firstUsableMovePolicy, firstUsableMovePolicy);
    expect(run.result.winner).not.toBeNull();
    expect(run.protocol.some((line) => line.startsWith('|win|'))).toBe(true);
  });
});

describe('switch cost', () => {
  /*
   * Asserted against the protocol on purpose. The rule — a switch consumes the
   * turn, and the incoming member takes the opponent's attack — is Showdown's,
   * not ours, and a test that read our own HP bookkeeping would pass even if we
   * had quietly invented a discounted switch.
   */
  it('consumes the turn and lands the opponent move on the incoming member', () => {
    const session = start(PARTY, PLAIN, 'COST');
    const incoming = session.viewFor('p1').switches.find((member) => member.species === 'Gengar')!;

    session.submit('p1', switchChoice(incoming.slot));
    session.submit('p2', moveChoice(1));

    const log = lines(session);
    const switchLine = log.findIndex((line) => line.startsWith('|switch|p1a') && line.includes('Gengar'));
    const moveLine = log.findIndex((line) => line.startsWith('|move|p2a'));

    expect(switchLine).toBeGreaterThanOrEqual(0);
    expect(moveLine).toBeGreaterThan(switchLine);
    // The damage lands on the Pokemon that came in, not the one that left.
    expect(log.some((line) => line.startsWith('|-damage|p1a') && line.includes('Gengar'))).toBe(true);
    // p1 got no move in: the switch *was* the turn.
    expect(log.some((line) => line.startsWith('|move|p1a'))).toBe(false);
    expect(session.turn).toBe(2);
  });

  it('leaves the outgoing member on the bench at the HP it left with', () => {
    const session = start(PARTY, PLAIN, 'COST-2');
    const before = session.viewFor('p1').me.hp;
    const incoming = session.viewFor('p1').switches.find((member) => member.species === 'Gengar')!;

    session.submit('p1', switchChoice(incoming.slot));
    session.submit('p2', moveChoice(1));

    const snorlax = session.viewFor('p1').switches.find((member) => member.species === 'Snorlax')!;
    expect(snorlax.hp).toBe(before);
    expect(snorlax.block).toBe(null);
  });
});

describe('trapping', () => {
  /*
   * The bug this stage actually had.
   *
   * An unrevealed Arena Trap arrives as `maybeTrapped`, not `trapped`. Reading
   * only `trapped` made the view report a legal switch that the sim then
   * refused — and under `strictChoices` a refusal is a throw mid-battle.
   */
  it('reads the block off the request, including an unrevealed trapping ability', () => {
    const session = start(PARTY, TRAPPER);
    const view = session.viewFor('p1');

    expect(view.trapped).toBe(true);
    expect(canSwitch(view)).toBe(false);
    for (const member of view.switches.filter((entry) => entry.species !== 'Snorlax')) {
      expect(member.usable).toBe(false);
      expect(member.block).toBe('maybe-trapped');
    }
    // The active Pokemon is blocked for its own reason, which the screen shows
    // instead of "trapped" — it is on the field, not held back.
    expect(view.switches.find((member) => member.species === 'Snorlax')?.block).toBe('active');
  });

  it('offers only moves while trapped, and refuses the switch by name', () => {
    const session = start(PARTY, TRAPPER);
    const view = session.viewFor('p1');

    expect(legalChoices(view).every((choice) => choice.kind === 'move')).toBe(true);
    expect(rejectionReason(view, switchChoice(2))).toMatch(/maybe-trapped/);
    expect(() => session.submit('p1', switchChoice(2))).toThrow(/Illegal choice switch 2/);
  });

  it('does not trap on a forced switch, where trapping does not apply', () => {
    const session = start(GLASS, [...TRAPPER, { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }]);
    // Dugtrio out-speeds and kills the level-5 Magikarp outright.
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    const view = session.viewFor('p1');
    expect(view.forceSwitch).toBe(true);
    expect(view.trapped).toBe(false);
    expect(usableSwitches(view).map((member) => member.species)).toEqual(['Gengar']);
  });

  it('leaves an untrapped side free to switch', () => {
    const view = start(PARTY, PLAIN).viewFor('p1');
    expect(view.trapped).toBe(false);
    expect(usableSwitches(view).map((member) => member.species)).toEqual(['Gengar', 'Blissey']);
  });
});

describe('choice lock', () => {
  /*
   * Stage 3 flagged Choice items as a possible trap with no switching. They
   * lock the *move* and never the switch, which is the mechanic that makes them
   * playable — and now that switching exists it is worth asserting rather than
   * assuming.
   */
  const CHOICED: TeamSpec = [
    { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Curse'], level: 50, item: 'Choice Band' },
    { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
  ];

  it('locks the move but leaves the switch legal', () => {
    const session = start(CHOICED, PLAIN, 'CHOICE');
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    const view = session.viewFor('p1');
    expect(view.moves.find((move) => move.name === 'Curse')?.usable).toBe(false);
    expect(view.moves.find((move) => move.name === 'Body Slam')?.usable).toBe(true);

    expect(view.trapped).toBe(false);
    expect(canSwitch(view)).toBe(true);
    expect(rejectionReason(view, switchChoice(2))).toBe(null);
    expect(rejectionReason(view, moveChoice(2))).toMatch(/not usable/);
  });

  it('lets the switch actually resolve, which is the point of it not being a trap', () => {
    const session = start(CHOICED, PLAIN, 'CHOICE-2');
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));
    session.submit('p1', switchChoice(2));
    session.submit('p2', moveChoice(1));

    expect(session.viewFor('p1').me.species).toBe('Gengar');
  });
});

describe('the choice set', () => {
  it('offers moves and switches together on an ordinary turn', () => {
    const view = start(PARTY, PLAIN).viewFor('p1');
    const choices: Choice[] = legalChoices(view);

    expect(choices.filter((choice) => choice.kind === 'move')).toHaveLength(2);
    expect(choices.filter((choice) => choice.kind === 'switch')).toHaveLength(2);
    // Moves first, then switches, and both in slot order. Not cosmetic: an AI
    // that maximises over this list breaks ties toward the earlier entry, so an
    // unspecified order would make a seed stop reproducing.
    expect(choices.map((choice) => `${choice.kind} ${choice.slot}`)).toEqual([
      'move 1',
      'move 2',
      'switch 2',
      'switch 3',
    ]);
  });

  it('is empty once the battle is over', () => {
    const session = start(GLASS_ALONE, HAMMER);
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));
    expect(legalChoices(session.viewFor('p1'))).toEqual([]);
    expect(isWaiting(session.viewFor('p1'))).toBe(false);
  });

  it('records switches in the battle log as a switch, not a move', () => {
    const session = start(PARTY, PLAIN, 'LOG');
    session.submit('p1', switchChoice(2));
    session.submit('p2', moveChoice(1));

    const mine = session.toBattleLog().decisions.filter((decision) => decision.side === 'p1');
    expect(mine).toHaveLength(1);
    expect(mine[0]?.choice).toEqual({ kind: 'switch', slot: 2 });
  });
});
