/**
 * The Colossus and the Harpoon (Part D,
 * `docs/spec/gymrun-card-battle-rulings-waves-boss-reskin.md`): a 2x2 enemy
 * hit once per card, advancing up to three rows, Crush and Stomp; the
 * Harpoon granted as it arrives, Retain and Uses 2, in a straight line in
 * the unit's lane at most 3 ahead; the pin (no moves, shields gone and back
 * on the second turn, a Scream at every tile touching it, allies too); and
 * the one stalk at half HP, stomping each tile it moves into.
 */
import { describe, expect, it } from 'vitest';

import { ENEMIES } from '../src/cardData/enemies';
import { createBattle, layoutBattle } from '../src/core/cards/create';
import type { EnemyDefId } from '../src/core/cards/defs';
import { enemyMovesAndTelegraph } from '../src/core/cards/enemies';
import type { BattleEvent } from '../src/core/cards/events';
import { checkInvariants } from '../src/core/cards/invariants';
import { choicesFor } from '../src/core/cards/legal';
import { startWave } from '../src/core/cards/resolve';
import type { Action, BattleState, Pos, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { viewOf } from '../src/core/cards/view';
import { enemyTiles } from '../src/core/cards/zones';
import { roundSteps } from '../src/ui/cardbattle/playback';
import { at, iidOf } from './fixtures/card-battle';

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result;
}
const commit = (s: BattleState) => ok(s, { type: 'commit' });
const boss = (s: BattleState) => s.enemies.find((e) => e.def === 'colossus')!;
const key = (ps: Pos[]) => ps.map((p) => `${p.lane},${p.col}`).sort();

/** Siege's last wave on a fixed board: the Colossus on `pos` and step `stepIndex`, deep-HP units where asked, cards in hand. */
function arena(spec: { pos?: Pos; stepIndex?: number; units?: Partial<Record<UnitId, Pos>>; hand?: string[]; mp?: number; extra?: { def: EnemyDefId; pos: Pos } } = {}): BattleState {
  const s = layoutBattle('siege', 'BOSS')!;
  s.phase = 'plan';
  s.round = 1;
  s.wave = 2;
  for (const e of s.enemies) {
    if (e.wave < 2) Object.assign(e, { hp: 0, pos: null });
    else Object.assign(e, { pos: spec.pos ?? at(1, 6), spawn: spec.pos ?? at(1, 6), step: spec.stepIndex ?? 2 });
  }
  if (spec.extra) {
    // A wave 1 enemy kept alive beside it, for the Scream's allies.
    Object.assign(s.enemies[3]!, { def: spec.extra.def, wave: 2, hp: ENEMIES[spec.extra.def].hp, pos: spec.extra.pos });
  }
  for (const u of s.units) {
    Object.assign(u, { hp: 9, maxHp: 9, mp: spec.mp ?? 5 });
    if (spec.units?.[u.id]) u.pos = spec.units[u.id]!;
  }
  const harpoon = s.piles.reserve[0]!;
  s.piles.reserve = [];
  s.piles.hand = [harpoon];
  for (const def of spec.hand ?? []) {
    const iid = iidOf(s, def);
    s.piles.draw = s.piles.draw.filter((c) => c !== iid);
    s.piles.hand.push(iid);
  }
  enemyMovesAndTelegraph({ s, events: [] }, false);
  return s;
}

describe('the Colossus', () => {
  it('covers 2 by 2, blocks, and a card hits it once however many tiles it covers', () => {
    // C at L2C5 (danger) aims Fire! at L2C6: the footprint covers two of the Colossus's tiles.
    let s = arena({ units: { B: at(2, 5) }, hand: ['fire'] });
    expect(key(enemyTiles(boss(s)))).toEqual(key([at(1, 6), at(2, 6), at(1, 7), at(2, 7)]));
    expect(checkInvariants(s)).toEqual([]);
    expect(choicesFor(s, iidOf(s, 'fire'), 'B').tiles.length).toBeGreaterThan(0);
    s = ok(s, { type: 'select', card: iidOf(s, 'fire'), unit: 'B', choice: { tile: at(1, 6) } }).state;
    const { events } = commit(s);
    expect(events.filter((e) => e.t === 'damaged' && e.target === boss(s).id)).toHaveLength(1);
  });

  it('opens on Shield 3 under grace, then Crushes both its lanes and Stomps every lane after advancing up to three rows', () => {
    const created = createBattle('siege', 'GRACEBOSS');
    if (!created.ok) throw new Error('create');
    expect(boss(created.state).step).toBe(2);
    // Step 1, Crush: a Pierce down lanes 1 and 2.
    let s = arena({ stepIndex: 0 });
    expect(boss(s).intent).toMatchObject({ act: 'pierce', n: 2, label: 'Crush' });
    expect(new Set(boss(s).intent!.tiles.map((t) => t.lane))).toEqual(new Set([1, 2]));
    // Step 2: advance three rows to C3, then Stomp across all three lanes of C2.
    s = commit(s).state;
    expect(boss(s).pos).toEqual(at(1, 3));
    expect(boss(s).intent).toMatchObject({ act: 'slash', n: 1, label: 'Stomp' });
    expect(key(boss(s).intent!.tiles)).toEqual(key([at(1, 2), at(2, 2), at(3, 2)]));
    expect(viewOf(s).enemies[0]!.intent!.label).toBe('Stomp');
  });

  it('advances only as far as it can stand', () => {
    // A unit on L2C4 stops it with its front row on C5.
    const s = commit(arena({ stepIndex: 0, units: { B: at(2, 4) } })).state;
    expect(boss(s).pos).toEqual(at(1, 5));
  });
});

describe('the Harpoon', () => {
  it('arrives in hand with the Colossus, holds a hand place round to round, and is black-framed', () => {
    const created = createBattle('siege', 'GRANT1');
    if (!created.ok) throw new Error('create');
    const s = structuredClone(created.state);
    for (const e of s.enemies) if (e.wave === 0) Object.assign(e, { hp: 0, pos: null });
    s.wave = 1;
    for (const e of s.enemies) if (e.wave === 1) Object.assign(e, { hp: 0, pos: null });
    const events: BattleEvent[] = [];
    startWave({ s, events }, 2);
    const harpoon = iidOf(s, 'harpoon');
    expect(events).toContainEqual({ t: 'granted', card: harpoon });
    expect(s.piles.hand).toContain(harpoon);
    expect(s.piles.hand).toHaveLength(5);
    expect(viewOf(s).hand.flatMap((g) => g.cards).find((c) => c.iid === harpoon)).toMatchObject({ granted: true, retain: true, uses: { left: 2, of: 2 } });
    // Unplayed, it stays through the round: the next hand is it plus four.
    const started = ok(s, { type: 'start' }).state;
    const next = commit(started).state;
    expect(next.piles.hand).toContain(harpoon);
    expect(next.piles.hand).toHaveLength(5);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('reaches only in a straight line in the unit lane, at most three tiles ahead', () => {
    const near = arena({ units: { A: at(1, 3) } });
    const harpoon = iidOf(near, 'harpoon');
    expect(choicesFor(near, harpoon, 'A').units).toEqual([boss(near).id]);
    // Four ahead, or the next lane over: out of range, and the card says so.
    const far = arena({ units: { A: at(1, 2) } });
    expect(viewOf(far).hand.flatMap((g) => g.cards).find((c) => c.iid === harpoon)!.reason).toBe('outOfRange');
    const aside = arena({ units: { A: at(3, 5), B: at(3, 1), C: at(3, 2) } });
    expect(choicesFor(aside, harpoon, 'A').units).toEqual([]);
  });

  it('pins for two turns: no moves, every shield gone and back on the second turn, a Scream at every tile touching it, allies too', () => {
    // Crush next, a Drone beside it on L3C6, A and C on C5, in reach and touching it.
    let s = arena({ stepIndex: 0, units: { A: at(1, 5), C: at(2, 5) }, extra: { def: 'drone', pos: at(3, 6) } });
    boss(s).shield = 3;
    const harpoon = iidOf(s, 'harpoon');
    s = ok(s, { type: 'select', card: harpoon, unit: 'A', choice: { unit: boss(s).id } }).state;
    const first = commit(s);
    expect(first.events).toContainEqual({ t: 'harpooned', enemy: boss(s).id, card: harpoon, turns: 2, shields: 6 });
    const screams = first.events.filter((e) => e.t === 'enemyActed' && e.act === 'scream');
    expect(screams).toHaveLength(1);
    const hit = first.events.filter((e) => e.t === 'damaged').map((e) => (e as { target: string }).target);
    expect(hit).toContain('A');
    expect(hit).toContain('C');
    expect(hit).toContain(first.state.enemies[3]!.id);
    let b = boss(first.state);
    expect([b.pos, b.pinned, b.baseShield, b.shield, b.intent!.act]).toEqual([at(1, 6), 1, 0, 0, 'scream']);
    // The second pinned turn: shields back, a Scream, then the pin ends and it telegraphs its script again.
    const second = commit(first.state);
    expect(second.events).toContainEqual({ t: 'shieldsReturned', enemy: b.id, amount: 3 });
    expect(second.events).toContainEqual({ t: 'pinEnded', enemy: b.id });
    b = boss(second.state);
    expect([b.pos, b.pinned, b.baseShield]).toEqual([at(1, 6), 0, 3]);
    expect(b.intent!.act).not.toBe('scream');
    // Two uses: back into the deck after the first, spent after the second.
    expect(second.state.uses[harpoon]).toBe(1);
    expect(second.state.piles.spent).not.toContain(harpoon);
  });
});

describe('the stalk', () => {
  it('comes once, at half HP: three rows toward the player, stomping the tiles it moves into, stopped by a unit it hits', () => {
    // Shield 3 next; at 6 HP of 12. B on L2C3: the third step stomps it and stops.
    let s = arena({ stepIndex: 2, units: { B: at(2, 3) } });
    Object.assign(boss(s), { hp: 6, baseShield: 0 });
    const { state, events } = commit(s);
    expect(events).toContainEqual({ t: 'stalked', enemy: boss(s).id });
    const stomps = events.filter((e) => e.t === 'stomped') as Extract<BattleEvent, { t: 'stomped' }>[];
    expect(stomps.map((e) => [e.from.col, e.to?.col ?? null])).toEqual([[6, 5], [5, 4], [4, null]]);
    expect(key(stomps[2]!.tiles)).toEqual(key([at(1, 3), at(2, 3)]));
    expect(events.some((e) => e.t === 'damaged' && e.target === 'B')).toBe(true);
    expect(boss(state).pos).toEqual(at(1, 4));
    // Played back as three beats, each lit like a Slash on the tiles it stomps.
    const beats = roundSteps(s, events, state).filter((b) => b.title.includes('stomps'));
    expect(beats.map((b) => [b.act, b.tiles.length])).toEqual([['slash', 2], ['slash', 2], ['slash', 2]]);
    // Once: the next round it keeps to its script.
    s = commit(state).state;
    expect(commit(s).events.some((e) => e.t === 'stalked')).toBe(false);
  });

  it('waits out a pin, and the boss panel says at what HP it comes', () => {
    let s = arena({ stepIndex: 2, units: { A: at(1, 4) } });
    expect(viewOf(s).enemies[0]!.stalkAt).toBe(6);
    Object.assign(boss(s), { hp: 6 });
    s = ok(s, { type: 'select', card: iidOf(s, 'harpoon'), unit: 'A', choice: { unit: boss(s).id } }).state;
    const pinned = commit(s);
    expect(pinned.events.some((e) => e.t === 'stalked')).toBe(false);
    expect(viewOf(pinned.state).enemies[0]!.pinned).toBe(1);
  });
});
