/**
 * Checkpoint 5a (`docs/spec/gymrun-card-run-shapes-prompt.md`): Cover, Stun,
 * and a talent for each shape the author named. Bodyguard and Battery for
 * "slasher builds tanky and blocks for commander to only have nukes and mana";
 * Siege Mode for the escorted artillery; Quartermaster and Sweep for control
 * and sweep; Field Medic for the Puppeteer.
 */
import { describe, expect, it } from 'vitest';

import { STARTING_DECK } from '../src/cardData/cardrunTables';
import { BENCH_IDS } from '../src/cardData/encounters';
import { TALENTS, UNIT_TALENTS } from '../src/cardData/talents';
import { botStream, playBattle, randomBot } from '../src/core/cards/bots';
import { layoutBattle } from '../src/core/cards/create';
import type { Loadout, UnitBoost, UnitDefId } from '../src/core/cards/defs';
import type { BattleEvent } from '../src/core/cards/events';
import { checkInvariants } from '../src/core/cards/invariants';
import { replay } from '../src/core/cards/log';
import { previewPlay } from '../src/core/cards/preview';
import type { BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { at, iidOf } from './fixtures/card-battle';

/** The `test` encounter on a deck holding `cards`, those in hand, every unit at 5 MP, no enemy telegraphing. */
function board(cards: string[], units?: Loadout['units']): BattleState {
  const state = layoutBattle('test', 'TALENT', { cards: [...cards, ...STARTING_DECK], ...(units ? { units } : {}) })!;
  for (const card of cards) {
    const iid = iidOf(state, card);
    state.piles.draw = state.piles.draw.filter((c) => c !== iid);
    state.piles.hand.push(iid);
  }
  for (const u of state.units) u.mp = 5;
  for (const e of state.enemies) e.intent = null;
  return state;
}

function play(state: BattleState, card: string, unit: UnitId, choice?: Choice): { state: BattleState; events: BattleEvent[] } {
  const selected = step(state, { type: 'select', card: iidOf(state, card), unit, ...(choice ? { choice } : {}) });
  if (!selected.ok) throw new Error(`${card}: ${selected.reason}`);
  const committed = step(selected.state, { type: 'commit' });
  if (!committed.ok) throw new Error(`${card}: ${committed.reason}`);
  return committed;
}

const strikeDownLane = (lane: 1 | 2 | 3, n: number) => ({ act: 'strike' as const, n, tiles: [1, 2, 3, 4, 5].map((col) => at(lane, col as 1)) });

describe('Cover', () => {
  it('sends a hit meant for a neighbour to the covering unit, and wears off by the next plan', () => {
    const state = board(['guard-duty']);
    // C on (3,2) covers B on (2,2); a Strike down lane 2 stops on B.
    const drone = state.enemies[1]!;
    drone.intent = strikeDownLane(2, 1);
    const { state: after, events } = play(state, 'guard-duty', 'C');
    expect(events).toContainEqual({ t: 'covering', unit: 'C', turns: 1 });
    expect(events).toContainEqual({ t: 'covered', unit: 'C', ally: 'B', enemy: drone.id });
    expect(events.some((e) => e.t === 'damaged' && e.target === 'B')).toBe(false);
    expect(events.some((e) => e.t === 'damaged' && e.target === 'C')).toBe(true);
    expect(after.units[2]!.cover).toBeUndefined();
  });

  it('covers only an orthogonal neighbour', () => {
    const state = board(['guard-duty']);
    Object.assign(state.units[2]!, { pos: at(3, 1) });
    state.enemies[1]!.intent = strikeDownLane(2, 1);
    const { events } = play(state, 'guard-duty', 'C');
    expect(events.some((e) => e.t === 'covered')).toBe(false);
    expect(events.some((e) => e.t === 'damaged' && e.target === 'B')).toBe(true);
  });
});

describe('Stun', () => {
  it('holds an enemy the card hit for its next turn: its telegraph clears at once and it does not act', () => {
    const state = board(['concuss']);
    const lancer = state.enemies[1]!;
    Object.assign(lancer, { hp: 4, baseShield: 0 });
    lancer.intent = strikeDownLane(2, 1);
    const { state: after, events } = play(state, 'concuss', 'B');
    expect(events).toContainEqual({ t: 'stunned', enemy: lancer.id, card: iidOf(state, 'concuss'), turns: 1 });
    expect(events.some((e) => e.t === 'enemyActed' && e.enemy === lancer.id)).toBe(false);
    expect(events.some((e) => e.t === 'damaged' && e.target === 'B')).toBe(false);
    // It wore off in the move phase and the lancer aims again for the next round.
    expect(events).toContainEqual({ t: 'pinEnded', enemy: lancer.id });
    expect(after.enemies[1]!.pinned).toBe(0);
    expect(after.enemies[1]!.intent).not.toBeNull();
  });

  it('never holds a boss', () => {
    const lair = layoutBattle('colossus-lair', 'BOSS', { cards: ['concuss', ...STARTING_DECK] })!;
    const iid = iidOf(lair, 'concuss');
    lair.piles.draw = lair.piles.draw.filter((c) => c !== iid);
    lair.piles.hand.push(iid);
    for (const u of lair.units) u.mp = 5;
    // The Gunner's lane is one of the two the Colossus stands in.
    const { events } = play(lair, 'concuss', 'B');
    expect(events.some((e) => e.t === 'damaged' && e.target === lair.enemies[0]!.id)).toBe(true);
    expect(events.some((e) => e.t === 'stunned')).toBe(false);
  });
});

describe('talents', () => {
  const only = (unit: UnitDefId, talent: string): Loadout['units'] => ({ [unit]: { talents: [talent] } as UnitBoost });

  it('gives every unit at least two, each for its own unit', () => {
    for (const [unit, list] of Object.entries(UNIT_TALENTS)) {
      expect(list.length, unit).toBeGreaterThanOrEqual(2);
      for (const t of list) expect(TALENTS[t]!.unit, t).toBe(unit);
    }
    expect(Object.values(UNIT_TALENTS).flat().sort()).toEqual(Object.keys(TALENTS).sort());
  });

  it('Battery: the Commander gains one more MP at each turn start', () => {
    // From 0 MP, so the cap does not swallow what it gains.
    const empty = (state: BattleState): BattleState => {
      state.units[0]!.mp = 0;
      return state;
    };
    const plain = play(empty(board(['dig-in'])), 'dig-in', 'A');
    const charged = play(empty(board(['dig-in'], only('A', 'battery'))), 'dig-in', 'A');
    const fromAbility = (events: BattleEvent[]) => events.filter((e) => e.t === 'mpGained' && e.unit === 'A' && e.source === 'ability').reduce((n, e) => n + (e.t === 'mpGained' ? e.amount : 0), 0);
    expect(fromAbility(charged.events)).toBe(fromAbility(plain.events) + 1);
  });

  it('Field Medic: the Commander’s Shields and Repairs are one bigger', () => {
    const shielded = play(board(['call-medic'], only('A', 'field-medic')), 'call-medic', 'A', { unit: 'C' });
    expect(shielded.events).toContainEqual({ t: 'shielded', unit: 'C', amount: 2 });
    const state = board(['patch-up'], only('A', 'field-medic'));
    state.units[2]!.hp = 1;
    const repaired = play(state, 'patch-up', 'A', { unit: 'C' });
    expect(repaired.events.find((e) => e.t === 'repaired')).toMatchObject({ amount: 2 });
  });

  it('Siege Mode: a Blast from the danger zone is one bigger, in the preview as in the round', () => {
    const state = board(['fire'], only('B', 'siege-mode'));
    Object.assign(state.units[1]!, { pos: at(2, 4) });
    const lancer = state.enemies[1]!;
    Object.assign(lancer, { pos: at(2, 6), hp: 5, baseShield: 0 });
    const choice = { tile: at(2, 6) };
    expect(previewPlay(state, { card: iidOf(state, 'fire'), unit: 'B', choice }).attack?.n).toBe(2);
    const { events } = play(state, 'fire', 'B', choice);
    expect(events.find((e) => e.t === 'damaged' && e.target === lancer.id)).toMatchObject({ amount: 2 });
  });

  it('Quartermaster: equipment the Gunner plays queues an extra card', () => {
    const { events } = play(board(['ration'], only('B', 'quartermaster')), 'ration', 'B');
    expect(events.filter((e) => e.t === 'drawQueued')).toHaveLength(1);
    expect(play(board(['ration']), 'ration', 'B').events.some((e) => e.t === 'drawQueued')).toBe(false);
  });

  it('Bodyguard: a Shield the Dasher gives itself also Covers', () => {
    const { events } = play(board(['brace-c'], only('C', 'bodyguard')), 'brace-c', 'C');
    expect(events).toContainEqual({ t: 'covering', unit: 'C', turns: 1 });
  });

  it('Sweep: the Dasher’s Slash is one bigger', () => {
    const state = board(['slash'], only('C', 'sweep'));
    Object.assign(state.units[2]!, { pos: at(2, 4) });
    const lancer = state.enemies[1]!;
    Object.assign(lancer, { pos: at(2, 5), hp: 5, baseShield: 0 });
    const { events } = play(state, 'slash', 'C');
    expect(events.find((e) => e.t === 'damaged' && e.target === lancer.id)).toMatchObject({ amount: 2 });
  });
});

describe('5a under the random bot', () => {
  it('holds every invariant with every talent taken and Cover and Stun in the deck, and every log replays', () => {
    const units = Object.fromEntries(Object.entries(UNIT_TALENTS).map(([u, list]) => [u, { talents: [...list] }])) as Loadout['units'];
    const loadout: Loadout = { cards: ['guard-duty', 'concuss', 'guard-duty+', 'concuss+', 'fire', 'call-medic', 'patch-up', 'ration', 'grapple', ...STARTING_DECK], units };
    const seen = new Set<string>();
    for (const [i, id] of BENCH_IDS.entries()) {
      for (let k = 0; k < 3; k++) {
        const stream = botStream(`T5${i}-${k}`);
        const battle = playBattle(
          id,
          `T5R${i}-${k}`,
          (s) => randomBot(s, stream),
          (_before, _action, result) => {
            if (result.ok) expect(checkInvariants(result.state), `${id} ${k}`).toEqual([]);
          },
          5000,
          loadout,
        );
        for (const e of battle.events) seen.add(e.t);
        expect(replay(battle.log).state).toEqual(battle.state);
      }
    }
    for (const t of ['covering', 'covered', 'stunned']) expect(seen.has(t), t).toBe(true);
  });
});
