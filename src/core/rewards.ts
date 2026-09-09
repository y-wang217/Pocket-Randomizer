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
import { joinLevelFor } from './acquisition';
import { generateRewardSpecies, damagingInBands } from './randomizer';
import { stow } from './items';
import { leadOf, recoverParty, teachMove } from './party';
import type { Rng } from './rng';
import type { RunState } from './run';
import type { PokemonState, Tier } from './types';
import { itemById } from '../data/items';
import { rewardEntriesFor, type RewardEntry } from '../data/rewardPools';
import { currencyScaleFor } from '../data/shop';
import { rewardMoveBands, rewardSpeciesBands } from '../data/scaling';
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
   * A Pokemon offered to the party.
   *
   * **Stage 3 typed this as a species *swap* and gated it off; Stage 4 turns it
   * on and it is an *addition*.** That is the same card doing a different
   * thing, and the difference is the party: at `PARTY_SIZE` 1 there was nowhere
   * to put a new Pokemon except on top of the only one you had, which is either
   * the most interesting decision in the game or an instant run-ender with no
   * way to tell which. With slots it is an offer — take it into a free slot,
   * take it and release someone, or decline — and declining is always legal.
   *
   * It is therefore the one reward kind that does not resolve inside
   * `applyReward`. Taking it is a second question (*which member goes?*), and a
   * question needs a policy call and a log entry of its own; `playRun` routes
   * this card through `chooseAcquisition` exactly as it routes an encounter's
   * offer. See `core/acquisition.ts`.
   */
  | { kind: 'species'; species: string; level: number; moves: string[]; ability: string };

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
 * Called from `generateSegment`'s pass 4, from `rng.rewards`, in node index
 * order. Every draw in this function comes from that stream and no other.
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
  rng: Rng,
  tuning: Tuning,
): RewardOffer {
  const stream = rng.rewards;
  const pool = rewardEntriesFor(tier, segment).filter(
    (entry) => entry.kind !== 'species' || tuning.allowSpeciesRewards,
  );

  const options: Reward[] = [];
  const takenMoves = new Set<string>();
  const takenItems = new Set<string>();
  let remaining = [...pool];

  for (let card = 0; card < OFFER_SIZE; card++) {
    if (remaining.length === 0) break;
    const entry = pickWeighted(remaining, stream);
    if (!entry) break;
    remaining = remaining.filter((candidate) => candidate !== entry);

    const reward = resolveRewardEntry(entry, segment, tier, rng, takenItems, takenMoves);
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
 * Weighted pick, one draw, no replacement handled by the caller.
 *
 * Local rather than shared with `encounters.sampleWeighted` on purpose: that
 * one draws a *set* and this draws a single entry, and merging them would mean
 * a change to one draw order silently moving the other. They are eight lines
 * each; the duplication is cheaper than the coupling.
 */
function pickWeighted(entries: readonly RewardEntry[], stream: Rng['rewards']): RewardEntry | null {
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
  rng: Rng,
  takenItems: Set<string>,
  takenMoves: Set<string>,
): Reward | null {
  const stream = rng.rewards;

  switch (entry.kind) {
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
      const bands = rewardMoveBands(segment, tier, entry.bandOffset);
      const available = damagingInBands(bands).filter((move) => !takenMoves.has(move.name));
      if (available.length === 0) return null;
      const move = stream.pick(available);
      takenMoves.add(move.name);
      return { kind: entry.kind, move: move.name };
    }
    case 'heal':
      return { kind: 'heal', fraction: entry.fraction };
    case 'species': {
      /*
       * At the join level, not the player's own.
       *
       * The same discount an encounter acquisition arrives at, and it has to be
       * the same one: two routes to a party member that arrived at different
       * levels would make the reward card strictly better than the wild offer
       * for a reason nothing on screen explains, and the simulator's
       * acquisition metrics would be measuring the gap rather than the choice.
       */
      const spec = generateRewardSpecies(
        rewardSpeciesBands(segment, tier, entry.bandOffset),
        joinLevelFor(segment),
        rng,
      );
      return {
        kind: 'species',
        species: spec.species,
        level: spec.level,
        moves: spec.moves,
        ability: spec.ability,
      };
    }
  }
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

    case 'species':
      return state;
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
    case 'tm':
      return `TM: ${reward.move}`;
    case 'tutor':
      return `Tutor: ${reward.move}`;
    case 'heal':
      return reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
    case 'species':
      return `Recruit ${reward.species} (Lv${reward.level})`;
  }
}
