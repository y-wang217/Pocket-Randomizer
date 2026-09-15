/**
 * A relic changes the run. **The fifth instance of one defect shape, and the
 * suite that exists so there is not a sixth.**
 *
 * `core/relics.ts` folds the held set into a `RelicEffects` — a per-node heal,
 * per-node currency, a backpack slot, a revive bonus, a shop discount — and
 * until this patch **`applyRelicPassives` had no caller anywhere in `src/`**.
 * It was imported by two test files and by nothing else, so every passive in
 * `data/relics.ts` was inert. Two of them say what they do in their own
 * player-facing description:
 *
 *   Tidecaller Shell: "The sound inside it mends a little at every stop."
 *   Everburning Lantern: "The party rests easier near it."
 *
 * Both were on screen, for the rest of a run, describing nothing.
 *
 * `core/capabilities.ts` imports `grantsCapability` from the same module, which
 * is why the file read as live to anything that only looked at its importers.
 * `docs/generation.md` sections 14 to 16 carry the other four instances.
 *
 * ## The assertions are per passive kind, and driven off the table
 *
 * Every relic in `data/relics.ts` is walked, and the one with a `nodeHeal` is
 * asserted to heal rather than a named id being asserted to heal. A relic
 * renamed or retuned keeps this honest; a relic whose passive is quietly
 * dropped from the fold fails here.
 */
import { describe, expect, it } from 'vitest';

import { createPartyMember } from '../src/core/party';
import { backpackCapacity } from '../src/core/items';
import { generateShopStock, nodePayout, resolveStock } from '../src/core/economy';
import { applyRelicPassives, NO_RELIC_EFFECTS } from '../src/core/relics';
import { createRng } from '../src/core/rng';
import { createRun, partyCapacity, resolveNode, type NodeResult, type RunState } from '../src/core/run';
import { RELICS, type Relic, type RelicId } from '../src/data/relics';
import { DEFAULT_TUNING } from '../src/data/tuning';

/** A run at half HP with a purse, holding exactly `relics`. */
function runWith(relics: RelicId[]): RunState {
  const run = createRun('RELIC-PASSIVES', DEFAULT_TUNING);
  const lead = createPartyMember({ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 30 });
  return {
    ...run,
    relics,
    currency: 500,
    backpack: [],
    party: [{ ...lead, hp: Math.round(lead.maxHp / 2) }],
  };
}

const hp = (state: RunState): number => state.party.reduce((total, member) => total + member.hp, 0);

/** Walk one ordinary node, won, and fold it in. */
function walk(state: RunState): RunState {
  const node = { ...state.segments[0]!.gym, kind: 'trainer' as const, event: null };
  return resolveNode(state, { node } as NodeResult);
}

/** One down, one standing: a wholly fainted party is a wipe and never reaches the boundary. */
function withCasualty(state: RunState): RunState {
  return {
    ...state,
    party: [
      { ...state.party[0]!, fainted: true, hp: 0 },
      createPartyMember({ species: 'Pidgeot', ability: 'Keen Eye', moves: ['Tackle'], level: 30 }),
    ],
  };
}

const withPassive = (kind: Relic['passive']['kind']): Relic[] =>
  RELICS.filter((relic) => relic.passive.kind === kind);

describe('the relic fold reaches the run', () => {
  it('is exercised by the table, so no passive kind goes untested', () => {
    // A test that walks an empty list passes forever. Every kind the table
    // actually uses must be covered by a case below.
    const kinds = new Set(RELICS.map((relic) => relic.passive.kind));
    kinds.delete('none');
    expect([...kinds].sort()).toEqual(
      ['backpackSlots', 'nodeCurrency', 'nodeHeal', 'reviveBonus', 'shopDiscount'].sort(),
    );
  });

  it('heals a share of max HP at every node boundary', () => {
    for (const relic of withPassive('nodeHeal')) {
      const without = hp(walk(runWith([])));
      const with_ = hp(walk(runWith([relic.id])));
      expect(with_, `${relic.name} mends nothing`).toBeGreaterThan(without);
    }
  });

  it('pays extra for a cleared battle node, and nothing for a node that is not one', () => {
    for (const relic of withPassive('nodeCurrency')) {
      const effects = applyRelicPassives([relic.id]);
      const state = runWith([]);
      const fight = { ...state.segments[0]!.gym, kind: 'trainer' as const };
      const rest = { ...state.segments[0]!.gym, kind: 'rest' as const };
      expect(nodePayout(fight, 0, effects), relic.name).toBeGreaterThan(nodePayout(fight, 0));
      // The passive is per *battle* node. A rest still pays nothing.
      expect(nodePayout(rest, 0, effects), relic.name).toBe(0);
    }
  });

  it('adds a backpack slot on top of the party-derived capacity', () => {
    for (const relic of withPassive('backpackSlots')) {
      const state = runWith([relic.id]);
      const without = backpackCapacity(partyCapacity(state), DEFAULT_TUNING);
      const with_ = backpackCapacity(partyCapacity(state), DEFAULT_TUNING, applyRelicPassives([relic.id]));
      expect(with_, relic.name).toBeGreaterThan(without);
    }
  });

  it('revives a fainted member higher', () => {
    for (const relic of withPassive('reviveBonus')) {
      const without = hp(walk(withCasualty(runWith([]))));
      const with_ = hp(walk(withCasualty(runWith([relic.id]))));
      expect(with_, relic.name).toBeGreaterThan(without);
    }
  });

  it('takes a share off every shelf price, and the same share at the till', () => {
    const stock = generateShopStock('n1', 3, createRng('RELIC-SHOP').rewards.at('s'), DEFAULT_TUNING);
    for (const relic of withPassive('shopDiscount')) {
      const full = resolveStock(stock, []);
      const cut = resolveStock(stock, [relic.id]);
      expect(cut.items.length).toBe(full.items.length);
      for (const [at, item] of cut.items.entries()) {
        expect(item.price, `${relic.name} slot ${at}`).toBeLessThan(full.items[at]!.price);
      }
      /*
       * Idempotent, because `playRun` resolves a shop twice — once to ask what
       * to buy and once to apply it. A discount applied at both sites would
       * charge less than the screen said, which is the same class of bug as
       * charging more.
       */
      expect(resolveStock(cut, [relic.id]).items.map((item) => item.price)).toEqual(
        cut.items.map((item) => item.price),
      );
    }
  });

  it('changes nothing at all for a run holding none', () => {
    expect(applyRelicPassives([])).toEqual(NO_RELIC_EFFECTS);
    const state = runWith([]);
    expect(hp(walk(state))).toBe(hp(walk(runWith([]))));
  });
});
