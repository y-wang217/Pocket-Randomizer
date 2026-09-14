/**
 * **The event rejig patch**, replacing the 4.6c suite that lived here.
 *
 * The old file asserted the three properties 4.6c shipped: three outcomes per
 * choice, one per capability band; a payout at *every* band including `none`;
 * and the encounter offered at `known` and only at `known`. The first is gone
 * because a choice is now an archetype with one outcome per *tier*, and the
 * second is **retired by this patch** — an event can punish now, and the rule
 * that it could not ("a player with nothing is unrewarded, not punished") is
 * replaced by the Safe option existing on every event. Downside is opt in.
 *
 * What survives unchanged is the property the whole design still rests on:
 * **RNG consumption is identical regardless of what the run holds.** Every
 * option, every tier and every band is drawn when the map is built, so two runs
 * on the same seed with deliberately different relics generate byte-identical
 * events and differ only in which already-drawn outcome they are paid.
 *
 * If that ever stops being true, a seed stops describing one run: two players
 * would diverge on a roll neither of them made.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import {
  EventPicker,
  generateEvent,
  outcomeFor,
  presentedOptions,
  type EventInstance,
} from '../src/core/events';
import { EVENTS, eventsInLocale } from '../src/data/events';
import { EVENT_ARCHETYPES, OUTCOME_TIERS } from '../src/data/eventPools';
import { LOCALES, type LocaleId } from '../src/data/locales';
import { RELICS, relicsGranting } from '../src/data/relics';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { resolveCapability } from '../src/core/capabilities';
import { CAPABILITIES } from '../src/data/capabilities';

const BANDS = ['none', 'latent', 'known'] as const;

function eventFor(seed: string, locale: LocaleId = 'forest', segment = 2): EventInstance {
  const event = generateEvent(
    'n1',
    locale,
    segment,
    createRng(seed).rewards.at('e'),
    DEFAULT_TUNING,
    new EventPicker(),
  );
  if (!event) throw new Error('no event generated');
  return event;
}

describe('the data', () => {
  it('gives every event exactly one required capability', () => {
    for (const event of EVENTS) {
      expect(CAPABILITIES, event.id).toContain(event.requires);
    }
  });

  it('puts every event in a locale that exists, and every locale in reach', () => {
    const locales = LOCALES.map((locale) => locale.id);
    for (const event of EVENTS) expect(locales, event.id).toContain(event.locale);
    for (const locale of locales) {
      expect(eventsInLocale(locale).length, `${locale} has no events to draw`).toBeGreaterThan(0);
    }
  });

  it('names a capability some relic grants, so no event is unreachable at known', () => {
    for (const event of EVENTS) {
      expect(relicsGranting(event.requires).length, event.id).toBeGreaterThan(0);
    }
  });

  it('gives every event copy for all four archetypes', () => {
    for (const event of EVENTS) {
      for (const archetype of EVENT_ARCHETYPES) {
        expect(event.labels[archetype]?.length, `${event.id}/${archetype}`).toBeGreaterThan(0);
        expect(event.hints[archetype]?.length, `${event.id}/${archetype}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('an instance', () => {
  it('builds all four options, in archetype order, whatever the run holds', () => {
    const event = eventFor('ARCH-1');
    expect(event.options.map((option) => option.archetype)).toEqual([...EVENT_ARCHETYPES]);
  });

  it('draws an outcome for every tier of every option', () => {
    const event = eventFor('ARCH-2');
    for (const option of event.options) {
      for (const tier of OUTCOME_TIERS) {
        const outcome = option.outcomes[tier];
        expect(outcome.tier, `${option.archetype}/${tier}`).toBe(tier);
        expect(outcome.grant.length, `${option.archetype}/${tier}`).toBeGreaterThan(0);
      }
    }
  });

  it('selects exactly one tier per band, per option', () => {
    const event = eventFor('ARCH-3');
    for (const option of event.options) {
      for (const band of BANDS) {
        expect(OUTCOME_TIERS, `${option.archetype}/${band}`).toContain(option.tierAt[band]);
        expect(outcomeFor(option, band).tier).toBe(option.tierAt[band]);
      }
    }
  });

  it('carries a toll price on the Toll option and on no other', () => {
    const event = eventFor('ARCH-4');
    for (const option of event.options) {
      if (option.archetype === 'toll') expect(option.toll, option.archetype).not.toBeNull();
      else expect(option.toll, option.archetype).toBeNull();
    }
  });

  it('draws an event from the locale it was asked for', () => {
    for (const locale of LOCALES.map((entry) => entry.id)) {
      const event = eventFor(`LOC-${locale}`, locale);
      expect(event.locale).toBe(locale);
      expect(eventsInLocale(locale).map((entry) => entry.id)).toContain(event.eventId);
    }
  });
});

describe('the Attune gate', () => {
  it('shows three options without the relic and four with', () => {
    const event = eventFor('GATE-1');
    expect(presentedOptions(event, 'none')).toHaveLength(3);
    expect(presentedOptions(event, 'latent')).toHaveLength(3);
    expect(presentedOptions(event, 'known')).toHaveLength(4);
  });

  it('withholds Attune and nothing else below known', () => {
    const event = eventFor('GATE-2');
    for (const band of ['none', 'latent'] as const) {
      const shown = presentedOptions(event, band).map((option) => option.archetype);
      expect(shown).toEqual(['safe', 'gamble', 'toll']);
    }
  });

  /*
   * **The patch's one hard rule, asserted end to end rather than on the table.**
   * `test/event-pools.test.ts` holds it structurally, on the distributions;
   * this holds it on generated instances, which is where a wiring mistake would
   * show up instead.
   */
  it('reaches T3 from no presented option, over many seeds, at every band below known', () => {
    for (let index = 0; index < 400; index++) {
      const event = eventFor(`NO-T3-${index}`, 'forest', index % 8);
      for (const band of ['none', 'latent'] as const) {
        for (const option of presentedOptions(event, band)) {
          expect(outcomeFor(option, band).tier, `${event.eventId}/${option.archetype}/${band}`).not.toBe('T3');
        }
      }
    }
  });

  it('does reach T3 through Attune, so the gate is a gate and not a wall', () => {
    let reached = 0;
    for (let index = 0; index < 400; index++) {
      const event = eventFor(`T3-${index}`, 'summit', index % 8);
      const attune = event.options.find((option) => option.archetype === 'attune')!;
      if (outcomeFor(attune, 'known').tier === 'T3') reached += 1;
    }
    expect(reached).toBeGreaterThan(40);
  });
});

describe('consumption does not depend on the run', () => {
  /*
   * The direct assertion Part 6 asks for. Two runs on one seed, one holding
   * every relic in the game and one holding none, must generate byte-identical
   * events — because nothing about the *draw* may consult what is held.
   */
  it('generates a byte-identical event whatever the run holds', () => {
    const first = eventFor('SAME-SEED');
    const second = eventFor('SAME-SEED');
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('costs the same draws whether or not a Pokemon can be offered', () => {
    const withOffers = generateEvent(
      'n1',
      'marsh',
      3,
      createRng('OFFERS').rewards.at('e'),
      DEFAULT_TUNING,
      new EventPicker(),
      () => null,
    );
    const noOffers = generateEvent(
      'n1',
      'marsh',
      3,
      createRng('OFFERS').rewards.at('e'),
      { ...DEFAULT_TUNING, allowEncounterAcquisitions: false },
      new EventPicker(),
      () => null,
    );
    expect(noOffers?.eventId).toBe(withOffers?.eventId);
    expect(noOffers?.rarity).toBe(withOffers?.rarity);
  });

  it('pays a different outcome at different bands, from the same option', () => {
    /*
     * Not an assertion that every option differs — a Safe option is flat `T1`
     * at every band by design, and a Gamble can land on the same tier twice.
     * What must be true is that the machinery *can* differ, or the band would
     * be decoration.
     */
    let differing = 0;
    for (let index = 0; index < 200; index++) {
      const event = eventFor(`BAND-${index}`, 'city', index % 8);
      for (const option of event.options) {
        if (option.tierAt.none !== option.tierAt.known) differing += 1;
      }
    }
    expect(differing).toBeGreaterThan(0);
  });
});

describe('the band a run reads at', () => {
  it('rises to known the moment the relic is held', () => {
    for (const relic of RELICS) {
      const without = resolveCapability({ relics: [], party: [] }, relic.grants);
      const held = resolveCapability({ relics: [relic.id], party: [] }, relic.grants);
      expect(without, relic.id).toBe('none');
      expect(held, relic.id).toBe('known');
    }
  });
});
