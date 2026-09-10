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
 * capture arrived at the level it was fought at, because its price is the step
 * it occupied and the slot it takes. Explaining that difference on screen was
 * not possible, and the simulator's acquisition numbers were measuring the gap
 * between the routes rather than the decision.
 *
 * ## Stage 4.7 closed the level difference too
 *
 * **Anything joining the party after run start arrives at the segment's player
 * level**, from `scaling.ts`, whatever level it was fought at. See
 * `joinLevelFor`. Only the level moves: moveset, ability and item are the ones
 * the player just watched, because re-rolling a caught Pokemon's moves at a new
 * level would turn a capture into a reward reroll.
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
import { generateWildTeam } from './randomizer';
import type { RngStream } from './rng';
import { createPartyMember } from './party';
import type { ItemId, PokemonSpec, PokemonState } from './types';
import { PARTY_SIZE } from '../data/partyTuning';
import { playerLevel } from '../data/scaling';
import type { Tuning } from '../data/tuning';

/**
 * Where an offer came from. Display and metrics only; the decision is the same.
 *
 * `event` arrived with band 3: a Pokemon offered by an event node, with no
 * fight in front of it. It is a third *source*, not a third kind of decision —
 * accept, decline and release mean exactly what they mean everywhere else, and
 * `applyAcquisition` cannot tell the three apart.
 */
export type AcquisitionSource = 'reward' | 'encounter' | 'event';

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
 * The level an acquired member arrives at. **The segment's, from Stage 4.7.**
 *
 * `playerLevel(segment)` and nothing else — the same level every other member
 * of the party is sitting at, because `party.levelParty` puts the whole party
 * on this number every time a gym falls. A Pokemon that joins is simply a
 * Pokemon in the party, and the party is level `playerLevel(segment)`.
 *
 * **This used to subtract `PARTY_TUNING.joinLevelOffset`, and before that it was
 * not called at all.** The three-stage history is the argument for where it
 * landed:
 *
 *   - 4.5.1 re-levelled every offer *down* by 3, as the price of a free Pokemon.
 *   - 4.6a deleted the call for encounter captures, on the grounds that the
 *     price is the step and the slot, and that a captured Pokemon weaker than
 *     the one just beaten is a readout the player cannot square with what they
 *     watched. It arrived "exactly as it was fought".
 *   - 4.7 keeps 4.6a's reasoning and finishes it. "Exactly as it was fought" is
 *     a much larger discount than 4.5.1's three levels, in the other direction:
 *     a wild encounter is drawn at `playerLevel + levelOffset.wild`, which in
 *     segment 3 is **16 to 20 levels below the party**. A capture was therefore
 *     a slot that could not fight for the rest of the segment it was taken in —
 *     including that segment's gym, the one fight where the slot matters.
 *
 * The tax was never visible and never chooseable, which is the same objection
 * 4.6a made to the capture *roll*. `docs/balance.md` §12 has the measurement,
 * and the honest part of it: the hypothesis that the tax was what suppressed
 * swapping is **not** supported by the numbers, and this ships as a correctness
 * fix rather than as the fix for that.
 *
 * There is no offset left to floor against, so there is no `Math.max` either:
 * `playerLevel` is a table of eight values and every one of them is above 1.
 */
export function joinLevelFor(segment: number): number {
  return playerLevel(segment);
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
 * **It arrives as it was fought, except for its level.** Moveset, ability,
 * gender and held item are the ones the player just beat. The level is the
 * segment's, from Stage 4.7 — see `joinLevelFor` for the tax that clause used
 * to hide and the measurement that closed it. Nothing here re-rolls: this
 * function still hands over the node's own lead verbatim, and the level is
 * applied at the one place a member actually joins, in `applyAcquisition`.
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
 * The Pokemon an event offers, drawn at map generation.
 *
 * Sibling of `generateEncounterAcquisition`, and the difference between them is
 * the whole of what band 3 changed. That one *reads back* the wild team the
 * node already generated, because the species has to be the one just defeated.
 * This one has no fight to read back from, so it rolls — on the node's capture
 * sub-stream, which nothing else consumes.
 *
 * A normal-tier draw at the segment's own level: an event Pokemon is neither a
 * reward for clearing something hard nor a discount, so it is simply what that
 * stretch of the map produces. It then joins at `joinLevelFor` like every other
 * acquisition, so the slot still costs what a slot costs.
 *
 * `tuning.allowEncounterAcquisitions` gates this too. Turning captures off and
 * leaving an event able to hand one over would be one switch with two answers.
 */
export function generateEventAcquisition(
  nodeId: string,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): AcquisitionOffer | null {
  if (!tuning.allowEncounterAcquisitions) return null;
  const team = generateWildTeam(segment, 'normal', stream);
  const spec = team[0];
  return spec ? { nodeId, source: 'event', spec } : null;
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
 *
 * **`segment` is required rather than defaulted, and that is the whole of Stage
 * 4.7's guarantee.** The level normalization has to happen here because this is
 * the only path by which a party gains a member; a caller that could omit the
 * segment is a caller that can silently reintroduce the level tax on one branch
 * and not the other. `applyAcquisition` is called from exactly two places in
 * `resolveNode` and both know their segment.
 */
export function applyAcquisition(
  party: readonly PokemonState[],
  offer: AcquisitionOffer,
  decision: AcquisitionDecision,
  segment: number,
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
  /*
   * **The level is the segment's, and it is the only field this touches.**
   *
   * Stage 4.7's rule, applied at the one place a member can join. Moveset,
   * ability, gender and item are the ones the player just fought — re-rolling
   * the moves at the new level would make a capture a second reward draw, and
   * would mean the Pokemon the player took is not the Pokemon they watched.
   *
   * `createPartyMember` rebuilds max HP and PP from the spec through
   * `describeSpec`, so the level change is a real one rather than a label: a
   * mon that joins at 54 has the HP bar of a 54.
   */
  const joined = createPartyMember(
    { ...offer.spec, level: joinLevelFor(segment), item: undefined },
    segment,
  );
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
