/**
 * Events: a hook, a relic, a toll price, and four option labels.
 *
 * **What is not here any more: outcomes.** Before the event rejig each event
 * authored its own weighted outcome tables, one set per choice per capability
 * band, and that is what made the table small — 24 events would have meant 24
 * bespoke payout tables to keep in balance with each other. Outcomes now live
 * in `data/eventPools.ts`, keyed by tier and segment band, and an event says
 * only which *copy* wraps them and what its Toll costs.
 *
 * If a bespoke outcome is ever needed for one event, the pool is missing an
 * entry. That is the rule this split exists to enforce.
 *
 * ## Rarity is not a column here, and that is a ruling
 *
 * The patch prompt gave each event a rarity and also drew a rarity per node, so
 * `(locale, rarity)` named exactly one event — rarity had become the event's
 * *name* rather than the payout knob, which made "no event twice in a run" mean
 * "no rarity twice in a locale" and distorted the very distribution the rarity
 * test pins. Decoupled: rarity scales the outcome distribution, event identity
 * is a separate draw from the locale's list, and **any event can roll any
 * rarity**. `docs/generation.md` section 14.
 *
 * ## Locale decides what is reachable
 *
 * An event belongs to exactly one locale and is drawn only by nodes on that
 * locale's route. That is new: before the rejig `generateEvent` picked from the
 * whole table with no locale filter at all, so a shore event could appear
 * inside a cave.
 *
 * ## The order is a draw order
 *
 * Generation picks from the locale's list, so appending is safe and reordering
 * or inserting reshuffles what every recorded seed produces.
 */

import type { Capability } from './capabilities';
import type { EffectTarget, EventArchetype } from './eventPools';
import type { LocaleId } from './locales';

/**
 * What a Toll charges. **A price, not a bet.**
 *
 * Paid up front, before the outcome is known to the player, and the outcome is
 * guaranteed `T2` regardless. So a Toll is the one option whose cost the player
 * can read exactly before pressing it.
 *
 * `gold` takes `max(floor, fraction x current gold)` so a broke player still
 * pays something; the floor is scaled by segment at resolution. `hp` applies
 * after the attrition rules, never below 1 HP and never fainting a member.
 */
export type TollPrice =
  | { kind: 'hp'; percent: number; target: EffectTarget }
  | { kind: 'gold'; fraction: number; floor: number }
  /** A flat price rather than a proportional one. Scaled by segment. */
  | { kind: 'goldFixed'; amount: number }
  | { kind: 'berry' }
  | { kind: 'discard'; count: number };

/** The copy for one event's four buttons. One label and one hint each. */
export type ArchetypeCopy = Readonly<Record<EventArchetype, string>>;

export interface EventDefinition {
  id: string;
  /** The only locale whose routes can draw this event. */
  locale: LocaleId;
  /**
   * The one capability whose relic puts the Attune option on the menu.
   *
   * Exactly one, never a set: a gate the player has to satisfy two ways is a
   * gate they cannot read off the map, and the map shows the requirement.
   */
  requires: Capability;
  /*
   * `hook`, `labels` and `hints` lived here and are gone. **M5.6's split,
   * D14, closed 2026-09-22.**
   *
   * They are `EVENT_HOOKS`, `EVENT_LABELS` and `EVENT_HINTS` in
   * `data/eventCopy.ts`, which `core/` does not import and which is therefore
   * excluded from `contentHash` by the mechanical rule. D14 was opened at Tier
   * 0 when two words of flavour turned out to cost a hash move and has been
   * waiting since for something else to move it; M5.1's item and relic copy
   * moved it on the same day, so both halves were taken together and the tier
   * paid once.
   *
   * What is left here is what a run generates and resolves from: the id, the
   * locale whose list it is drawn from, the capability that puts Attune on the
   * menu, and the toll's exact price.
   */
  /** What the Toll option charges. */
  toll: TollPrice;
}

/**
 * The events, by locale.
 *
 * **Step 6 replaces this with the 24-event chart.** What is here is the eight
 * pre-rejig events carried across to the new shape, one per locale, so that the
 * mechanism has something to draw while steps 3 to 5 build it. Their hooks and
 * relics are the originals; their option copy is written from the template,
 * which is what the 24 will be written from too.
 */
/**
 * The twenty-four events: three per locale, eight locales.
 *
 * **There is no rarity column, and that is a ruling rather than an omission.**
 * The patch prompt gave each event a rarity *and* drew a rarity per node, so
 * `(locale, rarity)` named exactly one event — which made "no event twice in a
 * run" mean "no rarity twice in a locale" and distorted the distribution the
 * rarity test pins. Rarity scales the payout; identity is a separate draw from
 * the locale's list; **any event can roll any rarity.**
 * `docs/generation.md` section 14.
 *
 * ## Relic coverage is one column, and it is the tuning lever
 *
 * Strength 4, Cut 3, RockSmash 3, Fly 3, Waterfall 3, Dive 3, Flash 3, Surf 2.
 * The skew toward Strength and away from Surf is deliberate: `surf`,
 * `waterfall` and `dive` are all keyed to Water alone, so a party with any
 * Water type sits at `latent` for three of the eight gates
 * (`data/capabilities.ts` measures it). Correcting that by narrowing the type
 * sets would make that table say something false about the games to fix this
 * table's problem, so it is corrected here, by how many events name each
 * capability.
 *
 * ## The copy is written from the template, never bespoke
 *
 * Each event supplies a hook, four labels and four hints. Outcomes come from
 * `data/eventPools.ts`. If a bespoke outcome is ever wanted for one event, the
 * pool is missing an entry — that is the rule this split exists to enforce.
 *
 * ## The order is a draw order
 *
 * Generation picks from the locale's list, so appending is safe and reordering
 * reshuffles what every recorded seed produces.
 */
export const EVENTS: readonly EventDefinition[] = [
  // --- Cave ---------------------------------------------------------------
  {
    id: 'cave-collapsed-shaft',
    locale: 'cave',
    requires: 'strength',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
  },
  {
    id: 'cave-lightless-gallery',
    locale: 'cave',
    requires: 'flash',
    toll: { kind: 'berry' },
  },
  {
    id: 'cave-fossil-seam',
    locale: 'cave',
    requires: 'rockSmash',
    toll: { kind: 'gold', fraction: 0.4, floor: 30 },
  },

  // --- Shore --------------------------------------------------------------
  {
    id: 'shore-seabed-crate',
    locale: 'shore',
    requires: 'dive',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
  },
  {
    id: 'shore-riptide-channel',
    locale: 'shore',
    requires: 'surf',
    toll: { kind: 'hp', percent: 0.15, target: 'lead' },
  },
  {
    id: 'shore-beached-trawler',
    locale: 'shore',
    requires: 'strength',
    toll: { kind: 'discard', count: 1 },
  },

  // --- Summit -------------------------------------------------------------
  {
    id: 'summit-wind-shear-ledge',
    locale: 'summit',
    requires: 'fly',
    toll: { kind: 'hp', percent: 0.2, target: 'party' },
  },
  {
    id: 'summit-sealed-cairn',
    locale: 'summit',
    requires: 'rockSmash',
    toll: { kind: 'goldFixed', amount: 45 },
  },
  {
    id: 'summit-ice-cache',
    locale: 'summit',
    requires: 'strength',
    toll: { kind: 'berry' },
  },

  // --- City ---------------------------------------------------------------
  {
    id: 'city-derelict-substation',
    locale: 'city',
    requires: 'flash',
    toll: { kind: 'hp', percent: 0.15, target: 'party' },
  },
  {
    id: 'city-flooded-underpass',
    locale: 'city',
    requires: 'waterfall',
    toll: { kind: 'gold', fraction: 0.3, floor: 22 },
  },
  {
    id: 'city-stranded-courier',
    locale: 'city',
    requires: 'fly',
    toll: { kind: 'discard', count: 1 },
  },

  // --- Forest -------------------------------------------------------------
  {
    id: 'forest-thornwall',
    locale: 'forest',
    requires: 'cut',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
  },
  {
    id: 'forest-sap-still',
    locale: 'forest',
    requires: 'cut',
    toll: { kind: 'gold', fraction: 0.35, floor: 26 },
  },
  {
    id: 'forest-fallen-giant',
    locale: 'forest',
    requires: 'strength',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
  },

  // --- Ruins --------------------------------------------------------------
  {
    id: 'ruins-sealed-antechamber',
    locale: 'ruins',
    requires: 'flash',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
  },
  {
    id: 'ruins-root-choked-stair',
    locale: 'ruins',
    requires: 'cut',
    toll: { kind: 'berry' },
  },
  {
    id: 'ruins-reliquary-font',
    locale: 'ruins',
    requires: 'waterfall',
    toll: { kind: 'gold', fraction: 0.4, floor: 30 },
  },

  // --- Marsh --------------------------------------------------------------
  {
    id: 'marsh-drowned-causeway',
    locale: 'marsh',
    requires: 'surf',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
  },
  {
    id: 'marsh-sinkhole-pool',
    locale: 'marsh',
    requires: 'dive',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
  },
  {
    id: 'marsh-leech-bed',
    locale: 'marsh',
    requires: 'dive',
    toll: { kind: 'discard', count: 1 },
  },

  // --- Badlands -----------------------------------------------------------
  {
    id: 'badlands-magma-vent',
    locale: 'badlands',
    requires: 'waterfall',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
  },
  {
    id: 'badlands-shattered-mesa',
    locale: 'badlands',
    requires: 'rockSmash',
    toll: { kind: 'hp', percent: 0.15, target: 'lead' },
  },
  {
    id: 'badlands-thermal-updraft',
    locale: 'badlands',
    requires: 'fly',
    toll: { kind: 'gold', fraction: 0.35, floor: 28 },
  },
];

const BY_ID = new Map(EVENTS.map((event) => [event.id, event]));

const BY_LOCALE = EVENTS.reduce<Map<LocaleId, EventDefinition[]>>((map, event) => {
  const list = map.get(event.locale) ?? [];
  list.push(event);
  map.set(event.locale, list);
  return map;
}, new Map());

export function eventById(id: string): EventDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** Every event this locale's routes can draw, in table order. */
export function eventsInLocale(locale: LocaleId): readonly EventDefinition[] {
  return BY_LOCALE.get(locale) ?? [];
}
