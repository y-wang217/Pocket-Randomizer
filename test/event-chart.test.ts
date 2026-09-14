/**
 * Event rejig step 6: the twenty-four events, as a table.
 *
 * Properties of the *chart* rather than of a generated instance. Three of them
 * are the patch's own shape — three per locale, eight locales, and the relic
 * coverage that corrects the common-type skew — and one is the condition the
 * archetype-as-log-identity ruling attached to itself: no event may carry two
 * options of the same archetype, or the tag stops naming a unique button.
 */
import { describe, expect, it } from 'vitest';

import { EVENTS, eventsInLocale } from '../src/data/events';
import { EVENT_ARCHETYPES } from '../src/data/eventPools';
import { LOCALES } from '../src/data/locales';
import { CAPABILITIES } from '../src/data/capabilities';
import { relicsGranting } from '../src/data/relics';

describe('the chart', () => {
  it('holds twenty-four events, three in every locale', () => {
    expect(EVENTS).toHaveLength(24);
    for (const locale of LOCALES.map((entry) => entry.id)) {
      expect(eventsInLocale(locale).length, locale).toBe(3);
    }
  });

  it('gives every event a unique id', () => {
    const ids = EVENTS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every capability, so no relic is dead weight', () => {
    const named = new Set(EVENTS.map((event) => event.requires));
    for (const capability of CAPABILITIES) {
      expect(named.has(capability), `${capability} is on no event`).toBe(true);
    }
  });

  it('weights relic coverage toward Strength and away from Surf, deliberately', () => {
    /*
     * `surf`, `waterfall` and `dive` are all keyed to Water alone, so a party
     * with any Water type sits at `latent` for three of the eight gates. The
     * correction lives here — in how many events name each capability — rather
     * than in `data/capabilities.ts`, because narrowing those type sets would
     * make that table say something false about the games to fix this one's
     * problem.
     */
    const counts = new Map<string, number>();
    for (const event of EVENTS) counts.set(event.requires, (counts.get(event.requires) ?? 0) + 1);
    expect(counts.get('strength')).toBe(4);
    expect(counts.get('surf')).toBe(2);
    for (const capability of ['cut', 'rockSmash', 'fly', 'waterfall', 'dive', 'flash'] as const) {
      expect(counts.get(capability), capability).toBe(3);
    }
    expect([...counts.values()].reduce((sum, n) => sum + n, 0)).toBe(24);
  });

  it('names a capability some relic grants, so every Attune is reachable', () => {
    for (const event of EVENTS) {
      expect(relicsGranting(event.requires).length, event.id).toBeGreaterThan(0);
    }
  });

  /*
   * **The condition the archetype ruling attached to itself.** The tag is the
   * log's answer, so it has to name exactly one button within its event. It is
   * structurally true — options are built by mapping `EVENT_ARCHETYPES` — and
   * asserted here because the day someone hand-writes a second Gamble onto one
   * event is the day a log stops being replayable.
   */
  it('supplies exactly one label and one hint per archetype, and no duplicates', () => {
    for (const event of EVENTS) {
      const labels = EVENT_ARCHETYPES.map((archetype) => event.labels[archetype]);
      const hints = EVENT_ARCHETYPES.map((archetype) => event.hints[archetype]);
      expect(Object.keys(event.labels).sort(), event.id).toEqual([...EVENT_ARCHETYPES].sort());
      expect(Object.keys(event.hints).sort(), event.id).toEqual([...EVENT_ARCHETYPES].sort());
      expect(new Set(labels).size, `${event.id} repeats a label`).toBe(labels.length);
      expect(new Set(hints).size, `${event.id} repeats a hint`).toBe(hints.length);
    }
  });

  it('carries no rarity, because rarity scales the payout and names nothing', () => {
    for (const event of EVENTS) {
      expect(event, event.id).not.toHaveProperty('rarity');
    }
  });

  it('spreads toll shapes rather than charging one way twenty-four times', () => {
    const kinds = new Map<string, number>();
    for (const event of EVENTS) kinds.set(event.toll.kind, (kinds.get(event.toll.kind) ?? 0) + 1);
    expect(kinds.size, 'every toll is the same shape').toBeGreaterThan(3);
    for (const [kind, count] of kinds) {
      expect(count, `${kind} is ${count} of 24`).toBeLessThan(13);
    }
  });
});
