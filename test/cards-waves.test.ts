/**
 * Waves (Part C, `docs/spec/gymrun-card-battle-rulings-waves-boss-reskin.md`):
 * the next wave arrives when the last enemy of the current one falls; HP
 * carries over; card shields clear, base shields come back, MP resets; every
 * card a faint did not remove is shuffled back, Once cards included; owed MP
 * and extra draws clear; the units are placed again; grace opens the wave;
 * the round count starts again.
 */
import { describe, expect, it } from 'vitest';

import { DECKS } from '../src/cardData/cards';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { botStream, playBattle, randomBot } from '../src/core/cards/bots';
import { createBattle, gradeTotal } from '../src/core/cards/create';
import type { BattleEvent } from '../src/core/cards/events';
import { guardBot } from '../src/core/cards/guard';
import { checkInvariants } from '../src/core/cards/invariants';
import { replay } from '../src/core/cards/log';
import type { Action, BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { viewOf } from '../src/core/cards/view';
import { zoneOf } from '../src/core/cards/zones';
import { at, iidOf } from './fixtures/card-battle';

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result;
}

/** Siege, started, wave 1 down to one Drone with 1 HP on B's lane, Shoot in hand and some history to clear. */
function lastOfWaveOne(): BattleState {
  const created = createBattle('siege', 'WAVES1');
  if (!created.ok) throw new Error('create');
  const s = ok(created.state, { type: 'start' }).state;
  const draft = structuredClone(s);
  const [drone, lancer, hound] = draft.enemies;
  Object.assign(drone!, { pos: at(2, 6), hp: 1, baseShield: 0, shield: 0 });
  Object.assign(lancer!, { pos: null, hp: 0, intent: null });
  Object.assign(hound!, { pos: null, hp: 0, intent: null });
  const shoot = iidOf(draft, 'shoot');
  const prep = iidOf(draft, 'prep');
  for (const pile of ['draw', 'hand', 'discard', 'spent'] as const) draft.piles[pile] = draft.piles[pile].filter((c) => c !== shoot && c !== prep);
  draft.piles.hand.push(shoot);
  draft.piles.spent.push(prep);
  const [a, b, c] = draft.units;
  Object.assign(a!, { mp: 3, pendingMp: [{ n: 1, turns: 2 }] });
  Object.assign(b!, { hp: 1, baseShield: 0, shield: 1, pos: at(2, 3) });
  Object.assign(c!, { baseShield: 0, pos: at(3, 4) });
  draft.pendingDraws = [{ n: 1, filter: 'notOwner', owner: 'C' }];
  return draft;
}

describe('waves', () => {
  it('lays a scenario out wave by wave: ids continue, a later wave stands nowhere until it arrives, its spawns already drawn', () => {
    const created = createBattle('siege', 'WAVES0');
    if (!created.ok) throw new Error('create');
    const s = created.state;
    expect(s.enemies.map((e) => [e.id, e.def, e.wave])).toEqual([
      ['e0', 'drone', 0], ['e1', 'lancer', 0], ['e2', 'hound', 0],
      ['e3', 'bulwark', 1], ['e4', 'sniper', 1], ['e5', 'lancer', 1], ['e6', 'hound', 1],
      ['e7', 'colossus', 2],
    ]);
    expect(s.enemies.filter((e) => e.wave === 1).every((e) => e.pos === null && e.spawn !== null)).toBe(true);
    expect(zoneOf(s.enemies[5]!.spawn!)).toBe('enemyBackline');
    expect(viewOf(s).enemies.map((e) => e.id)).toEqual(['e0', 'e1', 'e2']);
    expect([viewOf(s).wave, viewOf(s).waves]).toEqual([0, 3]);
    expect(gradeTotal(ENCOUNTERS['siege']!)).toBe(4 + 7 + 10);
    expect(checkInvariants(s)).toEqual([]);
  });

  it("brings the next wave when the last enemy falls: HP stays, the rest starts again, and it is back in deploy", () => {
    let s = lastOfWaveOne();
    s = ok(s, { type: 'select', card: iidOf(s, 'shoot'), unit: 'B' }).state;
    const { state: next, events } = ok(s, { type: 'commit' });
    expect(events).toContainEqual({ t: 'waveStarted', wave: 1 });
    expect(events.some((e) => e.t === 'won' || e.t === 'enemyActed')).toBe(false);
    expect([next.phase, next.wave, next.round]).toEqual(['deploy', 1, 1]);
    // Units: HP kept, card shield gone, base shield back, MP from 0 (A gets its turn-start 1), on their scenario tiles.
    expect(next.units.map((u) => [u.id, u.hp, u.shield, u.baseShield, u.mp, u.pos])).toEqual([
      ['A', 1, 0, 1, 1, at(1, 2)],
      ['B', 1, 0, 1, 0, at(2, 2)],
      ['C', 3, 0, 2, 0, at(3, 2)],
    ]);
    expect(next.units.every((u) => u.pendingMp.length === 0)).toBe(true);
    expect(next.pendingDraws).toEqual([]);
    // Every card back, Prep included; a fresh hand of five.
    expect(next.piles.spent).toEqual([]);
    expect(next.piles.hand).toHaveLength(5);
    expect(next.piles.draw.length + next.piles.hand.length).toBe(DECKS['puppeteer']!.cards.length);
    // Wave 2 on its tiles, not telegraphing until Start; then grace.
    const wave2 = next.enemies.filter((e) => e.wave === 1);
    expect(wave2.every((e) => e.pos !== null && e.intent === null)).toBe(true);
    expect(checkInvariants(next)).toEqual([]);
    const started = ok(next, { type: 'start' }).state;
    for (const e of started.enemies.filter((x) => x.wave === 1)) {
      if (!ENEMIES[e.def].fast) expect(['none', 'shield'], `${e.id} ${e.def}`).toContain(e.intent!.act);
    }
  });

  it("keeps a fainted unit fainted, its cards out of the reshuffle", () => {
    let s = lastOfWaveOne();
    const c = s.units[2]!;
    Object.assign(c, { hp: 0, fainted: true, pos: null });
    const owned = Object.values(s.cards).filter((card) => card.owner === 'C').map((card) => card.iid);
    for (const pile of ['draw', 'hand', 'discard', 'spent'] as const) s.piles[pile] = s.piles[pile].filter((x) => !owned.includes(x));
    s.piles.removed = owned;
    s = ok(s, { type: 'select', card: iidOf(s, 'shoot'), unit: 'B' }).state;
    const next = ok(s, { type: 'commit' }).state;
    expect(next.units[2]).toMatchObject({ fainted: true, pos: null });
    expect(next.piles.removed.sort()).toEqual(owned.sort());
    expect([...next.piles.draw, ...next.piles.hand].some((x) => owned.includes(x))).toBe(false);
  });

  it('wins only when the last wave falls, and a log across waves replays', () => {
    const guard = guardBot();
    let won = 0;
    for (let i = 0; i < 12; i++) {
      const played = playBattle('siege', `SIEGE${i}`, guard, (_before, _action, result) => {
        if (result.ok) expect(checkInvariants(result.state)).toEqual([]);
      });
      if (played.state.phase === 'won') {
        won++;
        expect(played.events.filter((e) => e.t === 'waveStarted')).toHaveLength(2);
        expect(played.state.wave).toBe(2);
      }
      expect(replay(played.log).state).toEqual(played.state);
    }
    expect(won).toBeGreaterThan(0);
  });

  it('holds the invariants under the random bot across waves', () => {
    for (let i = 0; i < 100; i++) {
      const stream = botStream(`WB${i}`);
      playBattle('siege', `WR${i}`, (s) => randomBot(s, stream), (_before, _action, result) => {
        if (result.ok) expect(checkInvariants(result.state)).toEqual([]);
      });
    }
  });
});
