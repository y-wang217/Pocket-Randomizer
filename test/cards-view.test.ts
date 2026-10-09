/** `viewOf`, the sandbox's UI contract. **Card battle engine, checkpoint 5.** */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/cards/create';
import { select } from '../src/core/cards/plan';
import { viewOf } from '../src/core/cards/view';
import { at, board, iidOf } from './fixtures/card-battle';

describe('viewOf', () => {
  it('draws 18 tiles with their zones, occupants and telegraphs', () => {
    const created = createBattle('test', 'VIEW');
    if (!created.ok) throw new Error('create');
    const view = viewOf(created.state);
    expect(view.tiles).toHaveLength(18);
    expect(view.tiles.filter((t) => t.zone === 'danger')).toHaveLength(6);
    expect(view.tiles.filter((t) => t.occupant?.kind === 'unit')).toHaveLength(3);
    expect(view.tiles.filter((t) => t.occupant?.kind === 'enemy')).toHaveLength(3);
    for (const enemy of created.state.enemies) {
      for (const tile of enemy.intent!.tiles) {
        expect(view.tiles.find((t) => t.pos.lane === tile.lane && t.pos.col === tile.col)!.telegraphedBy).toContain(enemy.id);
      }
    }
    expect(view.canCommit).toBe(true);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('groups the hand by owner in deck order, Neutrals last', () => {
    const view = viewOf(board({ hand: ['attack', 'dash', 'shoot', 'focus', 'move'] }));
    expect(view.hand.map((g) => g.owner)).toEqual(['A', 'B', 'C', 'neutral']);
    expect(view.hand.at(-1)!.cards.map((c) => c.def)).toEqual(['attack', 'move']);
  });

  it('says what a card needs, whether it is playable and why not', () => {
    const view = viewOf(board({ hand: ['slash', 'move', 'command', 'moon-strike', 'fire'], mp: { A: 1, B: 1, C: 1 } }));
    const card = (def: string) => view.hand.flatMap((g) => g.cards).find((c) => c.def === def)!;
    expect(card('move')).toMatchObject({ needs: 'tile', playable: true, players: ['A', 'B', 'C'] });
    expect(card('command')).toMatchObject({ needs: 'unitThenTile', playable: true, players: ['A'] });
    expect(card('slash')).toMatchObject({ playable: false, reason: 'wrongZone' });
    expect(card('moon-strike')).toMatchObject({ needs: 'unit', playable: false, reason: 'noMp' });
    expect(card('fire')).toMatchObject({ needs: 'tile', playable: false, reason: 'wrongZone' });
  });

  it('shows the plan: slots, reserved MP, a planned card and its destination ghost', () => {
    let state = board({ hand: ['dash', 'command'], mp: { A: 1, C: 1 } });
    const step = (action: Parameters<typeof select>[1]) => {
      const result = select(state, action);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    };
    step({ type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(3, 4) } });
    step({ type: 'select', card: iidOf(state, 'command'), unit: 'A', choice: { unit: 'B', tile: at(2, 3) } });
    const view = viewOf(state);
    const c = view.units.find((u) => u.id === 'C')!;
    expect(c).toMatchObject({ reserved: 1, projected: at(3, 4), pos: at(3, 2) });
    expect(c.planned).toEqual([{ planIndex: 0, card: iidOf(state, 'dash'), name: 'Dash' }]);
    expect(view.units.find((u) => u.id === 'B')!.planned).toEqual([{ planIndex: 1, card: iidOf(state, 'command'), name: 'Command', by: 'A' }]);
    expect(view.tiles.find((t) => t.pos.lane === 3 && t.pos.col === 4)!.planGhost).toBe('C');
    expect(view.hand.flatMap((g) => g.cards).find((card) => card.def === 'dash')).toMatchObject({ planned: true, playable: false, reason: null });
  });

  it('offers nothing to play once the battle is over', () => {
    const view = viewOf({ ...board({ hand: ['move'] }), phase: 'won' });
    expect(view.canCommit).toBe(false);
    expect(view.hand[0]!.cards[0]).toMatchObject({ playable: false, reason: null });
  });
});
