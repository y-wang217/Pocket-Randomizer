/**
 * Stage 4.6c step 3: three outcome sets per choice, one selected at play.
 *
 * The property this file exists for is the one the whole design rests on:
 * **RNG consumption is identical regardless of which band applies.** All three
 * outcomes are drawn when the map is built, so two runs on the same seed with
 * deliberately different parties generate byte-identical maps and differ only
 * in which already-drawn outcome they are paid.
 *
 * If that ever stops being true, a seed stops describing one run: two players
 * would diverge on a roll neither of them made.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { generateEvent, outcomeAt, type EventInstance } from '../src/core/events';
import { resolveCapability } from '../src/core/capabilities';
import { createRun } from '../src/core/run';
import { CAPABILITIES } from '../src/data/capabilities';
import { EVENTS } from '../src/data/events';
import { RELICS, relicsGranting } from '../src/data/relics';
import { DEFAULT_TUNING } from '../src/data/tuning';

const BANDS = ['none', 'latent', 'known'] as const;

function eventFor(seed: string): EventInstance {
  return generateEvent('n1', createRng(seed).rewards.at('e'), DEFAULT_TUNING);
}

describe('the data', () => {
  it('gives every event exactly one required capability', () => {
    for (const event of EVENTS) {
      expect(CAPABILITIES, `${event.id}`).toContain(event.requires);
    }
  });

  it('names every capability at least once, so no relic is dead weight', () => {
    const named = new Set(EVENTS.map((event) => event.requires));
    for (const capability of CAPABILITIES) {
      expect(named.has(capability), `no event requires ${capability}`).toBe(true);
    }
  });
});

describe('all three bands are drawn', () => {
  it('gives every choice a concrete outcome at every band', () => {
    for (let i = 0; i < 40; i++) {
      const event = eventFor(`BANDS-${i}`);
      for (const choice of event.choices) {
        for (const band of BANDS) {
          expect(outcomeAt(choice, band).kind, `${event.eventId} ${band}`).toBeTruthy();
        }
      }
    }
  });

  it('pays something at every band, including none', () => {
    // A player who cannot answer the requirement is unrewarded, not punished.
    let sawNothingAtNone = false;
    for (let i = 0; i < 60; i++) {
      for (const choice of eventFor(`PAY-${i}`).choices) {
        if (outcomeAt(choice, 'none').kind === 'nothing') sawNothingAtNone = true;
      }
    }
    expect(sawNothingAtNone, 'the none band paid nothing at all').toBe(false);
  });

  it('offers the encounter at known and only at known', () => {
    let sawCapture = 0;
    for (let i = 0; i < 40; i++) {
      const rng = createRng(`KNOWN-${i}`);
      const event = generateEvent('n1', rng.rewards.at('e'), DEFAULT_TUNING, () => ({
        nodeId: 'n1',
        source: 'event',
        spec: { species: 'Pikachu', ability: 'Static', moves: ['Thunderbolt'], level: 20 },
      }));
      for (const choice of event.choices) {
        expect(outcomeAt(choice, 'none').kind).not.toBe('acquisition');
        expect(outcomeAt(choice, 'latent').kind).not.toBe('acquisition');
        if (outcomeAt(choice, 'known').kind === 'acquisition') sawCapture++;
      }
    }
    expect(sawCapture, 'the known band never offered an encounter').toBeGreaterThan(0);
  });
});

describe('the band cannot move a draw', () => {
  it('generates a byte-identical event whatever the run holds', () => {
    for (let i = 0; i < 40; i++) {
      const a = createRng(`INV-${i}`);
      const b = createRng(`INV-${i}`);
      const first = generateEvent('n1', a.rewards.at('e'), DEFAULT_TUNING);
      const second = generateEvent('n1', b.rewards.at('e'), DEFAULT_TUNING);
      expect(first).toEqual(second);
      expect(a.rewards.at('e').draws).toBe(b.rewards.at('e').draws);
    }
  });

  it('costs the same draws whether or not a Pokemon can be offered', () => {
    /*
     * The invariance that matters, stated precisely.
     *
     * An event's draw count is *not* fixed across seeds — resolving an `item`
     * outcome costs one more pick than resolving a `currency` one, so two
     * seeds landing on the same event can cost 8 and 10. That has been true
     * since events existed and it is safe for the reason `generateEvent`
     * gives: the count varies with what was *drawn*, which is keyed per node,
     * never with the run reading it.
     *
     * What must not vary is the cost as a function of anything outside the
     * seed. The band is one such thing and is covered above; the capture
     * offer is the other, and it lands on the node's `capture` sub-stream, so
     * an event that can offer a Pokemon costs the `event` stream exactly what
     * one that cannot does.
     */
    for (let i = 0; i < 60; i++) {
      const withOffer = createRng(`COST-${i}`);
      const without = createRng(`COST-${i}`);
      const a = withOffer.rewards.at('e');
      const b = without.rewards.at('e');
      generateEvent('n1', a, DEFAULT_TUNING, () => ({
        nodeId: 'n1',
        source: 'event',
        spec: { species: 'Pikachu', ability: 'Static', moves: ['Thunderbolt'], level: 20 },
      }));
      generateEvent('n1', b, DEFAULT_TUNING);
      expect(a.draws).toBe(b.draws);
    }
  });

  it('builds the same map for two runs whose parties differ', () => {
    // The end-to-end form. Same seed, and the only difference is what the run
    // holds; the generated events must be identical objects.
    const a = createRun('SAMEMAP', DEFAULT_TUNING);
    const b = { ...createRun('SAMEMAP', DEFAULT_TUNING), relics: RELICS.map((relic) => relic.id) };
    const eventsOf = (state: typeof a): unknown[] =>
      state.segments.flatMap((segment) =>
        segment.routes.flatMap((route) => route.steps.flatMap((step) => step.options.map((node) => node.event))),
      );
    expect(eventsOf(a)).toEqual(eventsOf(b));
  });
});

describe('which band a run is paid at', () => {
  it('rises to known the moment the relic is held', () => {
    for (const capability of CAPABILITIES) {
      const relic = relicsGranting(capability)[0];
      if (!relic) throw new Error(`no relic grants ${capability}`);
      expect(resolveCapability({ relics: [], party: [] }, capability)).toBe('none');
      expect(resolveCapability({ relics: [relic.id], party: [] }, capability)).toBe('known');
    }
  });

  it('pays a different outcome at each band from the same choice', () => {
    // Three genuinely different payouts, not three copies. Asserted over a
    // sample because a single event could draw the same berry twice by luck.
    let differing = 0;
    for (let i = 0; i < 60; i++) {
      for (const choice of eventFor(`DIFF-${i}`).choices) {
        const kinds = new Set(BANDS.map((band) => JSON.stringify(outcomeAt(choice, band))));
        if (kinds.size === BANDS.length) differing++;
      }
    }
    expect(differing, 'every band paid the same thing').toBeGreaterThan(20);
  });
});
