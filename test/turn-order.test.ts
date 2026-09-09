/**
 * Priority, turn order, and switches — asserted against the protocol.
 *
 * ## The verification this file was written to perform
 *
 * The Stage 4.5.2 playtest said "priority doesn't exist, implement priority
 * moves". Before writing a line of mechanics, the hypothesis to disconfirm was
 * that priority *already* worked and was merely invisible — @pkmn/sim resolves
 * turn order natively and GYMRUN never computes it, so there should have been
 * nothing to implement.
 *
 * The first two tests are that disconfirmation attempt, and they are made
 * **against the raw battle protocol rather than against any internal state**,
 * exactly as the spec asks. If the sim had been reordering, or the driver had
 * been re-sorting the stream on its way out, these would fail and the bug would
 * be real. They pass: priority works, and the finding is that this was a
 * display problem all along.
 *
 * The rest of the file tests the display fix — that `readTurns` reports the
 * sequence the engine produced and marks a bracket-driven turn as one.
 */
import { describe, expect, it } from 'vitest';

import { createBattle, movePriority, type BattleSession } from '../src/core/battle/driver';
import { readTurns } from '../src/core/battle/turnOrder';
import { moveChoice, type TeamSpec } from '../src/core/types';

/**
 * Snorlax: base 30 Speed. Jolteon: base 130. At the same level the gap is
 * enormous and no roll can close it, so an order flip is a bracket and nothing
 * else. Both moves are 100% accurate — a miss would make this a test of an
 * accuracy roll — and both are physical Normal moves so nothing but priority
 * separates them.
 */
const SLOW: TeamSpec = [
  { species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Tackle'], level: 50 },
];
const FAST: TeamSpec = [
  { species: 'Jolteon', ability: 'Volt Absorb', moves: ['Tackle', 'Quick Attack'], level: 50 },
];

/** A bench to switch to, for the switch-indication tests. */
const WITH_BENCH: TeamSpec = [
  { species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 50 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
];

function lines(session: BattleSession, side: 'p1' | 'p2' = 'p1'): string[] {
  return session.protocolFor(side).filter((line) => !line.startsWith('|t:|'));
}

/** Only the `|move|` lines, in the order the engine emitted them. */
function moveLines(session: BattleSession, side: 'p1' | 'p2' = 'p1'): string[] {
  return lines(session, side).filter((line) => line.startsWith('|move|'));
}

describe('priority, against the raw protocol', () => {
  /**
   * **The disconfirmation test the spec asks for by name.**
   *
   * A slower Pokemon using a priority move must produce its `|move|` line
   * first. Asserted on the protocol stream, not on a view, a projection or a
   * `BattleFacts` — those are our translation of the turn, and a test of the
   * translation agreeing with itself would pass whether or not the engine
   * actually did what it says.
   */
  it('resolves a slower priority move before a faster ordinary one', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    session.submit('p1', moveChoice(1)); // Snorlax, Quick Attack (+1)
    session.submit('p2', moveChoice(1)); // Jolteon, Tackle (0)

    const moves = moveLines(session);
    expect(moves[0]).toContain('Quick Attack');
    expect(moves[0]).toContain('p1a: Snorlax');
    expect(moves[1]).toContain('p2a: Jolteon');
  });

  /**
   * The control, and the half that makes the first test mean anything.
   *
   * Same two Pokemon, same seed, Snorlax on Tackle instead: Jolteon goes first.
   * Without this, the test above would also pass in a world where the engine
   * simply always moved p1 first.
   */
  it('resolves by Speed when neither move has a bracket', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    session.submit('p1', moveChoice(2)); // Snorlax, Tackle (0)
    session.submit('p2', moveChoice(1)); // Jolteon, Tackle (0)

    const moves = moveLines(session);
    expect(moves[0]).toContain('p2a: Jolteon');
    expect(moves[1]).toContain('p1a: Snorlax');
  });

  it('reads brackets off the dex rather than off the move pools', () => {
    expect(movePriority('Quick Attack')).toBe(1);
    expect(movePriority('Extreme Speed')).toBe(2);
    expect(movePriority('Tackle')).toBe(0);
    // Negative brackets exist and must not be flattened to zero.
    expect(movePriority('Roar')).toBeLessThan(0);
    // An id the dex does not have is 0 rather than a throw: the log is a
    // display path, and an unknown move should cost a marker, not the screen.
    expect(movePriority('not-a-move')).toBe(0);
  });
});

describe('reading the protocol as turns', () => {
  it('reports actions in resolution order, and marks the bracket-driven one', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));

    const turns = readTurns(lines(session), movePriority);
    const first = turns.find((group) => group.turn === 1);
    expect(first).toBeDefined();

    const actions = first?.actions.filter((action) => action.kind === 'move') ?? [];
    expect(actions).toHaveLength(2);

    expect(actions[0]).toMatchObject({
      kind: 'move',
      side: 'p1',
      actor: 'Snorlax',
      move: 'Quick Attack',
      order: 1,
      priority: true,
      bracket: 1,
    });
    expect(actions[1]).toMatchObject({ side: 'p2', move: 'Tackle', order: 2, priority: false });
  });

  it('marks nothing when the turn was decided by Speed', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    session.submit('p1', moveChoice(2));
    session.submit('p2', moveChoice(1));

    const turns = readTurns(lines(session), movePriority);
    const actions = turns.find((group) => group.turn === 1)?.actions ?? [];
    expect(actions.every((action) => action.kind !== 'move' || !action.priority)).toBe(true);
    expect(actions[0]).toMatchObject({ side: 'p2', order: 1 });
  });

  /**
   * The conservative case, and the reason the rule is "brackets differ" rather
   * than "a priority move was used".
   *
   * Quick Attack into Quick Attack is a Speed decision that happens to occur in
   * the +1 bracket. Marking the winner as priority-driven would teach the player
   * that Quick Attack goes first against Quick Attack, which is not a rule.
   */
  it('marks nothing when both moves share a bracket', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    session.submit('p1', moveChoice(1)); // Quick Attack
    session.submit('p2', moveChoice(2)); // Quick Attack

    const turns = readTurns(lines(session), movePriority);
    const moves = (turns.find((group) => group.turn === 1)?.actions ?? []).filter(
      (action) => action.kind === 'move',
    );
    expect(moves).toHaveLength(2);
    expect(moves.every((action) => action.kind === 'move' && !action.priority)).toBe(true);
    // Both are in the +1 bracket, and Jolteon still wins it on Speed.
    expect(moves[0]).toMatchObject({ side: 'p2', bracket: 1 });
  });

  it('gives a switch its own action, generic over which side switched', () => {
    const session = createBattle({ teams: { p1: WITH_BENCH, p2: FAST }, seed: 'SWITCHLOG' });
    session.submit('p1', { kind: 'switch', slot: 2 });
    session.submit('p2', moveChoice(1));

    const turns = readTurns(lines(session), movePriority);
    const switches = turns
      .flatMap((group) => group.actions)
      .filter((action) => action.kind === 'switch');

    // The opening switch-ins, plus the voluntary one. Nothing here is keyed to
    // p1: player switching is Stage 4's and the opponent's is Stage 5's, and
    // the reader does not care which.
    expect(switches.length).toBeGreaterThanOrEqual(3);
    const voluntary = switches.find((action) => action.actor === 'Gengar');
    expect(voluntary).toMatchObject({ kind: 'switch', side: 'p1', from: 'Snorlax' });
  });

  it('puts the opening switch-ins in a group with no turn number', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    const turns = readTurns(lines(session), movePriority);

    const opening = turns[0];
    expect(opening?.turn).toBeNull();
    expect(opening?.actions.map((action) => action.actor)).toEqual(['Snorlax', 'Jolteon']);
    // Nothing was withdrawn to bring them in, and the reader must not invent
    // a `from` for the first Pokemon each side sends out.
    expect(opening?.actions.every((action) => action.kind === 'switch' && action.from === null)).toBe(true);
  });

  it('is a pure function of the lines it is given', () => {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed: 'PRIORITY' });
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));
    const protocol = lines(session);

    expect(readTurns(protocol, movePriority)).toEqual(readTurns(protocol, movePriority));
  });
});
