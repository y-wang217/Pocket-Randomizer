/**
 * Rewards: what a node pays out, drawn when the map is built and applied when
 * the node resolves.
 *
 * Pure, like `randomizer.ts`, and takes an explicit `Rng`. Nothing here decides
 * *what* a pool contains — that is `data/rewardPools.ts` — and if a balance
 * pass ever needs to edit this file the split has failed.
 *
 * ## Two decisions, both about when
 *
 * **The offer is drawn at map generation, not at node completion.** This is the
 * single most important line in the file and it is the same decision
 * docs/generation.md records for encounter contents, for the same reason one
 * level down. A lazy draw would make the roll depend on *how the battle went* —
 * how many turns it took, how many damage rolls the sim consumed, whether a
 * move missed — and the number of draws consumed before the next node would
 * then be a function of play. Every seed recorded before a change to battle
 * length would replay as a different set of rewards. The battle stream and the
 * rewards stream are already independent, so this is belt and braces; it is
 * also free, and the failure it prevents is silent.
 *
 * **The player is asked *after* the fight, and only if they won.** Drawing
 * early does not mean revealing early. `playRun` gates the question on
 * `winner === 'p1'`, so a lost fight pays nothing, and the three cards a player
 * sees were fixed before they chose the node — which is what makes "the map
 * shows you the trade" true rather than approximately true.
 *
 * ## What a reward may be
 *
 * Six kinds, and two of them do not finish inside `applyReward`. An `item`, a
 * `tm` and a `tutor` land on one party member, so Stage 4 asks *which*; a
 * `species` offer is a Pokemon joining the party, so Stage 4 asks whether to
 * take it and who to release for it. Both questions are `playRun`'s to ask and
 * both get their own entry in the run log — see `TargetedReward` below and
 * `core/acquisition.ts`.
 */
import { damagingInBands } from './randomizer';
import { stow } from './items';
import { leadOf, recoverParty, teachMove } from './party';
import type { RngStream } from './rng';
import type { RunState } from './run';
import type { PokemonState, Tier } from './types';
import { RELIC_IDS, relicById, type RelicId } from '../data/relics';
import { itemById } from '../data/items';
import { gymRewardEntriesFor, rewardEntriesFor, type RewardEntry } from '../data/rewardPools';
import { currencyScaleFor } from '../data/shop';
import { rewardMoveBands } from '../data/scaling';
import type { Tuning } from '../data/tuning';

/**
 * One thing a player can be given.
 *
 * A resolved value, not a template: by the time a `Reward` exists the draws are
 * done. That matters for the run log, which stores the *index* of the card
 * taken and reconstructs the reward by replaying the seed — the union has to be
 * serializable and inert, so nothing here is a function or a closure.
 */
export type Reward =
  | { kind: 'item'; item: string }
  | { kind: 'currency'; amount: number }
  | { kind: 'tm'; move: string }
  | { kind: 'tutor'; move: string }
  | { kind: 'heal'; fraction: number }
  /**
   * A relic, and the two things that make it resolvable later.
   *
   * `relic` is what the card shows. `alternates` is the rest of a shuffled
   * relic order, and `fallback` is an ordinary card from the same pool — both
   * drawn at map generation and both usually unused.
   *
   * They exist because a relic must never be offered twice and what the run
   * holds is not known when the map is built. `concreteReward` walks
   * `relic` then `alternates` for the first one not already held, and takes
   * `fallback` if every one of them is. Doing that at *resolution* is what
   * keeps the draw invariant: the shuffle and the fallback are drawn whether or
   * not they are needed, so acquiring a relic mid-run cannot shift a later
   * roll. A filter at draw time would have.
   *
   * A resolved card has an empty `alternates`, which is what tells the two
   * states apart without a second type.
   */
  | { kind: 'relic'; relic: RelicId; alternates: readonly RelicId[]; fallback: Reward }

/*
 * **A sixth kind, `species`, was here until Stage 4.6b.**
 *
 * It handed the player a Pokemon from a reward card, and 4.6a made it
 * redundant: capture is offered on every wild victory and a segment guarantees
 * a wild encounter, so there is already a route to a party member — one that
 * costs a step, which is the thing a player can plan around.
 *
 * Two routes was two sets of rules for what a joined Pokemon is. The card
 * arrived at `joinLevelFor(segment)`, below the curve, because a free Pokemon
 * needed a price; a capture arrives at the level it was fought at, because its
 * price is the step and the slot. Keeping both would have meant explaining on
 * screen why one is weaker, and the simulator's acquisition numbers would have
 * been measuring the gap between the routes rather than the decision.
 *
 * What survives is `offensiveCoverage` and the one-line coverage readout, which
 * 4.6a moved onto the capture card.
 */

/** The three cards a node offers. Exactly three, always distinct. */
export interface RewardOffer {
  /** The node this belongs to, so a screen or a test can tie the two together. */
  nodeId: string;
  tier: Tier;
  options: Reward[];
}

/** How many cards an offer holds. Three is a spec constant, not a taste. */
export const OFFER_SIZE = 3;

// ---------------------------------------------------------------------------
// Generating an offer
// ---------------------------------------------------------------------------

/**
 * Draw the three cards for one battle node.
 *
 * Called from `generateSegment`'s pass 4, from the `rewards` sub-stream keyed
 * to this node. Every draw in this function comes from that stream and no
 * other, so a change to how many cards a node draws cannot move any other
 * node's offer — see `core/streamKeys.ts`.
 *
 * **Exactly three distinct options, guaranteed by construction rather than by
 * retry.** Entries are drawn without replacement, and the resolvers filter out
 * anything already taken rather than re-rolling — the same idiom `rollMoveset`
 * uses, and for the same reason. A retry loop would make the number of draws
 * depend on what was drawn, which is a subtle way to make a seed's later rolls
 * depend on its earlier ones in a way nobody can reason about.
 *
 * Takes `tuning` in addition to the spec's signature, because whether the
 * species kind may be offered at all is a tuning flag and the honest place to
 * apply it is the draw rather than the application: a card the player can pick
 * and that then does nothing is worse than a card that was never dealt.
 */
export function generateRewardOffer(
  nodeId: string,
  tier: Tier,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): RewardOffer {
  void tuning;
  const pool = rewardEntriesFor(tier, segment);

  const options: Reward[] = [];
  const takenMoves = new Set<string>();
  const takenItems = new Set<string>();
  let remaining = [...pool];

  for (let card = 0; card < OFFER_SIZE; card++) {
    if (remaining.length === 0) break;
    const entry = pickWeighted(remaining, stream);
    if (!entry) break;
    remaining = remaining.filter((candidate) => candidate !== entry);

    const reward = resolveRewardEntry(entry, segment, tier, stream, takenItems, takenMoves, pool);
    if (reward) options.push(reward);
  }

  if (options.length < OFFER_SIZE) {
    // A pool too small to fill three cards is a data bug, and it is one that
    // would otherwise surface as a reward screen with two buttons on it several
    // hundred nodes into a run. test/rewards.test.ts asserts every pool can
    // fill an offer, so this is the belt to that braces.
    throw new RangeError(
      `Reward pool for ${tier} at segment ${segment} produced ${options.length} options, need ${OFFER_SIZE}`,
    );
  }
  return { nodeId, tier, options };
}

/**
 * Draw the three cards for a gym clear.
 *
 * **A separate function from `generateRewardOffer` rather than a branch inside
 * it**, for the reason `NodeSpec.tier` is nullable at all: a gym has no tier,
 * and threading a `Tier | null` through the shared path would make
 * `rewardEntriesFor(null, segment)` a thing that has to be handled rather than
 * a thing that cannot be said. The offer it returns is the *same shape* — three
 * distinct options, one pick, no skip, no reroll — because a gym reward is a
 * reward, and every screen and policy downstream reads `RewardOffer` and must
 * not learn a second one.
 *
 * `tier` on the returned offer is `'elite'`, and that is a display fact rather
 * than a draw: nothing here consulted it (the pool came from
 * `gymRewardEntriesFor`), but `RewardOffer.tier` is what the reward screen
 * badges, and a gym offer that badged as `normal` would be the screen
 * contradicting the cards in front of it. The alternative — widening the field
 * to `Tier | 'gym'` — would touch every consumer to say something they would
 * then have to render anyway.
 *
 * Called from `generateSegment`'s pass 6, from `rng.rewards`, exactly as pass 4
 * draws every other offer. Drawing at gym *completion* would make the roll
 * depend on how the fight went, which is the failure the whole eager-generation
 * contract exists to prevent.
 */
export function generateGymRewardOffer(
  nodeId: string,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): RewardOffer {
  void tuning;
  const pool = gymRewardEntriesFor(segment);

  const options: Reward[] = [];
  const takenMoves = new Set<string>();
  const takenItems = new Set<string>();
  let remaining = [...pool];

  for (let card = 0; card < OFFER_SIZE; card++) {
    if (remaining.length === 0) break;
    const entry = pickWeighted(remaining, stream);
    if (!entry) break;
    remaining = remaining.filter((candidate) => candidate !== entry);

    /*
     * Resolved at `elite`, which is what makes the entries land where the pool
     * intends. `resolveRewardEntry` takes a tier because the *move and species
     * bands* are a function of it (`rewardMoveBands`, `rewardSpeciesBands`), so
     * resolving a gym's `bandOffset: 3` tutor against `normal` would quietly
     * hand back a mid-tier move and the "strictly better than elite" rule would
     * fail silently in the one place nobody looks.
     */
    const reward = resolveRewardEntry(entry, segment, 'elite', stream, takenItems, takenMoves, pool);
    if (reward) options.push(reward);
  }

  if (options.length < OFFER_SIZE) {
    throw new RangeError(
      `Gym reward pool at segment ${segment} produced ${options.length} options, need ${OFFER_SIZE}`,
    );
  }
  return { nodeId, tier: 'elite', options };
}

/**
 * Weighted pick, one draw, no replacement handled by the caller.
 *
 * Local rather than shared with `encounters.sampleWeighted` on purpose: that
 * one draws a *set* and this draws a single entry, and merging them would mean
 * a change to one draw order silently moving the other. They are eight lines
 * each; the duplication is cheaper than the coupling.
 */
function pickWeighted(entries: readonly RewardEntry[], stream: RngStream): RewardEntry | null {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;
  let roll = stream.nextFloat() * total;
  const fallback = entries.filter((entry) => entry.weight > 0).at(-1) ?? null;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry;
  }
  return fallback;
}

/**
 * Turn a pool entry into a concrete reward.
 *
 * `takenItems` and `takenMoves` are how distinctness is kept without a retry:
 * a second item entry draws from its list minus what the first one took, so two
 * cards can never be the same Leftovers. Returns null only when a pool is so
 * narrow that filtering emptied it, which `generateRewardOffer` reports as the
 * data bug it is.
 *
 * Exported for `core/economy.ts`, which resolves shop stock through it. A shop
 * sells the same things a reward pays out, so it draws them the same way — a
 * second resolver would be a second set of rules for what "an item" means, and
 * the first divergence between them would be invisible.
 */
export function resolveRewardEntry(
  entry: RewardEntry,
  segment: number,
  tier: Tier,
  stream: RngStream,
  takenItems: Set<string>,
  takenMoves: Set<string>,
  pool: readonly RewardEntry[] = [],
): Reward | null {
  switch (entry.kind) {
    case 'relic': {
      /*
       * Two draws, always, and neither depends on the run.
       *
       * The shuffle is a full permutation rather than one pick because the
       * first choice may be held by the time the player arrives, and the
       * alternates have to already be decided — resolution consumes no RNG.
       * The fallback comes from this pool's non-relic entries, so a run that
       * has collected everything still gets a card the tier would have paid.
       */
      const order = shuffled(RELIC_IDS, stream);
      const ordinary = pool.filter((candidate) => candidate.kind !== 'relic');
      const fallbackEntry = ordinary.length > 0 ? pickWeighted(ordinary, stream) : null;
      const fallback = fallbackEntry
        ? resolveRewardEntry(fallbackEntry, segment, tier, stream, takenItems, takenMoves, [])
        : null;
      const [first, ...alternates] = order;
      if (!first || !fallback) return fallback;
      return { kind: 'relic', relic: first, alternates, fallback };
    }

    case 'item': {
      const available = entry.items.filter((id) => !takenItems.has(id) && itemById(id));
      if (available.length === 0) return null;
      const item = stream.pick(available);
      takenItems.add(item);
      return { kind: 'item', item };
    }
    case 'currency': {
      // Scaled by segment so that "40 coins" means the same share of a price
      // list at segment 6 as it did at segment 1. The scale table and the
      // prices are the two halves of one number.
      const raw = stream.inRange({ min: entry.min, max: entry.max });
      return { kind: 'currency', amount: Math.round(raw * currencyScaleFor(segment)) };
    }
    case 'tm':
    case 'tutor': {
      const bands = rewardMoveBands(segment, tier, entry.bandOffset ?? 0);
      const available = damagingInBands(bands).filter((move) => !takenMoves.has(move.name));
      if (available.length === 0) return null;
      const move = stream.pick(available);
      takenMoves.add(move.name);
      return { kind: entry.kind, move: move.name };
    }
    case 'heal':
      return { kind: 'heal', fraction: entry.fraction };
  }
}

/**
 * A Fisher-Yates shuffle off the stream. Exactly `n - 1` draws, always.
 *
 * A fixed draw count matters more than the shuffle being the tidiest one
 * available: it is what lets a relic card cost the same number of draws as the
 * relic table grows, so adding an eleventh relic does not reshuffle every seed
 * beyond the one extra draw it honestly costs.
 */
function shuffled(ids: readonly RelicId[], stream: RngStream): RelicId[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = stream.nextInt(i + 1);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/**
 * Collapse a relic card against what the run already holds.
 *
 * Pure, no RNG, and idempotent: a resolved card resolves to itself. Every
 * other kind passes straight through, so a caller can map an offer through
 * this without asking what each card is.
 */
export function concreteReward(reward: Reward, relics: readonly RelicId[]): Reward {
  if (reward.kind !== 'relic') return reward;
  const order = [reward.relic, ...reward.alternates];
  const free = order.find((id) => !relics.includes(id));
  return free ? { kind: 'relic', relic: free, alternates: [], fallback: reward.fallback } : reward.fallback;
}

/**
 * An offer with every relic card collapsed. **The one resolution point.**
 *
 * `playRun` calls this once, before it shows the offer, and everything
 * downstream — the policy, the log's index, `applyReward` — reads the result.
 * Resolving twice would be harmless (the function is idempotent) but resolving
 * in two *places* would not: the card the player was shown and the card that
 * gets applied have to be the same object, and one call site is how that stays
 * true.
 */
export function resolveOffer(offer: RewardOffer, relics: readonly RelicId[]): RewardOffer {
  if (!offer.options.some((option) => option.kind === 'relic')) return offer;
  return { ...offer, options: offer.options.map((option) => concreteReward(option, relics)) };
}

// ---------------------------------------------------------------------------
// Applying one
// ---------------------------------------------------------------------------

/**
 * Reward kinds that land on one specific party member.
 *
 * Named as a type rather than checked inline because three separate places have
 * to agree on the answer — `playRun` decides whether to ask the target
 * question, the log has to carry an answer exactly when one was asked, and
 * `applyReward` has to use it. Three copies of "is it an item, a tm or a
 * tutor?" is three places for the fourth kind to be forgotten.
 */
export type MoveReward = Extract<Reward, { kind: 'tm' } | { kind: 'tutor' }>;

/**
 * The old name for `MoveReward`, kept only where the UI still speaks it.
 *
 * Renamed in Stage 4.5.1: once items stopped being targeted, "the rewards that
 * need a target" and "the rewards that teach a move" became the same set, and
 * the second name is the one that says why.
 */
export type TargetedReward = MoveReward;

/**
 * Whether this card needs the player to pick who gets it.
 *
 * Currency and heals are party-wide. A species offer is not targeted either —
 * it is a different question entirely (`chooseAcquisition`), because the member
 * it affects is one that does not exist yet.
 *
 * **`item` left this set in Stage 4.5.1, and the removal is the backpack.** An
 * item reward no longer lands on a Pokemon at all; it lands in the backpack,
 * and who holds it is a separate, reversible, free decision made on the party
 * screen (see `core/items.ts`). Asking "who gets this Leftovers" at the reward
 * screen would be asking a question whose answer the player can change for free
 * ten seconds later — which is not a decision, it is a prompt.
 *
 * What is left is the two cards that teach a move, and those are targeted in
 * the strong sense: the choice is irreversible and it costs a move slot.
 */
export function isTargeted(reward: Reward): reward is TargetedReward {
  return reward.kind === 'tm' || reward.kind === 'tutor';
}

/**
 * Fold a chosen reward into the run. **The only path by which a reward changes
 * anything.**
 *
 * Called from `resolveNode` and nowhere else. If a reward screen ever mutates
 * party state directly, the seam Stage 1 built has been bypassed and replay
 * stops reconstructing the run: the log records an *index*, and the only way an
 * index becomes a state change is through here.
 *
 * `target` is the party slot a targeted card lands on, and it is passed in
 * rather than chosen here for exactly the reason the reward index is: choosing
 * is `playRun`'s job and applying is this file's, so a replayed choice and a
 * clicked one become the same value before anything downstream can tell them
 * apart.
 *
 * A `species` card is a no-op here. It is routed through `chooseAcquisition`
 * before `resolveNode` is ever called, and reaching this branch with one means
 * that routing was skipped — so it changes nothing rather than silently doing
 * the Stage 3 thing and overwriting someone.
 *
 * Returns new state, like every other transition.
 */
export function applyReward(
  state: RunState,
  choice: Reward,
  target = 0,
  replaceSlot: number | null = null,
): RunState {
  switch (choice.kind) {
    case 'currency':
      return { ...state, currency: state.currency + Math.max(0, choice.amount) };

    case 'heal':
      return { ...state, party: recoverParty(state.party, choice.fraction) };

    case 'item':
      // Into the backpack, never onto a Pokemon. See `isTargeted` above for why
      // the target question moved off this card entirely.
      return { ...state, backpack: stow(state.backpack, choice.item) };

    case 'tm':
    case 'tutor':
      return withTarget(state, target, (member) => teachMove(member, choice.move, replaceSlot));

    case 'relic':
      /*
       * Onto the run, and never anywhere else.
       *
       * Not the backpack, so `tuning.backpackCapacity` never sees it and no
       * discard can reach it. Not a party member, so no faint, release or swap
       * can take it. Guarded against a double-add because a relic appearing
       * twice in this list would be invisible everywhere except a passive that
       * silently counted double — `applyRelicPassives` de-duplicates too, so
       * this is the belt to that braces.
       */
      return state.relics.includes(choice.relic)
        ? state
        : { ...state, relics: [...state.relics, choice.relic] };
  }
}

/**
 * Apply a change to the party member a reward lands on.
 *
 * **The slot is the player's answer, and Stage 4 is where it became a
 * question.** At `PARTY_SIZE` 1 this reached for the lead and there was nothing
 * to decide, which is exactly why it was a named function rather than
 * `state.party[0]` written out five times.
 *
 * An out-of-range slot falls back to the lead rather than throwing. That is not
 * leniency about bad input — `playRun` validates the index when it records the
 * decision — it is about a *fainted* target: a member can faint in the fight
 * that paid the card, and a run that crashed rather than handing the Leftovers
 * to someone else would be a run ended by its own reward screen.
 *
 * A wiped party is left alone rather than reaching for slot 0. `resolveNode`
 * applies rewards after the wipe check so this cannot happen today, and a
 * reward silently resurrecting a finished run is the failure worth being
 * unreachable twice over.
 */
/**
 * The member a targeted card actually lands on. **The single definition.**
 *
 * An out-of-range or fainted slot falls back to the lead rather than throwing.
 * That is not leniency about bad input — `playRun` validates the index when it
 * records the decision — it is about a member that *fainted in the fight that
 * paid the card*: a run that crashed rather than handing the TM elsewhere would
 * be a worse failure than the move moving.
 *
 * **Exported in Stage 4.5.1, and the export is the fix for a bug the fallback
 * would otherwise have caused.** The replacement slot is chosen for a
 * particular Pokemon's four moves. If `playRun` asked "which of *this* member's
 * moves goes" and then `applyReward` quietly redirected the card to the lead,
 * the answer would be applied to a different Pokemon's move list — displacing
 * whatever happened to sit at that index. So both sides resolve the recipient
 * through this function, once, and the question is asked about the member that
 * will actually receive it.
 */
export function recipientFor(party: readonly PokemonState[], slot: number): PokemonState | null {
  const chosen = party[slot];
  return chosen && !chosen.fainted ? chosen : leadOf(party);
}

function withTarget(
  state: RunState,
  slot: number,
  change: (member: PokemonState) => PokemonState,
): RunState {
  const target = recipientFor(state.party, slot);
  if (!target) return state;
  return { ...state, party: state.party.map((member) => (member === target ? change(member) : member)) };
}

// ---------------------------------------------------------------------------
// Reading one
// ---------------------------------------------------------------------------

/** A one-line label for a reward. Shared by the reward screen and the report. */
export function describeReward(reward: Reward): string {
  switch (reward.kind) {
    case 'item':
      return itemById(reward.item)?.name ?? reward.item;
    case 'currency':
      return `${reward.amount} coins`;
    case 'relic':
      // The relic's own name. What it grants and what it does are the card's
      // body, not its one-line label — a label that tried to say all three
      // would be a sentence, and every other kind here is a noun.
      return relicById(reward.relic)?.name ?? reward.relic;
    case 'tm':
      return `TM: ${reward.move}`;
    case 'tutor':
      return `Tutor: ${reward.move}`;
    case 'heal':
      return reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
  }
}
