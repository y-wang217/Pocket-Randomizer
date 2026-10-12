/**
 * Checkpoint 4b (`docs/spec/gymrun-card-run-shapes-prompt.md`): a move card
 * may carry follow-up effects that ask for no choice of their own. They are
 * checked against the board the move leaves and resolve after it, from where
 * the unit then stands. Whirlwind (Move 1, Slash 3) and Rally (Grant Move 1,
 * Shield 1 to the ally that moves) are built on it, as first drafted.
 */
import { describe, expect, it } from 'vitest';

import { CARDS } from '../src/cardData/cards';
import { STARTING_DECK } from '../src/cardData/cardrunTables';
import { layoutBattle } from '../src/core/cards/create';
import { completeChoices } from '../src/core/cards/legal';
import { FOLLOW_UPS, followUps, isMoveCard } from '../src/core/cards/plan';
import { previewPlay } from '../src/core/cards/preview';
import type { BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { at, iidOf } from './fixtures/card-battle';

function board(card: string): { state: BattleState; iid: string } {
  const state = layoutBattle('test', 'FOLLOW', { cards: [card, ...STARTING_DECK] })!;
  const iid = iidOf(state, card);
  state.piles.draw = state.piles.draw.filter((c) => c !== iid);
  state.piles.hand.push(iid);
  state.mp = 15;
  for (const e of state.enemies) e.intent = null;
  return { state, iid };
}

describe('a move with a follow-up', () => {
  it('keeps every move card to follow-ups that need no choice of their own, and a granted move to none that hits', () => {
    for (const def of Object.values(CARDS).filter(isMoveCard)) {
      for (const effect of followUps(def)) expect(FOLLOW_UPS, `${def.id}: ${effect.k}`).toContain(effect.k);
      if (def.effects.some((e) => e.k === 'grantMove')) {
        expect(followUps(def).some((e) => ['strike', 'pierce', 'slash'].includes(e.k)), def.id).toBe(false);
      }
    }
    expect(CARDS['whirlwind']).toMatchObject({ owner: 'C', cost: 3, ult: true, effects: [{ k: 'move', n: 1 }, { k: 'slash', n: 3 }] });
    expect(CARDS['rally']).toMatchObject({ owner: 'A', effects: [{ k: 'grantMove', n: 1 }, { k: 'shield', n: 1, to: 'friendly' }] });
  });

  it('Whirlwind: offers only the tiles its Slash can hit from, then moves and slashes from there', () => {
    const { state, iid } = board('whirlwind');
    Object.assign(state.units[2]!, { pos: at(2, 3) });
    const [e0, e1, e2] = state.enemies;
    Object.assign(e0!, { pos: at(1, 5), hp: 5, baseShield: 0 });
    Object.assign(e1!, { pos: at(2, 5), hp: 5, baseShield: 0 });
    Object.assign(e2!, { pos: at(3, 7) });
    // From (2,4) the Slash reaches column 5; from (1,3) or (3,3) it reaches only column 4,
    // which is empty; (2,2) is the home row, where a Slash cannot be played.
    expect(completeChoices(state, iid, 'C')).toEqual([{ tile: at(2, 4) }]);
    expect(previewPlay(state, { card: iid, unit: 'C', choice: { tile: at(2, 4) } }).attack?.tiles.map((t) => t.pos)).toEqual(
      expect.arrayContaining([at(1, 5), at(2, 5), at(3, 5)]),
    );
    const selected = step(state, { type: 'select', card: iid, unit: 'C', choice: { tile: at(2, 4) } });
    if (!selected.ok) throw new Error(selected.reason);
    const committed = step(selected.state, { type: 'commit' });
    if (!committed.ok) throw new Error(committed.reason);
    const moved = committed.events.findIndex((e) => e.t === 'moved' && e.unit === 'C');
    const hits = committed.events.flatMap((e, i) => (e.t === 'damaged' ? [[i, e.target, e.amount] as const] : []));
    expect(moved).toBeGreaterThanOrEqual(0);
    expect(hits.map(([, target, n]) => [target, n])).toEqual([
      [e0!.id, 3],
      [e1!.id, 3],
    ]);
    expect(hits.every(([i]) => i > moved)).toBe(true);
  });

  it('Rally: the ally steps where the Commander sends it, and the Shield lands on that ally', () => {
    const { state, iid } = board('rally');
    const selected = step(state, { type: 'select', card: iid, unit: 'A', choice: { unit: 'B', tile: at(2, 3) } });
    if (!selected.ok) throw new Error(selected.reason);
    const committed = step(selected.state, { type: 'commit' });
    if (!committed.ok) throw new Error(committed.reason);
    expect(committed.events).toContainEqual({ t: 'moved', unit: 'B', from: at(2, 2), to: at(2, 3), card: iid });
    expect(committed.events).toContainEqual({ t: 'shielded', unit: 'B', amount: 1 });
  });
});
