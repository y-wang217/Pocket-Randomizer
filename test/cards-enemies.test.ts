/**
 * The enemy script interpreter: cycles, Hunt and Advance, conditions,
 * telegraphs, enemy actions, and the loss. **Card battle engine, checkpoint 3.**
 */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/cards/create';
import { enemyMovesAndTelegraph } from '../src/core/cards/enemies';
import type { BattleEvent } from '../src/core/cards/events';
import type { Ctx } from '../src/core/cards/keywords';
import { step } from '../src/core/cards/step';
import type { Action, BattleState, Pos } from '../src/core/cards/state';
import { at, board, type BoardSpec, iidOf } from './fixtures/card-battle';

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result;
}
const commit = (state: BattleState) => ok(state, { type: 'commit' });

/** A board with deep-HP units, enemies on given steps, telegraphed as battle start would. */
function arena(spec: BoardSpec & { steps?: number[]; tough?: boolean }): BattleState {
  const s = board(spec);
  if (spec.tough !== false) for (const u of s.units) u.hp = u.maxHp = 99;
  spec.steps?.forEach((value, index) => (s.enemies[index]!.step = value));
  enemyMovesAndTelegraph({ s, events: [] }, false);
  return s;
}

const e = (s: BattleState, index: number) => s.enemies[index]!;
const tiles = (list: Pos[]) => list.map((p) => `${p.lane},${p.col}`).sort();

describe('Drone', () => {
  it('walks its full six-step cycle on a fixed board', () => {
    // Lone Drone on step 1 (Hunt, Strike), players in column 2.
    let s = arena({ enemies: [at(1, 5), null, null], steps: [0] });
    const seen: [number, string, string][] = [];
    const record = (state: BattleState) => {
      const d = e(state, 0);
      seen.push([d.step, `${d.pos!.lane},${d.pos!.col}`, `${d.intent!.act}${d.intent!.n}`]);
    };
    record(s);
    for (let round = 0; round < 6; round++) {
      s = commit(s).state;
      record(s);
    }
    expect(seen).toEqual([
      [0, '1,5', 'strike1'], // Hunt: A is in its own lane, distance 0, it stays.
      [1, '1,4', 'none0'], // Advance one column.
      [2, '1,4', 'strike1'], // Nobody on column 3 in reach of a Slash: Hunt, Strike.
      [3, '1,4', 'shield1'],
      [4, '1,4', 'strike1'],
      [5, '1,3', 'none0'], // Advance to column 3, the limit.
      [0, '1,3', 'strike1'],
    ]);
  });

  it('Slashes only when a unit stands in range, and stays put to do it', () => {
    const inRange = arena({ enemies: [at(1, 4), null, null], units: { B: at(2, 3) }, steps: [2] });
    expect(e(inRange, 0).intent).toEqual({ act: 'slash', n: 1, tiles: [at(1, 3), at(2, 3)] });
    expect(e(inRange, 0).pos).toEqual(at(1, 4));

    const outOfRange = arena({ enemies: [at(1, 4), null, null], steps: [2] });
    expect(e(outOfRange, 0).intent!.act).toBe('strike');

    // In column 5 the condition cannot hold, whoever stands in column 4.
    const tooFar = arena({ enemies: [at(1, 5), null, null], units: { A: at(1, 4) }, steps: [2] });
    expect(e(tooFar, 0).intent!.act).toBe('strike');
  });

  it('Slash hits every unit on its lit tiles', () => {
    const s = arena({ enemies: [at(1, 4), null, null], units: { A: at(1, 3), B: at(2, 3) }, steps: [2] });
    const { events } = commit(s);
    const hit = events.filter((ev) => ev.t === 'damaged').map((ev) => (ev as { target: string }).target);
    expect(hit).toEqual(['A', 'B']);
  });

  it('waits when its advance is blocked, and never advances past column 3', () => {
    const blocked = { s: arena({ enemies: [at(2, 5), null, null], units: { B: at(2, 4) }, steps: [0] }), events: [] } as Ctx;
    blocked.s.enemies[0]!.step = 0; // the next move is step 2, Advance
    enemyMovesAndTelegraph(blocked, true);
    expect(blocked.events).toContainEqual({ t: 'enemyWaited', enemy: 'e0', why: 'blocked' });
    expect(e(blocked.s, 0).pos).toEqual(at(2, 5));

    const limit = { s: arena({ enemies: [at(2, 3), null, null], steps: [0] }), events: [] } as Ctx;
    enemyMovesAndTelegraph(limit, true);
    expect(limit.events).toContainEqual({ t: 'enemyWaited', enemy: 'e0', why: 'limit' });
    expect(e(limit.s, 0).pos).toEqual(at(2, 3));
  });
});

describe('Lancer', () => {
  it('walks its three-step cycle: Shield, Hunt, Pierce', () => {
    let s = arena({ enemies: [null, at(2, 5), null], units: { A: at(2, 1) }, steps: [0, 0] });
    expect(e(s, 1).intent).toEqual({ act: 'shield', n: 1, tiles: [] });
    s = commit(s).state;
    expect(e(s, 1).shield).toBe(1);
    expect(e(s, 1).intent!.act).toBe('none');
    s = commit(s).state;
    expect(e(s, 1).intent).toEqual({ act: 'pierce', n: 1, tiles: [at(2, 4), at(2, 3), at(2, 2), at(2, 1)] });
    const { events } = commit(s);
    const hit = events.filter((ev) => ev.t === 'damaged').map((ev) => (ev as { target: string }).target);
    // Pierce hits every unit in the lane, from the enemy's side.
    expect(hit).toEqual(['B', 'A']);
  });
});

describe('Hunt', () => {
  const hunt = (spec: BoardSpec, tough = true) =>
    arena({ ...spec, steps: [0], tough });

  it('stays when its own lane holds a unit', () => {
    expect(e(hunt({ enemies: [at(2, 5), null, null] }), 0).pos).toEqual(at(2, 5));
  });

  it('goes to the nearest lane holding a unit', () => {
    const s = hunt({ enemies: [at(1, 5), null, null], units: { A: at(3, 1), B: null } });
    // A and C are both in lane 3; lane 3 is the only candidate.
    expect(e(s, 0).pos).toEqual(at(3, 5));
  });

  it('breaks a distance tie by the lowest-HP front unit', () => {
    // Lanes 1 and 3 at distance 1 from lane 2; A (1 HP) fronts lane 1, C (3 HP) lane 3.
    const s = hunt({ enemies: [at(2, 5), null, null], units: { B: null } }, false);
    expect(e(s, 0).pos).toEqual(at(1, 5));
    const flipped = board({ enemies: [at(2, 5), null, null], units: { B: null } });
    flipped.units.find((u) => u.id === 'A')!.hp = 3;
    flipped.units.find((u) => u.id === 'C')!.hp = 1;
    flipped.enemies[0]!.step = 0;
    enemyMovesAndTelegraph({ s: flipped, events: [] }, false);
    expect(e(flipped, 0).pos).toEqual(at(3, 5));
  });

  it('breaks a full tie by the upper lane', () => {
    const s = hunt({ enemies: [at(2, 5), null, null], units: { B: null } });
    expect(e(s, 0).pos).toEqual(at(1, 5));
  });

  it('cannot pass a blocker in its column, and stays with no reachable lane', () => {
    // Lane 1 is blocked by the Lancer at (1,5): lane 3 it is.
    const s = hunt({ enemies: [at(2, 5), at(1, 5), null], units: { B: null } });
    expect(e(s, 0).pos).toEqual(at(3, 5));

    const boxed = { s: board({ enemies: [at(2, 5), at(1, 5), at(3, 5)], units: { B: null } }), events: [] } as Ctx;
    boxed.s.enemies.forEach((enemy) => (enemy.step = 0));
    boxed.s.enemies[1]!.def = 'drone';
    boxed.s.enemies[1]!.step = 3;
    boxed.s.enemies[2]!.step = 3;
    enemyMovesAndTelegraph(boxed, false);
    expect(boxed.events).toContainEqual({ t: 'enemyWaited', enemy: 'e0', why: 'noLane' });
  });
});

describe('telegraph and actions', () => {
  it('lights the lane in player reach for a Strike', () => {
    const s = arena({ enemies: [at(3, 5), null, null], steps: [0] });
    expect(tiles(e(s, 0).intent!.tiles)).toEqual(['3,1', '3,2', '3,3', '3,4']);
  });

  it('a telegraphed Strike misses when the player moves out of the lane', () => {
    let s = arena({ hand: ['move'], enemies: [at(1, 5), null, null], units: { B: at(3, 1) }, steps: [0] });
    expect(e(s, 0).intent!.act).toBe('strike');
    s = ok(s, { type: 'select', card: iidOf(s, 'move'), unit: 'A', choice: { tile: at(2, 2) } }).state;
    const { events } = commit(s);
    expect(events).toContainEqual({ t: 'enemyMissed', enemy: 'e0', act: 'strike' });
    expect(events.some((ev) => ev.t === 'damaged' && ev.target === 'A')).toBe(false);
  });

  it('enemy Strike hits the first unit in the lane from the enemy side, past other enemies', () => {
    const s = arena({ enemies: [at(2, 6), at(2, 5), null], units: { A: at(2, 1) }, steps: [0, 1] });
    const { events } = commit(s);
    const hits = events.filter((ev) => ev.t === 'damaged');
    expect(hits[0]).toMatchObject({ target: 'B' });
  });

  it('enemy Shield lasts until the start of that enemy\'s next action', () => {
    const raised = commit(arena({ enemies: [null, at(2, 5), null], steps: [0, 0] })).state;
    expect(e(raised, 1).shield).toBe(1);

    // Untouched, it clears as the Lancer's next action begins.
    const idle = commit(raised);
    expect(idle.events).toContainEqual({ t: 'shieldCleared', unit: 'e1', amount: 1 });
    expect(e(idle.state, 1).shield).toBe(0);

    // Hit during the player's half of that round, it absorbs first.
    const s = structuredClone(raised);
    const shoot = iidOf(s, 'shoot');
    for (const pile of ['draw', 'hand', 'discard'] as const) s.piles[pile] = s.piles[pile].filter((c) => c !== shoot);
    s.piles.hand.push(shoot);
    const { state, events } = commit(ok(s, { type: 'select', card: shoot, unit: 'B' }).state);
    expect(events).toContainEqual({ t: 'damaged', target: 'e1', amount: 1, shield: 1, baseShield: 0, hp: 0 });
    expect(e(state, 1).hp).toBe(2);
  });

  it('loses the moment the last unit faints, and no later enemy acts', () => {
    const s = arena({ enemies: [at(1, 5), at(2, 5), at(3, 5)], units: { B: null, C: null }, steps: [0, 2, 0], tough: false });
    s.units.find((u) => u.id === 'A')!.baseShield = 0;
    const { state, events } = commit(s);
    expect(state.phase).toBe('lost');
    expect(events).toContainEqual({ t: 'lost', why: 'allFainted' });
    const lostAt = events.findIndex((ev) => ev.t === 'lost');
    expect(events.slice(lostAt + 1)).toEqual([]);
  });
});

describe('the encounter', () => {
  it('opens with every enemy telegraphed', () => {
    const created = createBattle('test', 'OPEN');
    if (!created.ok) throw new Error('create');
    for (const enemy of created.state.enemies) expect(enemy.intent).not.toBeNull();
    expect(created.events.filter((ev) => ev.t === 'telegraphed')).toHaveLength(3);
  });

  it('a player who only ends turns loses inside the round cap', () => {
    for (const seed of ['P1', 'P2', 'P3', 'P4', 'P5']) {
      const created = createBattle('test', seed);
      if (!created.ok) throw new Error('create');
      let s = created.state;
      while (s.phase === 'plan') s = commit(s).state;
      expect(s.phase, seed).toBe('lost');
      expect(s.round, seed).toBeLessThanOrEqual(30);
    }
  });

  it('keeps the plain-JSON state and the one-unit-per-tile rule through whole battles', () => {
    const created = createBattle('test', 'TILES');
    if (!created.ok) throw new Error('create');
    let s = created.state;
    while (s.phase === 'plan') {
      const positions = [...s.units.map((u) => u.pos), ...s.enemies.map((x) => x.pos)].filter((p) => p !== null);
      expect(new Set(positions.map((p) => `${p!.lane},${p!.col}`)).size).toBe(positions.length);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      s = commit(s).state;
    }
  });
});
