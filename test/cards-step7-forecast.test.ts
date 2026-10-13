/**
 * Card run shapes, step 7a, section A (`docs/spec/gymrun-card-run-shapes-prompt.md`):
 * what the plan's cards do to the board before any enemy acts, shown while
 * planning rather than found out in the playback. Push and Pull move an enemy
 * and aim it again, Stun holds one, Cover and Stealth change who an enemy's
 * act lands on. Each is read off `playedOut`, the round's own phases 1 and 2
 * on a draft, so the forecast and the round cannot disagree.
 */
import { describe, expect, it } from 'vitest';

import { STARTING_DECK } from '../src/cardData/cardrunTables';
import { layoutBattle } from '../src/core/cards/create';
import type { BattleEvent } from '../src/core/cards/events';
import { displacementsFor, playedOut } from '../src/core/cards/preview';
import type { Action, BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { viewOf } from '../src/core/cards/view';
import { at, iidOf } from './fixtures/card-battle';

/** The `test` encounter (A (1,1), B (2,2), C (3,2) against three on column 6), `cards` in hand, every unit at 5 MP. */
function board(cards: string[], encounter = 'test'): BattleState {
  const state = layoutBattle(encounter, 'STEP7', { cards: [...cards, ...STARTING_DECK] })!;
  for (const card of cards) {
    const iid = iidOf(state, card);
    state.piles.draw = state.piles.draw.filter((c) => c !== iid);
    state.piles.hand.push(iid);
  }
  state.mp = 15;
  return state;
}

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result;
}

const select = (state: BattleState, card: string, unit: UnitId, choice?: Choice): BattleState =>
  ok(state, { type: 'select', card: iidOf(state, card), unit, ...(choice ? { choice } : {}) }).state;

const strikeDownLane = (lane: 1 | 2 | 3, n: number) => ({ act: 'strike' as const, n, tiles: [1, 2, 3, 4, 5].map((col) => at(lane, col as 1)) });

describe('playedOut', () => {
  it('plays the plan on a draft and leaves the state it was given alone', () => {
    const state = select(board(['grapple']), 'grapple', 'B', { unit: 'e1' });
    const before = JSON.stringify(state);
    const out = playedOut(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(out.plan).toEqual([]);
    expect(out.enemies[1]!.pos).not.toEqual(state.enemies[1]!.pos);
  });
});

describe('Push and Pull, before the round', () => {
  it('names where each enemy a Grapple could take would land, as the round puts it', () => {
    const state = board(['grapple']);
    const sniper = state.enemies[1]!;
    Object.assign(sniper, { pos: at(2, 7) });
    const grapple = iidOf(state, 'grapple');
    const landing = displacementsFor(state, grapple, 'B', state.enemies.map((e) => e.id));
    expect(landing).toContainEqual({ enemy: sniper.id, to: at(2, 5) });
    // The round agrees.
    const selected = select(state, 'grapple', 'B', { unit: sniper.id });
    const { events } = ok(selected, { type: 'commit' });
    expect(events).toContainEqual(expect.objectContaining({ t: 'displaced', enemy: sniper.id, to: at(2, 5) }));
  });

  it('draws a planned Shove: the enemy on the tile it lands on, with the attack it aims from there', () => {
    const state = board(['shove']);
    Object.assign(state.units[2]!, { pos: at(2, 4) });
    Object.assign(state.units[1]!, { pos: at(1, 2) });
    const lancer = state.enemies[1]!;
    Object.assign(lancer, { pos: at(2, 5), baseShield: 0, hp: 5 });
    const planned = select(state, 'shove', 'C');
    const view = viewOf(planned);
    const enemy = view.enemies.find((e) => e.id === lancer.id)!;
    expect(enemy.planned?.to).toEqual(at(2, 6));
    expect(view.tiles.find((t) => t.enemyGhost === lancer.id)?.pos).toEqual(at(2, 6));
    // The intent it is left with is the one the round telegraphs on displacing it.
    const { events } = ok(planned, { type: 'commit' });
    const displaced = events.findIndex((e) => e.t === 'displaced');
    const aimed = events.find((e, i) => i > displaced && e.t === 'telegraphed' && e.enemy === lancer.id);
    expect(aimed && aimed.t === 'telegraphed' && aimed.intent.act).toBe(enemy.planned!.intent?.icon ?? 'none');
  });

  it('draws nothing for an enemy the plan does not move', () => {
    const view = viewOf(board([]));
    expect(view.enemies.every((e) => e.planned === null)).toBe(true);
    expect(view.tiles.some((t) => t.enemyGhost)).toBe(false);
  });
});

describe('Stun on the board', () => {
  it('a planned Concuss clears the attack of the enemy it will hold, and marks it held', () => {
    const state = board(['concuss']);
    const lancer = state.enemies[1]!;
    Object.assign(lancer, { hp: 4, baseShield: 0, intent: strikeDownLane(2, 1) });
    expect(viewOf(state).tiles.some((t) => t.threats.some((h) => h.enemy === lancer.id))).toBe(true);
    const view = viewOf(select(state, 'concuss', 'B'));
    const enemy = view.enemies.find((e) => e.id === lancer.id)!;
    expect(enemy.planned).toMatchObject({ to: null, stun: 1 });
    expect(view.tiles.some((t) => t.threats.some((h) => h.enemy === lancer.id))).toBe(false);
  });

  it('a held enemy reads as pinned and not a boss, for the badge on its token', () => {
    // A Stun 1 wears off in the same round's move phase, so the hold shows on
    // the playback's pictures and in the forecast above, not at the next plan.
    const state = board([]);
    state.enemies[1]!.pinned = 1;
    const enemy = viewOf(state, { forecast: false }).enemies[1]!;
    expect(enemy).toMatchObject({ pinned: 1, boss: false });
  });
});

describe('Cover in the plan', () => {
  it('a planned Guard Duty marks the covering unit and the neighbours it protects', () => {
    const view = viewOf(select(board(['guard-duty']), 'guard-duty', 'C'));
    const unit = (id: UnitId) => view.units.find((u) => u.id === id)!;
    expect(unit('C').coveringByPlan).toBe(true);
    // B on (2,2) is next to C on (3,2); A on (1,1) is not.
    expect(unit('B').coveredBy).toEqual(['C']);
    expect(unit('A').coveredBy).toEqual([]);
    expect(unit('C').coveredBy).toEqual([]);
  });

  it('reads the neighbours where Interpose leaves the Dasher', () => {
    const state = board(['interpose']);
    Object.assign(state.units[2]!, { pos: at(3, 1) });
    const view = viewOf(select(state, 'interpose', 'C', { tile: at(3, 2) }));
    expect(view.units.find((u) => u.id === 'B')!.coveredBy).toEqual(['C']);
  });
});

describe('Stealth in the plan', () => {
  it('a planned Smoke hides the unit at once and marks the attacks it will dodge', () => {
    const state = board(['smoke']);
    state.enemies[1]!.intent = strikeDownLane(2, 1);
    expect(viewOf(state).tiles.find((t) => t.pos.lane === 2 && t.pos.col === 2)!.threats[0]).toMatchObject({ stop: true, dodged: false });
    const view = viewOf(select(state, 'smoke', 'B'));
    expect(view.units.find((u) => u.id === 'B')!.hiddenByPlan).toBe(true);
    expect(view.tiles.find((t) => t.pos.lane === 2 && t.pos.col === 2)!.threats[0]).toMatchObject({ stop: true, dodged: true });
    expect(view.tiles.find((t) => t.pos.lane === 2 && t.pos.col === 4)!.threats[0]).toMatchObject({ dodged: false });
  });

  it('draws no forecast on a playback picture', () => {
    const state = board(['smoke']);
    const view = viewOf(select(state, 'smoke', 'B'), { forecast: false });
    expect(view.units.find((u) => u.id === 'B')!.hiddenByPlan).toBe(false);
  });
});

describe('Veterans', () => {
  it('names the plain enemy a veteran is the veteran of', () => {
    const state = layoutBattle('run-skirmish', 'VET', { cards: [...STARTING_DECK] })!;
    const view = viewOf(state);
    expect(view.enemies.length).toBeGreaterThan(0);
    for (const enemy of view.enemies) expect(enemy.veteranOf).toBe(enemy.def === 'dire-hound' ? 'hound' : enemy.def === 'drone-mk2' ? 'drone' : enemy.def === 'lancer-captain' ? 'lancer' : null);
    expect(view.enemies.some((e) => e.veteranOf !== null)).toBe(true);
    expect(viewOf(board([])).enemies.every((e) => e.veteranOf === null)).toBe(true);
  });
});
