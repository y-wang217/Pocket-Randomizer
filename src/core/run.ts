/**
 * The run: a state machine over a generated map, and one function that plays it.
 *
 * Two seams matter more than anything else in this file.
 *
 * **`RunPolicy` mirrors the battle `Policy`.** A run is a sequence of decisions
 * — which starter, which node, which move — and a policy is a function from
 * "what I can see" to "what I do". The UI is a run policy whose promises
 * resolve on clicks. A scripted bot is a run policy. A recorded log replayed
 * back is a run policy. `playRun` takes one and cannot tell which it has, which
 * is what makes Stage 2's thousand-seed sweep a loop around a function that
 * already exists rather than a second implementation of the run loop that
 * drifts out of agreement with the one players use.
 *
 * **Everything is a list.** `segments`, not "the segment". `party`, not "the
 * starter". Stage 1 generates one segment and puts one Pokemon in the party,
 * and every function here is written as though it were eight and six, because
 * the version that special-cases the singular keeps passing its tests right up
 * until the day it silently does the wrong thing.
 *
 * State transitions return new state. A run is reconstructed by replaying a
 * decision log, and shared mutable state is the fastest way to make a replay
 * disagree with the run it replays.
 */
import { greedyAiPolicy } from './battle/ai';
import { ENGINE_VERSION, runBattle, type BattleSession, type Casualty } from './battle/driver';
import type { Policy } from './battle/policy';
import {
  generateSegment,
  generateStarterOptions,
  routeAt,
  type LocaleRoute,
  type NodeSpec,
  type Segment,
} from './encounters';
import {
  applyBattleState,
  battleTeamFor,
  betweenNodes,
  carryOverFor,
  createParty,
  isWiped,
  levelParty,
  replacementNeeded,
  recoverParty,
  restParty,
} from './party';
import {
  applyAcquisition,
  decisionRefusal,
  hasRoom,
  type AcquisitionDecision,
  type AcquisitionOffer,
} from './acquisition';
import type { RelicId } from '../data/relics';
import { RANDOMIZER_VERSION } from './randomizer';
import {
  applyPurchases,
  nodePayout,
  purchasedRewards,
  type MovePurchaseChoice,
  type ShopStock,
} from './economy';
import { applyEventOutcome, type EventInstance } from './events';
import { describeMove } from './battle/driver';
import { applyItemPlan, backpackCapacity, needsItemPlan, spendItems, stowAll } from './items';
import {
  applyReward,
  isTargeted,
  recipientFor,
  type MoveReward,
  type Reward,
  type RewardOffer,
} from './rewards';
import { createRng } from './rng';
import type {
  BattleResult,
  ItemAssignment,
  ItemId,
  ItemPlan,
  MoveSpec,
  PokemonSpec,
  PokemonState,
  RunDecision,
  RunLog,
} from './types';
import { SEGMENT_COUNT, playerLevel } from '../data/scaling';
import type { LocaleId } from '../data/locales';
import { DEFAULT_TUNING, type Tuning } from '../data/tuning';

/**
 * Bumped whenever a recorded decision sequence would replay differently.
 *
 * It carries the engine version because a run log is only replayable against
 * the mons, generation and sim it was recorded with. Stage 0's logs are
 * `gymrun-0.1.0` and do not match, which is the explicit rejection the widened
 * log format calls for.
 *
 * Went to `-4` in Stage 3, when `RunDecision` grew a `reward` member. A Stage 2
 * log replayed against this build would run out of step the first time a node
 * paid out: the run asks for a reward decision and finds a battle one. That
 * *would* throw — `replayRunPolicy` checks the kind at each cursor — but only
 * partway through, after reconstructing a run that was never played. The
 * version guard refuses it up front and says which version it found, which is
 * the difference between a diagnosis and a crash.
 *
 * Went to `-5` when `shop` and `event` decisions joined it, for the same
 * reason again.
 *
 * Went to `-6` in Stage 4, and this one is the largest break yet. Three things
 * changed at once: a battle choice can now be a *switch*, so the same recorded
 * sequence spends different turns and different battle rolls; a targeted reward
 * asks a `target` question that a Stage 3 log has no answer for; and an
 * acquisition asks another. A Stage 3 log replayed against this build would run
 * out of step at the first item card — `replayRunPolicy` would find a `node`
 * where the run wanted a `target` — and would do so several hundred decisions
 * into a run it had already reconstructed wrongly. The guard refuses it up
 * front and names both versions.
 *
 * Went to `-7` in Stage 4.5.1, and this break runs in both directions. A new
 * `items` decision appears at most node boundaries, which a Stage 4.5 log has
 * no answer for; and an item reward no longer asks a `target` question, which a
 * Stage 4.5 log *does* carry an answer for and would now offer one entry too
 * many. Either way the cursor slips, and it slips at the first item card rather
 * than at the point of the change — so the guard refuses the log up front and
 * names both versions.
 *
 * `ENGINE_VERSION` moved too (0.1.0 -> 0.2.0), so the composite string differs
 * twice over. That is not redundancy: the engine half says the *battle* would
 * replay differently and this half says the *run* would, and a reader
 * diagnosing a rejected log wants to know which.
 *
 * Went to `-8` in Stage 4.5.2, for the gym clear offer. A cleared gym now asks
 * a `reward` question — and, when the card taken is a move or a Pokemon, a
 * `target`, a `replace` or an `acquisition` behind it — where a 4.5.1 log has
 * nothing at all. The cursor slips at the *first gym*, which is early enough
 * that a silently misread log would reconstruct almost the entire run wrongly
 * while looking plausible throughout.
 *
 * `RANDOMIZER_VERSION` moved with it, and that half is the one that matters
 * more here: pass 6 appends a draw to the `rewards` stream in every segment, so
 * a 4.5.1 log replayed against this build would reconstruct different *cards*
 * at every node after the first gym even where the decision indexes still
 * lined up. That is the failure the two guards exist to separate — this one
 * says the questions changed, that one says the answers would mean something
 * different.
 *
 * Went to `-9` in Stage 4.6a, for the locale decision. A segment now opens on a
 * question a 4.5.2 log has no answer for, and it is the *first* question of
 * every segment — so the cursor slips at decision one and every entry after it
 * is read as an answer to the wrong question. A run that walked route 0 and
 * fought at step 0 would replay as a run that picked locale... and then found a
 * battle choice where a node pick belongs. The guard refuses it up front.
 *
 * `RANDOMIZER_VERSION` moved to 7 in the same stage and for a broader reason
 * still: keyed sub-streams moved every draw in the game onto a different
 * sequence. Two guards, two messages — this one says the questions changed,
 * that one says the answers would now mean something else.
 *
 * Went to `-10` for band 3, and it is worth being exact about why, because the
 * obvious reading says it should not have moved at all.
 *
 * No decision *kind* was added. An event-sourced capture records
 * `{ kind: 'acquisition', decision }`, byte for byte what a wild capture has
 * recorded since 4.6a, and `AcquisitionDecision` did not change shape. What
 * changed is *where the question is asked*: an event node that resolves to an
 * offer now asks one, and a 4.6c-minus-one log has no answer for it. The cursor
 * slips at that node and every entry after it is read as an answer to the wrong
 * question — a run that took the Pokemon replays as a run that took whatever
 * the next decision's index happens to select.
 *
 * Which is exactly what this guard is for. It does not ask whether the schema
 * changed; it asks whether the *questions* changed, and a new question in a new
 * place is a changed sequence even when every entry in it is an old shape.
 */
export const RUN_LOG_VERSION = `gymrun-run-10/${ENGINE_VERSION}`;

export type RunOutcome = 'victory' | 'defeat';

/** Where a run is: picking a starter, on the map, or finished. */
export type RunPhase = 'starter' | 'map' | 'complete';

/** One node the run actually went through. Display only; never serialized. */
export interface NodeVisit {
  node: NodeSpec;
  /** Which segment it belonged to, so the summary can say where a run ended. */
  segment: number;
  /** Null for nodes that were not a fight. */
  result: BattleResult | null;
  /** Party HP after the node resolved, for the summary. */
  hpAfter: number;
  /**
   * The player's losses in this node, with what caused them.
   *
   * Derived from the battle protocol by the adapter, not reconstructed here.
   * It is what the summary means by "cause of death" and what the balance
   * simulator counts.
   */
  casualties: Casualty[];
}

export interface RunState {
  seed: string;
  tuning: Tuning;
  /** Stage 1 generates one. The type is the same either way, deliberately. */
  segments: Segment[];
  currentSegment: number;
  /**
   * Which locale each segment is being walked through, as an index into that
   * segment's offer. `null` for a segment whose locale has not been picked.
   *
   * **State rather than a mutation of the segment, and that is the whole
   * shape of it.** `segments` is what the seed produced and never changes;
   * this is what the player did about it. A run that rewrote `segment.routes`
   * on selection would be a run whose map data disagreed with the seed that
   * built it, and the discarded routes are exactly what a replay needs in
   * order to reconstruct the choice.
   *
   * One entry per segment, all null at creation. `localeOf` reads it and
   * `chooseLocale` is the only thing that writes it.
   */
  localeChoices: (number | null)[];
  /**
   * Index into the current segment's steps.
   *
   * Equal to `steps.length` means the steps are done and the gym is next. The
   * gym is not a step because it is not a choice.
   */
  position: number;
  party: PokemonState[];
  /**
   * Run currency. A single scalar, and it may never go below zero.
   *
   * A scalar rather than a wallet object because there is exactly one currency
   * and there is no reason for there to be two. Earned from battle nodes and
   * from `currency` rewards; spent in shops, which is `core/economy.ts`'s job
   * and where the never-negative rule is enforced on the way out.
   */
  currency: number;
  /**
   * Loose items the run is carrying, by dex id, in acquisition order.
   *
   * **Stage 4.5.1, and it is state rather than a screen.** Held items live on
   * `PokemonState.item` and always have; this is everything the run owns and
   * nobody is holding. The two together are the run's item wealth, and the
   * split is what makes reassignment free — moving a Leftovers from one member
   * to another is a move between these two homes, not an acquisition.
   *
   * Order is preserved because it is the order the player sees on the party
   * screen, and a backpack that reshuffled itself between nodes would make
   * "discard the third one" mean something different on a replay than it did
   * live. Capacity is `tuning.backpackCapacity`; `core/items.ts` owns the rule.
   */
  backpack: ItemId[];
  /**
   * The relics this run holds, in the order they were taken.
   *
   * Run-scoped and permanent: nothing removes an id from this list. It is not
   * the backpack and it is not held by a Pokemon — `core/relics.ts` says why,
   * and `data/relics.ts` holds the table. Order is kept because it is the order
   * a readout lists them in, not because anything reads it as precedence.
   */
  relics: RelicId[];
  starterOptions: PokemonSpec[];
  starterIndex: number | null;
  history: NodeVisit[];
  outcome: RunOutcome | null;
}

// ---------------------------------------------------------------------------
// Creating and reading a run
// ---------------------------------------------------------------------------

/**
 * Build a run from a seed. Nothing is drawn after this point.
 *
 * Starter options come first and the map second, so that adding a starter to
 * the pool later does not reshape a recorded seed's map.
 */
export function createRun(seed: string, tuning: Tuning = DEFAULT_TUNING): RunState {
  const rng = createRng(seed);
  const starterOptions = generateStarterOptions(rng, tuning);

  /*
   * Segments are generated in order because the **locale offer** depends on the
   * offers before it: no locale twice in a row, and a locale nobody has been
   * offered outweighs one they have (`data/locales.ts`). That is a dependency
   * between segments, and it is the only one — everything else about segment 5
   * is a function of the seed and its own keys, which is what
   * `test/stream-keys.test.ts` asserts by generating one segment two ways.
   *
   * The context is what was *offered*, never what was picked. An offer that
   * depended on the player's choice would make the map a function of play, and
   * the two unpicked routes would stop being reconstructible from the seed.
   */
  const segments: Segment[] = [];
  const seen: LocaleId[] = [];
  for (let index = 0; index < SEGMENTS_PER_RUN; index++) {
    const previous = segments[index - 1]?.localeOffer ?? [];
    const segment = generateSegment(index, rng, tuning, { previous, seen: [...seen] });
    for (const locale of segment.localeOffer) {
      if (!seen.includes(locale)) seen.push(locale);
    }
    segments.push(segment);
  }

  return {
    seed,
    tuning,
    segments,
    currentSegment: 0,
    localeChoices: segments.map(() => null),
    position: 0,
    party: [],
    currency: 0,
    backpack: [],
    relics: [],
    starterOptions,
    starterIndex: null,
    history: [],
    outcome: null,
  };
}

/**
 * How many segments a run is.
 *
 * Stage 1 was one and this was a named constant precisely so that Stage 2 would
 * change a number rather than a loop. It did, and the number now comes from
 * data/scaling.ts, which is also where the eight rows describing those segments
 * live — one source rather than a constant here that has to agree with a table
 * there.
 */
export const SEGMENTS_PER_RUN = SEGMENT_COUNT;

export function phaseOf(state: RunState): RunPhase {
  if (state.outcome) return 'complete';
  return state.starterIndex === null ? 'starter' : 'map';
}

export function segmentOf(state: RunState): Segment {
  const segment = state.segments[state.currentSegment];
  if (!segment) throw new RangeError(`No segment ${state.currentSegment}`);
  return segment;
}

/**
 * Whether the current segment is still waiting for its locale.
 *
 * **Derived from state, never counted into it**, which is the property the
 * whole run log rests on: a replay reconstructs this the same way the live run
 * computed it, so the question is asked at exactly the same points in both.
 */
export function needsLocale(state: RunState): boolean {
  return !state.outcome && state.localeChoices[state.currentSegment] == null;
}

/** The locales the current segment is offering. Empty once one is picked. */
export function localeOptions(state: RunState): LocaleId[] {
  return needsLocale(state) ? [...segmentOf(state).localeOffer] : [];
}

/** The route the run is walking, or null before the locale is picked. */
export function routeOf(state: RunState): LocaleRoute | null {
  const choice = state.localeChoices[state.currentSegment];
  return choice == null ? null : routeAt(segmentOf(state), choice);
}

/** The locale the current segment is being walked through, or null. */
export function localeOf(state: RunState): LocaleId | null {
  return routeOf(state)?.locale ?? null;
}

/** The steps of the route being walked. Empty before the locale is picked. */
export function stepsOf(state: RunState): readonly { index: number; options: NodeSpec[] }[] {
  return routeOf(state)?.steps ?? [];
}

/**
 * True when the steps are done and the only thing left is the gym.
 *
 * False while a locale is still owed, even though the route is empty and
 * `position` is zero: a segment nobody has entered is not a segment finished.
 * Getting this backwards would send the run straight to the gym.
 */
export function atGym(state: RunState): boolean {
  if (needsLocale(state)) return false;
  return state.position >= stepsOf(state).length;
}

/**
 * The nodes the player is being offered.
 *
 * Empty at the gym: the gym is not a choice, so it must not arrive at
 * `chooseNode` as a list of one. A policy asked to pick from one option is a
 * decision recorded in the log that the player never made.
 */
export function nodeOptions(state: RunState): NodeSpec[] {
  if (state.outcome || needsLocale(state) || atGym(state)) return [];
  return stepsOf(state)[state.position]?.options ?? [];
}

/** The node that will be played next, choice or not. */
export function nextNode(state: RunState, choice: number): NodeSpec {
  if (atGym(state)) return segmentOf(state).gym;
  const options = nodeOptions(state);
  const node = options[choice];
  if (!node) throw new RangeError(`Node choice ${choice} out of range (${options.length} offered)`);
  return node;
}

/**
 * How many gyms this run has beaten. Zero to eight.
 *
 * Derived from history rather than counted into state, because a counter and a
 * history that disagree is a bug that only shows up on the summary screen.
 */
export function gymsCleared(state: RunState): number {
  return state.history.filter((visit) => visit.node.kind === 'gym' && visit.result?.winner === 'p1').length;
}

/**
 * What ended the run, in the terms the summary screen wants.
 *
 * Null for a victory, and for the rare defeat with nothing to point at (a
 * turn-limit draw against a gym leader is a loss with no casualty).
 */
export interface CauseOfDeath {
  /** Segment index the run ended in, 0-based. */
  segment: number;
  /** The gym leader guarding that segment. */
  leader: string;
  /** The node kind that did it: a gym, a trainer, or a wild encounter. */
  kind: NodeSpec['kind'];
  /** The party member that fell. */
  species: string;
  /** What killed it, and how. Nulls where the protocol did not say. */
  bySpecies: string | null;
  byMove: string | null;
  indirect: string | null;
}

export function causeOfDeath(state: RunState): CauseOfDeath | null {
  if (state.outcome !== 'defeat') return null;
  const last = state.history[state.history.length - 1];
  if (!last) return null;
  const casualty = last.casualties[last.casualties.length - 1];
  const leader = state.segments[last.segment]?.leader ?? '';

  return {
    segment: last.segment,
    leader,
    kind: last.node.kind,
    species: casualty?.name ?? state.party[0]?.spec.species ?? '',
    bySpecies: casualty?.bySpecies ?? null,
    byMove: casualty?.byMove ?? null,
    indirect: casualty?.indirect ?? null,
  };
}

/** Total current HP across the party. */
export function partyHp(party: readonly PokemonState[]): number {
  return party.reduce((total, member) => total + member.hp, 0);
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** Commit the starter pick. The party is a list from the first moment. */
export function chooseStarter(state: RunState, index: number): RunState {
  const spec = state.starterOptions[index];
  if (!spec) throw new RangeError(`Starter choice ${index} out of range`);
  return { ...state, starterIndex: index, party: createParty([spec]) };
}

/**
 * Commit the locale pick for the current segment.
 *
 * The one transition that discards generated content: the routes for the
 * locales not taken stay on the segment and are never walked. They are not
 * deleted, because a replay reconstructs the *offer* and needs them there to
 * resolve the same index to the same road.
 */
export function chooseLocale(state: RunState, index: number): RunState {
  const segment = segmentOf(state);
  if (!segment.localeOffer[index]) {
    throw new RangeError(`Locale choice ${index} out of range (${segment.localeOffer.length} offered)`);
  }
  if (state.localeChoices[state.currentSegment] != null) {
    throw new Error(`Segment ${state.currentSegment} already has a locale`);
  }
  const localeChoices = [...state.localeChoices];
  localeChoices[state.currentSegment] = index;
  return { ...state, localeChoices };
}

/**
 * What a node produced. Facts only — no rules applied.
 *
 * The split matters: reading HP and PP out of a finished battle is the sim
 * adapter's job, and deciding what that means for the run is this file's. A
 * battle screen that applied rest, revival and wipe detection itself is a
 * battle screen Stage 3 would have to teach about rewards.
 */
export interface NodeResult {
  node: NodeSpec;
  /**
   * The card the player took, if this node paid out and they won.
   *
   * The *reward*, not the index. `playRun` resolves the index against the
   * node's offer before handing it here, because the index is what the log
   * stores and the reward is what state changes need — and keeping the
   * resolution in one place means a replayed index and a clicked index become
   * the same value before anything downstream can tell them apart.
   */
  reward?: Reward;
  /**
   * Which party slot a targeted reward lands on.
   *
   * Resolved by `playRun` before this is handed over, like `reward` itself —
   * the log stores the index and the state change needs the slot, and keeping
   * the resolution in one place is what makes a replayed answer and a clicked
   * one the same value before anything downstream can tell them apart.
   */
  rewardTarget?: number;
  /**
   * Which of the recipient's move slots a taught move displaces, 0-based.
   *
   * Absent when nothing was displaced — a free move slot, or a move the
   * recipient already knew — which is `party.replacementNeeded` answering, and
   * is exactly when `playRun` did not ask. `teachMove` throws on a slot passed
   * in either of those cases rather than ignoring it, so an absent value here
   * and an absent question there cannot drift apart silently.
   */
  rewardReplaceSlot?: number;
  /**
   * Recipients and displaced slots for any taught moves in the shop basket, in
   * shelf order.
   *
   * Parallel to the move rewards in `economy.purchasedRewards`, not to
   * `purchases` — most baskets contain no TM at all and this is empty.
   */
  purchaseMoveChoices?: MovePurchaseChoice[];
  /**
   * What the player did with a Pokemon this node offered.
   *
   * Covers both routes: a `species` reward card and a wild node's post-battle
   * offer are one decision with two sources (`core/acquisition.ts`), so they
   * arrive here through one field rather than two.
   */
  acquisition?: { offer: AcquisitionOffer; decision: AcquisitionDecision };
  /** Shelf slots bought at a shop node, as indexes into its stock. */
  purchases?: number[];
  /** The event option taken, as an index into the instance's choices. */
  eventChoice?: number;
  /** Present for battle nodes: the outcome, and the party as the sim left it. */
  battle?: {
    result: BattleResult;
    party: PokemonState[];
    /**
     * Items the player's side used up, by dex id. **Stage 4.6b.**
     *
     * Carried on the result rather than read off the party, because a spent
     * item leaves no trace on the Pokemon that held it: `applyBattleState`
     * copies HP, PP and status back and the item field simply reads empty,
     * which is indistinguishable from a Pokemon that never held one. The
     * protocol is the only witness, and `core/battle/driver.ts` is the only
     * thing allowed to read it.
     */
    consumed?: ItemId[];
    /**
     * Every faint on either side, as the adapter read them off the protocol.
     *
     * Optional because `resolveNode` is also called directly by tests that
     * construct a battle outcome by hand and have no protocol to read. A
     * missing list means "nothing recorded", never "nobody fainted".
     */
    casualties?: Casualty[];
  };
}

/**
 * Everything a battle's result screen renders, assembled once by `playRun`.
 *
 * **Item D of the Stage 4.5.2 playtest round.** Every battle used to end in one
 * of two ways: a win with cards went to the reward screen, and a win *without*
 * cards — a gym, before this stage, or any battle the player lost — went
 * straight back to the map with nothing on screen to say the node had happened
 * at all. The reward screen was doing double duty as the result screen, so a
 * rewardless win read as the game skipping a beat.
 *
 * So this is what a node resolution *is*, from the player's side, and the offer
 * is a field on it rather than a screen of its own. That is the whole change:
 * cards render inside the result, not instead of it.
 *
 * Assembled before `resolveNode` runs, from the same inputs `resolveNode` will
 * use, because that function owns state transitions and `playRun` owns talking
 * to the policy — the split every other decision in this file already follows.
 */
export interface BattleReview {
  node: NodeSpec;
  result: BattleResult;
  /** `winner === 'p1'`, named because three call sites ask. */
  won: boolean;
  /** The party as the sim left it, before the node boundary heals anything. */
  party: PokemonState[];
  /**
   * What this node pays, or 0 on a loss.
   *
   * Computed here rather than read back off the state afterwards, because the
   * screen is shown *before* `resolveNode` folds it in — and "you earned 40"
   * is a fact about the node, while the balance after is a fact about the run.
   */
  currencyEarned: number;
  /** The three cards, or null on a loss and at a node that offers none. */
  offer: RewardOffer | null;
}

/**
 * Fold a finished node into the run. **This is Stage 3's hook for rewards.**
 *
 * Everything that happens between two nodes happens here and nowhere else:
 * the battle's damage is folded in, rest is applied, the run's two end
 * conditions are checked, and only then does the party heal its status and
 * revive. The ordering is the interesting part — the wipe check runs *before*
 * revival, or `reviveFaintedBetweenNodes` would quietly resurrect a run that
 * had already ended.
 */
export function resolveNode(state: RunState, result: NodeResult): RunState {
  if (state.outcome) throw new Error('Run has already ended');

  let party = state.party;
  if (result.battle) party = applyBattleState(party, result.battle.party);
  if (result.node.kind === 'rest') party = restParty(party, state.tuning);

  /*
   * Items the battle used up, spent before anything else touches the party.
   *
   * First, because everything below it — the wipe check, a heal reward, the
   * node boundary — reads a party that must already agree with the battle that
   * just happened. A berry still sitting on a Pokemon after the sim ate it is
   * an item the player would assign, carry and count against capacity, and
   * would find missing the next time a battle started.
   */
  let backpack = state.backpack;
  if (result.battle?.consumed?.length) {
    const spent = spendItems({ party, backpack }, result.battle.consumed);
    party = spent.party;
    backpack = spent.backpack;
  }

  /*
   * Winnings, and the event's outcome, folded in before the wipe check.
   *
   * The event especially: `applyEventOutcome` can take HP off the party, and
   * running it after the death rule would mean an event could leave a party at
   * zero that the run never noticed. It cannot today — damage is floored by
   * `tuning.eventDamageFloor` — but the ordering makes that a consequence of
   * the rule rather than of the clamp, which is the version that survives the
   * next tuning pass.
   */
  let currency = state.currency;
  if (result.battle?.result.winner === 'p1') currency += nodePayout(result.node, state.currentSegment);

  if (result.eventChoice !== undefined && result.node.event) {
    const choice = result.node.event.choices[result.eventChoice];
    if (!choice) {
      throw new RangeError(
        `Event choice ${result.eventChoice} out of range (${result.node.event.choices.length} offered)`,
      );
    }
    const after = applyEventOutcome({ ...state, party, currency }, choice.outcome, state.tuning);
    party = after.party;
    currency = after.currency;
  }

  const history: NodeVisit[] = [
    ...state.history,
    {
      node: result.node,
      segment: state.currentSegment,
      result: result.battle?.result ?? null,
      hpAfter: partyHp(party),
      casualties: (result.battle?.casualties ?? []).filter((casualty) => casualty.side === 'p1'),
    },
  ];

  // The one death rule, checked before anything can undo it.
  if (isWiped(party)) return { ...state, party, backpack, currency, history, outcome: 'defeat' };

  if (result.node.kind === 'gym') {
    // A gym that did not end in a win ends the run, wipe or not: a turn-limit
    // draw against a gym leader is a gym the player did not beat.
    if (result.battle?.result.winner !== 'p1') {
      return { ...state, party, backpack, currency, history, outcome: 'defeat' };
    }
    const nextSegment = state.currentSegment + 1;
    if (nextSegment >= state.segments.length) {
      return { ...state, party, backpack, currency, history, outcome: 'victory' };
    }
    /*
     * Clearing a gym is the only thing that levels the party.
     *
     * There is no XP and no grinding: the level is a function of segment index
     * (data/scaling.ts). Levelling happens *after* the node's damage has been
     * folded in and after the wipe check, so a gym won on one HP is a segment
     * started on the same share of a bigger bar rather than a free heal.
     */
    let cleared: RunState = {
      ...state,
      // Order matters: fold in the node, then heal, then level. Healing before
      // levelling means the fraction `levelParty` carries is the healed one, so
      // a full heal at the gym really is full at the new level rather than
      // full-at-the-old-max rounded down.
      party: levelParty(
        recoverParty(betweenNodes(party, state.tuning), state.tuning.gymClearHealFraction),
        playerLevel(nextSegment),
      ),
      backpack,
      currency,
      history,
      currentSegment: nextSegment,
      position: 0,
    };

    /*
     * The gym clear card, applied after the heal and the level.
     *
     * **Last, like every other reward, and for the same reasons**: after the
     * wipe check so a heal can never resurrect a finished run, and after the
     * node boundary so nothing it grants is undone by the transition that
     * follows. The ordering against `levelParty` is the new part and it matters
     * in one direction — a `species` card resolves at `joinLevelFor(segment)`
     * and a `tm`/`tutor` lands on a member whose `maxHp` has just moved, so
     * applying the card first would compute both against the pre-clear party.
     *
     * Gyms paid nothing before Stage 4.5.2, so this branch returned here.
     */
    if (result.reward) {
      cleared = applyReward(
        cleared,
        result.reward,
        result.rewardTarget ?? 0,
        result.rewardReplaceSlot ?? null,
      );
    }
    if (result.acquisition) {
      const { party: acquired, freed } = applyAcquisition(
        cleared.party,
        result.acquisition.offer,
        result.acquisition.decision,
      );
      cleared = {
        ...cleared,
        party: acquired,
        backpack: stowAll(cleared.backpack, freed),
      };
    }
    return cleared;
  }

  let advanced: RunState = {
    ...state,
    party: betweenNodes(party, state.tuning),
    backpack,
    currency,
    history,
    position: state.position + 1,
  };

  // Shop purchases before the reward, because only one of them can be at this
  // node — but the ordering is written down anyway so that a future node kind
  // that could do both has an answer rather than an accident.
  if (result.purchases && result.node.shop) {
    advanced = applyPurchases(
      advanced,
      result.node.shop,
      result.purchases,
      result.purchaseMoveChoices ?? [],
    );
  }

  /*
   * The reward, applied last and only here.
   *
   * After the wipe check, so a heal can never resurrect a finished run — and
   * `playRun` will not even have asked, because it gates the question on
   * winning the fight. After `betweenNodes`, so a heal reward is not undone by
   * the node boundary that follows it.
   *
   * This is the hook Stage 1 built `resolveNode` around, and `applyReward` is
   * the only path through it. A reward screen that changed party state itself
   * would bypass the seam, and the symptom would be a replay that reconstructs
   * a different run from the same log.
   */
  if (result.reward) {
    advanced = applyReward(
      advanced,
      result.reward,
      result.rewardTarget ?? 0,
      result.rewardReplaceSlot ?? null,
    );
  }

  /*
   * The acquisition, applied last of all.
   *
   * After the reward, because both can appear at one node — a `species` card
   * *is* the acquisition, and a wild node can pay a card and offer its Pokemon
   * — and a fixed order is what stops the two being a race. After the wipe
   * check for the same reason every other payout is: a party gained after the
   * run ended would be a run un-ending itself.
   *
   * `applyAcquisition` refuses a decision the party cannot take rather than
   * clamping it, so a log that says "release slot 2" against a party of two is
   * a loud failure instead of a quietly different run.
   */
  if (result.acquisition) {
    const { party, freed } = applyAcquisition(
      advanced.party,
      result.acquisition.offer,
      result.acquisition.decision,
    );
    /*
     * Every item the decision freed goes to the backpack, not with anybody.
     *
     * Two can come out of one capture: the released member's item — the release
     * is still permanent, but an item is destroyed only by an explicit discard
     * and letting a Pokemon go is not one — and, from 4.6a, whatever the
     * *captured* Pokemon was holding. Over capacity is allowed here and
     * resolved by the boundary's item plan, like any other acquisition.
     */
    advanced = { ...advanced, party, backpack: stowAll(advanced.backpack, freed) };
  }
  return advanced;
}

// ---------------------------------------------------------------------------
// Playing a run
// ---------------------------------------------------------------------------

/**
 * The run-level mirror of `Policy`.
 *
 * Three decisions, because a run has three kinds of decision. `battle` is the
 * Stage 0 policy unchanged, which is what lets the same move-picking code serve
 * a click, a bot and a replay.
 */
export interface RunPolicy {
  chooseStarter: (options: PokemonSpec[]) => Promise<number>;
  /**
   * Which region to walk this segment through. An index into the offer.
   *
   * **Asked once per segment, before its first step, and it is not a node.**
   * The locale decides what the segment's wild Pokemon are and nothing else —
   * not how hard it is, not what it pays — so a policy answering this is
   * choosing a *type pool*, which is why it takes the state: what the party
   * already covers is the whole of what makes one region better than another
   * for a given run.
   *
   * Takes the offered ids rather than the routes behind them, deliberately.
   * A policy handed three routes would be choosing between maps it can read in
   * full, which is an optimisation problem; the player sees a name and four
   * types, and the bot that balances the game should see the same.
   */
  chooseLocale: (options: LocaleId[], state: RunState) => Promise<number>;
  /**
   * Which node to walk into.
   *
   * Takes the state as well as the options, like every other decision on this
   * interface. Stage 3 is what forced it: a policy asked to weigh a `hard`
   * fight against a rest cannot answer without knowing how much HP it has, and
   * one asked whether a shop is worth a step cannot answer without knowing what
   * it can afford. A `chooseNode` that saw only the options would be picking
   * between labels.
   */
  chooseNode: (options: NodeSpec[], state: RunState) => Promise<number>;
  /**
   * Which of the three cards to take. No skip and no reroll — the return type
   * is an index, not an index-or-nothing, and that is the design.
   *
   * Takes the state as well as the offer because a reward is only good relative
   * to what you already have: a second Leftovers is worthless, a heal at full
   * HP is a wasted card, and a type item is a coin flip until you know your own
   * typing. A policy handed only the three cards would have to guess at all of
   * that, and the simulator's "reward take rate by kind" would be measuring a
   * bot playing a different game from the player.
   */
  chooseReward: (offer: RewardOffer, state: RunState) => Promise<number>;
  /**
   * The same question, asked with the whole result attached. **Optional.**
   *
   * `chooseReward` answers "which of these three", and until Stage 4.5.2 that
   * was the only thing `playRun` asked after a fight — so a battle that offered
   * no cards asked nothing, and the player was returned to the map with no
   * confirmation that anything had happened. `reviewBattle` is that same
   * question widened to "what happened, and what do you take from it": it is
   * asked for **every** battle completion, win or loss, cards or none, and
   * returns the reward index when there was an offer and null when there was
   * not.
   *
   * It is one path, not a second one. `playRun` records exactly the same
   * `{kind: 'reward', index}` decision whichever hook answered, and records it
   * under exactly the same condition, so a log written by a policy that
   * implements this is byte-identical to one written by a policy that does not.
   * That property is what makes the hook optional rather than a fork: a
   * headless policy has no screen to show and nothing to acknowledge, so the
   * simulator, the replay policy and every scripted test answer through
   * `chooseReward` and produce the same run.
   *
   * Returning a number for an offer that is null is a caller error and is
   * ignored; returning null for an offer that exists falls back to card 0,
   * because there is no skip.
   */
  reviewBattle?: (review: BattleReview, state: RunState) => Promise<number | null>;
  /**
   * Which shelf slots to buy. An array, because a shop visit is one decision.
   *
   * Not a sequence of buy-one calls: a player who picks three things and can
   * afford two has not said which two, so the basket is committed whole or not
   * at all (see `economy.applyPurchases`). Returning `[]` is leaving empty
   * handed, which is a legitimate and often correct answer.
   */
  chooseShopPurchases: (stock: ShopStock, state: RunState) => Promise<number[]>;
  /** Which event option to take. The outcome was drawn when the map was built. */
  chooseEventOption: (event: EventInstance, state: RunState) => Promise<number>;
  /**
   * Which party member learns a taught move. A party slot.
   *
   * **Stage 4's question, renamed in Stage 4.5.1 because the old name stopped
   * being true.** It was `chooseItemTarget`, and it answered for items, TMs and
   * tutors alike. Items no longer reach it — they go to the backpack — so what
   * is left is only ever a move, and a method called "item target" that is
   * never asked about an item is a comment that lies.
   *
   * Asked *first*, before `chooseMoveToReplace`, because the second question
   * cannot be posed until there is a member to pose it about: which four moves
   * are on the table depends entirely on who is learning.
   *
   * Takes the whole party rather than a list of legal targets, because "who
   * should learn Earthquake" is not a legality question — every member is legal
   * — it is a question about typing and about what they would have to give up.
   */
  chooseMoveRecipient: (
    offer: MoveReward,
    party: readonly PokemonState[],
    state: RunState,
  ) => Promise<number>;
  /**
   * Which of the recipient's four moves the incoming one displaces. A 0-based
   * move slot.
   *
   * **There is no decline, and the return type says so** — a slot, not a
   * slot-or-nothing. The place to skip a move reward is the reward screen,
   * where it was already chosen over two alternatives; a second escape hatch
   * here would make that pick meaningless.
   *
   * Asked only when a replacement is actually needed. A member with a free move
   * slot takes the move into it, and one that already knows the move refills its
   * PP instead — both are `party.replacementNeeded` answering, and it is the
   * single definition shared by this question and by the replay of it.
   *
   * Takes `member` rather than a slot index because the recipient has already
   * been resolved by `rewards.recipientFor` — including the fainted-member
   * fallback — and re-resolving it here is how the answer would end up applied
   * to a different Pokemon's move list.
   */
  chooseMoveToReplace: (
    member: PokemonState,
    incoming: MoveSpec,
    state: RunState,
  ) => Promise<number>;
  /**
   * Whether to take a Pokemon on offer, and who to release for it.
   *
   * Returns a decision rather than an index because the three answers are not a
   * list: declining is always available, accepting is available only with room,
   * and releasing is available only without. Flattening those into indexes
   * would mean the *meaning* of index 0 changed with the size of the party,
   * which is exactly the sort of thing a run log should never have to
   * reconstruct.
   */
  chooseAcquisition: (
    offer: AcquisitionOffer,
    party: readonly PokemonState[],
  ) => Promise<AcquisitionDecision>;
  /**
   * What to do with the run's items, asked once at each node boundary.
   *
   * **One question per boundary, not one per swap.** The spec asks that items
   * be reassignable "any number of times between nodes, at no cost" — so the
   * fidgeting is free and unlogged, and what reaches the log is the layout the
   * player committed to when they left the screen. That is what keeps a log's
   * size a function of the run rather than of the player's indecision.
   *
   * Takes the whole state because both halves of the answer need it: the
   * assignment half needs the party and the backpack, and the discard half
   * needs `tuning.backpackCapacity` to know whether it is being forced at all.
   *
   * Asked only where `items.needsItemPlan` says there is something to manage.
   * A plan that changes nothing is legal and common — `{assignments: [],
   * discards: []}` is the answer at most boundaries.
   */
  chooseItemPlan: (state: RunState) => Promise<ItemPlan>;
  battle: Policy;
}

export interface PlayRunOptions {
  /** Fired after every transition, so a UI can render without owning the loop. */
  onState?: (state: RunState) => void;
  /**
   * Fired after every decision with the log as it stands.
   *
   * This is what makes a mid-run save possible without the caller
   * reimplementing the loop: the log is complete and replayable at every point
   * it fires, so writing it straight to storage is enough to resume.
   */
  onDecision?: (log: RunLog) => void;
  /** Fired synchronously with a live session the moment a battle starts. */
  onBattle?: (session: BattleSession, node: NodeSpec, state: RunState) => void;
  /** The opponent. Defaults to the greedy AI; a sweep may want something else. */
  opponent?: Policy;
}

export interface RunResult {
  state: RunState;
  outcome: RunOutcome;
  /** Seed plus the decision sequence. Nothing derived. */
  log: RunLog;
}

/**
 * Play a run to its end under a policy.
 *
 * Must complete headless under Node with no DOM. That is not a nice-to-have:
 * it is the precursor to Stage 2's balance sweep, and a run loop that can only
 * run inside a page is one that has to be written twice.
 */
export async function playRun(
  seed: string,
  policy: RunPolicy,
  tuning: Tuning = DEFAULT_TUNING,
  options: PlayRunOptions = {},
): Promise<RunResult> {
  const decisions: RunDecision[] = [];
  const opponent = options.opponent ?? greedyAiPolicy;

  const record = (decision: RunDecision): void => {
    decisions.push(decision);
    options.onDecision?.(makeLog(seed, [...decisions]));
  };

  let state = createRun(seed, tuning);
  options.onState?.(state);

  const starterIndex = await policy.chooseStarter(state.starterOptions);
  record({ kind: 'starter', index: starterIndex });
  state = chooseStarter(state, starterIndex);
  options.onState?.(state);

  // A generated map is finite, so this loop is too; the guard exists to fail
  // loudly if a future transition ever forgets to advance rather than hanging
  // a browser tab.
  for (let guard = 0; guard <= maxNodes(state); guard++) {
    if (state.outcome) break;

    /*
     * The locale, asked at the top of the segment and before anything else.
     *
     * Inside the node loop rather than around it, because "a segment has begun"
     * is not a separate phase of the run — it is the state of the first
     * iteration that lands in a segment with no locale yet, whether that is the
     * very first iteration or the one right after a gym fell. `needsLocale` is
     * derived from state, so a replay asks at exactly the same points.
     *
     * It consumes no RNG. Every route was drawn when the map was built; this
     * says which of them the run keeps.
     */
    if (needsLocale(state)) {
      const index = await policy.chooseLocale(localeOptions(state), state);
      record({ kind: 'locale', index });
      state = chooseLocale(state, index);
      options.onState?.(state);
    }

    let node: NodeSpec;
    if (atGym(state)) {
      node = segmentOf(state).gym;
    } else {
      const choice = await policy.chooseNode(nodeOptions(state), state);
      record({ kind: 'node', index: choice });
      node = nextNode(state, choice);
    }

    const result = await playNode(state, node, policy, record, opponent, options);

    /*
     * The reward, asked for after the fight and only on a win.
     *
     * The three cards were drawn when the map was built, so nothing about this
     * question depends on how the battle went — but *whether it is asked* does,
     * and that is the point. A lost fight pays nothing, which is what makes the
     * elite node next to the normal one a risk rather than a longer wait for
     * the same payout.
     *
     * Winning is also what makes the wipe check downstream unreachable from
     * here: a side that won the battle has something left standing, so
     * `resolveNode` cannot end the run on a node that just paid out.
     */
    /*
     * A shop and an event are decisions with no fight attached, so they are
     * asked for unconditionally — there is no win to gate them on.
     *
     * Both are asked *before* `resolveNode`, like the reward, because that
     * function owns state transitions and this one owns talking to the policy.
     * Keeping the split means a replayed decision and a clicked one become the
     * same value before anything downstream can tell them apart.
     */
    if (result.node.shop) {
      const stock = result.node.shop;
      const indexes = await policy.chooseShopPurchases(stock, state);
      record({ kind: 'shop', indexes: [...indexes] });
      result.purchases = [...indexes];

      /*
       * A shop can sell a TM, so a basket can contain a taught move.
       *
       * Walked in `purchasedRewards` order — shelf order, the same order
       * `applyPurchases` folds them in — because the questions and the
       * application have to agree about which TM is which when a basket holds
       * two.
       *
       * Asked against a *running* party rather than the one the node started
       * with. Buying two TMs in one basket means the first one has already
       * filled a free move slot by the time the second is asked about, and
       * `replacementNeeded` would otherwise answer `'free'` here and `'choose'`
       * inside `applyPurchases` — one entry asked, two expected, and the log
       * out of step from that point on. Folding the same `applyReward` calls
       * keeps the two readings identical.
       */
      const moveChoices: MovePurchaseChoice[] = [];
      let scratch = state;
      for (const reward of purchasedRewards(stock, indexes)) {
        if (!isTargeted(reward)) {
          scratch = applyReward(scratch, reward);
          continue;
        }
        const answers = await askMoveQuestions(reward, state, scratch.party, policy, record);
        moveChoices.push(answers);
        scratch = applyReward(scratch, reward, answers.target, answers.replaceSlot);
      }
      result.purchaseMoveChoices = moveChoices;
    }

    if (result.node.event) {
      const event = result.node.event;
      const index = await policy.chooseEventOption(event, state);
      record({ kind: 'event', index });
      if (!event.choices[index]) {
        throw new RangeError(`Event choice ${index} out of range (${event.choices.length} offered)`);
      }
      result.eventChoice = index;
    }

    /*
     * The result of the fight, and the cards that came out of it.
     *
     * One question for both, asked once per battle node. The three cards were
     * drawn when the map was built, so nothing about *what* is offered depends
     * on how the battle went — but whether an offer exists at all does, and
     * that is the point: a lost fight pays nothing, which is what makes the
     * elite node next to the normal one a risk rather than a longer wait for
     * the same payout.
     *
     * Winning is also what makes the wipe check downstream unreachable from
     * here: a side that won has something left standing, so `resolveNode`
     * cannot end the run on a node that just paid out.
     */
    const won = result.battle?.result.winner === 'p1';
    const offer = won ? (result.node.reward ?? null) : null;
    let reviewedIndex: number | null = null;

    if (result.battle && policy.reviewBattle) {
      const picked = await policy.reviewBattle(
        {
          node: result.node,
          result: result.battle.result,
          won,
          party: result.battle.party,
          currencyEarned: won ? nodePayout(result.node, state.currentSegment) : 0,
          offer,
        },
        state,
      );
      // Null for a node with no offer is the expected answer and records
      // nothing. A number there would be an answer to a question nobody asked.
      if (offer) reviewedIndex = picked ?? 0;
    }

    if (offer) {
      const index = reviewedIndex ?? (await policy.chooseReward(offer, state));
      reviewedIndex = null;
      record({ kind: 'reward', index });
      const choice = offer.options[index];
      if (!choice) throw new RangeError(`Reward choice ${index} out of range (${offer.options.length} offered)`);
      result.reward = choice;

      /*
       * Which member gets it, asked only for the cards that land on one.
       *
       * **The condition has to be a property of the card and not of the
       * player**, or replay runs out of step. `isTargeted` is the single
       * definition of "this card needs a target", shared by the question here
       * and the application in `applyReward`; asking for a heal, or skipping
       * the question at a party of one, would put an entry in the log exactly
       * when the replaying run does not expect one.
       */
      if (isTargeted(choice)) {
        // Who learns it, then what it costs them. Both questions, both log
        // entries, in `askMoveQuestions` so the shop path below asks them the
        // same way.
        const answers = await askMoveQuestions(choice, state, state.party, policy, record);
        result.rewardTarget = answers.target;
        result.rewardReplaceSlot = answers.replaceSlot ?? undefined;
      }
    }

    /*
     * The Pokemon on offer, from either route, asked once.
     *
     * A `species` card and a wild node's post-battle offer are the same
     * decision, so they go through one call. The card's offer is built here
     * rather than at map generation because the *level* it joins at is the
     * card's own (see `resolveRewardEntry`) while a wild offer's was fixed when
     * the map was built — both are already resolved by the time this runs, and
     * neither draws.
     *
     * Gated on winning, like the reward. A lost fight hands over nothing, and
     * an offer the player can accept after losing would make the wild node's
     * risk one-sided.
     */
    /*
     * Won the fight, or there was no fight to win.
     *
     * The gate was `winner === 'p1'`, which is right for a wild node and reads
     * as "you earned it". An event node has no battle at all, and requiring a
     * victory there would make band 3 unreachable rather than gated. So the
     * rule is stated as what it always meant: an offer is refused only by a
     * fight that was lost, never by the absence of one.
     */
    const offered = acquisitionOffered(result);
    const earned = result.battle ? result.battle.result.winner === 'p1' : true;
    if (offered && earned) {
      const decision = await policy.chooseAcquisition(offered, state.party);
      record({ kind: 'acquisition', decision });
      const refusal = decisionRefusal(state.party, decision);
      if (refusal) throw new RangeError(`Acquisition decision is not legal: ${refusal}`);
      result.acquisition = { offer: offered, decision };
    }

    state = resolveNode(state, result);

    /*
     * The item plan, asked after the node has resolved and not before.
     *
     * The ordering is the whole design. Everything that hands the run an item —
     * a reward card, a shop basket, an event — lands inside `resolveNode`, and
     * all of it lands in the backpack. Asking beforehand would be asking the
     * player to arrange items they have not been given yet; asking afterwards
     * means the question is always "here is everything you own, what now".
     *
     * It is also the only point at which the backpack may be over capacity, and
     * `applyItemPlan` will not let it stay that way — so the transient overflow
     * `items.stow` permits is opened and closed within one loop iteration.
     *
     * Skipped when the run has ended, because there is nothing left to equip and
     * a wiped party has no slots to assign to. Skipped when there is nothing to
     * manage, per `needsItemPlan` — which is state-derived and therefore
     * reconstructed identically by a replay, the property the whole log depends
     * on.
     */
    if (!state.outcome && needsItemPlan(state)) {
      const plan = await policy.chooseItemPlan(state);
      record({ kind: 'items', plan: clonePlan(plan) });
      state = applyItemPlan(state, plan);
    }

    options.onState?.(state);
  }

  if (!state.outcome) throw new Error('Run did not reach an outcome');
  return {
    state,
    outcome: state.outcome,
    log: makeLog(seed, decisions),
  };
}

/**
 * The Pokemon this node is offering, or null.
 *
 * **One route since Stage 4.6b, and this function is what is left of two.** A
 * `species` reward card was the other, and it chose between them here so that
 * the two sources produced one decision. The card is gone — capture is the
 * acquisition path now, and it costs a step — so this reads the node's own
 * offer and nothing else.
 *
 * It stays a function rather than becoming a field read, because 4.6c adds a
 * second source again: a band-3 capability event spawns an encounter, and the
 * capture it offers arrives here.
 */
/**
 * The Pokemon this node is offering, from either place one can come from.
 *
 * A wild node carries its offer on `node.acquisition`, drawn in pass 5. An
 * event node carries it on the *chosen* outcome — which is the difference that
 * matters, because an event's other choices lead elsewhere and an offer sitting
 * statically on the node would appear whichever button was pressed.
 *
 * Both are drawn at map generation and neither depends on how anything went.
 * This function is the whole of what band 3 added to the node model: one more
 * place to look for an offer, not one more way for a node to finish.
 */
export function acquisitionOffered(result: NodeResult): AcquisitionOffer | null {
  if (result.node.acquisition) return result.node.acquisition;
  if (result.eventChoice === undefined) return null;
  const outcome = result.node.event?.choices[result.eventChoice]?.outcome;
  return outcome?.kind === 'acquisition' ? outcome.offer : null;
}

/**
 * A defensive copy of a plan on its way into the log.
 *
 * A policy returns arrays it may still hold a reference to — the UI builds one
 * from screen state and could well keep mutating it — and a log entry that
 * changed after it was recorded would replay as something the run never did.
 * `chooseShopPurchases` gets the same treatment at its call site for the same
 * reason.
 */
function clonePlan(plan: ItemPlan): ItemPlan {
  return {
    assignments: plan.assignments.map((assignment) => ({ ...assignment })),
    discards: [...plan.discards],
  };
}

/** The one place a `RunLog` is built, so every stamp on it agrees. */
function makeLog(seed: string, decisions: RunDecision[]): RunLog {
  return { seed, version: RUN_LOG_VERSION, randomizerVersion: RANDOMIZER_VERSION, decisions };
}

function maxNodes(state: RunState): number {
  // The *longest* offered route in each segment, because which one is walked is
  // a decision this guard runs before. A guard that assumed the shortest would
  // abort a legal run on its last node.
  return state.segments.reduce(
    (total, segment) => total + Math.max(...segment.routes.map((route) => route.steps.length)) + 1,
    0,
  );
}

/**
 * Play one node.
 *
 * Rest nodes resolve without a decision — the choice to rest *was* the
 * decision, and asking the player to confirm it would put a second entry in the
 * log for one act.
 */
async function playNode(
  state: RunState,
  node: NodeSpec,
  policy: RunPolicy,
  record: (decision: RunDecision) => void,
  opponent: Policy,
  options: PlayRunOptions,
): Promise<NodeResult> {
  if (!node.encounter) return { node };

  // Record the player's choices as they are made. Only the player's: the
  // opponent is a deterministic policy over a view it is handed, so recording
  // its answers would be recording the engine's output as though it were input.
  const recording: Policy = async (view) => {
    const choice = await policy.battle(view);
    record({ kind: 'battle', choice });
    return choice;
  };

  const run = await runBattle(
    battleTeamFor(state.party),
    node.encounter.team,
    state.seed,
    recording,
    opponent,
    {
      simSeed: node.encounter.simSeed,
      carryOver: carryOverFor(state.party),
      onStart: (session) => options.onBattle?.(session, node, state),
    },
  );

  return {
    node,
    battle: {
      result: run.result,
      party: run.session.partyState('p1'),
      casualties: run.casualties,
      consumed: run.consumed,
    },
  };
}

// ---------------------------------------------------------------------------
// Scripted policies
// ---------------------------------------------------------------------------

/**
 * Ask both move questions for one taught move, record both, return the answers.
 *
 * **One definition, two callers**, because a move bought from a shop and a move
 * taken from a reward card are the same act and must produce the same pair of
 * log entries in the same order. Two copies of this would be two places for the
 * `replacementNeeded` gate to be written slightly differently, and the symptom
 * would be a replay that runs out of step at the first shop that stocked a TM.
 *
 * The recipient is resolved through `rewards.recipientFor` before the second
 * question is asked, so the four moves on the table belong to the member that
 * will actually receive the move — see that function for the fainted-member
 * case this protects against.
 */
async function askMoveQuestions(
  offer: MoveReward,
  state: RunState,
  party: readonly PokemonState[],
  policy: RunPolicy,
  record: (decision: RunDecision) => void,
): Promise<MovePurchaseChoice> {
  const target = await policy.chooseMoveRecipient(offer, party, state);
  record({ kind: 'target', index: target });
  if (!party[target]) {
    throw new RangeError(`Move recipient ${target} out of range (party has ${party.length})`);
  }

  const recipient = recipientFor(party, target);
  if (!recipient || replacementNeeded(recipient, offer.move) !== 'choose') {
    return { target, replaceSlot: null };
  }

  const incoming = describeMove(offer.move);
  if (!incoming) throw new RangeError(`A reward offers a move the dex does not have: ${offer.move}`);
  const slot = await policy.chooseMoveToReplace(recipient, incoming, state);
  record({ kind: 'replace', slot });
  if (!Number.isInteger(slot) || slot < 0 || slot >= recipient.spec.moves.length) {
    throw new RangeError(
      `Move slot ${slot} out of range (${recipient.spec.species} knows ${recipient.spec.moves.length})`,
    );
  }
  return { target, replaceSlot: slot };
}

/**
 * The reference move replacement: drop the weakest damaging move, else the last
 * status move.
 *
 * **The heuristic that used to be a game rule.** Through Stage 4.5 this lived in
 * `party.replaceableSlot` and decided for the player; Stage 4.5.1 makes it the
 * player's decision and demotes this to what the scripted baseline answers when
 * nobody is asking. It is written down because it appears in every balance
 * report from here on.
 *
 * Three rules, in order:
 *
 *   1. The damaging move with the lowest base power. Ties go to the *later*
 *      slot, so the choice is stable rather than dependent on move order.
 *   2. If every move is a status move, the last one.
 *   3. Slot 0, which is unreachable — a member with four moves has a lowest one
 *      — and exists so the return type is a slot rather than a slot-or-nothing.
 *
 * **What it deliberately does not do is refuse.** The old rule's fourth clause
 * returned "displace nothing" when the incoming move was weaker than everything,
 * which is what made a move reward safe to be forced into. There is no decline
 * any more, so this always names a victim, and a baseline run can now be made
 * worse by a card it took. That is the intended shape: see `party.teachMove`.
 */
export function defaultMoveReplacement(member: PokemonState, incoming: MoveSpec): number {
  void incoming;
  const known = member.spec.moves.map((name) => describeMove(name));

  let weakestSlot: number | null = null;
  let weakest = Number.POSITIVE_INFINITY;
  let statusSlot: number | null = null;

  known.forEach((move, index) => {
    if (!move || move.category === 'Status') {
      statusSlot = index;
      return;
    }
    // `<=` so ties resolve to the later slot.
    if (move.basePower <= weakest) {
      weakest = move.basePower;
      weakestSlot = index;
    }
  });

  return weakestSlot ?? statusSlot ?? 0;
}

/**
 * The reference item plan: fill empty hands in order, discard the overflow.
 *
 * **Deliberately not clever, and written down because it will appear in every
 * balance report from here on.** Two rules, in this order:
 *
 *   1. Walk the party in slot order. Every member holding nothing takes the
 *      next item from the backpack, in acquisition order.
 *   2. If the backpack is still over `tuning.backpackCapacity`, discard from
 *      the front — the oldest items, the ones that have already been passed
 *      over once per node for as long as they have been carried.
 *
 * It never takes an item *off* a Pokemon. That is the part that keeps it a
 * baseline rather than a heuristic: a policy that reshuffled held items would
 * make every sweep it appears in a measurement of one reassignment strategy,
 * which is the objection `chooseItemTarget`'s comment already makes about
 * spreading targets around.
 *
 * It is also the floor on competent play rather than the floor on play: doing
 * *nothing* is not available, because a plan that leaves the backpack over
 * capacity is refused, and a run whose bag filled up would end on a thrown
 * `RangeError` rather than on a decision.
 */
export function defaultItemPlan(state: RunState): ItemPlan {
  const capacity = backpackCapacity(state.tuning);
  const assignments: ItemAssignment[] = [];

  let taken = 0;
  state.party.forEach((member, slot) => {
    if (member.item !== undefined) return;
    const item = state.backpack[taken];
    if (item === undefined) return;
    assignments.push({ slot, item });
    taken++;
  });

  const left = state.backpack.slice(taken);
  return { assignments, discards: left.slice(0, Math.max(0, left.length - capacity)) };
}

/**
 * A run policy that always takes the first option and the first usable move.
 *
 * The baseline a sweep measures against, and the cheapest possible proof that
 * `playRun` needs no DOM.
 */
export function scriptedRunPolicy(battle: Policy): RunPolicy {
  return {
    chooseStarter: async () => 0,
    /*
     * The first locale offered, like every other scripted answer here.
     *
     * Not "the one that covers the most types", which would make every sweep
     * this baseline appears in a measurement of one routing heuristic. The
     * simulator's `--policy` bots are where a real locale preference belongs.
     */
    chooseLocale: async () => 0,
    chooseNode: async () => 0,
    chooseReward: async () => 0,
    // Buys nothing. A scripted baseline that spent money would make every
    // sweep it appears in a measurement of one shopping heuristic.
    chooseShopPurchases: async () => [],
    chooseEventOption: async () => 0,
    // The lead, which is slot 0 and the member the Stage 3 code targeted
    // implicitly. A baseline that spread items around would make every sweep it
    // appears in a measurement of one targeting heuristic.
    // The lead, which is slot 0 and the member the Stage 3 code targeted
    // implicitly. A baseline that spread moves around would make every sweep it
    // appears in a measurement of one targeting heuristic.
    chooseMoveRecipient: async () => 0,
    chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
    /*
     * Fills the party, then declines.
     *
     * Not "always decline", which would measure a game with no acquisition in
     * it, and not "always take", which at a full party means releasing someone
     * on every offer and would measure a bot churning its own team. Taking
     * while there is room is the floor on competent play, which is what a
     * baseline wants.
     */
    chooseAcquisition: async (_offer, party) => (hasRoom(party) ? { kind: 'accept' } : { kind: 'decline' }),
    chooseItemPlan: async (state) => defaultItemPlan(state),
    battle,
  };
}

// ---------------------------------------------------------------------------
// Save, resume, replay
// ---------------------------------------------------------------------------

/** Whether a stored log was recorded against this build, engine and randomizer. */
export function isReplayable(log: RunLog): boolean {
  return log.version === RUN_LOG_VERSION && log.randomizerVersion === RANDOMIZER_VERSION;
}

/**
 * Reject an incompatible log loudly.
 *
 * Stage 0's logs are a different format under a different version string, and
 * a Stage 3 log will be different again. Replaying one of those against this
 * build would not fail — it would produce a plausible run that is not the run
 * the player recorded, which is the worst available outcome. So: refuse, and
 * say what was found.
 */
export function assertReplayable(log: RunLog): void {
  if (log.version !== RUN_LOG_VERSION) {
    throw new Error(`RunLog was recorded on ${log.version}, this build replays ${RUN_LOG_VERSION}`);
  }
  if (log.randomizerVersion !== RANDOMIZER_VERSION) {
    // Separate message from the one above, because the fix is different: an
    // engine mismatch means the log is old, and a randomizer mismatch means a
    // tuning pass moved the data under a log that is otherwise perfectly
    // replayable. Silently replaying that one produces a run the player never
    // played, on their own seed, which is the failure this whole check exists
    // to prevent.
    throw new Error(
      `RunLog was recorded on randomizer ${log.randomizerVersion ?? '(none)'}, ` +
        `this build rolls ${RANDOMIZER_VERSION}. The same seed no longer produces the same run.`,
    );
  }
}

/** A run policy backed by a recorded log, optionally handing over when it runs dry. */
export interface ReplayRunPolicy extends RunPolicy {
  /** Decisions not yet consumed. */
  remaining(): number;
}

/**
 * Turn a recorded log back into a policy.
 *
 * This is the whole of replay, and the reason it is this small is that a run
 * *is* a seed plus a decision sequence. There is no saved state to restore and
 * nothing derived to reconcile: replaying the decisions against the seed
 * reconstructs the run, or the run was never a function of its inputs.
 *
 * `live` is what makes resume different from replay. With it, the log is
 * consumed first and the player takes over at exactly the point they left off;
 * without it, running past the end of the log is an error rather than a
 * silently improvised continuation.
 */
export function replayRunPolicy(log: RunLog, live?: RunPolicy): ReplayRunPolicy {
  assertReplayable(log);
  let cursor = 0;

  const next = (kind: RunDecision['kind']): RunDecision | null => {
    const decision = log.decisions[cursor];
    if (!decision) return null;
    if (decision.kind !== kind) {
      throw new Error(`RunLog is out of step: expected a ${kind} decision at ${cursor}, found ${decision.kind}`);
    }
    cursor++;
    return decision;
  };

  const exhausted = (kind: string): never => {
    throw new Error(`RunLog ran out at decision ${cursor}, but the run wanted a ${kind}`);
  };

  return {
    remaining: () => Math.max(0, log.decisions.length - cursor),
    chooseStarter: async (options) => {
      const decision = next('starter');
      if (!decision) return live ? live.chooseStarter(options) : exhausted('starter');
      return decision.kind === 'starter' ? decision.index : exhausted('starter');
    },
    chooseLocale: async (options, state) => {
      const decision = next('locale');
      if (!decision) return live ? live.chooseLocale(options, state) : exhausted('locale');
      return decision.kind === 'locale' ? decision.index : exhausted('locale');
    },
    chooseNode: async (options, state) => {
      const decision = next('node');
      if (!decision) return live ? live.chooseNode(options, state) : exhausted('node');
      return decision.kind === 'node' ? decision.index : exhausted('node');
    },
    chooseReward: async (offer, state) => {
      const decision = next('reward');
      if (!decision) return live ? live.chooseReward(offer, state) : exhausted('reward');
      return decision.kind === 'reward' ? decision.index : exhausted('reward');
    },
    chooseShopPurchases: async (stock, state) => {
      const decision = next('shop');
      if (!decision) return live ? live.chooseShopPurchases(stock, state) : exhausted('shop');
      return decision.kind === 'shop' ? decision.indexes : exhausted('shop');
    },
    chooseEventOption: async (event, state) => {
      const decision = next('event');
      if (!decision) return live ? live.chooseEventOption(event, state) : exhausted('event');
      return decision.kind === 'event' ? decision.index : exhausted('event');
    },
    chooseMoveRecipient: async (offer, party, state) => {
      const decision = next('target');
      if (!decision) return live ? live.chooseMoveRecipient(offer, party, state) : exhausted('target');
      return decision.kind === 'target' ? decision.index : exhausted('target');
    },
    chooseMoveToReplace: async (member, incoming, state) => {
      const decision = next('replace');
      if (!decision) return live ? live.chooseMoveToReplace(member, incoming, state) : exhausted('replace');
      return decision.kind === 'replace' ? decision.slot : exhausted('replace');
    },
    chooseAcquisition: async (offer, party) => {
      const decision = next('acquisition');
      if (!decision) return live ? live.chooseAcquisition(offer, party) : exhausted('acquisition');
      return decision.kind === 'acquisition' ? decision.decision : exhausted('acquisition');
    },
    chooseItemPlan: async (state) => {
      const decision = next('items');
      if (!decision) return live ? live.chooseItemPlan(state) : exhausted('items');
      return decision.kind === 'items' ? decision.plan : exhausted('items');
    },
    battle: async (view) => {
      const decision = next('battle');
      if (!decision) return live ? live.battle(view) : exhausted('battle');
      return decision.kind === 'battle' ? decision.choice : exhausted('battle');
    },
  };
}

/** Replay a complete log. The result must match the run that produced it. */
export function replayRun(
  log: RunLog,
  tuning: Tuning = DEFAULT_TUNING,
  options: PlayRunOptions = {},
): Promise<RunResult> {
  return playRun(log.seed, replayRunPolicy(log), tuning, options);
}

/**
 * Resume a partial log: replay what was recorded, then hand control to `live`.
 *
 * The returned log is the whole run, replayed part included, so saving it again
 * is the same operation as saving during the original run.
 */
export function resumeRun(
  log: RunLog,
  live: RunPolicy,
  tuning: Tuning = DEFAULT_TUNING,
  options: PlayRunOptions = {},
): Promise<RunResult> {
  return playRun(log.seed, replayRunPolicy(log, live), tuning, options);
}
