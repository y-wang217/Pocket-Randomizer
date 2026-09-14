/**
 * Event rejig step 3: what map generation draws for an event, and what it must
 * never depend on.
 *
 * Three properties, and the first is the one the seed promise rests on.
 *
 * 1. **RNG consumption per event node does not depend on the run.** Every
 *    option, every tier and every band is drawn when the map is built, so two
 *    runs on one seed holding deliberately different relics generate
 *    byte-identical events and differ only in which already-drawn outcome they
 *    are paid. Asserted directly, by draw count and by content.
 * 2. **Rarity matches the ramp.** It is a per-node draw that scales the payout
 *    distribution and names nothing — the decoupling ruled in
 *    `docs/generation.md` section 14 — so its distribution has to match
 *    `EVENT_RARITY_WEIGHTS` per segment band or the tuning table is a fiction.
 * 3. **An event is drawn from its node's locale, without replacement inside a
 *    segment.** Repeats across segments are accepted; a locale that runs out
 *    refills rather than failing.
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
import { generateSegment, nodesOf, type Segment } from '../src/core/encounters';
import { eventsInLocale } from '../src/data/events';
import { EVENT_RARITIES, OUTCOME_TIERS } from '../src/data/eventPools';
import { eventRarityWeights, SEGMENT_COUNT } from '../src/data/scaling';
import { LOCALES, type LocaleId } from '../src/data/locales';
import { DEFAULT_TUNING } from '../src/data/tuning';

const BANDS = ['none', 'latent', 'known'] as const;

function mapOf(seed: string): Segment[] {
  const rng = createRng(seed);
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => generateSegment(index, rng, DEFAULT_TUNING));
}

function eventsOf(segments: Segment[]): { segment: number; locale: LocaleId | null; event: EventInstance }[] {
  return segments.flatMap((segment) =>
    nodesOf(segment)
      .filter((node) => node.event)
      .map((node) => ({ segment: segment.index, locale: node.locale, event: node.event! })),
  );
}

describe('consumption does not depend on the run', () => {
  /*
   * The direct assertion. `generateEvent` takes no run, no party and no relics
   * — it cannot, by signature — so the strongest statement available is that
   * the draw count is fixed by the seed and the node, and that *reading* an
   * outcome at any band consumes nothing at all.
   */
  it('draws the same number of times whatever band is read afterwards', () => {
    const stream = createRng('DRAWS').rewards.at('e');
    const event = generateEvent('n1', 'ruins', 4, stream, DEFAULT_TUNING, new EventPicker())!;
    const afterGeneration = stream.draws;

    for (const band of BANDS) {
      for (const option of presentedOptions(event, band)) outcomeFor(option, band);
    }
    expect(stream.draws, 'reading an outcome must not draw').toBe(afterGeneration);
  });

  it('generates byte-identical events for one seed, over a whole map', () => {
    const first = JSON.stringify(eventsOf(mapOf('CONSUME')).map((entry) => entry.event));
    const second = JSON.stringify(eventsOf(mapOf('CONSUME')).map((entry) => entry.event));
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(1000);
  });

  it('costs the same draws at every segment, since the shape does not vary with the party', () => {
    /*
     * Two streams, one event each, at the same segment and locale from the same
     * seed. Equal draw counts is the property; equal content is the proof that
     * the counts are equal for the right reason.
     */
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const a = createRng(`COST-${segment}`).rewards.at('e');
      const b = createRng(`COST-${segment}`).rewards.at('e');
      const one = generateEvent('n1', 'cave', segment, a, DEFAULT_TUNING, new EventPicker());
      const two = generateEvent('n1', 'cave', segment, b, DEFAULT_TUNING, new EventPicker());
      expect(a.draws, `segment ${segment}`).toBe(b.draws);
      expect(JSON.stringify(two)).toBe(JSON.stringify(one));
    }
  });
});

describe('T3 never reaches a run without the relic', () => {
  it('holds across a whole map, at every band below known', () => {
    let checked = 0;
    for (const seed of ['T3-A', 'T3-B', 'T3-C', 'T3-D']) {
      for (const { event } of eventsOf(mapOf(seed))) {
        for (const band of ['none', 'latent'] as const) {
          for (const option of presentedOptions(event, band)) {
            expect(outcomeFor(option, band).tier, `${event.eventId}/${option.archetype}`).not.toBe('T3');
            checked += 1;
          }
        }
      }
    }
    expect(checked, 'no events generated, so the assertion proved nothing').toBeGreaterThan(200);
  });
});

describe('rarity', () => {
  it('matches the ramp within tolerance, per segment band, over many seeds', () => {
    const bands: { name: string; segments: number[] }[] = [
      { name: 'opening', segments: [0, 1, 2] },
      { name: 'middle', segments: [3, 4, 5] },
      { name: 'late', segments: [6, 7] },
    ];

    const counts = new Map<string, Map<string, number>>();
    for (let seed = 0; seed < 60; seed++) {
      for (const { segment, event } of eventsOf(mapOf(`RARITY-${seed}`))) {
        const band = bands.find((row) => row.segments.includes(segment))!.name;
        const row = counts.get(band) ?? new Map<string, number>();
        row.set(event.rarity, (row.get(event.rarity) ?? 0) + 1);
        counts.set(band, row);
      }
    }

    for (const { name, segments } of bands) {
      const row = counts.get(name)!;
      const total = [...row.values()].reduce((sum, n) => sum + n, 0);
      expect(total, `${name} drew nothing`).toBeGreaterThan(400);

      const weights = eventRarityWeights(segments[0]!);
      const weightTotal = weights.common + weights.uncommon + weights.rare;
      for (const rarity of EVENT_RARITIES) {
        const expected = weights[rarity] / weightTotal;
        const actual = (row.get(rarity) ?? 0) / total;
        // Five points of tolerance on a sample this size: the draw is uniform
        // per node, and the bands pool three segments' worth of nodes.
        expect(Math.abs(actual - expected), `${name}/${rarity} ${actual.toFixed(3)} vs ${expected.toFixed(3)}`).toBeLessThan(0.05);
      }
    }
  });

  it('names no event: an event appears at more than one rarity', () => {
    /*
     * The decoupling, asserted rather than trusted. If rarity still named the
     * event, each event would only ever be seen at one rarity.
     */
    const seen = new Map<string, Set<string>>();
    for (let seed = 0; seed < 40; seed++) {
      for (const { event } of eventsOf(mapOf(`DECOUPLE-${seed}`))) {
        const set = seen.get(event.eventId) ?? new Set<string>();
        set.add(event.rarity);
        seen.set(event.eventId, set);
      }
    }
    expect(seen.size).toBeGreaterThan(4);
    for (const [id, rarities] of seen) {
      expect(rarities.size, `${id} only ever rolled ${[...rarities].join(', ')}`).toBeGreaterThan(1);
    }
  });
});

describe('locale and exhaustion', () => {
  it('draws every event from the locale of the node it sits on', () => {
    for (const seed of ['LOC-A', 'LOC-B']) {
      for (const { locale, event } of eventsOf(mapOf(seed))) {
        expect(event.locale, `${event.eventId} on a ${locale} node`).toBe(locale);
        expect(eventsInLocale(locale!).map((entry) => entry.id)).toContain(event.eventId);
      }
    }
  });

  it('does not repeat an event inside one segment until that locale runs out', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const segment of mapOf(`EXHAUST-${seed}`)) {
        const byLocale = new Map<LocaleId, string[]>();
        for (const { locale, event } of eventsOf([segment])) {
          const list = byLocale.get(locale!) ?? [];
          list.push(event.eventId);
          byLocale.set(locale!, list);
        }
        for (const [locale, ids] of byLocale) {
          const available = eventsInLocale(locale).length;
          const distinct = new Set(ids).size;
          /*
           * Every draw up to the locale's size is distinct. Past it the list
           * has refilled, and a repeat is the accepted outcome rather than a
           * failure — three events per locale does not cover a segment that
           * puts four event nodes on one route.
           */
          expect(distinct, `${locale} in segment ${segment.index}`).toBe(Math.min(ids.length, available));
        }
      }
    }
  });

  it('refills exactly as often as a locale runs short, at any table size', () => {
    /*
     * An exact invariant rather than a threshold, because the threshold is not
     * knowable yet: the table on this tree is the eight pre-rejig events, one
     * per locale, so a locale's list holds *one* event and a second event node
     * on that locale refills immediately. The measured rate is about 3.3
     * refills per segment, and it is an artefact of the placeholder rather
     * than of the design.
     *
     * With a list of N and D draws, the list empties after N and refills every
     * N thereafter: `floor((D - 1) / N)`. Asserting that holds whatever N is,
     * so step 6 raising the table to three per locale — or a later content pass
     * raising it to five — moves the number without touching this test.
     */
    let refills = 0;
    let predicted = 0;
    let segments = 0;
    for (let seed = 0; seed < 30; seed++) {
      for (const segment of mapOf(`REFILL-${seed}`)) {
        const draws = new Map<LocaleId, number>();
        for (const { locale } of eventsOf([segment])) {
          draws.set(locale!, (draws.get(locale!) ?? 0) + 1);
        }
        for (const [locale, count] of draws) {
          predicted += Math.floor((count - 1) / eventsInLocale(locale).length);
        }
        refills += segment.eventRefills;
        segments += 1;
      }
    }
    expect(segments).toBeGreaterThan(200);
    expect(refills).toBe(predicted);
    expect(refills, 'no locale ever ran short, so the rule proved nothing').toBeGreaterThan(0);
  });

  it('has events to draw in every locale, so no route can generate a blank', () => {
    for (const locale of LOCALES.map((entry) => entry.id)) {
      expect(eventsInLocale(locale).length, locale).toBeGreaterThan(0);
    }
  });
});

describe('every option resolves to exactly one tier', () => {
  it('reads one tier per band, and that tier is the outcome it pays', () => {
    for (const { event } of eventsOf(mapOf('ONE-TIER'))) {
      for (const option of event.options) {
        for (const band of BANDS) {
          const tier = option.tierAt[band];
          expect(OUTCOME_TIERS).toContain(tier);
          expect(outcomeFor(option, band)).toBe(option.outcomes[tier]);
        }
      }
    }
  });
});
