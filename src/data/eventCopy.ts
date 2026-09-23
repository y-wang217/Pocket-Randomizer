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

/**
 * What each outcome tier pays, for the inspect layer behind the reward pips.
 *
 * **Milestone M5.6.** The pips replaced `Reward: T0 to T2`, and section 3's
 * last column is where the words the meter stopped printing have to land —
 * *"tier definition"*, the same answer `data/tierInfo.ts` gives for a node's
 * tier. Four lines, one per tier, and a range shows the lines for the tiers it
 * spans.
 *
 * Each one restates the table at the top of `data/eventPools.ts` rather than
 * adding to it, for the reason `tierInfo.ts` gives: a sentence describing a
 * mechanic, written where it is rendered, drifts from the mechanic.
 *
 * Attributes, never verdicts. None of the four says a tier is a place to route
 * for; `T3` says what gates it, which is a fact about the tier.
 */
export const OUTCOME_TIER_INFO: Readonly<Record<string, string>> = {
  T0: 'A cost, and a consolation that always comes with it.',
  T1: 'One small thing, and nothing spent to get it.',
  T2: 'A move at band, a Pokemon, a premium item or a relic.',
  T3: 'Above what any other node pays, and relic-gated without exception.',
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
 * ## Rewritten to section 4 by M5.6, after being moved unchanged by the split
 *
 * The split itself changed nothing: every string was the one that had been in
 * the table, to the character, so that diff was one nobody had to read for
 * meaning. **M5.6 is the item that changed them**, and it changed nearly all
 * of them.
 *
 * Design bible section 4's event row now reads **59** against a composition
 * that names every part of the screen — *hook 12, four labels 4, four hints 6,
 * the Toll's price 5, the control 2* — which is D33, ruled option 1 on
 * 2026-09-22. The old row was 40 and composed itself as 54, and all
 * twenty-four events failed it by a median of twenty-seven words.
 *
 * So the shape below is deliberate and is not terseness for its own sake. A
 * hook is one sentence and at most twelve words. A label is an imperative of
 * at most four. **A hint is at most six words and reads as a fragment**, which
 * is what six words buys: it names the shape of the risk and stops, and never
 * names the drawn outcome, because the pools decide that and this file cannot
 * see it. `test/event-budget.test.ts` holds every one of those numbers, per
 * event, and `test/event-copy.test.ts` holds what the words may say.
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
  'marsh-leech-bed': 'A leech bed, and something under it.',
  'badlands-magma-vent': 'A magma vent with a spring running above it.',
  'badlands-shattered-mesa': 'A shattered mesa with a seam running right through it.',
  'badlands-thermal-updraft': 'A thermal updraft, and a ridge on the far side of it.',
};

/** The four button labels per event, in archetype order. */
export const EVENT_LABELS: Readonly<Record<string, ArchetypeCopy>> = {
  'cave-collapsed-shaft': { safe: 'Take what is loose', gamble: 'Shift the rubble', toll: 'Take the weight', attune: 'Lift the beam clear' },
  'cave-lightless-gallery': { safe: 'Feel along the wall', gamble: 'Walk it blind', toll: 'Trade for a lamp', attune: 'Light the whole gallery' },
  'cave-fossil-seam': { safe: 'Pocket the chips', gamble: 'Lever it out', toll: 'Hire the crew back', attune: 'Break the seam open' },
  'shore-seabed-crate': { safe: 'Wait for the tide', gamble: 'Hold your breath', toll: 'Everyone hauls', attune: 'Open it down there' },
  'shore-riptide-channel': { safe: 'Walk the long way', gamble: 'Wade the narrows', toll: 'Carry a line over', attune: 'Swim it' },
  'shore-beached-trawler': { safe: 'Search the deck', gamble: 'Force the hatch', toll: 'Trade the salvager', attune: 'Pull the hatch off' },
  'summit-wind-shear-ledge': { safe: 'Turn back', gamble: 'Jump it', toll: 'Rope across together', attune: 'Fly the gap' },
  'summit-sealed-cairn': { safe: 'Leave an offering', gamble: 'Pull it apart', toll: 'Pay the keeper', attune: 'Break the seal stone' },
  'summit-ice-cache': { safe: 'Chip at the edges', gamble: 'Kick it free', toll: 'Trade for a pick', attune: 'Haul it out whole' },
  'city-derelict-substation': { safe: 'Strip the outside boxes', gamble: 'Go past the fence', toll: 'Earth it by hand', attune: 'Read the panel lit' },
  'city-flooded-underpass': { safe: 'Go around the block', gamble: 'Wade the underpass', toll: 'Pay for the boat', attune: 'Climb the outflow' },
  'city-stranded-courier': { safe: 'Shout directions up', gamble: 'Climb the drainpipe', toll: 'Trade her for it', attune: 'Bring her down' },
  'forest-thornwall': { safe: 'Take the long detour', gamble: 'Push straight through', toll: 'Send your lead in', attune: 'Cut the wall down' },
  'forest-sap-still': { safe: 'Fill one jar', gamble: 'Run it dry', toll: 'Buy the tapper\'s stock', attune: 'Tap a fresh tree' },
  'forest-fallen-giant': { safe: 'Cross and keep going', gamble: 'Reach into the hollow', toll: 'Clear the nest out', attune: 'Roll the trunk over' },
  'ruins-sealed-antechamber': { safe: 'Read the carvings', gamble: 'Go in blind', toll: 'Burn what you carry', attune: 'Light the chamber' },
  'ruins-root-choked-stair': { safe: 'Take the top landing', gamble: 'Force your way down', toll: 'Trade for a blade', attune: 'Clear the stair' },
  'ruins-reliquary-font': { safe: 'Fill a flask', gamble: 'Reach into the basin', toll: 'Pay to still it', attune: 'Climb the inflow' },
  'marsh-drowned-causeway': { safe: 'Follow the markers back', gamble: 'Wade past the last', toll: 'Send your lead ahead', attune: 'Swim the span' },
  'marsh-sinkhole-pool': { safe: 'Fish from the rim', gamble: 'Drop in and grab', toll: 'Drag it with nets', attune: 'Go to the bottom' },
  'marsh-leech-bed': { safe: 'Skim the edge', gamble: 'Wade in and feel', toll: 'Trade for waders', attune: 'Go under the bed' },
  'badlands-magma-vent': { safe: 'Work the cooled crust', gamble: 'Cross it while quiet', toll: 'Douse the vent', attune: 'Climb the spring' },
  'badlands-shattered-mesa': { safe: 'Collect from the scree', gamble: 'Climb into the seam', toll: 'Wedge it open', attune: 'Split the mesa' },
  'badlands-thermal-updraft': { safe: 'Wait it out below', gamble: 'Ride the edge', toll: 'Pay the balloonist', attune: 'Take the updraft' },
};

/**
 * What the player is told *before* pressing each button.
 *
 * Never names the drawn outcome — that would make the choice a formality — but
 * it is honest about the shape of the risk. "Might be a trap" is a decision;
 * saying nothing at all is a coin flip with extra steps.
 */
export const EVENT_HINTS: Readonly<Record<string, ArchetypeCopy>> = {
  'cave-collapsed-shaft': { safe: 'Already fallen free. Nothing moves.', gamble: 'The pile holds itself up.', toll: 'Someone holds while the rest dig.', attune: 'One movement, and the shaft opens.' },
  'cave-lightless-gallery': { safe: 'The wall leads somewhere. Slowly.', gamble: 'The echoes say the floor ends.', toll: 'The miner wants paying first.', attune: 'Lit end to end. A room.' },
  'cave-fossil-seam': { safe: 'Loose fragments at the seam foot.', gamble: 'Whole, or else in pieces.', toll: 'Nobody paid them. That is fixable.', attune: 'It splits along the grain.' },
  'shore-seabed-crate': { safe: 'The tide brings up something else.', gamble: 'One breath deeper than one allows.', toll: 'Rope, four shoulders, a cold afternoon.', attune: 'No rope. You work that depth.' },
  'shore-riptide-channel': { safe: 'Hours added, and someone met.', gamble: 'Narrow because the water is fast.', toll: 'One of you fights the current.', attune: 'A crossing, not an obstacle.' },
  'shore-beached-trawler': { safe: 'Picked over. Not completely.', gamble: 'Jammed for a reason nobody wrote.', toll: 'He wants something from your bag.', attune: 'A hinge and a weight.' },
  'summit-wind-shear-ledge': { safe: 'A cache on the way down.', gamble: 'A long step. The wind decides.', toll: 'The line costs skin, everyone\'s.', attune: 'The shear is lift, not gap.' },
  'summit-sealed-cairn': { safe: 'You add, and something is left.', gamble: 'Coming apart is the easy part.', toll: 'He opens it, price named first.', attune: 'One stone holds the rest.' },
  'summit-ice-cache': { safe: 'The edges give. The face holds.', gamble: 'Ice holds cache, cache holds ice.', toll: 'The guide lends, and says nothing.', attune: 'The block comes away intact.' },
  'city-derelict-substation': { safe: 'Dead boxes, parts still in them.', gamble: 'Something in there is live.', toll: 'Grounding means touching. Everyone feels it.', attune: 'Lit, the live bus is labelled.' },
  'city-flooded-underpass': { safe: 'Longer, drier, a shopfront open.', gamble: 'Moving faster than its depth suggests.', toll: 'A punt, and a price kept.', attune: 'It goes the way you want.' },
  'city-stranded-courier': { safe: 'She finds her own way, eventually.', gamble: 'Four storeys of somebody else\'s maintenance.', toll: 'She swaps for something you carry.', attune: 'One trip, package and courier.' },
  'forest-thornwall': { safe: 'Slow, and it passes a grove.', gamble: 'Thorn that thick hides its depth.', toll: 'One goes in, makes a gap.', attune: 'Down in a single pass.' },
  'forest-sap-still': { safe: 'One jar, from the collector.', gamble: 'Unattended for a while now.', toll: 'He sells what he drew.', attune: 'A clean cut runs at once.' },
  'forest-fallen-giant': { safe: 'A bridge. Using it costs nothing.', gamble: 'Whatever nests there, nests there.', toll: 'Everyone gets bitten at least once.', attune: 'The underside has not been touched.' },
  'ruins-sealed-antechamber': { safe: 'The outside of the story pays.', gamble: 'The floor beyond is unsurveyed.', toll: 'A fire burns more than fuel.', attune: 'Lit, a room with a floor.' },
  'ruins-root-choked-stair': { safe: 'Reachable, and not yet emptied.', gamble: 'The roots hold the stair together.', toll: 'The digger has one, and appetite.', attune: 'Open the whole way down.' },
  'ruins-reliquary-font': { safe: 'The lip gives a flask up.', gamble: 'Deeper than the font is wide.', toll: 'The attendant can stop the flow.', attune: 'Water running upward is a climb.' },
  'marsh-drowned-causeway': { safe: 'They lead to somebody\'s cache.', gamble: 'Past the markers it may end.', toll: 'Someone finds the drop-offs first.', attune: 'Water, and water is crossable.' },
  'marsh-sinkhole-pool': { safe: 'A line brings something up.', gamble: 'Clear to the bottom, and deep.', toll: 'Every pair of hands, then cramp.', attune: 'Down there it has a floor.' },
  'marsh-leech-bed': { safe: 'Shallow, thin of leeches and everything.', gamble: 'Whatever is under stays under.', toll: 'The trapper lends, for something carried.', attune: 'From below it is a ceiling.' },
  'badlands-magma-vent': { safe: 'Cool at the edge, and holding.', gamble: 'Quiet a while. That is all.', toll: 'Close enough to douse it.', attune: 'It falls past, and climbs.' },
  'badlands-shattered-mesa': { safe: 'What fell out of the seam.', gamble: 'A gap between two moving things.', toll: 'Holding it means being there.', attune: 'It opens, and it stays open.' },
  'badlands-thermal-updraft': { safe: 'Still air, and somebody camped.', gamble: 'Where air stops agreeing with itself.', toll: 'He crosses daily, charges by crossing.', attune: 'Up, then across the ridge.' },
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
