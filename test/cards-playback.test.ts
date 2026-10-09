/**
 * `playback.ts`: a committed round as the steps the sandbox plays back and the
 * round log lists, in the order the round resolved.
 */
import { describe, expect, it } from 'vitest';

import { select } from '../src/core/cards/plan';
import type { BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { roundSteps, wayOf } from '../src/ui/cardbattle/playback';
import { at, board, iidOf } from './fixtures/card-battle';

function play(state: BattleState, def: string, unit: UnitId, choice?: Choice): BattleState {
  const card = iidOf(state, def);
  const result = select(state, choice ? { type: 'select', card, unit, choice } : { type: 'select', card, unit });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('roundSteps', () => {
  it('lists the cards in the order they were planned, each with the board it left', () => {
    let state = board({ hand: ['attack', 'move'], mp: { C: 1 }, units: { C: at(3, 2) } });
    state = play(state, 'attack', 'C');
    state = play(state, 'move', 'C', { tile: at(3, 3) });
    const result = step(state, { type: 'commit' });
    if (!result.ok) throw new Error(result.reason);
    const steps = roundSteps(state, result.events, result.state);

    const cards = steps.filter((s) => s.kind === 'card');
    expect(cards.map((s) => s.title)).toEqual(['C · Attack', 'C · Move']);
    expect(cards[0]!.actor).toBe('C');
    expect(cards[0]!.hits.map((h) => h.id)).toEqual(['e2']);
    expect(cards[0]!.tiles.length).toBeGreaterThan(0);
    // The Attack's picture still has C where it fired from; the Move's has it moved.
    expect(cards[0]!.state.units.find((u) => u.id === 'C')!.pos).toEqual(at(3, 2));
    expect(cards[1]!.state.units.find((u) => u.id === 'C')!.pos).toEqual(at(3, 3));
    expect(cards[1]!.moves).toEqual([{ id: 'C', from: at(3, 2), to: at(3, 3) }]);
    // The last step shows the state the engine returned.
    expect(steps.at(-1)!.state).toBe(result.state);
  });

  it("says when a unit's shield wears off as the next round starts", () => {
    let state = board({ hand: ['call-medic'], mp: { A: 1 } });
    for (const enemy of state.enemies) enemy.intent = { act: 'none', n: 0, tiles: [] };
    state = play(state, 'call-medic', 'A', { unit: 'A' });
    const result = step(state, { type: 'commit' });
    if (!result.ok) throw new Error(result.reason);
    const steps = roundSteps(state, result.events, result.state);
    expect(steps.find((s) => s.kind === 'card')!.lines).toContain('A shield +1');
    expect(steps.find((s) => s.kind === 'round' && !s.quiet)!.lines).toContain('A shield 1 wears off');
  });
});

describe('wayOf', () => {
  it('names a move as the screen shows it: lanes left to right, column 1 at the bottom', () => {
    expect(wayOf(at(3, 3), at(2, 4))).toBe('left 1, up 1');
    expect(wayOf(at(1, 2), at(3, 2))).toBe('right 2');
    expect(wayOf(at(2, 5), at(2, 4))).toBe('down 1');
  });
});
