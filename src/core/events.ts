/**
 * Events: resolving one when the map is built, and applying it when the player
 * picks.
 *
 * Pure, explicit `Rng`, same contract as `randomizer.ts` and `rewards.ts`.
 *
 * ## The coin is already flipped
 *
 * A choice in `data/events.ts` carries *weighted* outcomes; an `EventInstance`
 * carries exactly one per choice, drawn from the `rewards` stream at map
 * generation. So an event that reads "might be a trap" to the player has
 * already resolved before they see it.
 *
 * That is not a hedge, it is the only version of randomness a seeded game can
 * honestly offer. Resolving at pick time would mean a save reloaded before the
 * choice could reroll a bad outcome, and two players on the same seed making
 * the same decision would get different runs — which is precisely the promise
 * the seed exists to make.
 *
 * ## Outcomes are data
 *
 * `EventOutcome` is a typed union of kinds and numbers, never a callback, and
 * `apply` below is the only thing that interprets it. Two reasons, both in the
 * spec: an outcome must serialize into the run log, and the balance simulator
 * must be able to *score* a choice without executing arbitrary code — a policy
 * that had to run a function to find out what a button does could not compare
 * two buttons, and the report's event numbers would be measuring a coin toss.
 */
import type { AcquisitionOffer } from './acquisition';
import { stow } from './items';
import { recoverParty } from './party';
import type { RngStream } from './rng';
import type { RunState } from './run';
import { hpEventDelta } from './hpCopy';
import { itemById } from '../data/items';
import { EVENTS, type EventDefinition, type EventOutcomeTemplate } from '../data/events';
import type { Tuning } from '../data/tuning';

/**
 * A resolved outcome: what actually happens, with every draw already made.
 *
 * The `item` pool of the template has collapsed to one id. Everything here is
 * a plain value, so a `JSON.stringify` of a run's events is a complete record.
 */
export type EventOutcome =
  | { kind: 'currency'; amount: number }
  | { kind: 'damage'; percent: number }
  | { kind: 'heal'; percent: number }
  | { kind: 'item'; item: string }
  /**
   * A Pokemon offered with no fight in front of it.
   *
   * The offer is a complete `AcquisitionOffer`, drawn at map generation like
   * every other outcome, and it is handled by the run's **existing** capture
   * step rather than by `applyEventOutcome` below. That is the whole design:
   * `playRun` already asks `chooseAcquisition` once per node, after the event
   * decision and before `resolveNode`, so an event-sourced offer reaches it by
   * being visible to `acquisitionOffered` — not by opening a second path
   * through which a node can complete.
   */
  | { kind: 'acquisition'; offer: AcquisitionOffer }
  | { kind: 'nothing' };

/** One button on the event screen, with the outcome it is already bound to. */
export interface EventChoice {
  label: string;
  /** Shown before picking. Says the shape of the risk, never the drawn outcome. */
  hint: string;
  outcome: EventOutcome;
}

/** An event as it exists on a generated map. */
export interface EventInstance {
  nodeId: string;
  eventId: string;
  prompt: string;
  choices: EventChoice[];
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------

/**
 * Pick an event and resolve one outcome per choice.
 *
 * The draw count is a function of the chosen event's shape — one draw for the
 * event, then one per choice, plus one per `item` outcome that needs a pool
 * resolved. That does depend on what was drawn, which is the pattern this
 * codebase otherwise avoids... and it is safe here for a reason worth naming:
 * this is the **last** consumer of the `rewards` stream for a node, and nodes
 * are generated in a fixed index order, so a variable draw count inside one
 * node shifts only that node's successors — which is exactly what any change to
 * the event table would do anyway. What it must never do is shift `map`,
 * `randomizer` or `battle`, and it cannot: it never touches them.
 */
export function generateEvent(
  nodeId: string,
  stream: RngStream,
  tuning: Tuning,
  offerPokemon: () => AcquisitionOffer | null = () => null,
): EventInstance {
  void tuning;
  const definition = stream.pick(EVENTS);

  return {
    nodeId,
    eventId: definition.id,
    prompt: definition.prompt,
    choices: definition.choices.map((choice) => ({
      label: choice.label,
      hint: choice.hint,
      outcome: resolveOutcome(drawOutcome(choice.outcomes, stream), stream, offerPokemon),
    })),
  };
}

/** Weighted pick of one outcome template. Exactly one draw, always. */
function drawOutcome(
  outcomes: readonly { weight: number; outcome: EventOutcomeTemplate }[],
  stream: RngStream,
): EventOutcomeTemplate {
  const total = outcomes.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let roll = stream.nextFloat() * Math.max(total, Number.EPSILON);
  for (const entry of outcomes) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry.outcome;
  }
  return outcomes[outcomes.length - 1]?.outcome ?? { kind: 'nothing' };
}

/**
 * Collapse a template's remaining randomness.
 *
 * `item` draws off the event's own stream, as it always has. `acquisition` does
 * **not**: `offerPokemon` draws off the node's `capture` sub-stream instead, so
 * adding or removing an acquisition outcome cannot shift a single one of this
 * event's other draws. That is the keyed-stream discipline paying for itself —
 * under the old sequential streams this outcome kind would have moved every
 * reward draw after it in the run.
 *
 * A null offer degrades to `nothing` rather than throwing, for the same reason
 * an empty item pool does: an event that cannot pay is a dull event, not a
 * broken run.
 */
function resolveOutcome(
  template: EventOutcomeTemplate,
  stream: RngStream,
  offerPokemon: () => AcquisitionOffer | null,
): EventOutcome {
  if (template.kind === 'acquisition') {
    const offer = offerPokemon();
    return offer ? { kind: 'acquisition', offer } : { kind: 'nothing' };
  }
  if (template.kind !== 'item') return template;
  const available = template.pool.filter((id) => itemById(id));
  if (available.length === 0) return { kind: 'nothing' };
  return { kind: 'item', item: stream.pick(available) };
}

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

/**
 * Fold a chosen event outcome into the run. The only interpreter of the union.
 *
 * Called from `resolveNode` *before* the wipe check, so the death rule sees
 * whatever an event did. In practice it can never trigger one — damage is
 * floored by `tuning.eventDamageFloor` — but the ordering means that stays true
 * because of the rule rather than because of the clamp, which is the version
 * that survives a future tuning pass.
 */
export function applyEventOutcome(state: RunState, outcome: EventOutcome, tuning: Tuning): RunState {
  switch (outcome.kind) {
    case 'nothing':
      return state;

    /*
     * Deliberately nothing, and this is the load-bearing line of the whole
     * mechanism.
     *
     * The party change for an accepted capture is `applyAcquisition`, called
     * once by `resolveNode` from `result.acquisition` — the same call that has
     * handled every wild capture since 4.6a. Folding a second party change in
     * here would mean an event-sourced Pokemon joined by a different code path
     * than a wild one, and the first divergence between the two would be
     * invisible. The offer travels; the application does not move.
     */
    case 'acquisition':
      return state;

    case 'currency':
      // Clamped at zero rather than refused: an event that charges more than
      // the player has takes what they have. A shop is a transaction the player
      // can decline; a toll they already walked into is not.
      return { ...state, currency: Math.max(0, state.currency + outcome.amount) };

    case 'heal':
      return { ...state, party: recoverParty(state.party, outcome.percent) };

    case 'damage':
      return { ...state, party: damageParty(state, outcome.percent, tuning) };

    case 'item':
      /*
       * Into the backpack, like every other item the run acquires.
       *
       * It used to go straight onto the lead, because there was nowhere else to
       * put it and no way to move it afterwards. That made an event item a
       * *worse* reward than an identical one from a card, since it silently
       * destroyed whatever the lead was holding — the Stage 3 swap rule firing
       * on a decision the player was never offered.
       */
      return { ...state, backpack: stow(state.backpack, outcome.item) };
  }
}

/**
 * Take a percentage of max HP off every party member, without fainting any.
 *
 * The floor is what makes an event unable to end a run. That is a design rule,
 * not a safety net: an event is a node with no battle in it, so a player who
 * lost a run to one lost it to a coin flip they could see but never play. The
 * risk an event carries is arriving at the *next* fight nearly dead, which is a
 * cost the player then gets to make decisions about.
 *
 * It also keeps the party in a coherent state. `isWiped` reads `fainted`, and
 * HP driven to zero without a faint would be a shape no other code expects.
 */
function damageParty(state: RunState, percent: number, tuning: Tuning): RunState['party'] {
  return state.party.map((member) => {
    if (member.fainted) return member;
    const floor = Math.max(1, Math.round(member.maxHp * tuning.eventDamageFloor));
    const hit = Math.round(member.maxHp * Math.max(0, percent));
    return { ...member, hp: Math.max(floor, member.hp - hit) };
  });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** A one-line label for an outcome, for the event screen and the report. */
export function describeOutcome(outcome: EventOutcome): string {
  switch (outcome.kind) {
    case 'currency':
      return outcome.amount >= 0 ? `+${outcome.amount} coins` : `${outcome.amount} coins`;
    // The one place a delta is the correct unit: an event label describes an
    // effect drawn at map generation, so there is no "after" to state yet.
    // `core/hpCopy.ts` says why, and owns the wording.
    case 'damage':
      return hpEventDelta(-outcome.percent);
    case 'heal':
      return hpEventDelta(outcome.percent);
    case 'item':
      return itemById(outcome.item)?.name ?? outcome.item;
    // The species and nothing else: what taking it costs is a party question,
    // and the capture card is where the party is on screen to answer it.
    case 'acquisition':
      return outcome.offer.spec.species;
    case 'nothing':
      return 'Nothing happens';
  }
}

/** The definition an instance came from, for tests and the report. */
export function definitionOf(instance: EventInstance): EventDefinition | null {
  return EVENTS.find((event) => event.id === instance.eventId) ?? null;
}
