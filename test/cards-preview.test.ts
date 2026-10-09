/** `preview.ts`: what a card or a telegraph will do, before the round resolves. */
import { describe, expect, it } from 'vitest';

import { choicesFor } from '../src/core/cards/legal';
import { select } from '../src/core/cards/plan';
import { interceptsFor, previewPlay } from '../src/core/cards/preview';
import type { BattleState } from '../src/core/cards/state';
import { at, board, iidOf } from './fixtures/card-battle';

function planned(state: BattleState, action: Parameters<typeof select>[1]): BattleState {
  const result = select(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/** Every enemy waiting except the ones a test arms. */
function quiet(state: BattleState): BattleState {
  for (const enemy of state.enemies) enemy.intent = { act: 'none', n: 0, tiles: [] };
  return state;
}

describe('previewPlay', () => {
  it('lights a Strike up its lane to the first enemy and stops there', () => {
    const state = quiet(board({ hand: ['attack'], units: { A: at(1, 1), B: at(2, 1), C: at(3, 1) }, enemies: [at(3, 4), at(3, 6), null] }));
    const preview = previewPlay(state, { card: iidOf(state, 'attack'), unit: 'C' });
    expect(preview.attack).toEqual({
      act: 'strike',
      n: 1,
      tiles: [
        { pos: at(3, 2), stop: false },
        { pos: at(3, 3), stop: false },
        { pos: at(3, 4), stop: true },
      ],
    });
    expect(preview.targets).toEqual([]);
  });

  it('fires from where the Moves planned before it leave the unit, since the plan resolves in order', () => {
    let state = quiet(board({ hand: ['attack', 'dash'], mp: { C: 2 }, units: { A: at(1, 1), B: at(2, 1), C: at(3, 1) }, enemies: [at(2, 5), null, null] }));
    const attack = { card: iidOf(state, 'attack'), unit: 'C' as const };
    // From where C stands now, its lane is empty: the Strike lights it all and stops nowhere.
    expect(previewPlay(state, attack).attack!.tiles.every((t) => t.pos.lane === 3 && !t.stop)).toBe(true);
    state = planned(state, { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(2, 2) } });
    state = planned(state, { type: 'select', ...attack });
    expect(previewPlay(state, state.plan[1]!, 1).attack!.tiles).toEqual([
      { pos: at(2, 3), stop: false },
      { pos: at(2, 4), stop: false },
      { pos: at(2, 5), stop: true },
    ]);
  });

  it('fires from where the unit stands when its Move is planned after it', () => {
    let state = quiet(board({ hand: ['attack', 'dash'], mp: { C: 2 }, units: { A: at(1, 1), B: at(2, 1), C: at(3, 1) }, enemies: [at(3, 5), null, null] }));
    state = planned(state, { type: 'select', card: iidOf(state, 'attack'), unit: 'C' });
    state = planned(state, { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(2, 2) } });
    expect(previewPlay(state, state.plan[0]!, 0).attack!.tiles.at(-1)).toEqual({ pos: at(3, 5), stop: true });
  });

  it("reads B's first card as a Pierce while B is at full HP", () => {
    const state = quiet(board({ hand: ['attack'], units: { A: at(1, 1), B: at(2, 1), C: at(3, 1) }, enemies: [at(2, 4), at(2, 6), null] }));
    const play = { card: iidOf(state, 'attack'), unit: 'B' as const };
    const preview = previewPlay(state, play);
    expect(preview.attack!.act).toBe('pierce');
    expect(preview.attack!.tiles.map((t) => t.pos.col)).toEqual([2, 3, 4, 5, 6, 7]);
    state.units.find((u) => u.id === 'B')!.hp -= 1;
    expect(previewPlay(state, play).attack!.act).toBe('strike');
  });

  it('holds a reticle on what a card that deals no damage lands on', () => {
    const state = quiet(board({ hand: ['prep'] }));
    expect(previewPlay(state, { card: iidOf(state, 'prep'), unit: 'C' })).toEqual({ attack: null, targets: ['C'], allies: [] });
  });
});

describe('interceptsFor', () => {
  it('marks the destination that steps in front of a Strike aimed at an ally', () => {
    const state = quiet(board({ hand: ['move'], units: { A: at(1, 1), B: at(2, 2), C: at(3, 1) }, enemies: [at(3, 5), null, null] }));
    const strike = state.enemies[0]!;
    strike.intent = { act: 'strike', n: 1, tiles: [at(3, 4), at(3, 3), at(3, 2), at(3, 1)] };
    const card = iidOf(state, 'move');
    const tiles = choicesFor(state, card, 'B').tiles;
    expect(tiles).toContainEqual(at(3, 2));
    expect(interceptsFor(state, card, 'B', tiles)).toEqual([{ pos: at(3, 2), blocks: [strike.id] }]);
  });

  it('marks nothing for the unit already being struck, or against a Pierce', () => {
    const state = quiet(board({ hand: ['move'], units: { A: at(1, 1), B: at(2, 2), C: at(3, 1) }, enemies: [at(3, 5), null, null] }));
    const enemy = state.enemies[0]!;
    enemy.intent = { act: 'strike', n: 1, tiles: [at(3, 4), at(3, 3), at(3, 2), at(3, 1)] };
    const card = iidOf(state, 'move');
    expect(interceptsFor(state, card, 'C', choicesFor(state, card, 'C').tiles)).toEqual([]);
    enemy.intent = { ...enemy.intent, act: 'pierce' };
    expect(interceptsFor(state, card, 'B', choicesFor(state, card, 'B').tiles)).toEqual([]);
  });
});
