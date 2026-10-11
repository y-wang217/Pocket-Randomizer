/**
 * Card run shapes, checkpoint 2 (`docs/spec/gymrun-card-run-shapes-prompt.md`):
 * the basic starting deck, the Gunner's Pierce taken off the unit and given
 * back as a talent, and a card reward that replaces a card. The author's
 * rule for the checkpoint: everything taken away is given back in an upgrade.
 */
import { describe, expect, it } from 'vitest';

import { CARDS, DECKS, UPGRADE_OF } from '../src/cardData/cards';
import { RUN_RULES, STARTING_DECK, TOWN_POOL } from '../src/cardData/cardrunTables';
import { TALENTS, UNIT_TALENTS } from '../src/cardData/talents';
import { UNITS } from '../src/cardData/units';
import { createRun, offersFor, type CardRunState, type FightNode } from '../src/core/cards/cardrun';
import { createBattle } from '../src/core/cards/create';
import { abilitiesOf } from '../src/core/cards/plan';

const MARKSMAN = { k: 'firstCardConverts', from: 'strike', to: 'pierce', while: 'fullHp' };

describe('the basic starting deck', () => {
  it('is ten cards that do nothing fancy: a hit per unit, a Brace per unit, two Moves, an Attack and a Dig In', () => {
    expect(STARTING_DECK).toHaveLength(10);
    expect(createRun('BASIC').deck).toEqual([...STARTING_DECK]);
    for (const id of STARTING_DECK) {
      const def = CARDS[id]!;
      expect(def, id).toBeDefined();
      expect(def.ult, id).toBeUndefined();
      expect(def.cost, id).toBeLessThanOrEqual(1);
      expect(def.effects, id).toHaveLength(1);
      expect(UPGRADE_OF[id], `${id} has an upgrade`).toBeDefined();
    }
    for (const owner of ['A', 'B', 'C'] as const) {
      const own = STARTING_DECK.filter((id) => CARDS[id]!.owner === owner);
      expect(own.map((id) => CARDS[id]!.name).sort(), owner).toContain('Brace');
      expect(own.some((id) => ['strike', 'slash'].includes(CARDS[id]!.effects[0]!.k)), owner).toBe(true);
    }
  });

  it('lets the shrine thin it: the removal floor is under ten', () => {
    expect(RUN_RULES.minDeck).toBeLessThan(STARTING_DECK.length);
  });
});

describe('everything taken away is given back', () => {
  it('offers every Puppeteer card the starting deck leaves out as a card reward', () => {
    for (const id of DECKS['puppeteer']!.cards) {
      if (!STARTING_DECK.includes(id)) expect(TOWN_POOL, id).toContain(id);
    }
  });

  it("takes the Gunner's Pierce off the unit and offers it back as the Marksman talent", () => {
    expect(UNITS.B.abilities).toEqual([]);
    expect(TALENTS['marksman']).toMatchObject({ unit: 'B', abilities: [MARKSMAN] });
    expect(UNIT_TALENTS.B).toContain('marksman');
  });

  it('keeps it on the sandbox Puppeteer, an end state, and off a run battle until the talent is taken', () => {
    const sandbox = createBattle('skirmish', 'SHAPE1');
    if (!sandbox.ok) throw new Error('create');
    expect(abilitiesOf(sandbox.state, 'B')).toEqual([MARKSMAN]);

    const bare = createBattle('skirmish', 'SHAPE1', { cards: [...STARTING_DECK] });
    if (!bare.ok) throw new Error('create');
    expect(abilitiesOf(bare.state, 'B')).toEqual([]);

    const earned = createBattle('skirmish', 'SHAPE1', { cards: [...STARTING_DECK], units: { B: { talents: ['marksman'] } } });
    if (!earned.ok) throw new Error('create');
    expect(abilitiesOf(earned.state, 'B')).toEqual([MARKSMAN]);
  });

  it('refuses a loadout giving a talent to the wrong unit, or one that does not exist', () => {
    expect(createBattle('skirmish', 'S', { cards: [...STARTING_DECK], units: { A: { talents: ['marksman'] } } }).ok).toBe(false);
    expect(createBattle('skirmish', 'S', { cards: [...STARTING_DECK], units: { B: { talents: ['nope'] } } }).ok).toBe(false);
  });

  it("offers the Gunner's slot Marksman at every boss until taken, then the stat the node drew", () => {
    const run = createRun('BOSSES');
    const bosses = run.nodes.filter((n): n is FightNode => n.kind === 'fight' && n.boosts.length > 0);
    expect(bosses.length).toBeGreaterThan(1);
    for (const boss of bosses) {
      const offers = offersFor(run, boss);
      expect(offers.map((o) => o.unit)).toEqual(['A', 'B', 'C']);
      expect(offers[1]).toEqual({ unit: 'B', kind: 'talent', talent: 'marksman' });
      // A and C have no talent yet: their slots are the drawn stats.
      expect([offers[0], offers[2]]).toEqual([boss.boosts[0], boss.boosts[2]]);
    }
    const taken: CardRunState = { ...run, boosts: { ...run.boosts, B: { talents: ['marksman'] } } };
    for (const boss of bosses) expect(offersFor(taken, boss)).toEqual(boss.boosts);
  });
});
