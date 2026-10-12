/**
 * Checkpoint 5b (`docs/spec/gymrun-card-run-shapes-prompt.md`): the four
 * shapes divide every reward card between them; a Town's and an ambush's
 * offer is one card from each of three shapes; and the cards each shape was
 * missing (Overcharge, Barrage, Interpose, Riot Net) do what they say.
 */
import { describe, expect, it } from 'vitest';

import { CARDS, UPGRADE_OF } from '../src/cardData/cards';
import { MARKET, SHAPES, STARTING_DECK, TOWN_POOL, shapeOf } from '../src/cardData/cardrunTables';
import { createRun } from '../src/core/cards/cardrun';
import { layoutBattle } from '../src/core/cards/create';
import type { BattleEvent } from '../src/core/cards/events';
import { completeChoices } from '../src/core/cards/legal';
import type { BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { at, iidOf } from './fixtures/card-battle';

function board(card: string): BattleState {
  const state = layoutBattle('test', 'SHAPE5B', { cards: [card, ...STARTING_DECK] })!;
  const iid = iidOf(state, card);
  state.piles.draw = state.piles.draw.filter((c) => c !== iid);
  state.piles.hand.push(iid);
  state.mp = 15;
  for (const e of state.enemies) e.intent = null;
  return state;
}

function play(state: BattleState, card: string, unit: UnitId, choice?: Choice): BattleEvent[] {
  const selected = step(state, { type: 'select', card: iidOf(state, card), unit, ...(choice ? { choice } : {}) });
  if (!selected.ok) throw new Error(`${card}: ${selected.reason}`);
  const committed = step(selected.state, { type: 'commit' });
  if (!committed.ok) throw new Error(`${card}: ${committed.reason}`);
  return committed.events;
}

describe('the shapes', () => {
  it('divide every reward card between them, each card in exactly one, none from the starting deck', () => {
    const all = Object.values(SHAPES).flatMap((s) => s.cards);
    expect(new Set(all).size).toBe(all.length);
    expect([...TOWN_POOL].sort()).toEqual([...all].sort());
    for (const id of all) {
      expect(CARDS[id], id).toBeDefined();
      expect(CARDS[id]!.equipment, id).toBeUndefined();
      expect(STARTING_DECK, id).not.toContain(id);
      expect(UPGRADE_OF[id], `${id} has an upgrade`).toBeDefined();
      expect(shapeOf(id)!.cards).toContain(id);
      expect(shapeOf(`${id}+`)).toBe(shapeOf(id));
    }
    for (const shape of Object.values(SHAPES)) expect(shape.cards.length, shape.id).toBeGreaterThanOrEqual(5);
  });

  it('offers one card from each of three shapes at every Town and ambush', () => {
    for (const seed of ['OFFER1', 'OFFER2', 'OFFER3', 'OFFER4']) {
      for (const node of createRun(seed).nodes) {
        if (node.kind !== 'stop') continue;
        for (const offer of [node.town.offer, node.wild.offer]) {
          expect(offer).toHaveLength(3);
          const shapes = offer.map((c) => shapeOf(c)!.id);
          expect(new Set(shapes).size, `${seed} ${node.key}`).toBe(3);
        }
      }
    }
  });
});

describe('the shape cards', () => {
  it('Overcharge: the Commander’s Strike 3', () => {
    const state = board('overcharge');
    const drone = state.enemies[0]!;
    Object.assign(drone, { hp: 5, baseShield: 0 });
    const events = play(state, 'overcharge', 'A');
    expect(events.find((e) => e.t === 'damaged' && e.target === drone.id)).toMatchObject({ amount: 3 });
  });

  it('Barrage: the Gunner’s Blast 3 for 3 MP, an ult', () => {
    expect(CARDS['barrage']).toMatchObject({ owner: 'B', cost: 3, ult: true });
    const state = board('barrage');
    Object.assign(state.units[1]!, { pos: at(2, 4) });
    const lancer = state.enemies[1]!;
    Object.assign(lancer, { pos: at(2, 6), hp: 5, baseShield: 0 });
    const events = play(state, 'barrage', 'B', { tile: at(2, 6) });
    expect(events.find((e) => e.t === 'damaged' && e.target === lancer.id)).toMatchObject({ amount: 3 });
  });

  it('Interpose: the Dasher steps beside an ally and Covers it', () => {
    const state = board('interpose');
    Object.assign(state.units[2]!, { pos: at(3, 1) });
    // From (3,1) one step to (3,2), beside the Gunner on (2,2).
    expect(completeChoices(state, iidOf(state, 'interpose'), 'C')).toContainEqual({ tile: at(3, 2) });
    state.enemies[1]!.intent = { act: 'strike', n: 1, tiles: [1, 2, 3, 4, 5].map((col) => at(2, col as 1)) };
    const events = play(state, 'interpose', 'C', { tile: at(3, 2) });
    const moved = events.findIndex((e) => e.t === 'moved' && e.unit === 'C');
    const covering = events.findIndex((e) => e.t === 'covering' && e.unit === 'C');
    expect(moved).toBeGreaterThanOrEqual(0);
    expect(covering).toBeGreaterThan(moved);
    expect(events).toContainEqual(expect.objectContaining({ t: 'covered', unit: 'C', ally: 'B' }));
  });

  it('Riot Net: a Blast that stuns everything it hits, sold at the market', () => {
    expect(MARKET['riot-net']).toBeDefined();
    expect(CARDS['riot-net']).toMatchObject({ equipment: true, uses: 1 });
    const state = board('riot-net');
    Object.assign(state.units[1]!, { pos: at(2, 4) });
    const [e0, e1] = state.enemies;
    Object.assign(e0!, { pos: at(1, 6), hp: 5, baseShield: 0 });
    Object.assign(e1!, { pos: at(2, 6), hp: 5, baseShield: 0 });
    const events = play(state, 'riot-net', 'B', { tile: at(2, 6) });
    const stunned = events.filter((e) => e.t === 'stunned').map((e) => (e.t === 'stunned' ? e.enemy : ''));
    expect(stunned).toEqual(expect.arrayContaining([e0!.id, e1!.id]));
  });
});
