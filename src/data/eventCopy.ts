/**
 * The capability and band labels, as a player reads them.
 *
 * **This file used to carry a per-event copy table and no longer does.** That
 * table was written in patch 4.8.0.2 against the 4.6c model — a hint and a
 * conclusion per event id per capability band, because a *choice* paid a
 * different outcome at each band. The event rejig replaces choices with
 * archetypes and bands with tiers and renames every event, so every key named
 * an event that no longer exists and every sentence described a mechanism that
 * no longer runs. It is deleted from the lineage rather than left behind a
 * flag, and recorded with a dated note in `docs/generation.md` section 14.
 * Archetype copy replaces it at step 8.
 *
 * What is left is not about events at all. The map screen, the party screen and
 * the tooltips name capabilities and bands, and did before this file ever had
 * an event table in it.
 *
 * ## Read by `ui/` only, and excluded from `contentHash`
 *
 * Nothing under `core/` imports this file, so it sits on the exclusion list in
 * `build-config/content-hash.ts`: rewording a label here must not move a seed.
 *
 * ## The copy rule
 *
 * Part 4: attributes, never verdicts. A band label says what the run can do
 * here, and stops. It does not rank a band against another, and it is linted
 * against `TUTORIAL_FORBIDDEN_WORDS` in `test/event-copy.test.ts`.
 */
import type { CapabilityBand } from '../core/capabilities';
import type { Capability } from './capabilities';
import type { EventRarity } from './eventPools';
import type { EventArchetype } from './eventPools';
import type { ArchetypeCopy } from './events';

/** The capability names, as a player reads them rather than as ids. */
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  cut: 'Cut',
  surf: 'Surf',
  strength: 'Strength',
  rockSmash: 'Rock Smash',
  fly: 'Fly',
  waterfall: 'Waterfall',
  dive: 'Dive',
  flash: 'Flash',
};

/**
 * What each band says about the run. Attributes, and deliberately flat.
 *
 * None of the three is phrased as good or bad. `latent` is not "almost" and
 * `none` is not "you cannot" — the event pays at every band, and a player who
 * reads `none` as a locked door has been told something untrue.
 */
/**
 * How swingy an event node is, as a player reads it.
 *
 * An attribute of the node, like the capability it requires: it names which
 * distribution the node's Gamble and Attune draw on. It does not rank two
 * nodes, and the map still never orders them.
 */
export const RARITY_LABELS: Readonly<Record<EventRarity, string>> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};

export const BAND_LABELS: Readonly<Record<CapabilityBand, string>> = {
  known: 'you have the relic',
  latent: 'your party has the type',
  none: 'neither',
};

/**
 * What the reveal says about a price the player already agreed to.
 *
 * A Toll's price is on the button before the press and was charged by the time
 * the reveal is drawn, and the reveal said nothing about it — so the reporter
 * who took `20% HP` for a `T2` read the missing sentence as a missing charge.
 * Past tense on purpose: the button says what it *costs*, this says what it
 * *took*, and the two being different tenses is what separates the forecast
 * from the fact.
 *
 * It is not a verdict. It restates a price the player read on the button they
 * pressed, which is an attribute of what just happened.
 */
export const TOLL_PAID_PREFIX = 'Paid';

/*
 * **The per-event band copy table was deleted by the event rejig, not flagged
 * off.**
 *
 * It held, per event id, a hint and a conclusion per capability band — written
 * in patch 4.8.0.2 against the 4.6c model where a *choice* paid a different
 * outcome at each band. The rejig replaces choices with archetypes and bands
 * with tiers, and renames every event, so every key in that table named an
 * event that no longer exists and every sentence described a mechanism that no
 * longer runs. A superseded table is deleted from the lineage and recorded with
 * a dated note rather than left behind a flag: `docs/generation.md` section 14.
 *
 * What replaces it is archetype copy, and it is step 8's. The two labels below
 * survive because they are not about events at all — the map screen, the party
 * screen and the tooltips all name capabilities and bands, and did before this
 * file had an event table in it.
 */

// ---------------------------------------------------------------------------
// The event table's own words. **Milestone M5.6's split, discrepancy D14.**
// ---------------------------------------------------------------------------

/**
 * The hook, the four labels and the four hints, by event id.
 *
 * ## Why they are here and not in `data/events.ts`
 *
 * **D14, open since Tier 0 and closed 2026-09-22.** It was filed when widening
 * the forbidden-word list caught two sentences in violation and the rewrite —
 * two minutes of work — turned out to cost a `contentHash` move, because
 * `core/events.ts` imports `data/events.ts` and the mechanical exclusion rule
 * therefore cannot reach it. The row's own recommendation was to split rather
 * than to pay for two words, *"timed to whenever something else moves the hash
 * anyway, or taken on its own as a Tier 5 item beside M5.6"*. That is this.
 *
 * `data/events.ts` keeps `id`, `locale`, `requires` and `toll` — the four
 * fields a run actually generates and resolves from. Everything a player reads
 * is here, where rewording it is free forever.
 *
 * ## What had to change in `core/` for this to be possible
 *
 * `EventInstance` carried `prompt` and `EventOption` carried `label` and
 * `hint`, so the core was assembling display strings and handing them up. It
 * carries `eventId` and `archetype` instead, and the screen resolves the words
 * from here. That is the direction the architecture already required — nothing
 * under `core/` reads this file, which is what keeps the exclusion honest and
 * what `test/content-hash.test.ts` walks the import graph to hold.
 *
 * ## Nothing below was rewritten by the split
 *
 * Every string is the one that was in the table, to the character. M5.6 is the
 * item that changes them, against whatever section 4's event row says once D33
 * is applied; this commit only moves them, so the diff is one nobody has to
 * read for meaning.
 */
export const EVENT_HOOKS: Readonly<Record<string, string>> = {
  'cave-collapsed-shaft': 'A collapsed shaft, and something metallic under the rubble.',
  'cave-lightless-gallery': 'A gallery with no light in it, and echoes coming back wrong.',
  'cave-fossil-seam': 'A fossil seam that someone started on and abandoned.',
  'shore-seabed-crate': 'A crate on the seabed, deeper than it looks from the jetty.',
  'shore-riptide-channel': 'A riptide channel between you and the far bank.',
  'shore-beached-trawler': 'A beached trawler, hull intact, hatch jammed shut.',
  'summit-wind-shear-ledge': 'A ledge across a wind shear, with nothing below it.',
  'summit-sealed-cairn': 'A cairn of offerings, sealed by whoever stacked it.',
  'summit-ice-cache': 'A cache frozen into the ice face, a body-length up.',
  'city-derelict-substation': 'A derelict substation, with power still humming somewhere inside.',
  'city-flooded-underpass': 'A flooded underpass with a current running through it.',
  'city-stranded-courier': 'A courier stranded on a rooftop with a package and no stairs.',
  'forest-thornwall': 'A thornwall grown clean across the only path.',
  'forest-sap-still': 'A sap still, tapped and left running.',
  'forest-fallen-giant': 'A fallen giant across a ravine, with something nesting in it.',
  'ruins-sealed-antechamber': 'A sealed antechamber, with no light past the threshold.',
  'ruins-root-choked-stair': 'A stair choked with roots, descending further than you can see.',
  'ruins-reliquary-font': 'A reliquary font running hard, and running the wrong way.',
  'marsh-drowned-causeway': 'A causeway drowned past the markers.',
  'marsh-sinkhole-pool': 'A sinkhole pool with a clear bottom and no shallows at all.',
  'marsh-leech-bed': 'A leech bed lying over something worth having.',
  'badlands-magma-vent': 'A magma vent with a spring running above it.',
  'badlands-shattered-mesa': 'A shattered mesa with a seam running right through it.',
  'badlands-thermal-updraft': 'A thermal updraft, and a ridge on the far side of it.',
};

/** The four button labels per event, in archetype order. */
export const EVENT_LABELS: Readonly<Record<string, ArchetypeCopy>> = {
  'cave-collapsed-shaft': { safe: 'Take what is loose', gamble: 'Shift the rubble by hand', toll: 'Put your lead under the beam', attune: 'Lift the beam clear' },
  'cave-lightless-gallery': { safe: 'Feel along the wall', gamble: 'Walk it in the dark', toll: 'Trade for a lamp', attune: 'Light the whole gallery' },
  'cave-fossil-seam': { safe: 'Pocket the chips', gamble: 'Lever it out', toll: 'Hire the crew back', attune: 'Break the seam open' },
  'shore-seabed-crate': { safe: 'Wait for the tide', gamble: 'Hold your breath and go', toll: 'Everyone takes a turn hauling', attune: 'Go down and open it there' },
  'shore-riptide-channel': { safe: 'Walk the long way', gamble: 'Wade the narrows', toll: 'Send your lead across first', attune: 'Swim it' },
  'shore-beached-trawler': { safe: 'Search the deck', gamble: 'Force the hatch', toll: 'Trade the salvager for it', attune: 'Pull the hatch off' },
  'summit-wind-shear-ledge': { safe: 'Turn back at the gap', gamble: 'Jump it', toll: 'Rope across together', attune: 'Fly the gap' },
  'summit-sealed-cairn': { safe: 'Leave an offering', gamble: 'Pull it apart', toll: 'Pay the keeper to open it', attune: 'Break the seal stone' },
  'summit-ice-cache': { safe: 'Chip at the edges', gamble: 'Climb and kick it free', toll: 'Trade for the guide\'s pick', attune: 'Haul it out whole' },
  'city-derelict-substation': { safe: 'Strip the outside boxes', gamble: 'Go in past the fence', toll: 'Earth it by hand', attune: 'Light it and read the panel' },
  'city-flooded-underpass': { safe: 'Go around the block', gamble: 'Wade the underpass', toll: 'Pay for the boat', attune: 'Climb the outflow' },
  'city-stranded-courier': { safe: 'Shout directions up', gamble: 'Climb the drainpipe', toll: 'Trade her something for it', attune: 'Bring her down' },
  'forest-thornwall': { safe: 'Take the long detour', gamble: 'Push straight through', toll: 'Send your lead in first', attune: 'Cut the wall down' },
  'forest-sap-still': { safe: 'Fill one jar', gamble: 'Run it dry', toll: 'Buy the tapper\'s stock', attune: 'Tap a fresh tree' },
  'forest-fallen-giant': { safe: 'Cross and keep going', gamble: 'Reach into the hollow', toll: 'Clear the nest out', attune: 'Roll the trunk over' },
  'ruins-sealed-antechamber': { safe: 'Read the threshold carvings', gamble: 'Go in blind', toll: 'Burn what you carry for light', attune: 'Light the chamber' },
  'ruins-root-choked-stair': { safe: 'Take the top landing', gamble: 'Force your way down', toll: 'Trade the digger for a blade', attune: 'Clear the stair' },
  'ruins-reliquary-font': { safe: 'Fill a flask at the lip', gamble: 'Reach into the basin', toll: 'Pay the attendant to still it', attune: 'Climb the inflow' },
  'marsh-drowned-causeway': { safe: 'Follow the markers back', gamble: 'Wade past the last marker', toll: 'Send your lead to find the edge', attune: 'Swim the span' },
  'marsh-sinkhole-pool': { safe: 'Fish from the rim', gamble: 'Drop in and grab', toll: 'Drag the pool with a net', attune: 'Go down to the bottom' },
  'marsh-leech-bed': { safe: 'Skim the edge', gamble: 'Wade in and feel for it', toll: 'Trade the trapper for his waders', attune: 'Go under the bed' },
  'badlands-magma-vent': { safe: 'Work the cooled crust', gamble: 'Cross while it is quiet', toll: 'Douse the vent', attune: 'Climb the spring' },
  'badlands-shattered-mesa': { safe: 'Collect from the scree', gamble: 'Climb into the seam', toll: 'Wedge it open', attune: 'Split the mesa' },
  'badlands-thermal-updraft': { safe: 'Wait it out below', gamble: 'Ride the edge of it', toll: 'Pay the balloonist', attune: 'Take the updraft' },
};

/**
 * What the player is told *before* pressing each button.
 *
 * Never names the drawn outcome — that would make the choice a formality — but
 * it is honest about the shape of the risk. "Might be a trap" is a decision;
 * saying nothing at all is a coin flip with extra steps.
 */
export const EVENT_HINTS: Readonly<Record<string, ArchetypeCopy>> = {
  'cave-collapsed-shaft': { safe: 'What has already fallen free is yours without moving anything.', gamble: 'The pile is holding itself up. Some of it will not stay that way.', toll: 'Someone has to take the weight while the rest of you dig.', attune: 'The beam comes up in one movement and the shaft opens.' },
  'cave-lightless-gallery': { safe: 'The wall leads somewhere. Slowly, and not far.', gamble: 'The echoes say the floor ends. They do not say where.', toll: 'The miner at the mouth wants a berry for his spare lamp.', attune: 'Lit end to end, the gallery is a room rather than a risk.' },
  'cave-fossil-seam': { safe: 'Chips and fragments, already loose at the foot of the seam.', gamble: 'It comes out whole or it comes out in pieces.', toll: 'The crew left because nobody paid them. That is fixable.', attune: 'The matrix splits along the grain and leaves the fossil intact.' },
  'shore-seabed-crate': { safe: 'The tide will bring something up. Not the crate.', gamble: 'It is one breath deeper than one breath allows.', toll: 'A rope, four shoulders, and a long cold afternoon.', attune: 'No rope needed. You can work at that depth.' },
  'shore-riptide-channel': { safe: 'Hours added, and a beachcomber met on the way.', gamble: 'The narrows are narrow because the water is fast there.', toll: 'One of you fights the current to carry a line over.', attune: 'The channel is a crossing rather than an obstacle.' },
  'shore-beached-trawler': { safe: 'The deck has been picked over. Not completely.', gamble: 'The hatch is jammed for a reason nobody wrote down.', toll: 'The salvager wants something from your bag before he opens it.', attune: 'The hatch is a hinge and a weight. Both are answerable.' },
  'summit-wind-shear-ledge': { safe: 'The climb down is not wasted. There is a cache on the way.', gamble: 'It is a long step. The wind decides how long.', toll: 'Everyone crosses on the line, and the line costs skin.', attune: 'The shear is lift rather than a gap.' },
  'summit-sealed-cairn': { safe: 'You add to it instead of taking, and something is left for you.', gamble: 'A cairn comes apart easily. That is not the difficult part.', toll: 'The keeper opens it properly, for a price named in advance.', attune: 'One stone holds the rest. It is a stone.' },
  'summit-ice-cache': { safe: 'The edges give up a little without threatening the face.', gamble: 'The ice is holding the cache and the cache is holding the ice.', toll: 'The guide lends a pick for a berry, and says nothing else.', attune: 'The whole block comes away and the contents survive.' },
  'city-derelict-substation': { safe: 'The outside boxes are dead and still hold parts.', gamble: 'Something in there is live. The hum does not say what.', toll: 'Grounding it means touching it, and everyone feels that.', attune: 'With light on the panel the live bus is a label, not a guess.' },
  'city-flooded-underpass': { safe: 'Longer, drier, and a shopfront open on the way.', gamble: 'The water is moving faster than its depth suggests.', toll: 'A man with a punt names a price and keeps to it.', attune: 'The outflow is a climb, and it goes the way you want.' },
  'city-stranded-courier': { safe: 'She finds her own way eventually and leaves you a tip.', gamble: 'The drainpipe is four storeys of somebody else\'s maintenance.', toll: 'She will swap the package for something out of your bag.', attune: 'Down in one trip, package and courier both.' },
  'forest-thornwall': { safe: 'The detour is slow and passes a grove worth passing.', gamble: 'Thorn that thick is hiding how deep it goes.', toll: 'One of you goes in and makes a gap for the rest.', attune: 'The wall comes down in a single pass.' },
  'forest-sap-still': { safe: 'One jar, from what is already in the collector.', gamble: 'The still has been running unattended for a while.', toll: 'The tapper will sell what he has drawn, at his price.', attune: 'A clean cut on a fresh trunk runs while the old tap is still dripping.' },
  'forest-fallen-giant': { safe: 'The trunk is a bridge. Using it as one costs nothing.', gamble: 'Whatever is nesting in there is nesting in there.', toll: 'Clearing it means everyone gets bitten at least once.', attune: 'The trunk turns, and the underside has not been touched.' },
  'ruins-sealed-antechamber': { safe: 'The carvings are the outside of the story, and they pay.', gamble: 'The floor beyond the threshold has not been surveyed.', toll: 'A fire needs feeding, and it burns more than fuel.', attune: 'Lit, the chamber is a room with its floor visible.' },
  'ruins-root-choked-stair': { safe: 'The top landing is reachable and has not been emptied.', gamble: 'The roots hold the stair together as well as block it.', toll: 'The digger has a blade and an appetite for berries.', attune: 'The stair opens the whole way down.' },
  'ruins-reliquary-font': { safe: 'The lip gives up a flask of it without argument.', gamble: 'The basin is deeper than the font is wide.', toll: 'The attendant can stop the flow, and names what for.', attune: 'Water running upward is a climb like any other.' },
  'marsh-drowned-causeway': { safe: 'The markers lead somewhere, and somebody left a cache there.', gamble: 'Past the markers the causeway either continues or does not.', toll: 'Someone walks ahead finding the drop-offs the hard way.', attune: 'The span is water, and water is crossable.' },
  'marsh-sinkhole-pool': { safe: 'A line from the rim brings something up.', gamble: 'It is clear enough to see the bottom and deep enough to matter.', toll: 'Dragging it takes every pair of hands and gives them all cramp.', attune: 'At the bottom the pool is a room with a floor.' },
  'marsh-leech-bed': { safe: 'The edge is shallow, thin of leeches, and thin of everything else.', gamble: 'What is under the bed is under the bed.', toll: 'The trapper lends waders for something out of your bag.', attune: 'Underneath it the bed is a ceiling rather than a field.' },
  'badlands-magma-vent': { safe: 'The crust is cool at the edge and holds what cooled in it.', gamble: 'It has been quiet for a while. That is all anyone knows.', toll: 'Dousing it means standing close enough to douse it.', attune: 'The spring falls past the vent, and it can be climbed.' },
  'badlands-shattered-mesa': { safe: 'The scree at the base is full of what fell out of the seam.', gamble: 'The seam is a gap between two things that are still moving.', toll: 'Holding the wedge means being where the wedge is.', attune: 'The mesa opens along the seam and stays open.' },
  'badlands-thermal-updraft': { safe: 'Below the thermal the air is still and somebody is camped in it.', gamble: 'The edge of a thermal is where the air stops agreeing with itself.', toll: 'The balloonist crosses daily and charges by the crossing.', attune: 'The updraft is the way up and the ridge is the way across.' },
};

/** The situation, in one line, or the empty string for an unknown id. */
export function eventHook(id: string): string {
  return EVENT_HOOKS[id] ?? '';
}

/** One button's label, or the empty string for an unknown id. */
export function eventLabel(id: string, archetype: EventArchetype): string {
  return EVENT_LABELS[id]?.[archetype] ?? '';
}

/** One button's hint, or the empty string for an unknown id. */
export function eventHint(id: string, archetype: EventArchetype): string {
  return EVENT_HINTS[id]?.[archetype] ?? '';
}
