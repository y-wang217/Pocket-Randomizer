/**
 * The event screen says which capability, which standing, and what it bought.
 * **Patch 4.8.0.2.**
 *
 * @vitest-environment jsdom
 *
 * The first test of this screen. Until this patch it rendered the authored
 * hint at every band and one outcome label, so a "Requires Surf" node paid
 * out without ever mentioning Surf. Three things are held here, at each of
 * the three bands: the gate marks match the map's, the hint is the option's
 * own, and the reveal states the price and the payout — and the second click,
 * not the first, is what resolves the choice.
 *
 * **Rewritten against M5.6's encodings, not relaxed to fit them.** The gate
 * was two chips of words and the reward range was `Reward: T0 to T2`; both are
 * marks now, so every assertion that read their text reads their structure
 * instead and additionally asserts the text is gone. How many words the copy
 * may spend is `test/event-budget.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveCapability, type CapabilityBand } from '../src/core/capabilities';
import { generateEvent, concreteOutcome, describeOutcome, describeToll, outcomeFor,
  presentedOptions,
  EventPicker, type EventInstance } from '../src/core/events';
import { createPartyMember } from '../src/core/party';
import { createRng } from '../src/core/rng';
import { createRun, type RunState } from '../src/core/run';
import { eventHint, eventHook } from '../src/data/eventCopy';
import { capabilityTypes, type Capability } from '../src/data/capabilities';
import { BAND_LABELS, CAPABILITY_LABELS, TOLL_PAID_PREFIX } from '../src/data/eventCopy';
import { EVENTS } from '../src/data/events';
import { LOCALES } from '../src/data/locales';
import { relicsGranting } from '../src/data/relics';
import { SPECIES_POOL } from '../src/data/speciesPools';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createEventScreen } from '../src/ui/screens/event';
import { rewardTierPips } from '../src/ui/chip';

const BANDS: readonly CapabilityBand[] = ['none', 'latent', 'known'];

/** The first pool species whose type satisfies `capability` at `latent`, so the fixture tracks the data. */
function latentSpecies(capability: Capability): string {
  const types = capabilityTypes(capability);
  const entry = SPECIES_POOL.find((row) => row.types.some((type) => types.includes(type)));
  if (!entry) throw new Error(`no pool species answers ${capability}`);
  return entry.species;
}

function stateAt(band: CapabilityBand, capability: Capability): RunState {
  const base = createRun('EVT-SCREEN', DEFAULT_TUNING);
  const member = createPartyMember({ species: latentSpecies(capability), ability: 'Levitate', moves: ['Tackle'], level: 30 });
  const state: RunState =
    band === 'known'
      ? { ...base, party: [], relics: [relicsGranting(capability)[0]!.id] }
      : band === 'latent'
        ? { ...base, party: [member], relics: [] }
        : { ...base, party: [], relics: [] };
  // The fixture cannot drift from the band it claims.
  expect(resolveCapability(state, capability)).toBe(band);
  return state;
}

/** One generated instance of every event, found by walking seeds. */
function everyEvent(): EventInstance[] {
  const found = new Map<string, EventInstance>();
  for (const locale of LOCALES.map((entry) => entry.id)) {
    for (let i = 0; i < 60; i++) {
      const event = generateEvent(
        'n1',
        locale,
        i % 8,
        createRng(`EVT-${locale}-${i}`).rewards.at('e'),
        DEFAULT_TUNING,
        new EventPicker(),
      );
      if (event && !found.has(event.eventId)) found.set(event.eventId, event);
    }
  }
  expect([...found.keys()].sort()).toEqual(EVENTS.map((event) => event.id).sort());
  return [...found.values()];
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('the event screen', () => {
  for (const band of BANDS) {
    it(`at ${band}: shows the gate, the option's hint, and what the pick paid`, () => {
      for (const event of everyEvent()) {
        // The presented list: Attune is on it at `known` and off it below.
        for (const [index, choice] of presentedOptions(event, band).entries()) {
          const screen = createEventScreen();
          const state = stateAt(band, event.requires);
          const done: string[] = [];
          screen.render(event, state, (picked) => done.push(picked));
          document.body.append(screen.root);

          /*
           * **The gate is the map node's pair of marks, not two chips of
           * words. M5.6.** It used to read `Requires Strength` and `neither`;
           * section 3 gives this attribute one encoding and M5.2 built it, so
           * the screen mounts it. Asserted as the map card's test asserts it —
           * the glyph names the capability, the chevron fills to the band —
           * and asserted to carry no text, because the words leaving is the
           * budget this milestone is spending.
           */
          const gate = screen.root.querySelector('.event__gate');
          const need = gate?.querySelector('.node__gate-need');
          expect(need?.querySelector(`[data-glyph="capability-${event.requires}"]`), event.eventId).toBeTruthy();
          expect(need?.getAttribute('aria-label'), event.eventId).toBe(CAPABILITY_LABELS[event.requires]);
          expect(need?.textContent?.trim(), `${event.eventId} gate words`).toBe('');
          const chevron = gate?.querySelector('.node__gate-band');
          expect(chevron?.querySelectorAll('[data-glyph="capability-band-on"]').length, event.eventId).toBe(
            BANDS.indexOf(band),
          );
          expect(chevron?.getAttribute('aria-label'), event.eventId).toBe(BAND_LABELS[band]);
          expect(chevron?.textContent?.trim(), `${event.eventId} band words`).toBe('');
          /*
           * Who answers, at `latent` only. **Idle-sprites patch.** The fixture's
           * one member is the type, so one figure with its species; at `known`
           * the relic is the answer and at `none` there is nobody, so none.
           */
          const holders = [...(gate?.querySelectorAll('.figure-row .figure img.sprite') ?? [])].map((img) => img.getAttribute('alt'));
          expect(holders, `${event.eventId} ${band} holders`).toEqual(band === 'latent' ? [state.party[0]!.spec.species] : []);

          const hints = [...screen.root.querySelectorAll('.event__choice-hint')].map((node) => node.textContent);
          /*
           * The option's own hint, at every band. The per-band hint table went
           * with the 4.6c model the rejig replaced; the archetype copy that
           * replaces it is step 8's.
           */
          expect(hints, `${event.eventId} ${band}`).toHaveLength(band === 'known' ? 4 : 3);
          // The hint left `EventOption` at M5.6's split (D14); the screen
          // resolves it from the event id and the archetype, and this asserts
          // the screen renders what that lookup returns.
          expect(hints[index], `${event.eventId} ${band} hint ${index}`).toBe(eventHint(event.eventId, choice.archetype));

          const result = screen.root.querySelector<HTMLElement>('.event__result');
          expect(result?.hidden).toBe(true);
          const buttons = [...screen.root.querySelectorAll<HTMLButtonElement>('.event__choice')];
          buttons[index]?.click();

          expect(done, 'the pick alone must not resolve the choice').toEqual([]);
          expect(result?.hidden).toBe(false);
          for (const [i, button] of buttons.entries()) {
            expect(button.disabled).toBe(true);
            expect(button.classList.contains('event__choice--taken')).toBe(i === index);
          }

          /*
           * The **concrete** outcome, because the screen resolves a relic
           * grant against the held set before it describes it. A test reading
           * the drawn outcome would pass while the screen said "A relic" and
           * the run handed over a named one.
           */
          const paid = concreteOutcome(outcomeFor(choice, band), state.relics);
          const outcomes = [...screen.root.querySelectorAll('.event__outcome')].map((n) => n.textContent);
          /*
           * The payout is always last. Above it, in the order the run applies
           * them: the Toll's price when this button has one, then a `T0`'s
           * cost. A `T0` shown without its consolation reads as the game
           * taking something and giving nothing, and a Toll shown without its
           * price reads as a charge that never happened — which is the
           * playtest report `TOLL_PAID_PREFIX` was added for.
           */
          expect(outcomes[outcomes.length - 1]).toBe(describeOutcome(paid));
          expect(outcomes, `${event.eventId} ${band} ${index}`).toHaveLength(
            1 + (choice.toll ? 1 : 0) + (paid.cost.length > 0 ? 1 : 0),
          );
          if (choice.toll) {
            expect(outcomes[0], `${event.eventId} ${band} ${index} price`).toBe(
              `${TOLL_PAID_PREFIX}: ${describeToll(choice.toll)}`,
            );
          }

          screen.root.querySelector<HTMLButtonElement>('.primary-action')?.click();
          // The archetype names the button whatever the presented list is.
          expect(done).toEqual([choice.archetype]);
          document.body.replaceChildren();
        }
      }
    });
  }

  it('leaves the run state alone', () => {
    const event = everyEvent()[0]!;
    const state = stateAt('latent', event.requires);
    const before = JSON.stringify(state);
    const screen = createEventScreen();
    screen.render(event, state, () => undefined);
    screen.root.querySelector<HTMLButtonElement>('.event__choice')?.click();
    screen.root.querySelector<HTMLButtonElement>('.primary-action')?.click();
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('the attribute row', () => {
  /*
   * **Part 4's editorial carve-out, asserted.** Tier labels are ordinal and
   * Part 4 bans ordering that implies ranking; they are allowed here on the
   * `BAND n` precedent because the label names which pool the outcome draws
   * from, which is an attribute. What must stay true is that nothing *else*
   * moved — no recommendation, no highlight on the better option, no expected
   * value, and no marker on Attune beyond the relic requirement.
   */
  it('shows a reward range on every option, and a price on the Toll alone', () => {
    for (const event of everyEvent().slice(0, 4)) {
      for (const band of BANDS) {
        const screen = createEventScreen();
        screen.render(event, stateAt(band, event.requires), () => undefined);
        document.body.append(screen.root);

        const rows = [...screen.root.querySelectorAll('.event__choice-attributes')];
        const shown = presentedOptions(event, band);
        expect(rows, `${event.eventId} ${band}`).toHaveLength(shown.length);

        for (const [index, option] of shown.entries()) {
          const row = rows[index]!;
          const text = row.textContent ?? '';
          // The range is a span of pips since M5.6, so the row carries the
          // Toll's price and nothing else in words.
          expect(row.querySelector('.reward-tier-pips'), `${event.eventId} ${option.archetype}`).toBeTruthy();
          if (option.archetype === 'toll') expect(text).toMatch(/^Costs /);
          else expect(text.trim(), option.archetype).toBe('');
        }
        document.body.replaceChildren();
      }
    }
  });

  it('names the ranges the archetypes actually pay, off the table rather than beside it', () => {
    /*
     * **Attune reads `T2 to T3` at every rarity now, and it did not always.**
     *
     * Part 3 gave `T1` a weight of 10 at common and 5 at uncommon while Part 8
     * said the label reads `T2 to T3`. Because `rewardOf` derives the range
     * from the weights rather than restating them, the screen said `T1 to T3`
     * and the contradiction surfaced here rather than staying hidden. The
     * ruling raised the floor — an Attune paying `T1` is the one outcome the
     * relic gate exists to prevent — so the label and the table now agree
     * without either being made to lie.
     */
    for (const event of everyEvent().slice(0, 6)) {
      const screen = createEventScreen();
      screen.render(event, stateAt('known', event.requires), () => undefined);
      const spans = [...screen.root.querySelectorAll('.event__choice-attributes .reward-tier-pips')].map(
        (node) => node.getAttribute('data-tip') ?? '',
      );
      expect(spans[0], 'safe').toBe('reward-tier:T1-T1');
      expect(spans[1], 'gamble').toBe('reward-tier:T0-T2');
      expect(spans[2], 'toll').toBe('reward-tier:T2-T2');
      expect(spans[3], `attune at ${event.rarity}`).toBe('reward-tier:T2-T3');
      document.body.replaceChildren();
    }
  });

  /**
   * A span, not a prefix. **M5.6, and the reason the meter is its own strip.**
   *
   * `tierPips` fills a node's ladder from the bottom because a tier is a
   * position. A reward range is a *range*: Gamble reaches `T0` to `T2` and
   * Attune `T2` to `T3`, and a meter filled from the bottom would draw those
   * two as overlapping everywhere. This asserts the low end is dark when it is
   * outside the span, which is the whole of the difference.
   */
  it('draws the reward range as a span rather than a fill from the bottom', () => {
    const on = (node: HTMLElement) => [...node.querySelectorAll('.reward-tier-pips__pip')].map((pip) => pip.getAttribute('data-on') === 'true');
    expect(on(rewardTierPips('T0', 'T2', 'Reward T0 to T2'))).toEqual([true, true, true, false]);
    expect(on(rewardTierPips('T2', 'T3', 'Reward T2 to T3'))).toEqual([false, false, true, true]);
    expect(on(rewardTierPips('T1', 'T1', 'Reward T1'))).toEqual([false, true, false, false]);
  });

  /**
   * **The screen has no heading, since M5.6.** `Something happens` sat above a
   * hook that says what happens; the phrase stays on the map node card, which
   * is where a player reads it before arriving. Asserted rather than left to
   * the census, which reads one event on one fixture.
   */
  it('writes no heading above the hook', () => {
    const event = everyEvent()[0]!;
    const screen = createEventScreen();
    screen.render(event, stateAt('known', event.requires), () => undefined);
    expect(screen.root.querySelector('.screen__title')).toBeNull();
    expect(screen.root.querySelector('h1, h2, h3')).toBeNull();
    expect(screen.root.querySelector('.event__prompt')?.textContent).toBe(eventHook(event.eventId));
  });

  it('ranks nothing: no option is highlighted, ordered or marked before the pick', () => {
    const event = everyEvent()[0]!;
    const screen = createEventScreen();
    screen.render(event, stateAt('known', event.requires), () => undefined);
    const buttons = [...screen.root.querySelectorAll('.event__choice')];
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      // The taken marker is post-resolution only. Nothing carries it yet.
      expect(button.classList.contains('event__choice--taken')).toBe(false);
      expect(button.className, button.textContent ?? '').not.toMatch(/recommend|best|primary/i);
    }
    // No expected value anywhere on the screen.
    expect(screen.root.textContent ?? '').not.toMatch(/expected|average|EV\b/i);
  });
});
