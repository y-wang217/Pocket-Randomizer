/**
 * Acquiring Pokemon: one route, one decision.
 *
 * A run gains a party member by beating a wild Pokemon and keeping it. This
 * file is the decision: an offer, the three answers a player can give it, and
 * the rule that no answer can leave the party over `PARTY_SIZE`.
 *
 * ## There were two routes, and Stage 4.6b closed one
 *
 * A `species` reward card was the other. Stage 3 wrote it and gated it off at
 * `PARTY_SIZE` 1, where it was a forced swap of the run's only Pokemon rather
 * than an addition; Stage 4 turned it on once a swap cost a slot instead of the
 * whole run; and 4.6a made it redundant by guaranteeing a wild encounter per
 * segment and a capture on every wild victory.
 *
 * Two routes was two sets of rules for what a joined Pokemon is. The card
 * arrived below the level curve because a free Pokemon needed a price; a
 * capture arrives at the level it was fought at, because its price is the step
 * it occupied and the slot it takes. Explaining that difference on screen was
 * not possible, and the simulator's acquisition numbers were measuring the gap
 * between the routes rather than the decision.
 *
 * ## The one rule
 *
 * **Declining is always legal, and releasing is permanent.** There is no box
 * and no reserve. A box needs a screen, a capacity rule, and an answer to what
 * happens to it on a wipe, and none of those are interesting decisions — what
 * is interesting is being handed something good when you are full and having to
 * decide what it is worth. Making the release permanent is what gives that
 * question teeth.
 *
 * ## Determinism
 *
 * A reward-card offer is drawn at **map generation**, like every other payout
 * and for the same reason: what a node offers must not depend on how the battle
 * went, only on whether it was won.
 *
 * A wild node's offer is not drawn at all any more. **Stage 4.6a makes capture
 * guaranteed**, so the offer is a fact about the node rather than a roll about
 * it — see `generateEncounterAcquisition` for why a capture roll on a seeded
 * run is the one shape of randomness this design cannot defend.
 */
import { describeSpecCard } from './battle/driver';
import { createPartyMember } from './party';
import type { ItemId, PokemonSpec, PokemonState } from './types';
import { PARTY_SIZE, PARTY_TUNING } from '../data/partyTuning';
import { playerLevel } from '../data/scaling';
import type { Tuning } from '../data/tuning';

/** Where an offer came from. Display and metrics only; the decision is the same. */
export type AcquisitionSource = 'reward' | 'encounter';

/**
 * A Pokemon on the table, and what taking it would cost.
 *
 * The `spec` is fully resolved by the time an offer exists — level, ability and
 * moveset are all decided at map generation. That is what lets the run log
 * store a *decision* rather than a Pokemon: replaying the seed reconstructs the
 * offer, and a log naming the species would keep replaying happily after a pool
 * edit and hand the player a member their run never met.
 */
export interface AcquisitionOffer {
  /** The node that offers it, so a screen or a test can tie the two together. */
  nodeId: string;
  source: AcquisitionSource;
  spec: PokemonSpec;
}

/**
 * What the player did about an offer.
 *
 * Three answers, and `release` carries the slot because that is the part the
 * player chose. Stored in the run log verbatim: unlike a reward, this is not an
 * index into a generated list that replay can reconstruct — it is the input
 * itself, and there is nothing derived in it.
 */
export type AcquisitionDecision =
  | { kind: 'decline' }
  /** Take it into a free slot. Illegal at a full party. */
  | { kind: 'accept' }
  /** Take it and release the member in this slot. Illegal at anything else. */
  | { kind: 'release'; slot: number };

/** Whether the party has room without releasing anything. */
export function hasRoom(party: readonly PokemonState[]): boolean {
  return party.length < PARTY_SIZE;
}

/**
 * The level an acquired member arrives at.
 *
 * Below the segment's curve by `joinLevelOffset`, which is the cost of a free
 * Pokemon: at zero, taking one would be strictly better than declining and
 * there would be no decision in it. Floored at 1, and the party levels it to
 * the curve at the next gym like everything else — so the penalty is paid for
 * the remainder of the current segment and no longer.
 */
export function joinLevelFor(segment: number): number {
  return Math.max(1, playerLevel(segment) - PARTY_TUNING.joinLevelOffset);
}

/**
 * The offer a wild node makes. **Stage 4.6a: every wild node makes one.**
 *
 * Three things changed here and each is a rule rather than a number.
 *
 * **It is guaranteed rather than rolled, and it consumes no RNG.** A capture
 * roll on a seeded run is a punch with no counterplay: the player cannot see
 * it, change it or learn from it, and two players on one seed who both win the
 * same fight would get different parties for no reason either of them could
 * name. The cost of a catch already exists — 4.6a guarantees exactly one wild
 * encounter per segment and it occupies one of that segment's limited steps —
 * so the decision is "is this worth a slot", which is a decision, rather than
 * "did the seed feel like it", which is not. `data/rewardPools.ts` carries the
 * rate table that used to be here and why it went.
 *
 * **It arrives as it was fought.** Level, moveset, ability, gender and held
 * item are the ones the player just beat, where 4.5.1 re-levelled an encounter
 * offer down to `joinLevelFor(segment)`. The discount was the price of a free
 * Pokemon; the price is now the step and the slot, and a captured Pokemon that
 * was weaker than the one on the field is a readout the player cannot square
 * with what they just saw. Species *reward cards* still join at the discount —
 * they cost no step at all.
 *
 * **The species is the one just defeated, not a fresh roll.** Unchanged, and
 * still the point of this function: the team was generated by
 * `generateWildTeam` in pass 2, and this reads it back. A second generation
 * path would be a second set of rules for what a wild Pokemon is, and the first
 * divergence between them would be invisible.
 *
 * `tuning.allowEncounterAcquisitions` stays, and turning it off is now free of
 * side effects in a way it could not be while a roll existed: with no draw to
 * skip, a map generated with captures off is byte-identical to one generated
 * with them on.
 */
export function generateEncounterAcquisition(
  nodeId: string,
  lead: PokemonSpec,
  tuning: Tuning,
): AcquisitionOffer | null {
  if (!tuning.allowEncounterAcquisitions) return null;
  return {
    nodeId,
    source: 'encounter',
    spec: { ...lead, moves: [...lead.moves] },
  };
}

/**
 * Whether a decision is one the party could actually take.
 *
 * Returns the reason it could not, or null. Checked before applying rather than
 * clamped afterwards: a decision that silently becomes a different decision is
 * a log that replays into a different run, which is the failure the whole
 * decision-log design exists to prevent.
 */
export function decisionRefusal(
  party: readonly PokemonState[],
  decision: AcquisitionDecision,
): string | null {
  if (decision.kind === 'decline') return null;
  if (decision.kind === 'accept') {
    return hasRoom(party) ? null : `party is full (${party.length}/${PARTY_SIZE})`;
  }
  if (hasRoom(party)) return 'party has room, so nothing needs releasing';
  if (!party[decision.slot]) return `no party member in slot ${decision.slot}`;
  return null;
}

/**
 * Apply a decision. **The only path by which a party gains or loses a member.**
 *
 * Returns a new party, like every other party transition. The released member
 * is dropped rather than moved anywhere, which is the permanence the design
 * asked for; the acquired one is appended rather than inserted into the freed
 * slot, so `release` is a release and not a swap-in-place — the player reorders
 * the party on the party screen if the lead matters to them, and hiding a
 * reorder inside an acquisition would be a second decision in one act.
 */
export function applyAcquisition(
  party: readonly PokemonState[],
  offer: AcquisitionOffer,
  decision: AcquisitionDecision,
): { party: PokemonState[]; freed: ItemId[] } {
  const refusal = decisionRefusal(party, decision);
  if (refusal) throw new RangeError(`Cannot apply acquisition decision: ${refusal}`);

  if (decision.kind === 'decline') return { party: [...party], freed: [] };

  /*
   * What the captured Pokemon was holding goes to the **backpack**, not into
   * its hands.
   *
   * The spec says a caught Pokemon arrives holding what it held and that a held
   * item on it goes to the backpack, and only one of those can be literally
   * true. The backpack is the reading that makes the rest of the sentence work:
   * the next line of the spec is that going over capacity triggers the existing
   * discard choice, which can only happen if the item lands in the bag. Nothing
   * is lost either way — the party screen hands it straight back for free, which
   * is the whole point of a backpack that assignment is free from.
   */
  const carried = offer.spec.item ? [offer.spec.item] : [];
  const joined = createPartyMember({ ...offer.spec, item: undefined });
  if (decision.kind === 'accept') return { party: [...party, joined], freed: carried };

  /*
   * A released member hands their item back rather than taking it with them.
   *
   * The release itself is still permanent — there is no box and no retrieval,
   * and that is what gives the choice teeth. What changed in Stage 4.5.1 is
   * that the *item* is not part of the price: an item is destroyed only by an
   * explicit discard, and letting a Pokemon go is not one.
   */
  const released = party[decision.slot]?.item;
  return {
    party: [...party.filter((_, index) => index !== decision.slot), joined],
    freed: released ? [...carried, released] : carried,
  };
}

/**
 * A one-line label for an offer. Shared by the acquisition screen and the report.
 *
 * Asks the adapter for the species' real name and types rather than echoing the
 * spec, for the same reason `describeReward` resolves an item id: the spec
 * carries what was rolled and the screen shows what the player will see on the
 * field.
 */
export function describeOffer(offer: AcquisitionOffer): string {
  const card = describeSpecCard(offer.spec);
  return `${card.species} (Lv${card.level}, ${card.types.join('/')})`;
}
