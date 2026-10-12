/**
 * Card run shapes, checkpoint 2 (`docs/spec/gymrun-card-run-shapes-prompt.md`):
 * the basic starting deck, the Gunner's Pierce taken off the unit and given
 * back as a talent, and a card reward that replaces a card. The author's
 * rule for the checkpoint: everything taken away is given back in an upgrade.
 */
import { describe, expect, it } from 'vitest';

import { CARDS, DECKS, UPGRADE_OF } from '../src/cardData/cards';
import { MARKET, RUN_RULES, STARTING_DECK, TOWN_POOL } from '../src/cardData/cardrunTables';
import { TALENTS, UNIT_TALENTS } from '../src/cardData/talents';
import { UNITS } from '../src/cardData/units';
import { createRun, offersFor, type CardRunState, type FightNode } from '../src/core/cards/cardrun';
import { createBattle, layoutBattle } from '../src/core/cards/create';
import type { BattleEvent } from '../src/core/cards/events';
import { completeChoices } from '../src/core/cards/legal';
import { abilitiesOf } from '../src/core/cards/plan';
import type { BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { at, iidOf } from './fixtures/card-battle';

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

  it('offers Marksman first at every boss until taken, then the talents the boss drew, then a stat', () => {
    const run = createRun('BOSSES');
    const bosses = run.nodes.filter((n): n is FightNode => n.kind === 'fight' && n.boosts.length > 0);
    expect(bosses.length).toBeGreaterThan(1);
    for (const boss of bosses) {
      expect([...boss.talentOrder].sort()).toEqual(Object.keys(TALENTS).sort());
      const offers = offersFor(run, boss);
      expect(offers).toHaveLength(3);
      expect(offers[0]).toEqual({ unit: 'B', kind: 'talent', talent: 'marksman' });
      const second = boss.talentOrder.find((t) => t !== 'marksman')!;
      expect(offers[1]).toEqual({ unit: TALENTS[second]!.unit, kind: 'talent', talent: second });
      // The stat is the node's own draw, for a unit neither talent is for when there is one.
      expect(boss.boosts).toContainEqual(offers[2]);
      if (TALENTS[second]!.unit !== 'B') expect(['A', 'C'].filter((u) => u !== TALENTS[second]!.unit)).toContain(offers[2]!.unit);
    }
    const taken: CardRunState = { ...run, boosts: { ...run.boosts, B: { talents: ['marksman'] } } };
    for (const boss of bosses) {
      const offers = offersFor(taken, boss);
      expect(offers.slice(0, 2).map((o) => (o.kind === 'talent' ? o.talent : null))).toEqual(boss.talentOrder.filter((t) => t !== 'marksman').slice(0, 2));
    }
  });
});

describe('Group A (checkpoint 3): reward cards from the existing effects', () => {
  const GROUP_A = ['whirlwind', 'rally', 'mark-target', 'suppress', 'second-wind'];

  /** The `test` encounter on this deck, in plan: units on the danger zone's edge, every enemy one step past it. */
  function boardWith(card: string, mp: number): { state: BattleState; iid: string } {
    const state = layoutBattle('test', 'GROUPA', { cards: [card, ...STARTING_DECK] })!;
    const iid = iidOf(state, card);
    state.piles.draw = state.piles.draw.filter((c) => c !== iid);
    state.piles.hand.push(iid);
    state.mp = mp;
    state.units.forEach((u, i) => Object.assign(u, { pos: at((i + 1) as 1 | 2 | 3, 3) }));
    state.enemies.forEach((e, i) => Object.assign(e, { pos: at((i + 1) as 1 | 2 | 3, 4), baseShield: 0 }));
    return { state, iid };
  }

  /** Play the card with its first legal choice and commit the round. */
  function play(card: string): BattleEvent[] {
    const { state, iid } = boardWith(card, 5);
    const owner = CARDS[card]!.owner;
    const unit = owner === 'neutral' ? 'B' : owner;
    const choice = completeChoices(state, iid, unit)[0];
    const selected = step(state, { type: 'select', card: iid, unit, ...(choice ? { choice } : {}) });
    if (!selected.ok) throw new Error(`${card}: ${selected.reason}`);
    const committed = step(selected.state, { type: 'commit' });
    if (!committed.ok) throw new Error(`${card}: ${committed.reason}`);
    return committed.events;
  }

  it('offers each as a reward, each with an upgrade, and Flashbang at the market', () => {
    for (const id of GROUP_A) {
      expect(TOWN_POOL, id).toContain(id);
      expect(UPGRADE_OF[id], id).toBeDefined();
    }
    expect(MARKET['flashbang']).toBeDefined();
    expect(CARDS['flashbang']).toMatchObject({ equipment: true, uses: 1, owner: 'neutral' });
    expect(CARDS['whirlwind']).toMatchObject({ owner: 'C', ult: true });
  });

  it('resolves every effect each one names', () => {
    const kinds = (events: BattleEvent[]) => events.map((e) => e.t);
    // Whirlwind and Rally move first: `test/cards-move-follow-ups.test.ts` (4b).
    expect(kinds(play('mark-target'))).toContain('damaged');
    const suppress = play('suppress');
    expect(kinds(suppress)).toContain('damaged');
    expect(suppress).toContainEqual({ t: 'shielded', unit: 'B', amount: 1 });
    const second = play('second-wind');
    expect(kinds(second)).toEqual(expect.arrayContaining(['drawQueued', 'mpQueued']));
    const flash = play('flashbang');
    expect(kinds(flash)).toEqual(expect.arrayContaining(['damaged', 'drawQueued', 'usedUp']));
  });
});
