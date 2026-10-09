/**
 * `step` and `createBattle`: deck and hand, every keyword resolver, every
 * Puppeteer card, both unit abilities, shield timing, faint, and the battle's
 * own randomness. **Card battle engine, checkpoint 2.** Enemies do not act yet
 * (checkpoint 3), so a commit here is the player's half of a round and the
 * next hand.
 */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/cards/create';
import type { BattleEvent } from '../src/core/cards/events';
import { damage, faint, type Ctx } from '../src/core/cards/keywords';
import { step } from '../src/core/cards/step';
import type { Action, BattleState, Choice, PileName, UnitId } from '../src/core/cards/state';
import { at, begun, board, iidOf } from './fixtures/card-battle';

const PILES: PileName[] = ['draw', 'hand', 'discard', 'spent', 'removed'];

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result;
}

const play = (state: BattleState, def: string, unit: UnitId, choice?: Choice): BattleState =>
  ok(state, choice ? { type: 'select', card: iidOf(state, def), unit, choice } : { type: 'select', card: iidOf(state, def), unit }).state;

const commit = (state: BattleState) => ok(state, { type: 'commit' });

const enemy = (state: BattleState, index: number) => state.enemies[index]!;
const unit = (state: BattleState, id: UnitId) => state.units.find((u) => u.id === id)!;
const damaged = (events: BattleEvent[]) => events.filter((e) => e.t === 'damaged').map((e) => (e as { target: string }).target);

function cardCount(state: BattleState): number {
  return PILES.reduce((sum, pile) => sum + state.piles[pile].length, 0);
}

describe('createBattle', () => {
  it('opens on round 1 in deploy with a hand of 5, A holding its turn-1 MP, and no enemy telegraphed', () => {
    const created = createBattle('test', 'SEED1');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { state } = created;
    expect(state.phase).toBe('deploy');
    expect(state.enemies.every((e) => e.intent === null)).toBe(true);
    expect(state.round).toBe(1);
    expect(state.piles.hand).toHaveLength(5);
    expect(state.piles.draw).toHaveLength(10);
    expect(state.units.map((u) => u.mp)).toEqual([1, 0, 0]);
    for (const e of state.enemies) expect(e.step).toBeGreaterThanOrEqual(0);
    expect(state.rngDraws).toBe(3 + 14);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('is a function of the seed', () => {
    const a = createBattle('test', 'SEED1');
    const b = createBattle('test', 'SEED1');
    expect(a).toEqual(b);
    const hands = new Set(['S1', 'S2', 'S3', 'S4', 'S5'].map((seed) => JSON.stringify((createBattle('test', seed) as { state: BattleState }).state.piles.hand)));
    expect(hands.size).toBeGreaterThan(1);
  });

  it('refuses an unknown encounter without throwing', () => {
    expect(createBattle('nope', 'S')).toEqual({ ok: false, reason: 'unknownEncounter' });
    expect(createBattle(undefined as unknown as string, 'S')).toEqual({ ok: false, reason: 'unknownEncounter' });
  });
});

describe('step', () => {
  it('rejects malformed actions with the same state reference', () => {
    const state = board({ hand: ['move'] });
    for (const action of [null, {}, { type: 'x' }, 'commit', 3]) {
      const result = step(state, action);
      expect(result).toMatchObject({ ok: false, reason: 'malformed' });
      expect(result.state).toBe(state);
    }
  });

  it('never mutates the state it is handed, and stepping it twice gives the same result', () => {
    let state = begun('test', 'PURE').state;
    for (let round = 0; round < 6; round++) {
      const before = JSON.stringify(state);
      const once = step(state, { type: 'commit' });
      const twice = step(state, { type: 'commit' });
      expect(JSON.stringify(state)).toBe(before);
      expect(twice).toEqual(once);
      if (!once.ok) throw new Error('commit');
      state = once.state;
    }
  });

  it('refuses everything once the battle is over', () => {
    const state = { ...board(), phase: 'won' as const };
    expect(step(state, { type: 'commit' })).toMatchObject({ ok: false, reason: 'battleOver' });
  });
});

describe('keywords', () => {
  it('Strike hits the first enemy in the lane, from the attacker side', () => {
    let state = board({ hand: ['attack'], mp: { A: 1 }, enemies: [at(1, 4), at(2, 5), at(1, 6)] });
    state = play(state, 'attack', 'A');
    const { events } = commit(state);
    expect(damaged(events)).toEqual(['e0']);
  });

  it('Pierce hits every enemy in the lane, front to back', () => {
    // B at full HP converts its first card's Strike to Pierce.
    let state = board({ hand: ['shoot'], enemies: [at(2, 6), at(2, 4), at(3, 5)] });
    state = play(state, 'shoot', 'B');
    const { events } = commit(state);
    expect(events).toContainEqual({ t: 'converted', unit: 'B', card: iidOf(state, 'shoot'), from: 'strike', to: 'pierce' });
    expect(damaged(events)).toEqual(['e1', 'e0']);
  });

  it('Slash hits the three tiles of the next column, clipped at the edge', () => {
    let state = board({ hand: ['slash'], mp: { C: 1 }, units: { C: at(3, 4) }, enemies: [at(1, 5), at(2, 5), at(3, 5)] });
    state = play(state, 'slash', 'C');
    expect(damaged(commit(state).events)).toEqual(['e1', 'e2']);
  });

  it('Blast hits a chosen tile and its four neighbours, clipped at the edge', () => {
    let state = board({ hand: ['fire'], mp: { B: 1 }, units: { B: at(1, 4) }, enemies: [at(1, 5), at(2, 5), at(1, 6)] });
    state = play(state, 'fire', 'B', { tile: at(1, 6) });
    // (1,6) and its in-board neighbours (1,5) and (2,6).
    expect(damaged(commit(state).events)).toEqual(['e0', 'e2']);
  });

  it('Move is blocked by units and by the reach limit', () => {
    const state = board({ hand: ['dash'], mp: { C: 1 }, units: { C: at(3, 3), B: at(3, 2) }, enemies: [at(1, 5), at(2, 5), at(3, 4)] });
    // (3,4) holds an enemy, (3,2) holds B; column 5 is outside the player's reach.
    expect(step(state, { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(3, 4) } })).toMatchObject({ ok: false });
    expect(step(state, { type: 'select', card: iidOf(state, 'dash'), unit: 'C', choice: { tile: at(2, 5) } })).toMatchObject({ ok: false });
    const moved = commit(play(state, 'dash', 'C', { tile: at(2, 4) }));
    expect(unit(moved.state, 'C').pos).toEqual(at(2, 4));
    expect(moved.events).toContainEqual({ t: 'moved', unit: 'C', from: at(3, 3), to: at(2, 4), card: iidOf(state, 'dash') });
  });

  it('Shield absorbs before base shield, base shield before HP', () => {
    const state = board();
    const ctx: Ctx = { s: structuredClone(state), events: [] };
    const c = ctx.s.units.find((u) => u.id === 'C')!;
    c.shield = 1;
    damage(ctx, c, 2);
    expect([c.shield, c.baseShield, c.hp]).toEqual([0, 1, 3]);
    damage(ctx, c, 3);
    expect([c.shield, c.baseShield, c.hp]).toEqual([0, 0, 1]);
    expect(ctx.events).toEqual([
      { t: 'damaged', target: 'C', amount: 2, shield: 1, baseShield: 1, hp: 0 },
      { t: 'damaged', target: 'C', amount: 3, shield: 0, baseShield: 1, hp: 2 },
    ]);
  });

  it('Target lands at any range', () => {
    let state = board({ hand: ['moon-strike'], mp: { A: 4 }, enemies: [at(3, 6), at(2, 5), at(1, 5)] });
    state = play(state, 'moon-strike', 'A', { unit: 'e0' });
    const { state: after, events } = commit(state);
    expect(damaged(events)).toEqual(['e0']);
    // Drone: 1 base shield, then 1 HP of 3.
    expect([enemy(after, 0).baseShield, enemy(after, 0).hp]).toEqual([0, 2]);
  });
});

describe('Puppeteer cards', () => {
  it('Call Medic: Shield 1 on a chosen friendly unit, A included', () => {
    let state = board({ hand: ['call-medic'], mp: { A: 1 } });
    state = play(state, 'call-medic', 'A', { unit: 'A' });
    const { events } = commit(state);
    expect(events).toContainEqual({ t: 'shielded', unit: 'A', amount: 1 });
  });

  it('Command: the ally moves where Command sits in the plan, A pays, the ally does not', () => {
    let state = board({ hand: ['command', 'attack'], mp: { A: 1, C: 1 }, units: { C: at(3, 2) } });
    state = play(state, 'command', 'A', { unit: 'C', tile: at(3, 3) });
    state = play(state, 'attack', 'C');
    const { state: after, events } = commit(state);
    expect(unit(after, 'C').pos).toEqual(at(3, 3));
    // A: 1 - 1 + 1 round + 1 ability. C: 1 - 1 (Attack) + 1 round.
    expect(unit(after, 'A').mp).toBe(2);
    expect(unit(after, 'C').mp).toBe(1);
    const moveAt = events.findIndex((e) => e.t === 'moved');
    const attackAt = events.findIndex((e) => e.t === 'played' && e.card === iidOf(state, 'attack'));
    expect(moveAt).toBeLessThan(attackAt);
  });

  it('resolves the plan in the order it was made: a unit may shoot, then move', () => {
    let state = board({ hand: ['attack', 'move'], mp: { C: 1 }, units: { C: at(3, 2) } });
    state = play(state, 'attack', 'C');
    state = play(state, 'move', 'C', { tile: at(3, 3) });
    const { events } = commit(state);
    const played = events.flatMap((e) => (e.t === 'played' ? [e.card] : []));
    expect(played).toEqual([iidOf(state, 'attack'), iidOf(state, 'move')]);
    const attackAt = events.findIndex((e) => e.t === 'played' && e.card === iidOf(state, 'attack'));
    expect(events.findIndex((e) => e.t === 'damaged')).toBeGreaterThan(attackAt);
    expect(events.findIndex((e) => e.t === 'damaged')).toBeLessThan(events.findIndex((e) => e.t === 'moved'));
  });

  it('Focus: A gains 1 more MP at the start of each of its next 2 turns', () => {
    let state = board({ hand: ['focus'], mp: { A: 1 } });
    state = play(state, 'focus', 'A');
    const r1 = commit(state);
    expect(r1.events.filter((e) => e.t === 'mpGained' && e.unit === 'A').map((e) => (e as { source: string }).source)).toEqual(['round', 'ability', 'focus']);
    // Spend A down each round so the cap (R2) cannot swallow the grant.
    const drained = (s: BattleState): BattleState => {
      const copy = structuredClone(s);
      copy.units.find((u) => u.id === 'A')!.mp = 0;
      return copy;
    };
    const r2 = commit(drained(r1.state));
    expect(r2.events.some((e) => e.t === 'mpGained' && e.source === 'focus')).toBe(true);
    const r3 = commit(drained(r2.state));
    expect(r3.events.some((e) => e.t === 'mpGained' && e.source === 'focus')).toBe(false);
    expect(unit(r3.state, 'A').pendingMp).toEqual([]);
  });

  it('Moon Strike and Artillery: a second play at a target already gone fizzles, used and paid', () => {
    let state = board({ hand: ['moon-strike', 'artillery'], mp: { A: 4, B: 4 }, units: { B: at(2, 3) }, enemies: [null, at(2, 5), at(3, 6)] });
    state = play(state, 'moon-strike', 'A', { unit: 'e1' });
    state = play(state, 'artillery', 'B', { unit: 'e1' });
    const { state: after, events } = commit(state);
    expect(events).toContainEqual({ t: 'defeated', enemy: 'e1' });
    expect(events).toContainEqual({ t: 'fizzled', card: iidOf(state, 'artillery'), unit: 'B', why: 'targetGone' });
    expect(after.piles.discard).toContain(iidOf(state, 'artillery'));
    expect(unit(after, 'B').mp).toBe(1);
  });

  it('Artillery: Blast 2 centred on the chosen enemy', () => {
    let state = board({ hand: ['artillery'], mp: { B: 4 }, units: { B: at(2, 3) } });
    state = play(state, 'artillery', 'B', { unit: 'e1' });
    expect(damaged(commit(state).events)).toEqual(['e0', 'e1', 'e2']);
  });

  it('Shoot: Strike 1', () => {
    let state = board({ hand: ['shoot'] });
    state = play(state, 'shoot', 'B');
    expect(damaged(commit(state).events)).toEqual(['e1']);
  });

  it('Resupply: B gains 2 MP when it resolves, spendable next turn', () => {
    let state = board({ hand: ['resupply'], mp: { B: 1 } });
    state = play(state, 'resupply', 'B');
    const { state: after, events } = commit(state);
    expect(events).toContainEqual({ t: 'mpGained', unit: 'B', amount: 2, source: 'card' });
    expect(unit(after, 'B').mp).toBe(3);
  });

  it('Fire!: Blast 1 on a chosen tile', () => {
    let state = board({ hand: ['fire'], mp: { B: 1 }, units: { B: at(2, 4) } });
    state = play(state, 'fire', 'B', { tile: at(2, 5) });
    // (2,5)'s neighbours include (2,6), the Lancer.
    expect(damaged(commit(state).events)).toEqual(['e1']);
  });

  it('Dash: Move 2', () => {
    let state = board({ hand: ['dash'], mp: { C: 1 } });
    state = play(state, 'dash', 'C', { tile: at(3, 4) });
    expect(unit(commit(state).state, 'C').pos).toEqual(at(3, 4));
  });

  it('Slash: Slash 1 from the danger zone', () => {
    let state = board({ hand: ['slash'], mp: { C: 1 }, units: { C: at(2, 5) } });
    state = play(state, 'slash', 'C');
    expect(damaged(commit(state).events)).toEqual(['e0', 'e1', 'e2']);
  });

  it('Need Help: the next hand draws one extra card that is not C\'s', () => {
    let state = board({ hand: ['need-help'], mp: { C: 1 } });
    // Order the draw pile: five cards, then two of C's, then a Neutral.
    const ids = (defs: string[]) => defs.map((d) => iidOf(state, d));
    state.piles.draw = ids(['shoot', 'resupply', 'artillery', 'fire', 'call-medic', 'dash', 'slash', 'move', 'prep', 'dig-in', 'attack', 'command', 'focus', 'moon-strike']);
    state = play(state, 'need-help', 'C');
    const { state: after, events } = commit(state);
    expect(events).toContainEqual({ t: 'extraDrew', card: iidOf(state, 'move') });
    expect(after.piles.hand).toHaveLength(6);
  });

  it('Need Help: with no such card in the draw pile the extra draw fizzles, and nothing reshuffles for it', () => {
    let state = board({ hand: ['need-help'], mp: { C: 1 } });
    const ids = (defs: string[]) => defs.map((d) => iidOf(state, d));
    // Exactly five left to draw, then nothing: the extra cannot come from the discard.
    state.piles.draw = ids(['shoot', 'resupply', 'artillery', 'fire', 'call-medic']);
    state.piles.discard = ids(['dash', 'slash', 'move', 'prep', 'dig-in', 'attack', 'command', 'focus', 'moon-strike']);
    state = play(state, 'need-help', 'C');
    const { state: after, events } = commit(state);
    expect(events).toContainEqual({ t: 'extraDrawFizzled' });
    expect(events.some((e) => e.t === 'reshuffled')).toBe(false);
    expect(after.piles.hand).toHaveLength(5);
  });

  it('Prep and Dig In: Once cards go to spent and never return', () => {
    let state = board({ hand: ['prep', 'dig-in'], mp: { C: 1 } });
    state = play(state, 'prep', 'C');
    state = play(state, 'dig-in', 'B');
    let after = commit(state);
    expect(after.events).toContainEqual({ t: 'shielded', unit: 'C', amount: 2 });
    expect(after.events).toContainEqual({ t: 'shielded', unit: 'B', amount: 1 });
    expect(after.state.piles.spent.sort()).toEqual([iidOf(state, 'prep'), iidOf(state, 'dig-in')].sort());
    for (let round = 0; round < 8; round++) {
      after = commit(after.state);
      expect(after.state.piles.hand).not.toContain(iidOf(state, 'prep'));
      expect(cardCount(after.state)).toBe(15);
    }
  });

  it('Move and Attack: Neutrals spend the MP of the unit that plays them', () => {
    let state = board({ hand: ['move', 'attack'], mp: { B: 1 } });
    state = play(state, 'move', 'B', { tile: at(2, 3) });
    state = play(state, 'attack', 'B');
    const { state: after } = commit(state);
    expect(unit(after, 'B').pos).toEqual(at(2, 3));
    expect(unit(after, 'B').mp).toBe(1);
  });
});

describe('unit abilities', () => {
  it('A gains 1 MP at the start of each turn, turn 1 included', () => {
    const created = begun('test', 'A');
    expect(created.events).toContainEqual({ t: 'mpGained', unit: 'A', amount: 1, source: 'ability' });
    const next = commit(created.state);
    expect(next.events).toContainEqual({ t: 'mpGained', unit: 'A', amount: 1, source: 'ability' });
  });

  it('B converts only its first card, only at full HP', () => {
    let state = board({ hand: ['shoot', 'attack'], mp: { B: 1 }, enemies: [at(1, 5), at(2, 4), at(2, 6)] });
    state = play(state, 'attack', 'B');
    state = play(state, 'shoot', 'B');
    const first = commit(state);
    expect(first.events.filter((e) => e.t === 'converted')).toHaveLength(1);
    expect(first.events.find((e) => e.t === 'converted')).toMatchObject({ card: iidOf(state, 'attack') });

    let hurt = board({ hand: ['shoot'], enemies: [at(1, 5), at(2, 4), at(2, 6)] });
    hurt.units.find((u) => u.id === 'B')!.hp = 1;
    hurt = play(hurt, 'shoot', 'B');
    const events = commit(hurt).events;
    expect(events.some((e) => e.t === 'converted')).toBe(false);
    expect(damaged(events)).toEqual(['e1']);
  });

  it('B\'s first slot taken by Command means no conversion this turn', () => {
    let state = board({ hand: ['command', 'shoot'], mp: { A: 1 }, enemies: [at(1, 5), at(2, 4), at(2, 6)] });
    state = play(state, 'command', 'A', { unit: 'B', tile: at(2, 3) });
    state = play(state, 'shoot', 'B');
    expect(commit(state).events.some((e) => e.t === 'converted')).toBe(false);
  });
});

describe('shield timing, faint and piles', () => {
  it('player Shield clears at the next hand; base shield never refreshes', () => {
    let state = board({ hand: ['dig-in'] });
    state = play(state, 'dig-in', 'C');
    const ctx: Ctx = { s: structuredClone(state), events: [] };
    damage(ctx, ctx.s.units.find((u) => u.id === 'B')!, 1);
    const after = commit(ctx.s);
    expect(after.events).toContainEqual({ t: 'shieldCleared', unit: 'C', amount: 1 });
    expect(unit(after.state, 'C').shield).toBe(0);
    let later = after.state;
    for (let round = 0; round < 3 && later.phase === 'plan'; round++) later = commit(later).state;
    expect(unit(later, 'B').baseShield).toBe(0);
  });

  it('faint removes the unit\'s cards from every pile and leaves Neutrals', () => {
    const state = board({ hand: ['dash', 'move'] });
    state.piles.draw = state.piles.draw.filter((c) => c !== iidOf(state, 'slash') && c !== iidOf(state, 'prep'));
    state.piles.discard.push(iidOf(state, 'slash'));
    state.piles.spent.push(iidOf(state, 'prep'));
    const ctx: Ctx = { s: structuredClone(state), events: [] };
    faint(ctx, ctx.s.units.find((u) => u.id === 'C')!);
    const cOwned = ['dash', 'slash', 'need-help', 'prep'].map((d) => iidOf(state, d)).sort();
    expect([...ctx.s.piles.removed].sort()).toEqual(cOwned);
    for (const pile of ['draw', 'hand', 'discard', 'spent'] as const) {
      for (const iid of cOwned) expect(ctx.s.piles[pile]).not.toContain(iid);
    }
    expect(ctx.s.piles.hand).toEqual([iidOf(state, 'move')]);
    expect(cardCount(ctx.s)).toBe(15);
    expect(unit(ctx.s, 'C').pos).toBeNull();
  });

  it('reshuffles the discard into the draw pile mid-draw, drawing new RNG, and loses no card', () => {
    const created = begun('test', 'RESHUFFLE');
    // Units nothing can faint, so the piles are measured alone.
    let state = structuredClone(created.state);
    for (const u of state.units) u.hp = u.maxHp = 99;
    let reshuffles = 0;
    for (let round = 0; round < 9; round++) {
      const before = state.rngDraws;
      const { state: next, events } = commit(state);
      if (events.some((e) => e.t === 'reshuffled')) {
        reshuffles++;
        expect(next.rngDraws).toBeGreaterThan(before);
      } else expect(next.rngDraws).toBe(before);
      const all = PILES.flatMap((pile) => next.piles[pile]);
      expect(all).toHaveLength(15);
      expect(new Set(all).size).toBe(15);
      expect(next.piles.hand).toHaveLength(5);
      state = next;
    }
    expect(reshuffles).toBeGreaterThan(0);
  });

  it('a battle still running after the round cap is lost', () => {
    const state = { ...board(), round: 30 };
    const { state: after, events } = commit(state);
    expect(after.phase).toBe('lost');
    expect(events).toContainEqual({ t: 'lost', why: 'roundCap' });
  });

  it('wins when no enemy remains, and stops there', () => {
    let state = board({ hand: ['moon-strike'], mp: { A: 4 }, enemies: [null, at(2, 5), null] });
    state = play(state, 'moon-strike', 'A', { unit: 'e1' });
    const { state: after, events } = commit(state);
    expect(after.phase).toBe('won');
    expect(events.at(-1)).toEqual({ t: 'won' });
    expect(events.some((e) => e.t === 'roundStarted')).toBe(false);
  });
});

describe('determinism', () => {
  it('the same seed and actions give a deep-equal state and an identical event stream', () => {
    const run = () => {
      const created = begun('test', 'TWICE');
      let state = created.state;
      const events: BattleEvent[] = [...created.events];
      for (let round = 0; round < 8; round++) {
        const result = commit(state);
        events.push(...result.events);
        state = result.state;
      }
      return { state, events };
    };
    expect(run()).toEqual(run());
  });
});
