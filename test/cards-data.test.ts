/**
 * The card engine's data tables against the design snapshot, Appendix A of
 * `docs/spec/gymrun-card-battle-engine-prompt.md`, and the author's card
 * sheet. **Card battle engine, checkpoint 1.**
 */
import { describe, expect, it } from 'vitest';

import { CARDS, DECKS, PUPPETEER_CARDS } from '../src/cardData/cards';
import { CLASS_SLOTS } from '../src/cardData/classes';
import { ENCOUNTERS, SCENARIOS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { RULES } from '../src/cardData/rules';
import { UNITS } from '../src/cardData/units';
import { createBattle, gradeTotal, layoutBattle } from '../src/core/cards/create';
import { RESERVED_EFFECTS } from '../src/core/cards/defs';
import { allTiles, inReach, samePos, zoneOf } from '../src/core/cards/zones';

describe('card data', () => {
  it('ships no card that uses a reserved effect', () => {
    for (const card of Object.values(CARDS)) {
      for (const effect of card.effects) {
        expect((RESERVED_EFFECTS as readonly string[]).includes(effect.k), `${card.id} uses ${effect.k}`).toBe(false);
      }
    }
  });

  it('matches the snapshot card table: owner, cost and Uses 1 for the old Once cards', () => {
    const table: [string, string, number, boolean][] = [
      ['call-medic', 'A', 1, false],
      ['command', 'A', 1, false],
      ['focus', 'A', 1, false],
      ['moon-strike', 'A', 4, false],
      ['shoot', 'B', 0, false],
      ['resupply', 'B', 1, false],
      ['artillery', 'B', 4, false],
      ['fire', 'B', 1, false],
      ['dash', 'C', 1, false],
      ['slash', 'C', 1, false],
      ['need-help', 'C', 1, false],
      ['prep', 'C', 1, true],
      ['move', 'neutral', 0, false],
      ['dig-in', 'neutral', 0, true],
      ['attack', 'neutral', 1, false],
    ];
    // Every card but the Harpoon, which the Colossus grants (Part D) and no deck holds.
    expect(Object.keys(PUPPETEER_CARDS).filter((id) => id !== 'harpoon').sort()).toEqual(table.map(([id]) => id).sort());
    for (const [id, owner, cost, once] of table) {
      expect([CARDS[id]!.owner, CARDS[id]!.cost, CARDS[id]!.uses === 1], id).toEqual([owner, cost, once]);
    }
  });

  it('builds the Puppeteer deck from one copy of every card', () => {
    expect([...DECKS['puppeteer']!.cards].sort()).toEqual(Object.keys(PUPPETEER_CARDS).filter((id) => id !== 'harpoon').sort());
  });

  it('matches the snapshot units and classes', () => {
    expect(CLASS_SLOTS).toEqual({ special: 1, ranged: 2, melee: 3 });
    expect([UNITS.A.class, UNITS.A.hp, UNITS.A.baseShield]).toEqual(['special', 1, 1]);
    expect([UNITS.B.class, UNITS.B.hp, UNITS.B.baseShield]).toEqual(['ranged', 2, 1]);
    expect([UNITS.C.class, UNITS.C.hp, UNITS.C.baseShield]).toEqual(['melee', 3, 2]);
  });

  it('matches the snapshot enemies (the rest: test/cards-new-enemies.test.ts)', () => {
    expect([ENEMIES.drone.hp, ENEMIES.drone.baseShield, ENEMIES.drone.script.steps.length]).toEqual([3, 1, 6]);
    expect([ENEMIES.lancer.hp, ENEMIES.lancer.baseShield, ENEMIES.lancer.script.steps.length]).toEqual([2, 0, 3]);
  });

  it('places the first encounter as the snapshot does', () => {
    const state = layoutBattle('test', 'S')!;
    expect(state.units.map((u) => [u.id, u.pos])).toEqual([
      ['A', { lane: 1, col: 2 }],
      ['B', { lane: 2, col: 2 }],
      ['C', { lane: 3, col: 2 }],
    ]);
    expect(state.enemies.map((e) => [e.def, e.pos])).toEqual([
      ['drone', { lane: 1, col: 6 }],
      ['lancer', { lane: 2, col: 6 }],
      ['drone', { lane: 3, col: 6 }],
    ]);
    expect(ENCOUNTERS['test']!.deckId).toBe('puppeteer');
  });

  it('gives every scenario a legal start: units on distinct home tiles, enemies in reach and room to spawn', () => {
    const key = (p: { lane: number; col: number }): string => `${p.lane},${p.col}`;
    for (const encounter of Object.values(ENCOUNTERS)) {
      const id = encounter.id;
      expect(encounter.name.length, id).toBeGreaterThan(0);
      expect(DECKS[encounter.deckId], id).toBeDefined();
      expect(encounter.units.map((u) => u.def), id).toEqual([...DECKS[encounter.deckId]!.units]);
      for (const { pos } of encounter.units) expect(zoneOf(pos), id).toBe(RULES.deployZone);
      expect(new Set(encounter.units.map((u) => key(u.pos))).size, id).toBe(encounter.units.length);
      const fixed = encounter.enemies.flatMap((e) => (e.pos ? [e.pos] : []));
      for (const pos of fixed) expect(inReach('enemy', pos), id).toBe(true);
      expect(new Set(fixed.map(key)).size, id).toBe(fixed.length);
      const room = allTiles().filter((t) => zoneOf(t) === RULES.spawnZone && !fixed.some((f) => samePos(f, t))).length;
      expect(encounter.enemies.length - fixed.length, `${id}: spawns without room`).toBeLessThanOrEqual(room);
    }
  });

  it('places the A4 scenarios as the patch lists them, in spawn order, each with its grade total', () => {
    const table: [string, string, [string, number, number][], number][] = [
      ['turret-alley', 'Turret Alley', [['turret', 1, 7], ['hound', 2, 6], ['turret', 3, 7]], 5],
      ['wall-and-gun', 'Wall and Gun', [['bulwark', 1, 6], ['sniper', 2, 7], ['bulwark', 3, 6]], 7],
      ['the-pack', 'The Pack', [['hound', 1, 6], ['hound', 2, 6], ['hound', 3, 6], ['pikeman', 2, 7]], 6],
    ];
    for (const [id, name, enemies, grade] of table) {
      const encounter = ENCOUNTERS[id]!;
      expect(encounter.name, id).toBe(name);
      expect(encounter.enemies.map((e) => [e.def, e.pos?.lane, e.pos?.col]), id).toEqual(enemies);
      expect(gradeTotal(encounter), id).toBe(grade);
    }
    // The shipped scenarios keep their ids and layouts and gain a total.
    expect(Object.keys(SCENARIOS)).toEqual(['skirmish', 'test', 'staggered', 'turret-alley', 'wall-and-gun', 'the-pack', 'siege']);
    expect(['skirmish', 'test', 'staggered'].map((id) => gradeTotal(ENCOUNTERS[id]!))).toEqual([5, 5, 5]);
  });

  it('spawns an unplaced enemy on the enemy backline, and not always on the row nearest the danger zone', () => {
    const rows = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const created = createBattle('skirmish', `SPAWN${i}`);
      if (!created.ok) throw new Error('create');
      for (const e of created.state.enemies) {
        expect(zoneOf(e.pos!)).toBe('enemyBackline');
        rows.add(e.pos!.col);
      }
      const tiles = created.state.enemies.map((e) => `${e.pos!.lane},${e.pos!.col}`);
      expect(new Set(tiles).size).toBe(3);
    }
    expect([...rows].sort()).toEqual([6, 7]);
  });

  it('carries the rule defaults it is asked to', () => {
    expect(RULES.mp.cap).toBe(5);
    expect(RULES.handSize).toBe(5);
    expect(RULES.huntTieBreak).toEqual(['nearestLane', 'lowestHp', 'upperLane']);
    expect(RULES.advance).toEqual({ cols: 1, limitCol: 3, ifBlocked: 'wait' });
  });

  it('lays out a battle whose state is plain JSON', () => {
    const state = layoutBattle('test', 'S')!;
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state.piles.draw).toHaveLength(15);
    expect(layoutBattle('nope', 'S')).toBeNull();
    expect(layoutBattle('__proto__', 'S')).toBeNull();
  });
});
