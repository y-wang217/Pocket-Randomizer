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
export const BAND_LABELS: Readonly<Record<CapabilityBand, string>> = {
  known: 'you have the relic',
  latent: 'your party has the type',
  none: 'neither',
};

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
