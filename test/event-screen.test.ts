/**
 * The event screen says which capability, which standing, and what it bought.
 * **Patch 4.8.0.2.**
 *
 * @vitest-environment jsdom
 *
 * The first test of this screen. Until this patch it rendered the authored
 * hint at every band and one outcome label, so a "Requires Surf" node paid
 * out without ever mentioning Surf. Three things are held here, at each of
 * the three bands: the gate chips match the map's, the hint is the band's
 * own, and the reveal opens with the band's conclusion above the outcome
 * label — and the second click, not the first, is what resolves the choice.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveCapability, type CapabilityBand } from '../src/core/capabilities';
import { generateEvent, describeOutcome, outcomeFor,
  presentedOptions,
  EventPicker, type EventInstance } from '../src/core/events';
import { createPartyMember } from '../src/core/party';
import { createRng } from '../src/core/rng';
import { createRun, type RunState } from '../src/core/run';
import { capabilityTypes, type Capability } from '../src/data/capabilities';
import { BAND_LABELS, CAPABILITY_LABELS } from '../src/data/eventCopy';
import { EVENTS } from '../src/data/events';
import { LOCALES } from '../src/data/locales';
import { relicsGranting } from '../src/data/relics';
import { SPECIES_POOL } from '../src/data/speciesPools';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createEventScreen } from '../src/ui/screens/event';

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
          const done: number[] = [];
          screen.render(event, state, (picked) => done.push(picked));
          document.body.append(screen.root);

          const gate = screen.root.querySelector('.event__gate');
          expect(gate?.querySelector('.node__gate-need')?.textContent, event.eventId).toBe(
            `Requires ${CAPABILITY_LABELS[event.requires]}`,
          );
          expect(gate?.querySelector('.node__gate-band')?.textContent, event.eventId).toBe(BAND_LABELS[band]);

          const hints = [...screen.root.querySelectorAll('.event__choice-hint')].map((node) => node.textContent);
          /*
           * The option's own hint, at every band. The per-band hint table went
           * with the 4.6c model the rejig replaced; the archetype copy that
           * replaces it is step 8's.
           */
          expect(hints, `${event.eventId} ${band}`).toHaveLength(band === 'known' ? 4 : 3);
          expect(hints[index], `${event.eventId} ${band} hint ${index}`).toBe(choice.hint);

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

          const paid = outcomeFor(choice, band);
          const outcomes = [...screen.root.querySelectorAll('.event__outcome')].map((n) => n.textContent);
          /*
           * A `T0` renders two lines, the cost above the payout, and every
           * other tier renders one. That split is the point: a cost shown
           * without its consolation reads as the game taking something and
           * giving nothing.
           */
          expect(outcomes[outcomes.length - 1]).toBe(describeOutcome(paid));
          expect(outcomes, `${event.eventId} ${band} ${index}`).toHaveLength(
            paid.cost.length > 0 ? 2 : 1,
          );

          screen.root.querySelector<HTMLButtonElement>('.primary-action')?.click();
          // The index handed back is into the *built* list, which does not move
          // when the relic does.
          expect(done).toEqual([event.options.indexOf(choice)]);
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
