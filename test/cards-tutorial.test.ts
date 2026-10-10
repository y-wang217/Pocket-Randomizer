/**
 * The card battle tutorial, headless
 * (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`): the Target
 * Dummy, its battle, and the script walked by engine actions alone.
 */
import { describe, expect, it } from 'vitest';

import { ENCOUNTERS, SCENARIO_IDS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { CARDS } from '../src/cardData/cards';
import { UNITS } from '../src/cardData/units';
import { createBattle } from '../src/core/cards/create';
import { planRound } from '../src/core/cards/guard';
import { choicesFor } from '../src/core/cards/legal';
import type { Action, BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { viewOf } from '../src/core/cards/view';
import { TUTORIAL_ENCOUNTER, TUTORIAL_SEED, TUTORIAL_STEPS, settle, waitMet } from '../src/ui/cardbattle/tutorial';

function run(state: BattleState, actions: Action[], action: Action): BattleState {
  const result = step(state, action);
  if (!result.ok) throw new Error(`${JSON.stringify(action)} refused: ${result.reason}`);
  actions.push(action);
  return result.state;
}

function cardIn(state: BattleState, def: string): string {
  const iid = state.piles.hand.find((i) => state.cards[i]!.def === def);
  if (!iid) throw new Error(`${def} not in hand`);
  return iid;
}

describe('the Target Dummy', () => {
  it('never moves and never attacks, on any seed', () => {
    const def = ENEMIES.dummy;
    expect(def.script.steps.every((s) => s.move === 'none' && 'k' in s.act && s.act.k === 'none')).toBe(true);
    for (let i = 0; i < 20; i++) {
      const created = createBattle(TUTORIAL_ENCOUNTER, `DUMMY${i}`);
      if (!created.ok) throw new Error('create');
      let state = run(created.state, [], { type: 'start' });
      for (let round = 0; round < 3 && state.phase === 'plan'; round++) {
        state = run(state, [], { type: 'commit' });
        expect(state.enemies[0]!.pos).toEqual({ lane: 2, col: 4 });
        expect(state.units.every((u) => u.hp === u.maxHp)).toBe(true);
      }
    }
  });

  it('is a battle of its own, out of the scenario list, the bench and the trainer', () => {
    expect(ENCOUNTERS[TUTORIAL_ENCOUNTER]!.tutorial).toBe(true);
    expect(SCENARIO_IDS).not.toContain(TUTORIAL_ENCOUNTER);
    expect(SCENARIO_IDS).toEqual(Object.keys(ENCOUNTERS).filter((id) => id !== TUTORIAL_ENCOUNTER));
  });
});

describe('each unit marks its ult', () => {
  it('as its most expensive card, and none for a unit with nothing above 1 MP', () => {
    expect(UNITS.A.ult).toBe('moon-strike');
    expect(UNITS.B.ult).toBe('artillery');
    expect(UNITS.C.ult).toBeUndefined();
    for (const unit of Object.values(UNITS)) {
      const own = Object.values(CARDS).filter((c) => c.owner === unit.id);
      const top = Math.max(...own.map((c) => c.cost));
      if (unit.ult) {
        expect(CARDS[unit.ult]!.owner).toBe(unit.id);
        expect(CARDS[unit.ult]!.cost).toBe(top);
      } else expect(top).toBeLessThanOrEqual(1);
    }
  });
});

describe('the tutorial script', () => {
  it('opens on a hand that holds every card it names', () => {
    const created = createBattle(TUTORIAL_ENCOUNTER, TUTORIAL_SEED);
    if (!created.ok) throw new Error('create');
    const hand = created.state.piles.hand.map((i) => created.state.cards[i]!.def);
    expect(hand).toEqual(expect.arrayContaining(['move', 'shoot', 'call-medic']));
  });

  it('is walked to the end by the acts it asks for, then the guard bot, against the dummy', () => {
    const created = createBattle(TUTORIAL_ENCOUNTER, TUTORIAL_SEED);
    if (!created.ok) throw new Error('create');
    let state = created.state;
    const actions: Action[] = [];
    let index = settle(0, state, actions);
    const at = (): string => TUTORIAL_STEPS[index]!.id;
    const tap = (): void => {
      expect(TUTORIAL_STEPS[index]!.wait).toBeUndefined();
      index = settle(index + 1, state, actions);
    };

    expect(at()).toBe('place');
    // Swap the Commander and the Dasher: a place, the Gunner left in the dummy's lane.
    state = run(state, actions, { type: 'place', unit: 'A', tile: { lane: 3, col: 2 } });
    index = settle(index, state, actions);
    expect(at()).toBe('start');
    state = run(state, actions, { type: 'start' });
    index = settle(index, state, actions);
    expect(at()).toBe('hand');
    tap();
    expect(at()).toBe('vitals');
    tap();
    expect(at()).toBe('mana');
    tap();
    expect(at()).toBe('move');

    const move = cardIn(state, 'move');
    const tile = choicesFor(state, move, 'C').tiles[0]!;
    state = run(state, actions, { type: 'select', card: move, unit: 'C', choice: { tile } });
    index = settle(index, state, actions);
    expect(at()).toBe('slots');
    expect(viewOf(state).units.find((u) => u.id === 'C')!.planned).toHaveLength(1);
    tap();
    expect(at()).toBe('attack');
    state = run(state, actions, { type: 'select', card: cardIn(state, 'shoot'), unit: 'B' });
    index = settle(index, state, actions);
    expect(at()).toBe('end');
    state = run(state, actions, { type: 'commit' });
    index = settle(index, state, actions);
    expect(at()).toBe('finish');
    // Shoot pops the dummy's one bubble and leaves its hearts.
    expect(state.enemies[0]!.baseShield).toBe(0);
    expect(state.enemies[0]!.hp).toBe(3);

    for (let round = 0; round < 10 && state.phase === 'plan'; round++) {
      for (const action of planRound(state).actions) state = run(state, actions, action);
      if (state.phase === 'plan') state = run(state, actions, { type: 'commit' });
    }
    expect(state.phase).toBe('won');
    expect(settle(index, state, actions)).toBe(TUTORIAL_STEPS.length);
  });

  it('passes a step the player already did: a Shoot planned before the Move step, then the turn ended', () => {
    const created = createBattle(TUTORIAL_ENCOUNTER, TUTORIAL_SEED);
    if (!created.ok) throw new Error('create');
    const actions: Action[] = [];
    let state = run(created.state, actions, { type: 'start' });
    expect(waitMet('placed', state, actions)).toBe(true);
    state = run(state, actions, { type: 'select', card: cardIn(state, 'shoot'), unit: 'B' });
    state = run(state, actions, { type: 'commit' });
    const move = TUTORIAL_STEPS.findIndex((s) => s.id === 'move');
    // Move was never played, so the script waits there; once played, it passes the attack and End Turn too.
    expect(TUTORIAL_STEPS[settle(move, state, actions)]!.id).toBe('move');
    const card = state.piles.hand.find((i) => ['move', 'dash'].includes(state.cards[i]!.def));
    if (card) {
      const unit = state.cards[card]!.def === 'dash' ? 'C' : 'A';
      const tile = choicesFor(state, card, unit).tiles[0]!;
      state = run(state, actions, { type: 'select', card, unit, choice: { tile } });
      expect(TUTORIAL_STEPS[settle(move, state, actions)]!.id).toBe('slots');
      expect(TUTORIAL_STEPS[settle(move + 2, state, actions)]!.id).toBe('finish');
    }
  });
});
