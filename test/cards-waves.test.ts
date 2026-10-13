/**
 * Waves: the next wave arrives when the last enemy of the current one falls.
 * Since the author's ruling of 2026-10-11 (`docs/spec/gymrun-card-run-shapes-prompt.md`,
 * superseding Part C's C1 to C5) only the cards reset: HP, base shield as
 * spent, MP and owed MP carry, and the units stay on their tiles; every card a
 * faint did not remove is shuffled back, Once cards included; extra draws
 * clear; the wave spawns at once, with no placement, and opens under grace;
 * the round count starts again.
 */
import { describe, expect, it } from 'vitest';

import { DECKS } from '../src/cardData/cards';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { RULES } from '../src/cardData/rules';
import { botStream, playBattle, randomBot } from '../src/core/cards/bots';
import { createBattle, gradeTotal } from '../src/core/cards/create';
import type { BattleEvent } from '../src/core/cards/events';
import { guardBot } from '../src/core/cards/guard';
import { checkInvariants } from '../src/core/cards/invariants';
import { legalActions } from '../src/core/cards/legal';
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
  const [, b, c] = draft.units;
  draft.mp = 3;
  draft.pendingMp = [{ n: 1, turns: 2 }];
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

  it('brings the next wave when the last enemy falls: only the cards reset, and it spawns at once under grace', () => {
    let s = lastOfWaveOne();
    s = ok(s, { type: 'select', card: iidOf(s, 'shoot'), unit: 'B' }).state;
    const { state: next, events } = ok(s, { type: 'commit' });
    expect(events).toContainEqual({ t: 'waveStarted', wave: 1 });
    expect(events.some((e) => e.t === 'won' || e.t === 'enemyActed')).toBe(false);
    expect([next.phase, next.wave, next.round]).toEqual(['plan', 1, 1]);
    // Units: HP, spent base shield and tiles kept; card shield cleared at the turn start (R3);
    // The shared pool refilled to its max, plus the 1 a Focus still owes it.
    expect(next.units.map((u) => [u.id, u.hp, u.shield, u.baseShield, u.pos])).toEqual([
      ['A', 1, 0, 1, at(1, 2)],
      ['B', 1, 0, 0, at(2, 3)],
      ['C', 3, 0, 0, at(3, 4)],
    ]);
    expect(next.mp).toBe(4 + 1);
    expect(next.pendingMp).toEqual([{ n: 1, turns: 1 }]);
    expect(next.pendingDraws).toEqual([]);
    // Every card back, Prep included; a fresh hand of five.
    expect(next.piles.spent).toEqual([]);
    expect(next.piles.hand).toHaveLength(5);
    expect(next.piles.draw.length + next.piles.hand.length).toBe(DECKS['puppeteer']!.cards.length);
    // Wave 2 on its tiles, already telegraphing its opening, under grace.
    const wave2 = next.enemies.filter((e) => e.wave === 1);
    expect(wave2.every((e) => e.pos !== null && e.intent !== null)).toBe(true);
    for (const e of wave2) {
      if (!ENEMIES[e.def].fast) expect(['none', 'shield'], `${e.id} ${e.def}`).toContain(e.intent!.act);
    }
    expect(checkInvariants(next)).toEqual([]);
    expect(step(next, { type: 'start' })).toMatchObject({ ok: false, reason: 'notDeploying' });
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

describe('the supply pack a fallen wave leaves (2026-10-13)', () => {
  /** The board just after wave 1 falls: wave 2 has arrived and the pack waits. */
  function packWaiting(): BattleState {
    const s = lastOfWaveOne();
    const selected = ok(s, { type: 'select', card: iidOf(s, 'shoot'), unit: 'B' }).state;
    const { state, events } = ok(selected, { type: 'commit' });
    expect(events).toContainEqual({ t: 'rewardOffered' });
    return state;
  }

  it('waits on a claim before the wave is planned: three offers, nothing else legal', () => {
    const s = packWaiting();
    expect([s.wave, s.waveReward]).toEqual([1, true]);
    expect(legalActions(s)).toEqual([
      { type: 'claim', reward: 'supplies' },
      { type: 'claim', reward: 'hp' },
      { type: 'claim', reward: 'mp' },
    ]);
    expect(step(s, { type: 'commit' })).toMatchObject({ ok: false, reason: 'claimFirst' });
    expect(step(s, { type: 'select', card: s.piles.hand[0]!, unit: 'B' })).toMatchObject({ ok: false, reason: 'claimFirst' });
    expect(step(s, { type: 'claim', reward: 'gold' })).toMatchObject({ ok: false, reason: 'malformed' });
    const view = viewOf(s);
    expect(view.reward).toEqual([
      { kind: 'supplies', n: RULES.waveReward.supplies },
      { kind: 'hp', n: RULES.waveReward.hp },
      { kind: 'mp', n: RULES.waveReward.mp },
    ]);
    expect(view.canCommit).toBe(false);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('pays what it says: supplies for the run, HP to every living unit up to its max, or MP this turn', () => {
    const s = packWaiting();
    const supplies = ok(s, { type: 'claim', reward: 'supplies' });
    expect(supplies.events).toEqual([{ t: 'claimed', reward: 'supplies', n: RULES.waveReward.supplies }]);
    expect([supplies.state.suppliesWon, supplies.state.waveReward]).toEqual([RULES.waveReward.supplies, false]);

    const hp = ok(s, { type: 'claim', reward: 'hp' }).state;
    // B was down to 1 of 2; A and C were full and stay so.
    expect(hp.units.map((u) => [u.id, u.hp])).toEqual(s.units.map((u) => [u.id, Math.min(u.maxHp, u.hp + RULES.waveReward.hp)]));
    expect(hp.units.find((u) => u.id === 'B')!.hp).toBe(2);

    const mp = ok(s, { type: 'claim', reward: 'mp' }).state;
    expect(mp.mp).toBe(s.mp + RULES.waveReward.mp);
    // Claimed, the wave plans as any other, and a second claim is refused.
    expect(step(mp, { type: 'commit' }).ok).toBe(true);
    expect(step(mp, { type: 'claim', reward: 'hp' })).toMatchObject({ ok: false, reason: 'nothingToClaim' });
  });

  it('offers nothing after the last wave, and nothing in a one-wave battle', () => {
    const created = createBattle('test', 'PACK1');
    if (!created.ok) throw new Error('create');
    expect(created.state.waveReward).toBe(false);
    expect(step(created.state, { type: 'claim', reward: 'hp' })).toMatchObject({ ok: false });
  });
});
