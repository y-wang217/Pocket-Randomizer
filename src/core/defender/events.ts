/**
 * A defender question mark, drawn and read. **Defender Mode, 2026-10-06.**
 *
 * The attacker's event (`core/events.ts`) is four archetypes, three capability
 * bands and four tiers, sixteen outcomes per button. A defender run has no
 * capabilities and the design message asks for *variety of shape*, so this is
 * its own, smaller instance: a shape, an identity, and each option drawn once.
 * It reuses the attacker's atoms, `EventEffect` resolved through the same
 * resolver into the same `EventOutcome`, applied by the same fold, so a heal,
 * an item or a relic means one thing in both modes.
 *
 * ## Everything is drawn at generation
 *
 * Per option, in option order: its cost, its grant, its loss, then the
 * wager's roll. Every option of every event is drawn whatever the run looks
 * like, and reading an outcome draws nothing. The shape and the identity are
 * drawn on the rank's `map` key; the options on the node's own `rewards` key
 * (`defenderNodeRewardKey(id, 'event')`), a purpose nothing else reads.
 *
 * ## What a pick means
 *
 * `applyDefenderEventPick` is the fold: the price first (`applyToll`, the
 * attacker's), then the outcome the role and the result name: a `fight`'s on
 * a win and nothing on a loss, a `wager`'s on its drawn roll, every other
 * role's outright. The pick is logged as an index (`eventPick`), stable
 * because the menu never shrinks: a `pay` the run cannot afford stays on it,
 * dimmed, by the Prices rule.
 */
import { DEFENDER_RELIC_IDS } from '../../data/defender';
import {
  DEFENDER_AMBUSH,
  DEFENDER_EVENT_SHAPES,
  defenderEventShapeWeights,
  defenderEventsOf,
  type DefenderEventDef,
  type DefenderEventShape,
  type DefenderOptionRole,
} from '../../data/defenderEvents';
import type { OutcomeTier } from '../../data/eventPools';
import type { TollPrice } from '../../data/events';
import type { NodeKind, Tuning } from '../../data/tuning';
import type { NodeSpec } from '../encounters';
import { applyEventOutcome, applyToll, pricePayable, resolveEffects, weightedPick, type EventOutcome } from '../events';
import type { RngStream } from '../rng';
import type { RunState } from '../run';
import type { Tier } from '../types';

export interface DefenderEventOptionInstance {
  role: DefenderOptionRole;
  /** The pips the button wears; null wears none. */
  tier: OutcomeTier | null;
  /** The stated price, on `pay` and nowhere else. */
  toll: TollPrice | null;
  /** The chance shown on a `wager`, 0 to 1. */
  odds: number | null;
  /** What it pays: outright, on a win, or on the wager's roll. */
  outcome: EventOutcome;
  /** What a lost wager takes, as that outcome's cost. */
  lose: EventOutcome | null;
  /** The wager's roll, made at generation. */
  won: boolean | null;
}

/** A question mark as it exists on a generated map. */
export interface DefenderEventInstance {
  nodeId: string;
  eventId: string;
  shape: DefenderEventShape;
  /** In button order. Empty on a bazaar, which asks nothing. */
  options: readonly DefenderEventOptionInstance[];
}

/**
 * Draws each question mark's identity, without repeats inside a run.
 *
 * One picker per run, handed to every rank's `generateRank`, so the state is
 * a function of generation order and never of where the player walked. An
 * event is eligible by shape and rank; when every eligible one has been used
 * the list refills, and `refills` counts how often, the number that says the
 * table is too small.
 */
export class DefenderEventPicker {
  private readonly used = new Set<string>();
  refills = 0;

  /** Exactly one draw. */
  pick(shape: DefenderEventShape, rank: number, stream: RngStream): DefenderEventDef {
    const eligible = defenderEventsOf(shape, rank);
    if (eligible.length === 0) throw new Error(`No ${shape} event is eligible at rank ${rank}`);
    let fresh: readonly DefenderEventDef[] = eligible.filter((event) => !this.used.has(event.id));
    if (fresh.length === 0) {
      this.refills += 1;
      fresh = eligible;
    }
    const chosen = stream.pick(fresh);
    this.used.add(chosen.id);
    return chosen;
  }
}

/** One weighted draw over the shapes at `rank`. Exactly one draw, always. */
export function drawDefenderEventShape(rank: number, stream: RngStream): DefenderEventShape {
  const weights = defenderEventShapeWeights(rank);
  return weightedPick(
    DEFENDER_EVENT_SHAPES.map((shape) => ({ weight: weights[shape], value: shape })),
    stream,
    'dilemma',
  );
}

/**
 * Build one question mark from its definition: every option fully drawn.
 * Takes no run, no party and no relics, by signature.
 */
export function generateDefenderEvent(nodeId: string, rank: number, definition: DefenderEventDef, stream: RngStream): DefenderEventInstance {
  const options = definition.options.map((option, index): DefenderEventOptionInstance => {
    const tier = option.tier ?? 'T1';
    const cost = resolveEffects(option.cost ?? [], rank, stream, DEFENDER_RELIC_IDS);
    const grant = resolveEffects(option.grant, rank, stream, DEFENDER_RELIC_IDS);
    const lose = option.lose ? resolveEffects(option.lose, rank, stream, DEFENDER_RELIC_IDS) : null;
    const won = option.odds === undefined ? null : stream.nextFloat() < option.odds;
    return {
      role: option.role,
      tier: option.tier,
      toll: option.toll ?? null,
      odds: option.odds ?? null,
      outcome: { tier, entryId: `${definition.id}/${index}`, cost, grant },
      lose: lose ? { tier, entryId: `${definition.id}/${index}/lose`, cost: lose, grant: [] } : null,
      won,
    };
  });
  return { nodeId, eventId: definition.id, shape: definition.shape, options };
}

/** Whether this button can be pressed. Everything but an unaffordable `pay` can. */
export function defenderOptionPayable(state: RunState, option: DefenderEventOptionInstance): boolean {
  return option.toll === null || pricePayable(state, option.toll);
}

/**
 * The outcome a pressed option pays, given how the node went, or null for a
 * fight that was lost. **The single reader**, for the fold and the screens.
 */
export function defenderOutcomeOf(option: DefenderEventOptionInstance, won: boolean): EventOutcome | null {
  switch (option.role) {
    case 'fight':
      return won ? option.outcome : null;
    case 'wager':
      return option.won ? option.outcome : option.lose;
    default:
      return option.outcome;
  }
}

/** Fold a pick into the run: the price, then what the role pays. Draws nothing. */
export function applyDefenderEventPick(state: RunState, event: DefenderEventInstance, index: number, won: boolean, tuning: Tuning): RunState {
  const option = event.options[index];
  if (!option) throw new RangeError(`Event option ${index} is not on ${event.eventId} (${event.options.length} offered)`);
  const priced = option.toll ? applyToll(state, option.toll, tuning) : state;
  const outcome = defenderOutcomeOf(option, won);
  return outcome ? applyEventOutcome(priced, outcome, tuning) : priced;
}

/**
 * The tier a node's fight plays at: an ambush reads it from the shape, since
 * its `tier` stays null so the map shows the question mark alone.
 */
export function fightTierOf(node: NodeSpec): Tier | null {
  return node.defenderEvent?.shape === 'ambush' ? DEFENDER_AMBUSH.tier : node.tier;
}

/** The kind a node's fight is judged as: an ambush fights as a trainer. */
export function fightKindOf(node: NodeSpec): NodeKind {
  return node.defenderEvent?.shape === 'ambush' ? 'trainer' : node.kind;
}
