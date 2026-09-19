/**
 * A stated price is charged, or the option is not offered. **2026-09-19.**
 *
 * @vitest-environment jsdom
 *
 * The playtest: a Toll priced in berries, pressed by a run whose bag held no
 * berry, took nothing and paid its guaranteed `T2` in full. Three of the five
 * `TollPrice` kinds had the same hole — `loseItem` no-ops on a bag that cannot
 * answer it, `currency` clamps at zero, and an HP hit against a party already
 * at `tuning.eventDamageFloor` removes nothing — so the button was a free `T2`
 * with a cost written on it.
 *
 * What is held here is the rule rather than the berry:
 *
 *   1. A price the run cannot pay leaves the option **on the menu, dimmed**.
 *      Not removed: a player who can see the price they are short of can go
 *      and get a berry, and a player shown three buttons where there were four
 *      learns nothing.
 *   2. `playRun` refuses the archetype anyway, because a log can reach a
 *      button a screen cannot.
 *   3. The item the screen names is the item the fold takes. One walk.
 *   4. A **drawn** cost is not a price and is not gated, because gating it
 *      would reveal the outcome before the press.
 */
import { describe, expect, it } from 'vitest';

import {
  applyEventOutcome,
  applyToll,
  describePrice,
  describeToll,
  forfeits,
  optionPayable,
  presentedOptions,
  pricePayable,
  type EventInstance,
  type EventOption,
  type EventOutcome,
} from '../src/core/events';
import { createRun, type RunState } from '../src/core/run';
import { createPartyMember } from '../src/core/party';
import type { EventArchetype } from '../src/data/eventPools';
import type { TollPrice } from '../src/data/events';
import { EVENTS } from '../src/data/events';
import { BERRIES, itemById } from '../src/data/items';
import { PRICE_UNPAYABLE } from '../src/data/eventCopy';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createEventScreen } from '../src/ui/screens/event';

/** Every price kind the table actually charges, one live example of each. */
const PRICES: readonly TollPrice[] = [
  { kind: 'berry' },
  { kind: 'discard', count: 1 },
  { kind: 'gold', fraction: 0.4, floor: 30 },
  { kind: 'goldFixed', amount: 45 },
  { kind: 'hp', percent: 0.25, target: 'party' },
  { kind: 'hp', percent: 0.2, target: 'lead' },
];

function solvent(): RunState {
  const base = createRun('PRICE', DEFAULT_TUNING);
  return {
    ...base,
    currency: 200,
    backpack: ['oranberry', 'leftovers'],
    relics: [],
    party: [createPartyMember({ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 30 })],
  };
}

/** Nothing to take: no bag, no coins, and a party already at the damage floor. */
function destitute(): RunState {
  const state = solvent();
  return {
    ...state,
    currency: 0,
    backpack: [],
    party: state.party.map((member) => ({
      ...member,
      hp: Math.max(1, Math.round(member.maxHp * DEFAULT_TUNING.eventDamageFloor)),
    })),
  };
}

function outcomeOf(cost: EventOutcome['cost'] = []): EventOutcome {
  return { tier: 'T2', entryId: 'test', cost, grant: [{ kind: 'currency', amount: 40 }] };
}

function option(archetype: EventArchetype, toll: TollPrice | null): EventOption {
  const paid = outcomeOf();
  return {
    archetype,
    label: archetype,
    hint: archetype,
    toll,
    outcomes: { T0: paid, T1: paid, T2: paid, T3: paid },
    tierAt: { none: 'T2', latent: 'T2', known: 'T2' },
  };
}

function eventWith(toll: TollPrice): EventInstance {
  return {
    nodeId: 'n1',
    eventId: 'priced',
    locale: 'forest',
    rarity: 'common',
    prompt: 'p',
    requires: 'cut',
    options: [option('safe', null), option('gamble', null), option('toll', toll), option('attune', null)],
  };
}

describe('a price is payable exactly when charging it takes something', () => {
  it('says yes on a run that can pay, for every kind the table charges', () => {
    for (const toll of PRICES) {
      expect(pricePayable(solvent(), toll), describeToll(toll)).toBe(true);
    }
  });

  it('says no on a run that cannot, for every kind the table charges', () => {
    for (const toll of PRICES) {
      expect(pricePayable(destitute(), toll), describeToll(toll)).toBe(false);
    }
  });

  /**
   * The property the gate exists for, asserted as a property rather than per
   * kind: **a price that is refused is a price that would have changed
   * nothing**, and one that is allowed changes the run. It is checked by
   * charging it, which is also how `pricePayable` answers — so what this
   * really pins is that no third opinion about a price can exist.
   */
  it('agrees with the fold on every kind, on both runs', () => {
    for (const state of [solvent(), destitute()]) {
      for (const toll of PRICES) {
        const after = applyToll(state, toll, state.tuning);
        const moved =
          after.currency !== state.currency ||
          after.backpack.length !== state.backpack.length ||
          after.party.reduce((sum, m) => sum + m.hp, 0) !== state.party.reduce((sum, m) => sum + m.hp, 0);
        expect(pricePayable(state, toll), describeToll(toll)).toBe(moved);
      }
    }
  });

  it('leaves a free option payable, always', () => {
    for (const state of [solvent(), destitute()]) {
      for (const archetype of ['safe', 'gamble', 'attune'] as const) {
        expect(optionPayable(state, option(archetype, null))).toBe(true);
      }
    }
  });

  /** The reported case, stated as the reporter would: a berry, and no berry. */
  it('refuses a berry price against a bag holding every other kind of item', () => {
    const state = { ...solvent(), backpack: ['leftovers', 'lifeorb', 'tm-thunderbolt'] };
    expect(pricePayable(state, { kind: 'berry' })).toBe(false);
    for (const berry of BERRIES.slice(0, 4)) {
      expect(pricePayable({ ...state, backpack: [...state.backpack, berry.id] }, { kind: 'berry' })).toBe(true);
    }
  });
});

describe('the price names what it will take', () => {
  /**
   * **One walk.** The item the screen prints and the item the fold removes are
   * read from the same function, so this compares the name against the bag
   * before and after rather than against a second list written here.
   */
  it('names the berry the fold then removes', () => {
    const state = { ...solvent(), backpack: ['leftovers', 'sitrusberry', 'oranberry'] };
    expect(describePrice({ kind: 'berry' }, state.backpack)).toBe('Sitrus Berry');

    const after = applyToll(state, { kind: 'berry' }, state.tuning);
    const gone = state.backpack.filter((item, at) => after.backpack[at] !== item || after.backpack.length <= at);
    expect(itemById(gone[0]!)?.name).toBe('Sitrus Berry');
  });

  it('names the bag item a discard takes, which is the last one in', () => {
    const state = { ...solvent(), backpack: ['oranberry', 'leftovers'] };
    expect(describePrice({ kind: 'discard', count: 1 }, state.backpack)).toBe('Leftovers');
    expect(applyToll(state, { kind: 'discard', count: 1 }, state.tuning).backpack).toEqual(['oranberry']);
  });

  it('falls back to the generic wording when there is nothing to name', () => {
    for (const toll of PRICES) {
      expect(describePrice(toll, destitute().backpack), describeToll(toll)).toBe(describeToll(toll));
    }
  });

  it('leaves a priced kind that takes no bag item alone', () => {
    for (const toll of PRICES.filter((price) => price.kind !== 'berry' && price.kind !== 'discard')) {
      expect(describePrice(toll, solvent().backpack)).toBe(describeToll(toll));
    }
  });
});

describe('the screen dims what the run cannot pay', () => {
  it('keeps the option on the menu, disabled, and says why', () => {
    const event = eventWith({ kind: 'berry' });
    const screen = createEventScreen();
    const done: string[] = [];
    screen.render(event, destitute(), (picked) => done.push(picked));
    document.body.replaceChildren(screen.root);

    const buttons = [...screen.root.querySelectorAll<HTMLButtonElement>('.event__choice')];
    // Still three long at `none`: the Toll is dimmed, not withdrawn.
    expect(buttons).toHaveLength(presentedOptions(event, 'none').length);
    const toll = buttons[2]!;
    expect(toll.disabled).toBe(true);
    expect(toll.classList.contains('event__choice--unpayable')).toBe(true);
    expect(toll.textContent).toContain(PRICE_UNPAYABLE);

    toll.click();
    expect(done, 'a dimmed button resolves nothing').toEqual([]);
    expect(screen.root.querySelector<HTMLElement>('.event__result')?.hidden).toBe(true);

    // And the three it can pay are live.
    for (const button of [buttons[0]!, buttons[1]!]) expect(button.disabled).toBe(false);
  });

  it('enables it and names the berry once the bag can answer', () => {
    const event = eventWith({ kind: 'berry' });
    const state = { ...destitute(), backpack: ['lumberry'] };
    const screen = createEventScreen();
    screen.render(event, state, () => undefined);
    document.body.replaceChildren(screen.root);

    const toll = [...screen.root.querySelectorAll<HTMLButtonElement>('.event__choice')][2]!;
    expect(toll.disabled).toBe(false);
    expect(toll.classList.contains('event__choice--unpayable')).toBe(false);
    expect(toll.querySelector('.event__choice-attributes')?.textContent).toContain('Costs Lum Berry');
    expect(toll.textContent).not.toContain(PRICE_UNPAYABLE);

    // And the reveal restates it as taken, by name rather than by kind.
    toll.click();
    const lines = [...screen.root.querySelectorAll('.event__outcome')].map((node) => node.textContent);
    expect(lines[0]).toBe('Paid: Lum Berry');
  });

  it('never dims a free option', () => {
    const event = eventWith({ kind: 'berry' });
    const screen = createEventScreen();
    screen.render(event, destitute(), () => undefined);
    const dimmed = [...screen.root.querySelectorAll('.event__choice--unpayable')];
    expect(dimmed).toHaveLength(1);
  });
});

describe('a drawn cost is not a price', () => {
  /**
   * The line the patch must not cross. A `T0` consolation's `loseItem` is the
   * *result* of a Gamble, revealed after the press — refusing the button on it
   * would tell the player what they drew before they chose it, which is the
   * two-phase reveal the whole screen is built around.
   */
  it('leaves a Gamble live on a run that could not pay its drawn cost', () => {
    const drawn: EventOutcome = {
      tier: 'T0',
      entryId: 'test',
      cost: [{ kind: 'loseItem', pool: BERRIES.map((berry) => berry.id) }],
      grant: [{ kind: 'currency', amount: 5 }],
    };
    const gamble: EventOption = {
      ...option('gamble', null),
      outcomes: { T0: drawn, T1: drawn, T2: drawn, T3: drawn },
    };
    expect(optionPayable(destitute(), gamble)).toBe(true);

    const event: EventInstance = { ...eventWith({ kind: 'berry' }), options: [gamble] };
    const screen = createEventScreen();
    screen.render(event, destitute(), () => undefined);
    expect(screen.root.querySelector<HTMLButtonElement>('.event__choice')?.disabled).toBe(false);

    // And it still no-ops on the fold, which is the rule that has always held
    // for a drawn cost and is now the *only* place that no-op is reachable.
    const state = destitute();
    expect(applyEventOutcome(state, drawn, state.tuning).backpack).toEqual([]);
  });

  it('forfeits nothing for a kind that takes nothing out of the bag', () => {
    expect(forfeits({ kind: 'currency', amount: -10 }, ['oranberry'])).toEqual([]);
    expect(forfeits({ kind: 'damage', percent: 0.5, target: 'party' }, ['oranberry'])).toEqual([]);
  });
});

describe('the table the rule has to hold for', () => {
  /**
   * Every authored Toll, against a run that can pay nothing. **None of them may
   * be payable**, which is what stops a new price kind arriving in
   * `data/events.ts` with a hole in it: a price that is payable on a run with
   * no bag, no coins and no HP to give is a price that charges nothing.
   */
  it('finds no authored price that a destitute run can pay', () => {
    const broke = destitute();
    for (const event of EVENTS) {
      expect(pricePayable(broke, event.toll), `${event.id} ${describeToll(event.toll)}`).toBe(false);
    }
  });

  it('finds every authored price payable by a run that is not', () => {
    const rich = solvent();
    for (const event of EVENTS) {
      expect(pricePayable(rich, event.toll), `${event.id} ${describeToll(event.toll)}`).toBe(true);
    }
  });
});
