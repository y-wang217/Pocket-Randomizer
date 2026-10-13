/**
 * Floor 2 (`docs/reports/floor-2-design.md`, 2026-10-13): Root and Frail, the
 * Cleanse that lifts them, the three enemies that leave them, melee into the
 * end zone with its repel, the fort's skin, and the Antidote at the market.
 */
import { describe, expect, it } from 'vitest';

import { CARDS } from '../src/cardData/cards';
import { ACTS, MARKET, MARKET_FROM } from '../src/cardData/cardrunTables';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { RULES } from '../src/cardData/rules';
import { generateRun } from '../src/core/cards/cardrun';
import { wavesOf } from '../src/core/cards/create';
import { actCanDamage, enemyMovesAndTelegraph } from '../src/core/cards/enemies';
import type { BattleEvent } from '../src/core/cards/events';
import { checkInvariants } from '../src/core/cards/invariants';
import { choicesFor } from '../src/core/cards/legal';
import { checkPlan } from '../src/core/cards/plan';
import type { Action, BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { viewOf } from '../src/core/cards/view';
import { at, board, iidOf } from './fixtures/card-battle';

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return { state: result.state, events: result.events };
}

const play = (state: BattleState, card: string, unit: UnitId, choice?: Choice) =>
  ok(state, { type: 'select', card: iidOf(state, card), unit, ...(choice ? { choice } : {}) }).state;

const unit = (state: BattleState, id: UnitId) => state.units.find((u) => u.id === id)!;

/** The `test` board with its first enemy turned into `def`, on `step`, telegraphing at `pos`. */
function facing(def: 'snarer' | 'breaker' | 'reaver', pos = at(1, 5), stepIndex = 0, spec: Parameters<typeof board>[0] = {}): BattleState {
  const s = board({ ...spec, enemies: [pos, null, null] });
  Object.assign(s.enemies[0]!, { def, step: stepIndex, hp: ENEMIES[def].hp, maxHp: ENEMIES[def].hp });
  s.phase = 'plan';
  s.round = 1;
  enemyMovesAndTelegraph({ s, events: [] }, false);
  return s;
}

describe('Root and Frail', () => {
  it("the Snarer's hit roots what it lands on for 2 of its turns: no Move, no Command, then it wears off", () => {
    // A alone in the Snarer's lane.
    let s = facing('snarer', at(1, 5), 0, { hand: ['move', 'command'], units: { A: at(1, 2), B: at(2, 1), C: at(3, 1) } });
    expect(viewOf(s).enemies[0]!.intent).toMatchObject({ icon: 'strike', n: 1, inflict: { k: 'root', n: 2 } });
    const hit = ok(s, { type: 'commit' });
    expect(hit.events).toContainEqual({ t: 'inflicted', unit: 'A', status: 'root', turns: 2 });
    s = hit.state;
    expect(unit(s, 'A').root).toBe(2);
    expect(viewOf(s).units.find((u) => u.id === 'A')).toMatchObject({ root: 2 });
    // Rooted: its own Move is refused, and saying why. (The commit dealt a fresh hand: deal the two back.)
    s.mp = 3;
    for (const card of ['move', 'command']) {
      const iid = iidOf(s, card);
      for (const pile of ['draw', 'discard'] as const) s.piles[pile] = s.piles[pile].filter((c) => c !== iid);
      if (!s.piles.hand.includes(iid)) s.piles.hand.push(iid);
    }
    expect(step(s, { type: 'select', card: iidOf(s, 'move'), unit: 'A', choice: { tile: at(1, 3) } })).toMatchObject({ ok: false, reason: 'rooted' });
    // And no Command moves it.
    expect(choicesFor(s, iidOf(s, 'command'), 'A').units).not.toContain('A');
    // Its turns count down once its cards have played.
    const one = ok(s, { type: 'commit' }).state;
    expect(unit(one, 'A').root ?? 0).toBeLessThanOrEqual(2);
    let t = one;
    for (let i = 0; i < 3 && t.phase === 'plan'; i++) t = ok(t, { type: 'commit' }).state;
    expect(checkInvariants(t)).toEqual([]);
  });

  it('a second Root takes the longer, never the sum', () => {
    const shorter = facing('snarer', at(1, 5), 0, { units: { A: at(1, 2), B: at(2, 1), C: at(3, 1) } });
    unit(shorter, 'A').root = 3;
    const after = ok(shorter, { type: 'commit' }).state;
    // 3, less the turn just played, then the hit: max(2, 2).
    expect(unit(after, 'A').root).toBe(2);
  });

  it("Frail: a card's shield gives the unit nothing; its base shield still holds", () => {
    let s = board({ hand: ['dig-in'] });
    unit(s, 'C').frail = 2;
    s = play(s, 'dig-in', 'C');
    const { state: after, events } = ok(s, { type: 'commit' });
    expect(events).toContainEqual({ t: 'frailBlocked', unit: 'C', amount: 1 });
    expect(events.some((e) => e.t === 'shielded' && e.unit === 'C')).toBe(false);
    expect(unit(after, 'C').baseShield).toBeGreaterThan(0);
  });

  it("the Breaker's Pierce leaves Frail 2 on every unit in its lane", () => {
    const s = facing('breaker', at(2, 5), 0, { units: { A: at(1, 2), B: at(2, 2), C: at(3, 2) } });
    expect(viewOf(s).enemies[0]!.intent).toMatchObject({ icon: 'pierce', n: 2, inflict: { k: 'frail', n: 2 } });
    const { events } = ok(s, { type: 'commit' });
    expect(events).toContainEqual({ t: 'inflicted', unit: 'B', status: 'frail', turns: 2 });
  });
});

describe('Cleanse', () => {
  it("takes n turns off every living ally's Root and Frail, and a status at 0 is gone", () => {
    const s = board({ hand: [] });
    s.cards['cX'] = { iid: 'cX', def: 'cleanse', owner: 'neutral' };
    s.piles.hand.push('cX');
    unit(s, 'A').root = 3;
    unit(s, 'B').frail = 1;
    const planned = ok(s, { type: 'select', card: 'cX', unit: 'B' }).state;
    const { state: after, events } = ok(planned, { type: 'commit' });
    expect(events).toContainEqual({ t: 'cleansed', card: 'cX', n: 2 });
    expect(unit(after, 'A').root ?? 0).toBeLessThanOrEqual(1);
    expect(unit(after, 'B').frail).toBeUndefined();
  });

  it('comes as Cleanse, a reward card, and the Antidote, sold from floor 2 on', () => {
    expect(CARDS['cleanse']).toMatchObject({ owner: 'neutral', cost: 1, effects: [{ k: 'cleanse', n: 2 }] });
    expect(CARDS['cleanse+']).toMatchObject({ effects: [{ k: 'cleanse', n: 3 }] });
    expect(CARDS['antidote']).toMatchObject({ cost: 0, equipment: true, uses: 1, effects: [{ k: 'cleanse', n: 9 }] });
    expect(MARKET['antidote']).toBeDefined();
    expect(MARKET_FROM['antidote']).toBe(1);
    for (const node of generateRun('ANTIDOTE')) {
      if (node.kind !== 'stop' || node.act > 0) continue;
      expect(node.city.market.map((m) => m.card), node.key).not.toContain('antidote');
      expect(node.wild.equipment, node.key).not.toBe('antidote');
    }
  });
});

describe("floor 2's enemies", () => {
  it('are the Snarer, the Breaker and the Reaver, each with a step that deals nothing', () => {
    expect([ENEMIES.snarer.hp, ENEMIES.snarer.baseShield, ENEMIES.snarer.fast === true, ENEMIES.snarer.script.steps.length]).toEqual([3, 1, true, 2]);
    expect([ENEMIES.breaker.hp, ENEMIES.breaker.baseShield, ENEMIES.breaker.fast === true, ENEMIES.breaker.script.steps.length]).toEqual([4, 1, false, 3]);
    expect([ENEMIES.reaver.hp, ENEMIES.reaver.baseShield, ENEMIES.reaver.fast === true, ENEMIES.reaver.script.steps.length]).toEqual([3, 0, false, 3]);
    for (const id of ['snarer', 'breaker', 'reaver'] as const) expect(ENEMIES[id].script.steps.some((s) => !actCanDamage(s.act)), id).toBe(true);
  });

  it('lead the waves of floor 2 and 3, and never floor 1', () => {
    const fieldsNew = (id: string) => wavesOf(ENCOUNTERS[id]!).flat().some((s) => ['snarer', 'breaker', 'reaver'].includes(s.def));
    for (const id of [...ACTS[0]!.fights, ACTS[0]!.boss, ...ACTS[0]!.townQuests, ...ACTS[0]!.defenseQuests]) expect(fieldsNew(id), id).toBe(false);
    for (const id of [...ACTS[1]!.fights, ACTS[1]!.boss]) expect(fieldsNew(id), id).toBe(true);
  });

  it("put floor 2 and 3 on the fort's board, and floor 1 on the meadow", () => {
    ACTS.forEach((act, index) => {
      for (const id of [...act.fights, act.boss, ...act.townQuests, ...act.defenseQuests]) expect(ENCOUNTERS[id]!.skin, id).toBe(index === 0 ? undefined : 'fort');
    });
  });
});

describe('melee into the end zone', () => {
  it('lets the Sword dasher move into the end zone, and no one else', () => {
    // Every enemy gone but one far off, so the end zone is open.
    const s = board({ hand: ['dash', 'move'], units: { A: at(1, 5), B: at(2, 5), C: at(3, 5) }, enemies: [at(1, 7), null, null] });
    expect(choicesFor(s, iidOf(s, 'dash'), 'C').tiles).toContainEqual(at(3, 6));
    expect(choicesFor(s, iidOf(s, 'move'), 'B').tiles).not.toContainEqual(at(2, 6));
    expect(choicesFor(s, iidOf(s, 'move'), 'C').tiles).toContainEqual(at(3, 6));
  });

  it('a Slash from column 6 hits the top row, then the dasher is repelled to column 5', () => {
    let s = board({ hand: ['dash', 'slash'], units: { A: at(1, 2), B: at(2, 2), C: at(2, 5) }, enemies: [null, at(2, 7), null] });
    s = play(s, 'dash', 'C', { tile: at(2, 6) });
    s = play(s, 'slash', 'C');
    expect(checkPlan(s, s.plan).ok).toBe(true);
    const { state: after, events } = ok(s, { type: 'commit' });
    expect(events.some((e) => e.t === 'damaged' && e.target === 'e1')).toBe(true);
    const repelled = events.find((e) => e.t === 'repelled');
    expect(repelled).toMatchObject({ unit: 'C', from: at(2, 6) });
    expect(repelled && 'to' in repelled ? repelled.to.col : 0).toBe(RULES.endZone.repelCol);
    expect(unit(after, 'C').pos!.col).toBeLessThanOrEqual(RULES.endZone.repelCol);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('a move into the end zone with no hit there is repelled once the plan has played', () => {
    let s = board({ hand: ['dash'], units: { A: at(1, 2), B: at(2, 2), C: at(3, 5) }, enemies: [at(1, 7), null, null] });
    s = play(s, 'dash', 'C', { tile: at(3, 7) });
    const { state: after, events } = ok(s, { type: 'commit' });
    expect(events.find((e) => e.t === 'repelled')).toMatchObject({ unit: 'C', from: at(3, 7) });
    expect(unit(after, 'C').pos!.col).toBeLessThanOrEqual(RULES.endZone.repelCol);
  });

  it('the plan reads the repel: a card after a hit in the end zone plays from where the dasher lands', () => {
    let s = board({ hand: ['dash', 'slash', 'attack'], mp: 3, units: { A: at(1, 2), B: at(2, 2), C: at(2, 5) }, enemies: [null, at(2, 7), null] });
    s = play(s, 'dash', 'C', { tile: at(2, 6) });
    s = play(s, 'slash', 'C');
    // Attack strikes down C's lane from column 5 now, which still finds the enemy at 2,7.
    s = play(s, 'attack', 'C');
    expect(checkPlan(s, s.plan).ok).toBe(true);
  });
});

describe('the fort on screen', () => {
  it('names the Root and Frail on a unit in the view, with their turns', () => {
    const s = board();
    unit(s, 'A').root = 2;
    unit(s, 'B').frail = 1;
    const view = viewOf(s);
    expect(view.units.map((u) => [u.id, u.root, u.frail])).toEqual([
      ['A', 2, 0],
      ['B', 0, 1],
      ['C', 0, 0],
    ]);
  });
});
