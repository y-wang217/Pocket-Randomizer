/**
 * Group B (`docs/spec/gymrun-card-run-shapes-prompt.md`, checkpoint 4): the
 * four effects that were reserved, each with its resolver. Push and Pull move
 * an enemy and aim it again; Repair heals an ally to its max; Stealth lets the
 * enemies' acts pass over a unit for the coming enemy phase.
 */
import { describe, expect, it } from 'vitest';

import { CARDS, UPGRADE_OF } from '../src/cardData/cards';
import { MARKET, STARTING_DECK, TOWN_POOL } from '../src/cardData/cardrunTables';
import { BENCH_IDS } from '../src/cardData/encounters';
import { botStream, playBattle, randomBot } from '../src/core/cards/bots';
import { layoutBattle } from '../src/core/cards/create';
import type { Loadout } from '../src/core/cards/defs';
import type { BattleEvent } from '../src/core/cards/events';
import { checkInvariants } from '../src/core/cards/invariants';
import { completeChoices } from '../src/core/cards/legal';
import { replay } from '../src/core/cards/log';
import type { Action, BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { at, iidOf } from './fixtures/card-battle';

const GROUP_B = ['shove', 'patch-up', 'grapple', 'smoke'];

/** The `test` encounter on a deck holding `cards`, in plan, `card` in hand, every unit with 5 MP. */
function board(cards: string[], hand: string): { state: BattleState; iid: string } {
  const state = layoutBattle('test', 'GROUPB', { cards: [...cards, ...STARTING_DECK] })!;
  const iid = iidOf(state, hand);
  state.piles.draw = state.piles.draw.filter((c) => c !== iid);
  state.piles.hand.push(iid);
  state.mp = 15;
  return { state, iid };
}

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result;
}

function playAndCommit(state: BattleState, card: string, unit: UnitId, choice?: Choice): { state: BattleState; events: BattleEvent[] } {
  const selected = ok(state, { type: 'select', card, unit, ...(choice ? { choice } : {}) }).state;
  return ok(selected, { type: 'commit' });
}

describe('Group B: the cards', () => {
  it('offers Shove and Patch Up as rewards and Grapple and Smoke at the market', () => {
    expect(TOWN_POOL).toEqual(expect.arrayContaining(['shove', 'patch-up']));
    expect(MARKET['grapple']).toBeDefined();
    expect(MARKET['smoke']).toBeDefined();
    expect(UPGRADE_OF['shove']).toBe('shove+');
    expect(UPGRADE_OF['patch-up']).toBe('patch-up+');
    for (const id of ['grapple', 'smoke']) expect(CARDS[id], id).toMatchObject({ equipment: true, uses: 1, owner: 'neutral' });
  });
});

describe('Push', () => {
  it("moves every enemy the card's damage hit away from the player, and aims it again", () => {
    const { state, iid } = board(['shove'], 'shove');
    const [a, b, c] = state.units;
    Object.assign(a!, { pos: at(1, 1) });
    Object.assign(b!, { pos: at(3, 1) });
    Object.assign(c!, { pos: at(2, 4) });
    const [e0, lancer, e2] = state.enemies;
    Object.assign(e0!, { pos: at(1, 7) });
    Object.assign(lancer!, { pos: at(2, 5), baseShield: 0, hp: 5, intent: { act: 'none', n: 0, tiles: [] } });
    Object.assign(e2!, { pos: at(3, 7) });
    const { events } = playAndCommit(state, iid, 'C');
    expect(events).toContainEqual({ t: 'displaced', enemy: lancer!.id, card: iid, how: 'push', from: at(2, 5), to: at(2, 6) });
    // Aimed again from where it now stands, before the enemies act.
    const displaced = events.findIndex((e) => e.t === 'displaced');
    expect(events.findIndex((e, i) => i > displaced && e.t === 'telegraphed' && e.enemy === lancer!.id)).toBeGreaterThan(displaced);
  });

  it('stops short of a held tile, and never moves a boss', () => {
    const { state, iid } = board(['shove'], 'shove');
    Object.assign(state.units[2]!, { pos: at(2, 4) });
    const [blocker, lancer] = state.enemies;
    Object.assign(blocker!, { pos: at(2, 6) });
    Object.assign(lancer!, { pos: at(2, 5), baseShield: 0, hp: 5 });
    Object.assign(state.enemies[2]!, { pos: at(3, 7) });
    const { events } = playAndCommit(state, iid, 'C');
    expect(events.some((e) => e.t === 'displaced')).toBe(false);

    const lair = layoutBattle('colossus-lair', 'BOSS', { cards: ['shove', ...STARTING_DECK] })!;
    const shove = iidOf(lair, 'shove');
    lair.piles.draw = lair.piles.draw.filter((x) => x !== shove);
    lair.piles.hand.push(shove);
    lair.mp = 15;
    Object.assign(lair.units[2]!, { pos: at(1, 4) });
    const boss = lair.enemies[0]!;
    Object.assign(boss, { pos: at(1, 5), baseShield: 0, hp: 12 });
    const after = playAndCommit(lair, shove, 'C');
    expect(after.events.some((e) => e.t === 'damaged' && e.target === boss.id)).toBe(true);
    expect(after.events.some((e) => e.t === 'displaced')).toBe(false);
  });
});

describe('Pull', () => {
  it('pulls the chosen enemy toward the player, at any range, never past the enemy reach', () => {
    const { state, iid } = board(['grapple'], 'grapple');
    const sniper = state.enemies[1]!;
    Object.assign(sniper, { pos: at(2, 7) });
    const { events } = playAndCommit(state, iid, 'B', { unit: sniper.id });
    expect(events).toContainEqual({ t: 'displaced', enemy: sniper.id, card: iid, how: 'pull', from: at(2, 7), to: at(2, 5) });

    const near = board(['grapple'], 'grapple');
    const front = near.state.enemies[1]!;
    Object.assign(front, { pos: at(2, 4) });
    const pulled = playAndCommit(near.state, near.iid, 'B', { unit: front.id });
    // Column 3 is the enemies' nearest: one tile, not two.
    expect(pulled.events.find((e) => e.t === 'displaced')).toMatchObject({ from: at(2, 4), to: at(2, 3) });
  });

  it('offers no boss to pull', () => {
    const lair = layoutBattle('colossus-lair', 'BOSS', { cards: ['grapple', ...STARTING_DECK] })!;
    const grapple = iidOf(lair, 'grapple');
    lair.piles.draw = lair.piles.draw.filter((x) => x !== grapple);
    lair.piles.hand.push(grapple);
    expect(completeChoices(lair, grapple, 'B')).toEqual([]);
    expect(step(lair, { type: 'select', card: grapple, unit: 'B', choice: { unit: lair.enemies[0]!.id } })).toMatchObject({ ok: false });
  });
});

describe('Repair', () => {
  it('heals the chosen ally, never past its max', () => {
    const { state, iid } = board(['patch-up+'], 'patch-up+');
    const dasher = state.units[2]!;
    dasher.hp = 1;
    // Out of every enemy's way, so the round's enemy phase cannot touch the reading.
    for (const e of state.enemies) e.intent = null;
    const { state: after, events } = playAndCommit(state, iid, 'A', { unit: 'C' });
    expect(events).toContainEqual({ t: 'repaired', unit: 'C', card: iid, amount: 2 });
    expect(after.units[2]!.hp).toBe(3);

    const full = board(['patch-up+'], 'patch-up+');
    for (const e of full.state.enemies) e.intent = null;
    const capped = playAndCommit(full.state, full.iid, 'A', { unit: 'C' });
    expect(capped.events).toContainEqual({ t: 'repaired', unit: 'C', card: full.iid, amount: 0 });
    expect(capped.state.units[2]!.hp).toBe(3);
  });
});

describe('Stealth', () => {
  it("lets the enemy's act pass over the unit for the coming enemy phase, then wears off", () => {
    const { state, iid } = board(['smoke'], 'smoke');
    const gunner = state.units[1]!;
    const drone = state.enemies[1]!;
    for (const e of state.enemies) e.intent = null;
    // A Strike down lane 2 that stops on the Gunner.
    drone.intent = { act: 'strike', n: 2, tiles: [1, 2, 3, 4, 5].map((col) => at(2, col as 1)) };
    const { state: after, events } = playAndCommit(state, iid, 'B');
    expect(events).toContainEqual({ t: 'stealthed', unit: 'B', card: iid, turns: 1 });
    expect(events).toContainEqual({ t: 'unseen', unit: 'B', enemy: drone.id });
    expect(events.some((e) => e.t === 'damaged' && e.target === 'B')).toBe(false);
    expect(after.units[1]!.hp).toBe(gunner.hp);
    // Worn off by the next plan.
    expect(after.units[1]!.stealth).toBeUndefined();
  });
});

describe('Group B under the random bot', () => {
  it('holds every invariant across battles whose deck holds every new card, and every log replays', () => {
    const loadout: Loadout = { cards: [...GROUP_B, 'shove+', 'patch-up+', 'whirlwind', 'rally', 'mark-target', 'suppress', 'second-wind', 'flashbang', ...STARTING_DECK] };
    let played = 0;
    const seen = new Set<string>();
    for (const [i, id] of BENCH_IDS.entries()) {
      for (let k = 0; k < 4; k++) {
        const stream = botStream(`GB${i}-${k}`);
        const battle = playBattle(
          id,
          `GBR${i}-${k}`,
          (s) => randomBot(s, stream),
          (_before, _action, result) => {
            if (result.ok) expect(checkInvariants(result.state), `${id} ${k}`).toEqual([]);
          },
          5000,
          loadout,
        );
        for (const e of battle.events) seen.add(e.t);
        expect(replay(battle.log).state).toEqual(battle.state);
        played++;
      }
    }
    expect(played).toBeGreaterThan(40);
    // The random bot reached each new effect at least once.
    for (const t of ['displaced', 'repaired', 'stealthed']) expect(seen.has(t), t).toBe(true);
  });
});
