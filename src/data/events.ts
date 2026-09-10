/**
 * Events: a prompt, two or three choices, and what each one costs or pays.
 *
 * **Outcomes are a declarative typed union, never a callback.** That is the
 * load-bearing constraint in this file and it is worth stating before the data:
 *
 *   - A run log has to be able to *serialize* what happened, and a function is
 *     not serializable. An event whose outcome was `(state) => ...` would be
 *     replayable only as "choice 1 was taken", with the effect reconstructed by
 *     re-running code that may since have changed.
 *   - The balance simulator has to be able to **score** an option without
 *     executing it. A policy that had to run an arbitrary function to find out
 *     what a choice does could not compare two choices, and the report's event
 *     numbers would be a measurement of a bot picking at random.
 *
 * So an outcome is data: a kind and a number. `core/events.ts` interprets it,
 * and it is the only thing that may.
 *
 * ## The coin is flipped when the map is built
 *
 * A choice carries *weighted* outcomes, and exactly one of them is drawn from
 * the `rewards` stream at map generation. An event that reads "50/50" to the
 * player has already resolved by the time they see it — so reloading a save
 * cannot reroll it, and two players on the same seed who make the same choice
 * get the same result. The uncertainty is real for the player and settled for
 * the run, which is the only version of "random" a seeded game can honestly
 * offer.
 */

import type { Capability } from './capabilities';
import { BERRIES } from './items';

/**
 * What an outcome does, before its randomised parts are drawn.
 *
 * `item` carries a *pool* here and a concrete id on the resolved instance; that
 * is the same template-then-resolve split `data/rewardPools.ts` uses, and for
 * the same reason — the contents stay in data, the draw stays in core.
 */
export type EventOutcomeTemplate =
  | { kind: 'currency'; amount: number }
  /** Percent of max HP taken off the party. Cannot faint; see `eventDamageFloor`. */
  | { kind: 'damage'; percent: number }
  /** Percent of max HP and PP restored. */
  | { kind: 'heal'; percent: number }
  /** One item, drawn from this pool of ids. */
  | { kind: 'item'; pool: readonly string[] }
  /**
   * A Pokemon on the table, take it or leave it.
   *
   * Carries no data: the spec is drawn at map generation, on the node's own
   * `capture` sub-stream, and lands on the resolved `EventOutcome`. There is
   * nothing here to tune because there is nothing here to choose — an event
   * that offers a Pokemon offers whatever that node's segment would have
   * produced.
   */
  | { kind: 'acquisition' }
  | { kind: 'nothing' };

/**
 * The outcome sets a choice carries, one per capability band.
 *
 * **All three are drawn at map generation and one is selected at resolution.**
 * That ordering is the rule the whole feature rests on: if the band were
 * consulted before drawing, RNG consumption would depend on the party, and a
 * seed would stop describing one run. Two runs on the same seed with
 * deliberately different parties draw byte-identically and differ only in
 * which of the three already-drawn outcomes is used.
 *
 * The bands escalate, and the escalation is the design:
 *
 * - `none` — a minor payout. The event still resolves and still pays. A player
 *   with nothing is unrewarded, not punished.
 * - `latent` — a real payout. The party can improvise the job.
 * - `known` — the encounter. A Pokemon, and an item that arrives whether or not
 *   the Pokemon is taken.
 */
export interface BandedOutcomes {
  none: readonly WeightedOutcome[];
  latent: readonly WeightedOutcome[];
  known: readonly WeightedOutcome[];
}

export type WeightedOutcome = { weight: number; outcome: EventOutcomeTemplate };

/** One thing the player can do, and the outcomes it may produce. */
export interface EventChoiceDefinition {
  /** The button. */
  label: string;
  /**
   * What the player is told *before* picking.
   *
   * Never names the drawn outcome — that would make the choice a formality —
   * but it must be honest about the shape of the risk. "Might be a trap" is a
   * decision; saying nothing at all is a coin flip with extra steps.
   */
  hint: string;
  /**
   * The `latent` payout: weighted, exactly one drawn at map generation.
   *
   * Named `outcomes` rather than `latent` because it is the set every event in
   * this file was authored against, and `latent` is the band a party lands on
   * most often. The other two bands are derived from the shared tables below
   * rather than written per choice — see `bandsFor`.
   */
  outcomes: readonly WeightedOutcome[];
}

export interface EventDefinition {
  id: string;
  prompt: string;
  /**
   * The one capability this event's payout scales with.
   *
   * Exactly one, never a set: a gate the player has to satisfy two ways is a
   * gate they cannot read off the map, and the map shows the requirement.
   *
   * **How often each capability appears here is the tuning lever for the
   * common-type skew.** Water and Flying are common types, so `surf`, `dive`,
   * `waterfall` and `fly` resolve at `latent` more often than `flash` or
   * `cut` do. That is corrected by how many events name each capability, not
   * by narrowing the type sets in `data/capabilities.ts` — narrowing those
   * would make them say something false about the games to fix a problem that
   * belongs to this table. The simulator reports a per-capability `latent`
   * rate, which is the measurement this weighting is set from.
   */
  requires: Capability;
  /** Two or three. One choice is not an event, it is a cutscene. */
  choices: readonly EventChoiceDefinition[];
}

/**
 * The `none` payout, shared by every event.
 *
 * Small, and never nothing. An event a player cannot answer still pays,
 * because the alternative is a node that punishes a run for a routing decision
 * it made four segments ago and cannot now undo.
 */
const BERRY_POOL: readonly string[] = BERRIES.map((berry) => berry.id);

const BAND_NONE: readonly WeightedOutcome[] = [
  { weight: 4, outcome: { kind: 'item', pool: BERRY_POOL } },
  { weight: 3, outcome: { kind: 'heal', percent: 0.15 } },
  { weight: 3, outcome: { kind: 'currency', amount: 18 } },
];

/**
 * The `known` payout, shared by every event.
 *
 * The encounter mechanism built in Stage 4.6c step 2's predecessor: a Pokemon
 * offered with no fight in front of it. The item that comes with it is granted
 * separately and unconditionally — `core/events.ts` says why declining still
 * yields it.
 */
const BAND_KNOWN: readonly WeightedOutcome[] = [{ weight: 1, outcome: { kind: 'acquisition' } }];

/** The three outcome sets for one choice. Two are shared; `latent` is authored. */
export function bandsFor(choice: EventChoiceDefinition): BandedOutcomes {
  return { none: BAND_NONE, latent: choice.outcomes, known: BAND_KNOWN };
}

/** Shorthand for a choice whose outcome is certain. */
function certain(outcome: EventOutcomeTemplate): { weight: number; outcome: EventOutcomeTemplate }[] {
  return [{ weight: 1, outcome }];
}

const TRINKETS: readonly string[] = ['silkscarf', 'charcoal', 'mysticwater', 'miracleseed', 'magnet'];
const REAL_ITEMS: readonly string[] = ['leftovers', 'shellbell', 'muscleband', 'wiseglasses', 'expertbelt'];

/**
 * The events, in a fixed order.
 *
 * The order is a **draw order** — generation picks an index into this list — so
 * appending is safe and inserting reshuffles what every recorded seed produces.
 *
 * Every event follows one rule: **each choice is the right answer to some
 * state.** A choice that is never correct is a button nobody should press, and
 * a choice that is always correct makes the other one decoration. So the
 * recurring shape is a gamble against a certainty, and which one is right
 * depends on how much HP and how much money the player is carrying — the two
 * things the map screen already shows them.
 */
export const EVENTS: readonly EventDefinition[] = [
  {
    id: 'abandoned-ball',
    requires: 'flash',
    prompt: 'A dented Poke Ball sits in the long grass. Something is rattling inside it.',
    choices: [
      {
        label: 'Open it',
        hint: 'Could be anything. Could be something that bites.',
        outcomes: [
          { weight: 5, outcome: { kind: 'item', pool: REAL_ITEMS } },
          { weight: 3, outcome: { kind: 'damage', percent: 0.18 } },
          { weight: 2, outcome: { kind: 'nothing' } },
        ],
      },
      {
        label: 'Sell it unopened',
        hint: 'A collector down the road pays for these. Not much, but reliably.',
        outcomes: certain({ kind: 'currency', amount: 45 }),
      },
    ],
  },
  {
    id: 'roadside-berries',
    requires: 'cut',
    prompt: 'Berries, heavy on the branch. You do not recognise the variety.',
    choices: [
      {
        label: 'Eat them',
        hint: 'Most berries are food. Most.',
        outcomes: [
          { weight: 6, outcome: { kind: 'heal', percent: 0.45 } },
          { weight: 4, outcome: { kind: 'damage', percent: 0.12 } },
        ],
      },
      {
        label: 'Bag them for market',
        hint: 'Someone will buy them. Whatever they are.',
        outcomes: certain({ kind: 'currency', amount: 35 }),
      },
    ],
  },
  {
    id: 'toll-bridge',
    requires: 'surf',
    prompt: 'A gatekeeper wants payment to cross. The river looks shallow enough.',
    choices: [
      {
        label: 'Pay the toll',
        hint: 'He waves you through and throws in something from his pack.',
        outcomes: [
          { weight: 1, outcome: { kind: 'currency', amount: -30 } },
          { weight: 1, outcome: { kind: 'item', pool: TRINKETS } },
        ],
      },
      {
        label: 'Wade across',
        hint: 'Free. Cold, fast, and further than it looks.',
        outcomes: [
          { weight: 6, outcome: { kind: 'nothing' } },
          { weight: 4, outcome: { kind: 'damage', percent: 0.15 } },
        ],
      },
    ],
  },
  {
    id: 'old-trainer',
    requires: 'strength',
    prompt: 'An old trainer offers to run drills with you. She does not offer to go easy.',
    choices: [
      {
        label: 'Spar with her',
        hint: 'It will hurt. She has been doing this longer than you have been alive.',
        outcomes: [
          { weight: 6, outcome: { kind: 'item', pool: REAL_ITEMS } },
          { weight: 4, outcome: { kind: 'damage', percent: 0.22 } },
        ],
      },
      {
        label: 'Just talk',
        hint: 'She tells you where the good routes are. Nothing you can hold.',
        outcomes: certain({ kind: 'nothing' }),
      },
      {
        label: 'Buy her lunch',
        hint: 'Costs a little. She insists on paying you back in kind.',
        outcomes: [
          { weight: 5, outcome: { kind: 'heal', percent: 0.6 } },
          { weight: 5, outcome: { kind: 'currency', amount: -25 } },
        ],
      },
    ],
  },
  {
    id: 'hot-spring',
    requires: 'dive',
    prompt: 'Steam rises off a pool tucked into the rocks. It smells strongly of sulphur.',
    choices: [
      {
        label: 'Soak',
        hint: 'Warm. Restorative, probably.',
        outcomes: [
          { weight: 7, outcome: { kind: 'heal', percent: 0.7 } },
          { weight: 3, outcome: { kind: 'damage', percent: 0.1 } },
        ],
      },
      {
        label: 'Bottle the water',
        hint: 'Tourists pay for this. You will not get to use it yourself.',
        outcomes: certain({ kind: 'currency', amount: 55 }),
      },
    ],
  },
  {
    id: 'card-sharp',
    requires: 'fly',
    prompt: 'A man with a folding table wants to bet you on which cup the coin is under.',
    choices: [
      {
        label: 'Play a round',
        hint: 'He is very good at this. So is everyone who owns a folding table.',
        outcomes: [
          { weight: 4, outcome: { kind: 'currency', amount: 90 } },
          { weight: 6, outcome: { kind: 'currency', amount: -60 } },
        ],
      },
      {
        label: 'Walk on',
        hint: 'Nothing gained, nothing lost, no folding table involved.',
        outcomes: certain({ kind: 'nothing' }),
      },
    ],
  },
  {
    id: 'storm-shelter',
    requires: 'rockSmash',
    prompt: 'The sky opens. There is a cave, and there is a longer road around it.',
    choices: [
      {
        label: 'Shelter in the cave',
        hint: 'Dry. Occupied, possibly.',
        outcomes: [
          { weight: 5, outcome: { kind: 'heal', percent: 0.5 } },
          { weight: 3, outcome: { kind: 'damage', percent: 0.16 } },
          { weight: 2, outcome: { kind: 'item', pool: TRINKETS } },
        ],
      },
      {
        label: 'Push through the rain',
        hint: 'You arrive soaked and behind schedule, but you arrive.',
        outcomes: [
          { weight: 7, outcome: { kind: 'damage', percent: 0.08 } },
          { weight: 3, outcome: { kind: 'currency', amount: 40 } },
        ],
      },
    ],
  },
  {
    id: 'scrap-heap',
    requires: 'waterfall',
    prompt: 'A heap of discarded trainer gear behind a gym. Most of it is junk.',
    choices: [
      {
        label: 'Dig through it',
        hint: 'Sharp edges and rust. Something in there still works.',
        outcomes: [
          { weight: 5, outcome: { kind: 'item', pool: TRINKETS } },
          { weight: 3, outcome: { kind: 'damage', percent: 0.1 } },
          { weight: 2, outcome: { kind: 'item', pool: REAL_ITEMS } },
        ],
      },
      {
        label: 'Sell the scrap by weight',
        hint: 'A guaranteed, unglamorous handful of coins.',
        outcomes: certain({ kind: 'currency', amount: 50 }),
      },
    ],
  },
];

const BY_ID = new Map(EVENTS.map((event) => [event.id, event]));

export function eventById(id: string): EventDefinition | null {
  return BY_ID.get(id) ?? null;
}
