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
  /** The situation, in one line. Never names an outcome. */
  hook: string;
  /** What the Toll option charges. */
  toll: TollPrice;
  /** The four buttons. */
  labels: ArchetypeCopy;
  /**
   * What the player is told *before* pressing each button.
   *
   * Never names the drawn outcome — that would make the choice a formality —
   * but it must be honest about the shape of the risk. "Might be a trap" is a
   * decision; saying nothing at all is a coin flip with extra steps.
   */
  hints: ArchetypeCopy;
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
export const EVENTS: readonly EventDefinition[] = [
  {
    id: 'cave-rattling-ball',
    locale: 'cave',
    requires: 'flash',
    hook: 'A dented Poke Ball sits in the dark. Something is rattling inside it.',
    toll: { kind: 'berry' },
    labels: {
      safe: 'Leave it and move on',
      gamble: 'Open it',
      toll: 'Trade a berry for it',
      attune: 'Light the gallery first',
    },
    hints: {
      safe: 'You take what the ledge already offered and keep walking.',
      gamble: 'Could be anything. Could be something that bites.',
      toll: 'The trader wants a berry. He hands it over without opening it.',
      attune: 'With light, you can see what you are reaching for.',
    },
  },
  {
    id: 'forest-roadside-berries',
    locale: 'forest',
    requires: 'cut',
    hook: 'Berries, heavy on the branch, behind a wall of thorn.',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
    labels: {
      safe: 'Take what is within reach',
      gamble: 'Push through the thorn',
      toll: 'Force a path and pay for it',
      attune: 'Cut the wall down',
    },
    hints: {
      safe: 'The low branches are picked over, but they are picked.',
      gamble: 'Most berries are food. Most.',
      toll: 'Your lead goes in first and comes out scratched.',
      attune: 'The wall comes down in one pass and the grove is yours.',
    },
  },
  {
    id: 'shore-toll-bridge',
    locale: 'shore',
    requires: 'surf',
    hook: 'A gatekeeper wants payment to cross. The channel looks shallow enough.',
    toll: { kind: 'gold', fraction: 0.3, floor: 24 },
    labels: { safe: 'Turn back', gamble: 'Wade across', toll: 'Pay the toll', attune: 'Swim it' },
    hints: {
      safe: 'He shrugs and gives you something for the walk.',
      gamble: 'Free. Cold, fast, and further than it looks.',
      toll: 'He waves you through and throws in something from his pack.',
      attune: 'The channel is nothing to a party that swims.',
    },
  },
  {
    id: 'summit-old-trainer',
    locale: 'summit',
    requires: 'strength',
    hook: 'An old trainer offers to run drills. She does not offer to go easy.',
    toll: { kind: 'hp', percent: 0.2, target: 'party' },
    labels: { safe: 'Just talk', gamble: 'Spar with her', toll: 'Go a full round', attune: 'Haul her gear up' },
    hints: {
      safe: 'She talks you through the routes ahead, and shares her lunch.',
      gamble: 'It will hurt. She has done this longer than you have been alive.',
      toll: 'Everyone gets a turn. Everyone pays for it.',
      attune: 'The crates go up the face in one trip. She notices.',
    },
  },
  {
    id: 'marsh-hot-spring',
    locale: 'marsh',
    requires: 'dive',
    hook: 'Steam rises off a pool in the reeds. It smells strongly of sulphur.',
    toll: { kind: 'discard', count: 1 },
    labels: { safe: 'Fill a bottle', gamble: 'Soak', toll: 'Trade for the deep water', attune: 'Go down to the vent' },
    hints: {
      safe: 'Tourists pay for this. You will not get to use it yourself.',
      gamble: 'Warm. Restorative, probably.',
      toll: 'The keeper wants something from your bag for the deeper water.',
      attune: 'The vent is the source, and it is well below the surface.',
    },
  },
  {
    id: 'city-card-sharp',
    locale: 'city',
    requires: 'fly',
    hook: 'A man with a folding table wants to bet on which cup the coin is under.',
    toll: { kind: 'gold', fraction: 0.3, floor: 20 },
    labels: { safe: 'Walk on', gamble: 'Play a round', toll: 'Buy the table off him', attune: 'Watch from the roof' },
    hints: {
      safe: 'Nothing gained, nothing lost, no folding table involved.',
      gamble: 'He has done this a long time. So has everyone who owns a folding table.',
      toll: 'He names a price for the whole setup and everything on it.',
      attune: 'From above, the trick is obvious, and so is where he keeps the rest.',
    },
  },
  {
    id: 'badlands-storm-shelter',
    locale: 'badlands',
    requires: 'rockSmash',
    hook: 'The sky opens. There is a sealed shelter, and a longer road around it.',
    toll: { kind: 'goldFixed', amount: 40 },
    labels: { safe: 'Push through the rain', gamble: 'Force the door', toll: 'Pay the keeper', attune: 'Break the seal' },
    hints: {
      safe: 'You arrive soaked and behind schedule, but you arrive.',
      gamble: 'Dry inside. Occupied, possibly.',
      toll: 'Someone has the key and a price for turning it.',
      attune: 'The seal is stone, and stone is a solved problem.',
    },
  },
  {
    id: 'ruins-scrap-heap',
    locale: 'ruins',
    requires: 'waterfall',
    hook: 'A heap of discarded gear below a flooded stair. Most of it is junk.',
    toll: { kind: 'gold', fraction: 0.35, floor: 26 },
    labels: { safe: 'Sell the scrap by weight', gamble: 'Dig through it', toll: 'Buy the pick of it', attune: 'Climb the stair' },
    hints: {
      safe: 'A guaranteed, unglamorous handful of coins.',
      gamble: 'Sharp edges and rust. Something in there still works.',
      toll: 'The scrapper lets you choose first, for a cut.',
      attune: 'What washed down came from above, and above is reachable.',
    },
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
