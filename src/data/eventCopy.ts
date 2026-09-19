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

/**
 * What the button says when the run cannot pay the price on it.
 *
 * **An attribute, not a verdict.** It states a fact about the bag standing
 * beside a price standing on the button — the player can read both and see
 * the arithmetic — and it says nothing about whether taking the option would
 * have been a good idea. The chip beside it still names the price, so the
 * sentence the player assembles is "costs a berry, cannot pay", which is what
 * tells them to go and find a berry.
 *
 * Present tense, and about the run rather than about the option: the option is
 * not broken and is not locked, the bag is empty. A Toll the run cannot afford
 * today is one it can afford after the next node.
 */
export const PRICE_UNPAYABLE = 'Cannot pay';

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
