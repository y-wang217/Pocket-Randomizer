/**
 * The plan and its legality, checked against the projected board. **Card
 * battle engine, checkpoint 1.** No card resolves here: these are the rules
 * for what may be planned.
 */
import { describe, expect, it } from 'vitest';

import { choicesFor, legalActions, playBlock } from '../src/core/cards/legal';
import { project, select, unselect } from '../src/core/cards/plan';
import type { Action, BattleState, Choice } from '../src/core/cards/state';
import { at, board, iidOf } from './fixtures/card-battle';

function pick(state: BattleState, action: Action): BattleState {
  const result = action.type === 'select' ? select(state, action) : unselect(state, action);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.state;
}

const sel = (state: BattleState, def: string, unit: 'A' | 'B' | 'C', choice?: Choice) =>
  select(state, choice ? { type: 'select', card: iidOf(state, def), unit, choice } : { type: 'select', card: iidOf(state, def), unit });

describe('projection', () => {
  it('refuses Slash from the backline, allows it after a planned Move into the danger zone, and drops it when that Move goes', () => {
    let state = board({ hand: ['dash', 'slash'], mp: { C: 2 } });
    const refused = sel(state, 'slash', 'C');
    expect(refused).toMatchObject({ ok: false, reason: 'wrongZone' });
    expect(refused.state).toBe(state);

    state = pick(state, { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(3, 4) } });
    expect(project(state).C).toEqual(at(3, 4));
    state = pick(state, { type: 'select', card: iidOf(state, 'slash'), unit: 'C' });
    expect(state.plan).toHaveLength(2);

    const removed = unselect(state, { type: 'unselect', planIndex: 0 });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.state.plan).toEqual([]);
    expect(removed.events).toEqual([
      { t: 'unplanned', card: iidOf(state, 'dash'), unit: 'C' },
      { t: 'planPruned', card: iidOf(state, 'slash'), unit: 'C', reason: 'wrongZone' },
    ]);
    expect(project(removed.state).C).toEqual(at(3, 2));
  });

  it('refuses a Move that would leave an earlier play illegal', () => {
    // From (3,4) the Slash covers column 5, where the enemies stand. A Move to
    // (3,3) would leave it hitting an empty column 4.
    let state = board({ hand: ['slash', 'move'], mp: { C: 1 }, units: { C: at(3, 4) } });
    state = pick(state, { type: 'select', card: iidOf(state, 'slash'), unit: 'C' });
    expect(sel(state, 'move', 'C', { tile: at(3, 3) })).toMatchObject({ ok: false, reason: 'breaksPlan' });
    expect(choicesFor(state, iidOf(state, 'move'), 'C').tiles).toEqual([at(2, 4)]);
    expect(sel(state, 'move', 'C', { tile: at(2, 4) }).ok).toBe(true);
  });

  it('allows Fire! only on tiles in the next two columns of the projected position', () => {
    let state = board({ hand: ['move', 'fire'], mp: { B: 1 }, units: { B: at(2, 2) } });
    expect(sel(state, 'fire', 'B', { tile: at(2, 5) })).toMatchObject({ ok: false, reason: 'wrongZone' });
    state = pick(state, { type: 'select', card: iidOf(state, 'move'), unit: 'B', choice: { tile: at(2, 3) } });
    // From (2,3) the next two columns are 4 and 5; enemies stand in column 5.
    const tiles = choicesFor(state, iidOf(state, 'fire'), 'B').tiles;
    expect(tiles).toContainEqual(at(2, 5));
    expect(tiles).toContainEqual(at(2, 4));
    expect(tiles).not.toContainEqual(at(2, 6));
    expect(sel(state, 'fire', 'B', { tile: at(2, 6) })).toMatchObject({ ok: false, reason: 'badChoice' });
  });
});

describe('MP and slots', () => {
  it('reserves MP at select and releases it at unselect', () => {
    let state = board({ hand: ['dash', 'slash', 'need-help'], mp: { C: 2 }, units: { C: at(3, 4) } });
    state = pick(state, { type: 'select', card: iidOf(state, 'slash'), unit: 'C' });
    state = pick(state, { type: 'select', card: iidOf(state, 'need-help'), unit: 'C' });
    expect(sel(state, 'dash', 'C', { tile: at(2, 4) })).toMatchObject({ ok: false, reason: 'noMp' });
    expect(playBlock(state, iidOf(state, 'dash'), 'C')).toBe('noMp');
    state = pick(state, { type: 'unselect', planIndex: 1 });
    expect(sel(state, 'dash', 'C', { tile: at(2, 4) }).ok).toBe(true);
  });

  it('caps plays at the class slots', () => {
    let state = board({ hand: ['shoot', 'move', 'attack'], mp: { B: 5 }, units: { B: at(2, 2) } });
    state = pick(state, { type: 'select', card: iidOf(state, 'shoot'), unit: 'B' });
    state = pick(state, { type: 'select', card: iidOf(state, 'attack'), unit: 'B' });
    expect(sel(state, 'move', 'B', { tile: at(2, 3) })).toMatchObject({ ok: false, reason: 'noSlot' });
  });

  it('Command uses a slot of the ally and none of its MP', () => {
    let state = board({ hand: ['command', 'shoot', 'attack'], mp: { A: 1, B: 1 } });
    const command = iidOf(state, 'command');
    expect(choicesFor(state, command, 'A').units).toEqual(['B', 'C']);
    expect(choicesFor(state, command, 'A', 'B').tiles).toContainEqual(at(2, 3));
    state = pick(state, { type: 'select', card: command, unit: 'A', choice: { unit: 'B', tile: at(2, 3) } });
    expect(project(state).B).toEqual(at(2, 3));
    // B has 2 slots and 1 MP: Command took a slot and no MP, so one card fits.
    state = pick(state, { type: 'select', card: iidOf(state, 'attack'), unit: 'B' });
    expect(sel(state, 'shoot', 'B')).toMatchObject({ ok: false, reason: 'noSlot' });
  });

  it('Command cannot pick the commander itself', () => {
    const state = board({ hand: ['command'], mp: { A: 1 } });
    expect(sel(state, 'command', 'A', { unit: 'A', tile: at(1, 3) })).toMatchObject({ ok: false, reason: 'badChoice' });
  });
});

describe('cards and targets', () => {
  it('assigns an owned card to its owner only, and a Neutral to any living unit', () => {
    const state = board({ hand: ['shoot', 'attack'], mp: { A: 1, B: 1, C: 1 } });
    expect(sel(state, 'shoot', 'C')).toMatchObject({ ok: false, reason: 'notOwner' });
    for (const unit of ['A', 'B', 'C'] as const) expect(sel(state, 'attack', unit).ok).toBe(true);
  });

  it('refuses a Strike with no enemy in the lane', () => {
    const state = board({ hand: ['shoot'], enemies: [at(1, 5), null, at(3, 5)] });
    expect(sel(state, 'shoot', 'B')).toMatchObject({ ok: false, reason: 'noTarget' });
  });

  it('lands Moon Strike on any living enemy at any range', () => {
    const state = board({ hand: ['moon-strike'], mp: { A: 4 }, enemies: [at(1, 6), at(2, 5), null] });
    expect(choicesFor(state, iidOf(state, 'moon-strike'), 'A').units).toEqual(['e0', 'e1']);
    expect(sel(state, 'moon-strike', 'A', { unit: 'e2' })).toMatchObject({ ok: false, reason: 'badChoice' });
  });

  it('keeps Artillery to the danger zone even though it targets at any range', () => {
    const state = board({ hand: ['artillery'], mp: { B: 4 } });
    expect(sel(state, 'artillery', 'B', { unit: 'e1' })).toMatchObject({ ok: false, reason: 'wrongZone' });
    const forward = board({ hand: ['artillery'], mp: { B: 4 }, units: { B: at(2, 3) } });
    expect(sel(forward, 'artillery', 'B', { unit: 'e0' }).ok).toBe(true);
  });

  it('lets Call Medic shield A itself', () => {
    const state = board({ hand: ['call-medic'], mp: { A: 1 } });
    expect(choicesFor(state, iidOf(state, 'call-medic'), 'A').units).toEqual(['A', 'B', 'C']);
    expect(sel(state, 'call-medic', 'A', { unit: 'A' }).ok).toBe(true);
  });
});

describe('legalActions', () => {
  const hands = [
    ['call-medic', 'command', 'shoot', 'dash', 'move'],
    ['focus', 'moon-strike', 'artillery', 'fire', 'slash'],
    ['need-help', 'prep', 'dig-in', 'attack', 'resupply'],
  ];

  it('offers only actions select accepts, and select accepts every one of them', () => {
    for (const hand of hands) {
      let state = board({ hand, mp: { A: 4, B: 4, C: 3 }, units: { B: at(2, 3) } });
      // Walk a few plays deep so the projection is exercised as it grows.
      for (let depth = 0; depth < 4; depth++) {
        const actions = legalActions(state).filter((a) => a.type === 'select');
        for (const action of actions) expect(select(state, action).ok, JSON.stringify(action)).toBe(true);
        if (actions.length === 0) break;
        state = pick(state, actions[actions.length - 1]!);
      }
    }
  });

  it('rejects malformed and illegal actions with the same state reference and no throw', () => {
    const state = board({ hand: ['dash', 'shoot'], mp: { C: 1 } });
    const junk: unknown[] = [
      null, 7, 'select', {}, { type: 'select' }, { type: 'select', card: 3, unit: 'C' },
      { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: 'x' },
      { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: { lane: 9, col: 1 } } },
      { type: 'select', card: iidOf(state, 'dash'), unit: 'Z', choice: { tile: at(3, 3) } },
      { type: 'select', card: 'c99', unit: 'C' },
      { type: 'select', card: '__proto__', unit: 'C' },
      { type: 'select', card: iidOf(state, 'attack'), unit: 'C' },
      { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { unit: 'B' } },
    ];
    for (const action of junk) {
      const result = select(state, action);
      expect(result.ok, JSON.stringify(action)).toBe(false);
      expect(result.state).toBe(state);
    }
    for (const planIndex of [-1, 0, 1.5, 'a', null]) {
      const result = unselect(state, { type: 'unselect', planIndex });
      expect(result).toMatchObject({ ok: false, reason: 'badPlanIndex' });
      expect(result.state).toBe(state);
    }
  });

  it('refuses a card already in the plan', () => {
    let state = board({ hand: ['move'] });
    state = pick(state, { type: 'select', card: iidOf(state, 'move'), unit: 'A', choice: { tile: at(1, 3) } });
    expect(sel(state, 'move', 'B', { tile: at(2, 3) })).toMatchObject({ ok: false, reason: 'alreadyPlanned' });
  });

  it('offers nothing once the battle is over', () => {
    const state = { ...board({ hand: ['move'] }), phase: 'won' as const };
    expect(legalActions(state)).toEqual([]);
    expect(sel(state, 'move', 'A', { tile: at(1, 3) })).toMatchObject({ ok: false, reason: 'battleOver' });
  });

  it('draws no RNG and keeps the state plain JSON', () => {
    let state = board({ hand: ['dash', 'slash'], mp: { C: 2 } });
    state = pick(state, { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(3, 4) } });
    expect(state.rngDraws).toBe(0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
