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
import { damagingInBands, statusByImpact } from './randomizer';
import { stow } from './items';
import { recoverParty } from './party';
import type { RngStream } from './rng';
import type { RunState } from './run';
import type { Tier } from './types';
import { RELIC_IDS, relicById, type RelicId } from '../data/relics';
import { itemById } from '../data/items';
import { GYM_MOVE_ENTRY, gymRewardEntriesFor, rewardEntriesFor, type RewardEntry } from '../data/rewardPools';
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
  /**
   * A status move. Same shape as the two above, and deliberately so.
   *
   * It carries a move name and nothing else, because a status move asks the
   * player exactly what a TM asks: who learns it, and what it displaces. The
   * separate kind buys one thing — a card, a shelf row and a report line can
   * say *which* of the three it is without inspecting the move.
   */
  | { kind: 'technique'; move: string }
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

/**
 * What the reward screen prints beside `TAKE ONE`.
 *
 * **Four values, not three, and the fourth is why this type exists.** It was
 * `Tier`, and `generateGymRewardOffer` put `'elite'` in it because that was the
 * closest available lie — its own header argued the case, that a gym page
 * badged `normal` would contradict the cards in front of it, and the argument
 * was right about `normal` and wrong about the conclusion.
 *
 * The cost of the lie was paid by a reader. A gym page and an elite node are
 * indistinguishable in a screenshot when both say `ELITE`, and the R19 playtest
 * duplicate-card report was root-caused against the elite pool on exactly that
 * evidence — a wrong diagnosis and 18,000 measurements of the wrong thing,
 * corrected in `docs/generation.md` section 44.
 *
 * `'gym'` is not a tier and this type does not claim it is. `NodeSpec.tier` is
 * nullable precisely because a gym has no tier — there is one gym per segment
 * and no version of it you could have taken instead, so a tier would be a risk
 * label on a decision nobody made. That reasoning is untouched. What this says
 * is narrower and true: these are the four things a reward screen can be
 * labelled, and three of them happen to be tiers.
 */
export type OfferBadge = Tier | 'gym';

/** The three cards a node offers. Exactly three, always distinct. */
export interface RewardOffer {
  /** The node this belongs to, so a screen or a test can tie the two together. */
  nodeId: string;
  /**
   * The label the screen prints. **Display only — nothing draws off it.**
   *
   * Named `badge` rather than `tier` since the R19 close-out, and the rename is
   * the point rather than tidying: a field called `tier` holding `'gym'` would
   * be the same lie one level down, and a field called `tier` is one an
   * unsuspecting caller reaches for when it wants `REWARD_POOLS[offer.tier]`.
   * A gym's pool comes from `gymRewardEntriesFor` and a node's from
   * `rewardEntriesFor(tier, segment)`, both off the *node*, never off here.
   */
  badge: OfferBadge;
  options: Reward[];
}

/** How many cards an offer holds. Three is a spec constant, not a taste. */
/**
 * The kinds where a second card is the **same decision with a different number
 * on it**, and therefore not a distinct option.
 *
 * `CLAUDE.md`: "Every offer is exactly 3 distinct options." The R19 playtest
 * showed a gym page with two coin cards on it, and the measurement behind
 * `docs/spec/gymrun-patch-r19-overnight-playtest.md` put that at 26.3% of gym
 * pages with a further 5.4% showing three.
 *
 * **Two item cards are not this, and neither are two move cards.** A Leftovers
 * against a Charcoal is a real choice and `taken.items` already guarantees the
 * two differ; so does `taken.moves` for a TM against a tutor. Two relic cards
 * are a real choice *provided they are different relics*, which is what
 * `taken.relics` is for. What is left is `currency` and `heal`: 159 coins
 * against 150 coins is one card printed twice, and two full restores is worse.
 *
 * A set rather than a predicate, because the question "is this kind fungible"
 * is asked in three places — the offer loop, the gym loop and the relic
 * fallback — and three copies of the answer is three places for the next
 * fungible kind to be forgotten.
 */
const FUNGIBLE_KINDS: ReadonlySet<Reward['kind']> = new Set(['currency', 'heal']);

/**
 * What an offer has already handed out, threaded through every draw in it.
 *
 * **One object rather than four parameters**, and that is the change the R19
 * duplicate-card fix is built on. `resolveRewardEntry` took `takenItems` and
 * `takenMoves` as separate arguments, which is why relics were never tracked:
 * adding a third set meant an eighth parameter, so nobody added it, and the
 * measurement found 11.3% of gym pages offering the same relic on two cards —
 * against a comment two functions up claiming the opposite.
 *
 * Distinctness is now one idea in one place. A kind that needs a rule adds a
 * field here and every draw site gets it.
 */
export interface OfferDraw {
  /** Item ids already on the table. */
  items: Set<string>;
  /** Move names already on the table, shared across `tm`, `tutor`, `technique`. */
  moves: Set<string>;
  /** Relics already shown, so a second relic card cannot repeat the first. */
  relics: Set<RelicId>;
  /** Every kind drawn so far, consulted only for `FUNGIBLE_KINDS`. */
  kinds: Set<Reward['kind']>;
}

/** An empty draw record. One per offer, never shared between two. */
export function newOfferDraw(): OfferDraw {
  return { items: new Set(), moves: new Set(), relics: new Set(), kinds: new Set() };
}

/**
 * The entries still worth drawing, given what the table already holds.
 *
 * **This is the whole duplicate fix, and it costs no RNG.** `pickWeighted`
 * spends exactly one `nextFloat` whatever it is handed, so narrowing the
 * candidate list before the pick changes the answer without changing the draw
 * count — which is what lets the eager-generation contract survive a fix that
 * the first reading thought would need the fallback re-ordered.
 *
 * Only the fungible kinds are removed. Everything else is kept and made
 * distinct at resolution instead, because an `item` entry can still yield a
 * *different* item and a `relic` entry a different relic.
 */
function drawable(entries: readonly RewardEntry[], taken: OfferDraw): readonly RewardEntry[] {
  if (!entries.some((entry) => FUNGIBLE_KINDS.has(entry.kind) && taken.kinds.has(entry.kind))) {
    return entries;
  }
  return entries.filter((entry) => !(FUNGIBLE_KINDS.has(entry.kind) && taken.kinds.has(entry.kind)));
}

export const OFFER_SIZE = 3;

/**
 * How many cards a **gym** clear offers, on each of its two pages.
 *
 * **Three, and the exception is retired.** This was 2 from Stage 4.8 item 2 Part
 * B, the only offer in the game that was not three, on the argument that a relic
 * against a currency lump is a cleaner decision than either against a padded
 * third option — `docs/generation.md` section 7c. The padding argument was
 * sound and no longer applies: the gym pays two pages now, three moves and then
 * three relics-or-gold, and the item page fills its third card from the same two
 * entry kinds by drawing a *second distinct relic* rather than a filler.
 *
 * So `OFFER_SIZE` and this are the same number again, and the reason they are
 * still two constants is that they answer different questions — "how many cards
 * does a node offer" and "how many does a gym page offer" — and the next patch
 * that wants to move one should not have to prove it is not moving the other.
 *
 * CLAUDE.md's rewards invariant (every offer is exactly three distinct options)
 * is satisfied by both gym pages now, which it was not before.
 */
export const GYM_OFFER_SIZE = 3;

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
  const taken = newOfferDraw();
  let remaining = [...pool];

  for (let card = 0; card < OFFER_SIZE; card++) {
    if (remaining.length === 0) break;
    /*
     * `drawable` narrows the candidates to the ones that would not repeat a
     * fungible kind already on the table. One `nextFloat` either way — see its
     * own note — so this is a distinctness rule rather than a draw change.
     *
     * Without replacement *and* narrowed, because the two rules answer
     * different questions: `remaining` stops one entry filling two cards, and
     * `drawable` stops two entries of the same fungible kind doing it. This
     * pool never holds two `currency` entries, so only the first was needed
     * here — but the gym pool draws *with* replacement, and one rule that holds
     * in both places is worth more than two that each hold in one.
     */
    const entry = pickWeighted(drawable(remaining, taken), stream);
    if (!entry) break;
    remaining = remaining.filter((candidate) => candidate !== entry);

    const reward = resolveRewardEntry(entry, segment, tier, stream, taken, pool);
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
  return { nodeId, badge: tier, options };
}

/**
 * Draw what a gym clear pays: **two pages, three cards each.**
 *
 * **Stage 4.8, item 2. A gym pays twice**, and both halves are drawn here, in
 * this order, from the one `rewards` stream the gym has always used. Nothing is
 * drawn at gym completion — that would make the roll depend on how the fight went,
 * which is the failure the whole eager-generation contract exists to prevent.
 *
 * **A separate function from `generateRewardOffer` rather than a branch inside
 * it**, for the reason `NodeSpec.tier` is nullable at all: a gym has no tier, and
 * threading a `Tier | null` through the shared path would make
 * `rewardEntriesFor(null, segment)` a thing that has to be handled rather than a
 * thing that cannot be said.
 *
 * **Both returned offers badge `'gym'`, and they used to badge `'elite'`.**
 * That was a display fact rather than a draw — nothing here consulted it, the
 * item pool came from `gymRewardEntriesFor` and the move page from
 * `GYM_MOVE_ENTRY` — and the argument for it was that a gym page badged
 * `normal` would be the screen contradicting the cards in front of it. True,
 * and it ruled out one wrong answer rather than finding the right one.
 *
 * `RewardOffer.badge` carries a fourth value now and this says `gym`. What the
 * old arrangement cost is in `OfferBadge`'s own note: a gym page and an elite
 * node read identically in a screenshot, and one root cause was filed against
 * the wrong pool because of it.
 *
 * ## The move page used to be a grant
 *
 * Part A was one move, handed over unconditionally, at the segment's band **+3**
 * — which clamped to the top of the table at segment 0, so gym 1 paid a band-4
 * move 300 times out of 300. It is a choice of three at **+1** now, and
 * `data/rewardPools.ts`'s `GYM_MOVE_ENTRY` carries that argument and the rule it
 * deleted.
 *
 * That is a **decision-schema change**, not only a balance one: the player now
 * answers a `reward` question where they previously received a grant, so a gym
 * node records two `reward` entries instead of one and `RUN_LOG_VERSION` moves
 * with it. The replay cursor is strictly positional and kind-checked, so two
 * `reward` entries in one node need no new decision kind — only a fixed order,
 * which is the order below and the order the player meets them in.
 *
 * ## Why the moves are drawn first
 *
 * Order inside a stream is the stream's contract. The move page was the
 * guaranteed half and is drawn first for that reason; it stays first now that it
 * is a choice, because it is still the page the player meets first and because
 * swapping them would reshuffle every gym in every recorded seed for no gain.
 */
export function generateGymRewardOffer(
  nodeId: string,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): { moveOffer: RewardOffer; offer: RewardOffer } {
  void tuning;

  /*
   * Page 1: three distinct moves, one band above the segment's own.
   *
   * Resolved at `normal` so the band is `segmentMoveBand + GYM_MOVE_BAND_BONUS`
   * and nothing else — see `GYM_MOVE_ENTRY`. One `OfferDraw` across all three
   * draws is what makes them distinct; `resolveRewardEntry` consults its
   * `moves` set and redraws rather than repeating, which is the same mechanism
   * the ordinary three-card offer uses.
   */
  const moveTaken = newOfferDraw();
  const moveOptions: Reward[] = [];
  for (let card = 0; card < GYM_OFFER_SIZE; card++) {
    const drawn = resolveRewardEntry(GYM_MOVE_ENTRY, segment, 'normal', stream, moveTaken, [
      GYM_MOVE_ENTRY,
    ]);
    if (drawn) moveOptions.push(drawn);
  }
  if (moveOptions.length < GYM_OFFER_SIZE) {
    throw new RangeError(
      `Gym at segment ${segment} could resolve only ${moveOptions.length} of ${GYM_OFFER_SIZE} moves`,
    );
  }

  /*
   * Page 2: three distinct relics-or-gold.
   *
   * **The entry is not removed after it is drawn, and that is the change.** It
   * used to be, which capped this page at the pool's two entry kinds and is why
   * `GYM_OFFER_SIZE` was 2. Distinctness is a property of the resolved *payload*
   * rather than of the entry, so drawing `relic` twice yields two different
   * relics — a better third card than any filler kind would have been.
   *
   * **That sentence used to name the wrong mechanism, and the gap it hid is
   * what the R19 measurement found.** It said `resolveRewardEntry` "takes
   * `takenItems` and `takenMoves` and will not hand back a relic the page
   * already holds", which those two sets could not do: neither of them tracked
   * relics, nothing else did either, and 11.3% of gym pages offered the same
   * relic on two cards. `OfferDraw.relics` is the set that actually does it
   * now, at generation, with `resolveOffer` carrying the same rule through
   * resolution.
   *
   * A draw that resolves to nothing (a pool exhausted of distinct payloads) is
   * skipped rather than retried, so the draw count stays a function of
   * `GYM_OFFER_SIZE` alone and the loop cannot spin.
   */
  const pool = gymRewardEntriesFor(segment);
  const options: Reward[] = [];
  const taken = newOfferDraw();

  for (let card = 0; card < GYM_OFFER_SIZE; card++) {
    /*
     * **`drawable` is what stops the reported bug, and this loop is where it
     * was reported.** Drawing with replacement over a pool of two entries —
     * one relic, one currency — put two coin cards on 26.3% of gym pages and
     * three on a further 5.4%, measured over 4,000 seeds with no relics held.
     * The first diagnosis blamed the relic fallback and was wrong: the
     * fallback contributes nothing here until the run holds all ten relics.
     *
     * With `currency` removed from the candidates once it has been drawn, and
     * an `item` entry now in the pool for the draw to land on instead, the
     * three cards are three distinct decisions again.
     */
    const entry = pickWeighted(drawable(pool, taken), stream);
    if (!entry) break;
    const reward = resolveRewardEntry(entry, segment, 'elite', stream, taken, pool);
    if (reward) options.push(reward);
  }

  if (options.length < GYM_OFFER_SIZE) {
    throw new RangeError(
      `Gym reward pool at segment ${segment} produced ${options.length} options, need ${GYM_OFFER_SIZE}`,
    );
  }
  return {
    // Both pages badge `GYM`. They used to badge `ELITE` — see `OfferBadge`
    // for what that cost and why the type has a fourth value now.
    moveOffer: { nodeId, badge: 'gym', options: moveOptions },
    offer: { nodeId, badge: 'gym', options },
  };
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
 * `taken` is how distinctness is kept without a retry: a second item entry
 * draws from its list minus what the first one took, so two cards can never be
 * the same Leftovers, and the same holds for moves and — since R19 — relics.
 * Returns null only when a pool is so narrow that filtering emptied it, which
 * `generateRewardOffer` reports as the data bug it is.
 *
 * **Every entry stamps its kind into `taken.kinds` on the way through**,
 * including a fallback resolved inside a relic card. That is what `drawable`
 * reads, and doing it here rather than in the two loops is what makes it
 * impossible to add a third loop that forgets to.
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
  taken: OfferDraw,
  pool: readonly RewardEntry[] = [],
): Reward | null {
  taken.kinds.add(entry.kind);
  switch (entry.kind) {
    case 'relic': {
      /*
       * Two draws, always, and neither depends on the run.
       *
       * The shuffle is a full permutation rather than one pick because the
       * first choice may be held by the time the player arrives, and the
       * alternates have to already be decided — resolution consumes no RNG.
       *
       * **The card shown is the first relic in that permutation this offer has
       * not already shown, not the first one outright.** Nothing consulted
       * anything before the R19 fix, despite the comment above the gym page-2
       * loop asserting that it did, and 11.3% of gym pages offered the same
       * relic on two cards. Reading further down a permutation that was drawn
       * in full anyway costs nothing: the shuffle is the same shuffle and the
       * draw count is the same draw count.
       */
      const order = shuffledRelics(RELIC_IDS, stream);
      /*
       * **The fallback excludes the fungible kinds as well as relics**, and
       * that one filter is both halves of the R19 item-1a ask.
       *
       * It cannot duplicate a coin or a heal card, because it can no longer
       * *be* one — which fixes the 8.8% of elite offers that showed two, and
       * fixes it without the re-ordering the first reading said it would need.
       * The fallback still resolves here, at generation, in the same position,
       * consuming the same draws. And what it lands on instead is an item,
       * which is the report's own request: "Put an item option there, whatever
       * would be comparable to the move like a good one."
       *
       * `pickWeighted` is one `nextFloat` for any candidate list, so the
       * narrowing is free. A pool with nothing left to offer returns null and
       * the card is dropped, which `generateRewardOffer` reports as the data
       * bug it would be; `test/rewards.test.ts` holds that no shipped pool can
       * reach it.
       */
      const ordinary = pool.filter(
        (candidate) => candidate.kind !== 'relic' && !FUNGIBLE_KINDS.has(candidate.kind),
      );
      const fallbackEntry = ordinary.length > 0 ? pickWeighted(ordinary, stream) : null;
      const fallback = fallbackEntry
        ? resolveRewardEntry(fallbackEntry, segment, tier, stream, taken, [])
        : null;
      const [first, ...alternates] = orderFrom(order, taken.relics);
      if (!first || !fallback) return fallback;
      taken.relics.add(first);
      return { kind: 'relic', relic: first, alternates, fallback };
    }

    case 'item': {
      const available = entry.items.filter((id) => !taken.items.has(id) && itemById(id));
      if (available.length === 0) return null;
      const item = stream.pick(available);
      taken.items.add(item);
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
      const available = damagingInBands(bands).filter((move) => !taken.moves.has(move.name));
      if (available.length === 0) return null;
      const move = stream.pick(available);
      taken.moves.add(move.name);
      return { kind: entry.kind, move: move.name };
    }
    case 'technique': {
      /*
       * One draw, from the status pool, sharing `taken.moves` with the two
       * above.
       *
       * Sharing the set is the point rather than an economy: an offer holding
       * a TM and a technique must not name the same move twice, and a status
       * move and a damaging one can never collide anyway, so the shared set
       * costs nothing and removes a rule nobody would remember to keep.
       *
       * No band, no segment and no tier. A status move has no base power, so
       * there is nothing for `rewardMoveBands` to say about it — a Recover is
       * the same Recover at segment 1 and segment 7, and what changes with the
       * run is what it is *worth*, which is a price rather than a draw.
       */
      const available = statusByImpact(entry.impacts ?? []).filter(
        (move) => !taken.moves.has(move.name),
      );
      if (available.length === 0) return null;
      const move = stream.pick(available);
      taken.moves.add(move.name);
      return { kind: 'technique', move: move.name };
    }
    case 'heal':
      return { kind: 'heal', fraction: entry.fraction };
  }
}

/**
 * A drawn relic order, rotated so the first entry is one this offer has not
 * already shown.
 *
 * **Pure, and that is the requirement.** The permutation was drawn in full by
 * `shuffledRelics`; this only decides where to start reading it, so it consumes
 * no RNG and cannot move a later roll. Nothing is removed — the already-shown
 * relics stay in `alternates`, because `concreteReward` walks that list against
 * what the *run* holds and a relic another card is offering is not a relic the
 * run holds.
 *
 * Falls back to the order as drawn when every relic is spoken for, which can
 * only happen on a page showing more relic cards than there are relics. The
 * card is then a duplicate again, and that is better than no card at all.
 */
function orderFrom(order: readonly RelicId[], shown: ReadonlySet<RelicId>): readonly RelicId[] {
  const at = order.findIndex((id) => !shown.has(id));
  if (at <= 0) return order;
  return [...order.slice(at), ...order.slice(0, at)];
}

/**
 * A Fisher-Yates shuffle off the stream. Exactly `n - 1` draws, always.
 *
 * A fixed draw count matters more than the shuffle being the tidiest one
 * available: it is what lets a relic card cost the same number of draws as the
 * relic table grows, so adding an eleventh relic does not reshuffle every seed
 * beyond the one extra draw it honestly costs.
 *
 * Exported as `shuffledRelics` because `core/events.ts` draws a relic order for
 * the same reason and must draw it the same way. Two copies would be two draw
 * counts, and the symptom of a divergence is a seed that reproduces everywhere
 * except at a question mark.
 */
export function shuffledRelics(ids: readonly RelicId[], stream: RngStream): RelicId[] {
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
export function concreteReward(
  reward: Reward,
  relics: readonly RelicId[],
  alsoTaken: ReadonlySet<RelicId> = new Set(),
): Reward {
  if (reward.kind !== 'relic') return reward;
  const order = [reward.relic, ...reward.alternates];
  /*
   * `alsoTaken` is the relics *this offer* has already resolved onto, and it is
   * the resolution-time half of the R19 duplicate-relic fix. Generation makes
   * the two cards show different relics; without this, two cards could still
   * converge here, because each walked its own `alternates` against the run
   * with no knowledge of the other.
   *
   * It defaults to empty so a caller resolving one card in isolation — the
   * item-target screen, a test — gets the old behaviour exactly. `resolveOffer`
   * is the caller that threads it, and it is the one that has three cards.
   */
  const free = order.find((id) => !relics.includes(id) && !alsoTaken.has(id));
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
  /*
   * Left to right, carrying what has already been resolved onto. Still pure and
   * still idempotent: a resolved card has an empty `alternates`, so a second
   * pass finds the same relic free and returns the same object.
   */
  const shown = new Set<RelicId>();
  const options = offer.options.map((option) => {
    const resolved = concreteReward(option, relics, shown);
    if (resolved.kind === 'relic') shown.add(resolved.relic);
    return resolved;
  });
  return { ...offer, options };
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
export type MoveReward = Extract<
  Reward,
  { kind: 'tm' } | { kind: 'tutor' } | { kind: 'technique' }
>;

/**
 * The old name for `MoveReward`, kept only where the UI still speaks it.
 *
 * Renamed in Stage 4.5.1: once items stopped being targeted, "the rewards that
 * need a target" and "the rewards that teach a move" became the same set, and
 * the second name is the one that says why.
 */
export type TargetedReward = MoveReward;

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
export function applyReward(state: RunState, choice: Reward): RunState {
  switch (choice.kind) {
    case 'currency':
      return { ...state, currency: state.currency + Math.max(0, choice.amount) };

    case 'heal':
      return { ...state, party: recoverParty(state.party, choice.fraction) };

    case 'item':
      // Into the backpack, never onto a Pokemon. An item card has asked no
      // question since Stage 4.5.1, and from this stage a move card asks none
      // either — both pay an object into a bag with a finite number of slots.
      return { ...state, backpack: stow(state.backpack, choice.item) };

    case 'tm':
    case 'tutor':
    case 'technique':
      /*
       * Into the bag as a TM, never onto a Pokemon here.
       *
       * **This is the whole of the moves-as-inventory stage at this seam.** The
       * three move kinds used to teach on arrival, which made "who learns it"
       * a question asked at the node that paid the card and answered before the
       * player knew what the rest of the segment held. A TM defers that: it
       * costs a bag slot from the moment it arrives, competes with every held
       * item for it, and is spent at a rest or a shop or never.
       *
       * `target` and `replaceSlot` are no longer read by these three kinds and
       * the parameters are gone with them — the teach lives in `ItemPlan`.
       */
      return { ...state, tms: [...state.tms, choice.move] };

    case 'relic':
      return grantRelic(state, choice.relic);
  }
}

/**
 * Append a relic to the run. **The only thing in the codebase that writes the
 * held set**, and `test/relic-permanence.test.ts` greps for a second one.
 *
 * Onto the run, and never anywhere else. Not the backpack, so
 * `tuning.backpackCapacity` never sees it and no discard can reach it. Not a
 * party member, so no faint, release or swap can take it. Guarded against a
 * double-add because a relic appearing twice in this list would be invisible
 * everywhere except a passive that silently counted double —
 * `applyRelicPassives` de-duplicates too, so this is the belt to that braces.
 *
 * It became a named function when a *second* grant arrived: an event outcome
 * can pay a relic, and the first build of that appended to `state.relics`
 * itself. That is the exact thing the permanence rule forbids, and the rule's
 * own comment names an event outcome as the case it exists for.
 */
export function grantRelic(state: RunState, relic: RelicId): RunState {
  return state.relics.includes(relic) ? state : { ...state, relics: [...state.relics, relic] };
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
/*
 * `recipientFor` was here and is retired.
 *
 * It redirected a move aimed at a fainted or out-of-range party slot to the
 * lead, and it existed because the recipient was named at the node that paid
 * the card — where the member the player wanted could have died in the fight
 * that paid for it, and where a `RangeError` would have ended the run on its
 * own reward screen.
 *
 * A teach is composed at a rest or a shop now, against the party as it stands,
 * and a fainted member is a legitimate recipient there rather than an accident:
 * it revives between nodes and the move is still on it when it does. So the
 * slot a plan names is the slot that learns, with no redirection, and an
 * out-of-range one is the loud `RangeError` `applyItemPlan` raises.
 */

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
    case 'technique':
      return `Technique: ${reward.move}`;
    case 'heal':
      return reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
  }
}
