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
    hook: 'A collapsed shaft, and something metallic under the rubble.',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
    labels: {
      safe: 'Take what is loose',
      gamble: 'Shift the rubble by hand',
      toll: 'Put your lead under the beam',
      attune: 'Lift the beam clear',
    },
    hints: {
      safe: 'What has already fallen free is yours without moving anything.',
      gamble: 'The pile is holding itself up. Some of it will not stay that way.',
      toll: 'Someone has to take the weight while the rest of you dig.',
      attune: 'The beam comes up in one movement and the shaft opens.',
    },
  },
  {
    id: 'cave-lightless-gallery',
    locale: 'cave',
    requires: 'flash',
    hook: 'A gallery with no light in it, and echoes coming back wrong.',
    toll: { kind: 'berry' },
    labels: {
      safe: 'Feel along the wall',
      gamble: 'Walk it in the dark',
      toll: 'Trade for a lamp',
      attune: 'Light the whole gallery',
    },
    hints: {
      safe: 'The wall leads somewhere. Slowly, and not far.',
      gamble: 'The echoes say the floor ends. They do not say where.',
      toll: 'The miner at the mouth wants a berry for his spare lamp.',
      attune: 'Lit end to end, the gallery is a room rather than a risk.',
    },
  },
  {
    id: 'cave-fossil-seam',
    locale: 'cave',
    requires: 'rockSmash',
    hook: 'A fossil seam that someone started on and abandoned.',
    toll: { kind: 'gold', fraction: 0.4, floor: 30 },
    labels: {
      safe: 'Pocket the chips',
      gamble: 'Lever it out',
      toll: 'Hire the crew back',
      attune: 'Break the seam open',
    },
    hints: {
      safe: 'Chips and fragments, already loose at the foot of the seam.',
      gamble: 'It comes out whole or it comes out in pieces.',
      toll: 'The crew left because nobody paid them. That is fixable.',
      attune: 'The matrix splits along the grain and leaves the fossil intact.',
    },
  },

  // --- Shore --------------------------------------------------------------
  {
    id: 'shore-seabed-crate',
    locale: 'shore',
    requires: 'dive',
    hook: 'A crate on the seabed, deeper than it looks from the jetty.',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
    labels: {
      safe: 'Wait for the tide',
      gamble: 'Hold your breath and go',
      toll: 'Everyone takes a turn hauling',
      attune: 'Go down and open it there',
    },
    hints: {
      safe: 'The tide will bring something up. Not the crate.',
      gamble: 'It is one breath deeper than one breath allows.',
      toll: 'A rope, four shoulders, and a long cold afternoon.',
      attune: 'No rope needed. You can work at that depth.',
    },
  },
  {
    id: 'shore-riptide-channel',
    locale: 'shore',
    requires: 'surf',
    hook: 'A riptide channel between you and the far bank.',
    toll: { kind: 'hp', percent: 0.15, target: 'lead' },
    labels: { safe: 'Walk the long way', gamble: 'Wade the narrows', toll: 'Send your lead across first', attune: 'Swim it' },
    hints: {
      safe: 'Hours added, and a beachcomber met on the way.',
      gamble: 'The narrows are narrow because the water is fast there.',
      toll: 'One of you fights the current to carry a line over.',
      attune: 'The channel is a crossing rather than an obstacle.',
    },
  },
  {
    id: 'shore-beached-trawler',
    locale: 'shore',
    requires: 'strength',
    hook: 'A beached trawler, hull intact, hatch jammed shut.',
    toll: { kind: 'discard', count: 1 },
    labels: { safe: 'Search the deck', gamble: 'Force the hatch', toll: 'Trade the salvager for it', attune: 'Pull the hatch off' },
    hints: {
      safe: 'The deck has been picked over. Not completely.',
      gamble: 'The hatch is jammed for a reason nobody wrote down.',
      toll: 'The salvager wants something from your bag before he opens it.',
      attune: 'The hatch is a hinge and a weight. Both are answerable.',
    },
  },

  // --- Summit -------------------------------------------------------------
  {
    id: 'summit-wind-shear-ledge',
    locale: 'summit',
    requires: 'fly',
    hook: 'A ledge across a wind shear, with nothing below it.',
    toll: { kind: 'hp', percent: 0.2, target: 'party' },
    labels: { safe: 'Turn back at the gap', gamble: 'Jump it', toll: 'Rope across together', attune: 'Fly the gap' },
    hints: {
      safe: 'The climb down is not wasted. There is a cache on the way.',
      gamble: 'It is a long step. The wind decides how long.',
      toll: 'Everyone crosses on the line, and the line costs skin.',
      attune: 'The shear is lift rather than a gap.',
    },
  },
  {
    id: 'summit-sealed-cairn',
    locale: 'summit',
    requires: 'rockSmash',
    hook: 'A cairn of offerings, sealed by whoever stacked it.',
    toll: { kind: 'goldFixed', amount: 45 },
    labels: { safe: 'Leave an offering', gamble: 'Pull it apart', toll: 'Pay the keeper to open it', attune: 'Break the seal stone' },
    hints: {
      safe: 'You add to it instead of taking, and something is left for you.',
      gamble: 'A cairn comes apart easily. That is not the difficult part.',
      toll: 'The keeper opens it properly, for a price named in advance.',
      attune: 'One stone holds the rest. It is a stone.',
    },
  },
  {
    id: 'summit-ice-cache',
    locale: 'summit',
    requires: 'strength',
    hook: 'A cache frozen into the ice face, a body-length up.',
    toll: { kind: 'berry' },
    labels: { safe: 'Chip at the edges', gamble: 'Climb and kick it free', toll: "Trade for the guide's pick", attune: 'Haul it out whole' },
    hints: {
      safe: 'The edges give up a little without threatening the face.',
      gamble: 'The ice is holding the cache and the cache is holding the ice.',
      toll: 'The guide lends a pick for a berry, and says nothing else.',
      attune: 'The whole block comes away and the contents survive.',
    },
  },

  // --- City ---------------------------------------------------------------
  {
    id: 'city-derelict-substation',
    locale: 'city',
    requires: 'flash',
    hook: 'A derelict substation, with power still humming somewhere inside.',
    toll: { kind: 'hp', percent: 0.15, target: 'party' },
    labels: { safe: 'Strip the outside boxes', gamble: 'Go in past the fence', toll: 'Earth it by hand', attune: 'Light it and read the panel' },
    hints: {
      safe: 'The outside boxes are dead and still hold parts.',
      gamble: 'Something in there is live. The hum does not say what.',
      toll: 'Grounding it means touching it, and everyone feels that.',
      attune: 'With light on the panel the live bus is a label, not a guess.',
    },
  },
  {
    id: 'city-flooded-underpass',
    locale: 'city',
    requires: 'waterfall',
    hook: 'A flooded underpass with a current running through it.',
    toll: { kind: 'gold', fraction: 0.3, floor: 22 },
    labels: { safe: 'Go around the block', gamble: 'Wade the underpass', toll: 'Pay for the boat', attune: 'Climb the outflow' },
    hints: {
      safe: 'Longer, drier, and a shopfront open on the way.',
      gamble: 'The water is moving faster than its depth suggests.',
      toll: 'A man with a punt names a price and keeps to it.',
      attune: 'The outflow is a climb, and it goes the way you want.',
    },
  },
  {
    id: 'city-stranded-courier',
    locale: 'city',
    requires: 'fly',
    hook: 'A courier stranded on a rooftop with a package and no stairs.',
    toll: { kind: 'discard', count: 1 },
    labels: { safe: 'Shout directions up', gamble: 'Climb the drainpipe', toll: 'Trade her something for it', attune: 'Bring her down' },
    hints: {
      safe: 'She finds her own way eventually and leaves you a tip.',
      gamble: "The drainpipe is four storeys of somebody else's maintenance.",
      toll: 'She will swap the package for something out of your bag.',
      attune: 'Down in one trip, package and courier both.',
    },
  },

  // --- Forest -------------------------------------------------------------
  {
    id: 'forest-thornwall',
    locale: 'forest',
    requires: 'cut',
    hook: 'A thornwall grown clean across the only path.',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
    labels: { safe: 'Take the long detour', gamble: 'Push straight through', toll: 'Send your lead in first', attune: 'Cut the wall down' },
    hints: {
      safe: 'The detour is slow and passes a grove worth passing.',
      gamble: 'Thorn that thick is hiding how deep it goes.',
      toll: 'One of you goes in and makes a gap for the rest.',
      attune: 'The wall comes down in a single pass.',
    },
  },
  {
    id: 'forest-sap-still',
    locale: 'forest',
    requires: 'cut',
    hook: 'A sap still, tapped and left running.',
    toll: { kind: 'gold', fraction: 0.35, floor: 26 },
    labels: { safe: 'Fill one jar', gamble: 'Run it dry', toll: "Buy the tapper's stock", attune: 'Tap a fresh tree' },
    hints: {
      safe: 'One jar, from what is already in the collector.',
      gamble: 'The still has been running unattended for a while.',
      toll: 'The tapper will sell what he has drawn, at his price.',
      attune: 'A clean cut on a fresh trunk runs while the old tap is still dripping.',
    },
  },
  {
    id: 'forest-fallen-giant',
    locale: 'forest',
    requires: 'strength',
    hook: 'A fallen giant across a ravine, with something nesting in it.',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
    labels: { safe: 'Cross and keep going', gamble: 'Reach into the hollow', toll: 'Clear the nest out', attune: 'Roll the trunk over' },
    hints: {
      safe: 'The trunk is a bridge. Using it as one costs nothing.',
      gamble: 'Whatever is nesting in there is nesting in there.',
      toll: 'Clearing it means everyone gets bitten at least once.',
      attune: 'The trunk turns, and the underside has not been touched.',
    },
  },

  // --- Ruins --------------------------------------------------------------
  {
    id: 'ruins-sealed-antechamber',
    locale: 'ruins',
    requires: 'flash',
    hook: 'A sealed antechamber, with no light past the threshold.',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
    labels: { safe: 'Read the threshold carvings', gamble: 'Go in blind', toll: 'Burn what you carry for light', attune: 'Light the chamber' },
    hints: {
      safe: 'The carvings are the outside of the story, and they pay.',
      gamble: 'The floor beyond the threshold has not been surveyed.',
      toll: 'A fire needs feeding, and it burns more than fuel.',
      attune: 'Lit, the chamber is a room with its floor visible.',
    },
  },
  {
    id: 'ruins-root-choked-stair',
    locale: 'ruins',
    requires: 'cut',
    hook: 'A stair choked with roots, descending further than you can see.',
    toll: { kind: 'berry' },
    labels: { safe: 'Take the top landing', gamble: 'Force your way down', toll: 'Trade the digger for a blade', attune: 'Clear the stair' },
    hints: {
      safe: 'The top landing is reachable and has not been emptied.',
      gamble: 'The roots hold the stair together as well as block it.',
      toll: 'The digger has a blade and an appetite for berries.',
      attune: 'The stair opens the whole way down.',
    },
  },
  {
    id: 'ruins-reliquary-font',
    locale: 'ruins',
    requires: 'waterfall',
    hook: 'A reliquary font running hard, and running the wrong way.',
    toll: { kind: 'gold', fraction: 0.4, floor: 30 },
    labels: { safe: 'Fill a flask at the lip', gamble: 'Reach into the basin', toll: 'Pay the attendant to still it', attune: 'Climb the inflow' },
    hints: {
      safe: 'The lip gives up a flask of it without argument.',
      gamble: 'The basin is deeper than the font is wide.',
      toll: 'The attendant can stop the flow, and names what for.',
      attune: 'Water running upward is a climb like any other.',
    },
  },

  // --- Marsh --------------------------------------------------------------
  {
    id: 'marsh-drowned-causeway',
    locale: 'marsh',
    requires: 'surf',
    hook: 'A causeway drowned past the markers.',
    toll: { kind: 'hp', percent: 0.2, target: 'lead' },
    labels: { safe: 'Follow the markers back', gamble: 'Wade past the last marker', toll: 'Send your lead to find the edge', attune: 'Swim the span' },
    hints: {
      safe: 'The markers lead somewhere, and somebody left a cache there.',
      gamble: 'Past the markers the causeway either continues or does not.',
      toll: 'Someone walks ahead finding the drop-offs the hard way.',
      attune: 'The span is water, and water is crossable.',
    },
  },
  {
    id: 'marsh-sinkhole-pool',
    locale: 'marsh',
    requires: 'dive',
    hook: 'A sinkhole pool with a clear bottom and no shallows at all.',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
    labels: { safe: 'Fish from the rim', gamble: 'Drop in and grab', toll: 'Drag the pool with a net', attune: 'Go down to the bottom' },
    hints: {
      safe: 'A line from the rim brings something up.',
      gamble: 'It is clear enough to see the bottom and deep enough to matter.',
      toll: 'Dragging it takes every pair of hands and gives them all cramp.',
      attune: 'At the bottom the pool is a room with a floor.',
    },
  },
  {
    id: 'marsh-leech-bed',
    locale: 'marsh',
    requires: 'dive',
    hook: 'A leech bed lying over something worth having.',
    toll: { kind: 'discard', count: 1 },
    labels: { safe: 'Skim the edge', gamble: 'Wade in and feel for it', toll: 'Trade the trapper for his waders', attune: 'Go under the bed' },
    hints: {
      safe: 'The edge is shallow, thin of leeches, and thin of everything else.',
      gamble: 'What is under the bed is under the bed.',
      toll: 'The trapper lends waders for something out of your bag.',
      attune: 'Underneath it the bed is a ceiling rather than a field.',
    },
  },

  // --- Badlands -----------------------------------------------------------
  {
    id: 'badlands-magma-vent',
    locale: 'badlands',
    requires: 'waterfall',
    hook: 'A magma vent with a spring running above it.',
    toll: { kind: 'hp', percent: 0.25, target: 'party' },
    labels: { safe: 'Work the cooled crust', gamble: 'Cross while it is quiet', toll: 'Douse the vent', attune: 'Climb the spring' },
    hints: {
      safe: 'The crust is cool at the edge and holds what cooled in it.',
      gamble: 'It has been quiet for a while. That is all anyone knows.',
      toll: 'Dousing it means standing close enough to douse it.',
      attune: 'The spring falls past the vent, and it can be climbed.',
    },
  },
  {
    id: 'badlands-shattered-mesa',
    locale: 'badlands',
    requires: 'rockSmash',
    hook: 'A shattered mesa with a seam running right through it.',
    toll: { kind: 'hp', percent: 0.15, target: 'lead' },
    labels: { safe: 'Collect from the scree', gamble: 'Climb into the seam', toll: 'Wedge it open', attune: 'Split the mesa' },
    hints: {
      safe: 'The scree at the base is full of what fell out of the seam.',
      gamble: 'The seam is a gap between two things that are still moving.',
      toll: 'Holding the wedge means being where the wedge is.',
      attune: 'The mesa opens along the seam and stays open.',
    },
  },
  {
    id: 'badlands-thermal-updraft',
    locale: 'badlands',
    requires: 'fly',
    hook: 'A thermal updraft, and a ridge on the far side of it.',
    toll: { kind: 'gold', fraction: 0.35, floor: 28 },
    labels: { safe: 'Wait it out below', gamble: 'Ride the edge of it', toll: 'Pay the balloonist', attune: 'Take the updraft' },
    hints: {
      safe: 'Below the thermal the air is still and somebody is camped in it.',
      gamble: 'The edge of a thermal is where the air stops agreeing with itself.',
      toll: 'The balloonist crosses daily and charges by the crossing.',
      attune: 'The updraft is the way up and the ridge is the way across.',
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
