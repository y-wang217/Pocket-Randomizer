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
import { AI_VERSION, aiPolicy } from './battle/ai';
import { AI_TIERS, aiTierFor } from '../data/ai';
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
  leadRefusal,
  levelParty,
  setLead,
  recoverParty,
  replacementNeeded,
  restParty,
  teachMove,
} from './party';
import {
  applyAcquisition,
  decisionRefusal,
  hasRoom,
  type AcquisitionDecision,
  type AcquisitionOffer,
} from './acquisition';
import { partyCapacityAfter } from '../data/partyTuning';
import type { RelicId } from '../data/relics';
import { applyRelicPassives } from './relics';
import { RANDOMIZER_VERSION } from './randomizer';
import { CONTENT_HASH } from './contentHash';
import {
  applyPurchases,
  resolveStock,
  nodePayout,
  type ShopStock,
} from './economy';
import {
  applyEventOutcome,
  applyToll,
  grantedMove,
  optionOf,
  outcomeFor,
  presentedOptions,
  type EventInstance,
  type EventOutcome,
} from './events';
import type { EventArchetype } from '../data/eventPools';
import { resolveCapability, type CapabilityContext } from './capabilities';
import { describeMove } from './battle/driver';
import { applyItemPlan, backpackCapacity, needsItemPlan, spendItems, stowAll } from './items';
import {
  applyReward,
  resolveOffer,
  type Reward,
  type RewardOffer,
} from './rewards';
import { createAiStream, createRng } from './rng';
import type {
  BattleMemberState,
  BattleResult,
  Contribution,
  ItemAssignment,
  ItemId,
  ItemPlan,
  TmTeach,
  MoveSpec,
  PokemonSpec,
  PokemonState,
  RunDecision,
  RunLog,
  RunLogVersions,
} from './types';
import { SEGMENT_COUNT, playerLevel } from '../data/scaling';
import { evolveParty, pendingEvolutionQuestion, type EvolutionQuestion } from './evolution';
import { gymForSegment, type GymDefinition } from '../data/gyms';
import type { LocaleId } from '../data/locales';
import { DEFAULT_TUNING, type NodeKind, type Tuning } from '../data/tuning';

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
 *
 * Went to `-11` in Stage 4.7, for lead selection. A `{ kind: 'lead' }` entry is
 * recorded once per gym, immediately before the gym node, which is the plainest
 * version of this guard's case: eight new questions in a run, the first of them
 * at the end of segment 0, and a 4.6c log has an answer to none of them. The
 * cursor slips at the first gym and every entry after it is read as an answer
 * to the wrong question.
 *
 * `RANDOMIZER_VERSION` moved in the same patch, for acquisition levelling, and
 * the split is the usual one: this says the questions changed, that says the
 * same answers would now build a different party.
 *
 * ## `-12`: Stage 4.8, item 2, and a deviation from its own prompt
 *
 * A gym clear pays twice now — a guaranteed move, then a choice of two cards — and
 * the guaranteed move routes through the existing move-learning flow, which means
 * a `target` and sometimes a `replace` entry **immediately after every gym win**.
 *
 * The prompt for Stage 4.8 states that run log version does not bump, and lists
 * why: capacity, nicknames, death records and the score are all derived rather
 * than logged. That reasoning is correct and all four are derived. It simply does
 * not cover item 2 Part A, which adds a reward the player has to aim — up to
 * sixteen new questions in a run, the first at the end of segment 0.
 *
 * This guard's rule decides it, and the rule is two paragraphs up: it "does not
 * ask whether the schema changed; it asks whether the *questions* changed, and a
 * new question in a new place is a changed sequence even when every entry in it is
 * an old shape". That is this case exactly, and it is the same case `-11` was for.
 * A 4.7 log replayed against this build would answer the gym's move target with
 * whatever its next entry happened to be.
 *
 * The deviation is recorded in `docs/generation.md` section 7c rather than by
 * editing the prompt, per protocol 4.
 *
 * ## `-13`: the `contentHash` release, and a changed *shape* rather than a
 * changed question
 *
 * No decision was added. What moved is the log's own header: `version` and
 * `randomizerVersion` were two loose fields, and they are now one `versions`
 * block carrying four axes — this one, `contentHash`, `aiVersion` and
 * `randomizerVersion`. The rule above says this guard asks whether the
 * questions changed; it also guards the format that carries the answers, and a
 * `-12` log has no `versions` block for `assertReplayable` to read. It is
 * refused on this axis by name, with the old `version` field quoted so the
 * message still says what the log was.
 *
 * ## `-14`: the event decision stopped being an index
 *
 * **The event rejig, and it is a changed *answer* rather than a changed
 * question.** The event node still asks exactly one thing — which button — but
 * the answer is now the option's archetype (`safe`, `gamble`, `toll`,
 * `attune`) instead of an index.
 *
 * The reason is the Attune gate. The presented list is three options without
 * the event's relic and four with, so an index into it names a different button
 * depending on what the run holds, and a `-13` log replayed against a different
 * relic state would take a decision the player never made. The archetype names
 * a role rather than a position, so it survives the gate — and a log naming
 * `attune` on a replay that reaches the node without the relic is *refused*,
 * which is the loud failure the index rule exists to produce.
 *
 * A `-13` log carries `{kind:'event', index}` where this build reads
 * `archetype`, so it is refused on this axis by name. `contentHash` would also
 * refuse it, because the same patch rewrote `data/events.ts` — but that is a
 * coincidence of the patch rather than a rule, and the schema axis is the one
 * that states *why*.
 *
 * `aiVersion` is the point of doing this here rather than in the AI patch that
 * follows: the AI patch bumps one constant and the guard picks it up, with no
 * schema change of its own. `docs/generation.md` section 9.
 *
 * ## `-15`: an event that pays a move asks who learns it
 *
 * A new question in a new place. A `T2` or `T3` event outcome grants a move,
 * and until this patch nothing asked the two questions that land one — so the
 * move was drawn, shown to the player and dropped. It is asked now, with the
 * same `target` and `replace` entries a reward card, a shop TM and a gym clear
 * already use.
 *
 * Every entry in the pair is an old shape, and the sequence is still changed:
 * a `-14` log that walked through a question mark has no answer where this
 * build asks, so replaying it would hand the event's targeting question the
 * answer to whatever the run asked next. That is the exact failure the guard
 * exists to make loud, and it is refused on this axis by name.
 *
 * `contentHash` and `randomizerVersion` also move in this patch — the relic
 * grant gained a fallback in `data/eventPools.ts` and a drawn order at
 * generation — but, as at `-14`, that is a coincidence of the patch. The
 * schema axis is the one that states why a `-14` log cannot be replayed.
 */
/*
 * ## `-16`: a gym clear asks which way a Pokemon evolves
 *
 * Stage 4.9. A new question in a new place: after the level-up a gym clear
 * pays, each member whose species forks at the new level asks for a branch,
 * and the answer is a new decision kind, `evolve`. Single-target evolutions
 * ask nothing, so a party that never reaches a fork writes the same log it
 * did — but a `-15` log that did would have its next answer read as a branch,
 * and the guard refuses it on this axis by name.
 *
 * `contentHash` and `randomizerVersion` move in the same stage, for the pool,
 * the curve and the draw order; as before, the schema axis is the one that
 * states why an old log cannot be replayed.
 */
/*
 * ## `-17`: the capture moved in front of the move, and a gym move can be refused
 *
 * Two changes, one bump, because either alone would have earned it.
 *
 * **The order.** A node used to ask its move questions and then offer its
 * Pokemon. It now offers the Pokemon and then asks, so the member that just
 * joined is on the recipient list. No decision kind was added and none was
 * removed — a `-16` log carries the same `reward`, `target`, `replace` and
 * `acquisition` entries this build asks for — but it carries them in the other
 * order, and a run that caught a Pokemon and taught a TM would replay with the
 * acquisition decision read as a move recipient. The guard's own rule covers it
 * exactly: it does not ask whether the schema changed, it asks whether the
 * *questions* changed, and a reordered sequence is a changed one.
 *
 * **The decline.** A gym's guaranteed move may now be handed back, recorded as
 * `DECLINED_MOVE` in the `target` entry it always wrote. The shape is unchanged
 * and every `-16` log is still in range — no old log contains the sentinel — so
 * this half is the forward direction only. It is named here rather than left
 * implicit because the *meaning* of that field widened, and a reader diagnosing
 * a rejected log should find both reasons under one number.
 *
 * `RANDOMIZER_VERSION` moves in the same patch for the final segment's battle
 * pair. Two guards, two messages: that one says the answers would mean
 * something else, this one says the questions changed.
 */
/*
 * **18: moves became inventory TMs and four questions left the node.**
 *
 * The `target` and `replace` entries that every reward card, shop TM, event
 * grant and gym clear used to write are gone from those four places entirely —
 * a move is stowed on arrival now and taught, if ever, out of an `ItemPlan` at
 * a rest or a shop. So the same seed and the same clicks produce a different
 * sequence of entries, which is precisely what this axis guards, and an old log
 * replayed against the new questions would read a recipient index as an item
 * assignment. `ItemPlan` also grew `teaches` and `discardTms`, reshaping the
 * `items` entry that carries it.
 *
 * `RANDOMIZER_VERSION` deliberately holds: every draw is made from the same key
 * in the same order, and what changed is only where the drawn move goes.
 */
export const RUN_LOG_VERSION = `gymrun-run-18/${ENGINE_VERSION}`;

/**
 * The node kinds at which a carried TM may be spent. **Rest and shop only.**
 *
 * The one definition, read by `playRun` when it applies a plan and by the UI
 * when it decides whether to offer the teach control, for the reason
 * `hasBattlePair` is one definition: a gate the generator and the floor state
 * separately is a gate that drifts.
 *
 * Why these two and not every boundary: a TM you can spend anywhere is a move
 * you already have, and the carry costs nothing. Rest and shop are where a run
 * already stops to spend things, so binding the teach to them makes banking a
 * band-4 TM through three fights a real commitment rather than a formality.
 * `docs/spec/gymrun-stage-moves-as-inventory-tms.md` section 5 is the ruling.
 */
export function canTeachAt(kind: NodeKind): boolean {
  return kind === 'rest' || kind === 'shop';
}

/**
 * Whether the boundary this state is sitting at allows a teach.
 *
 * The same question as `canTeachAt`, asked by whoever is *composing* a plan
 * rather than applying one — the UI's `chooseItemPlan`, and the reconcile it
 * runs first. It reads the node off the last history entry because an item plan
 * is asked after `resolveNode`, so the node just walked is the last thing in
 * there, and that is the node `playRun` will pass to `applyItemPlan`.
 *
 * False on an empty history, which is a run that has not walked a node yet and
 * therefore cannot be holding a TM to spend.
 */
export function canTeachNow(state: { history: readonly NodeVisit[] }): boolean {
  const last = state.history[state.history.length - 1];
  return last ? canTeachAt(last.node.kind) : false;
}

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
   * The TMs this run is carrying, by move name, in the order they arrived.
   *
   * **Every move the run is paid lands here first and nowhere else.** A reward
   * card, a shop purchase, an event grant and a gym clear all stow rather than
   * teach — see `rewards.applyReward` — so the question "who learns this" is
   * never asked at the node that paid for it.
   *
   * A separate list from `backpack` and a *shared* capacity with it, which is
   * the whole mechanic: see `items.inventoryLoad` for why the scarcity is one
   * number over two lists rather than one list of two kinds.
   *
   * Move *names*, matching what a `Reward` carries, not move ids. Order is
   * preserved for the reason the backpack's is — "discard the third one" has to
   * mean the same thing on a replay as it did live.
   */
  tms: string[];
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
    tms: [],
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
 * How many party slots this run has **right now**. Stage 4.8, item 1.
 *
 * `partyCapacityAfter(gymsCleared(state))`, and that composition is the whole of
 * it. Nothing else in the codebase may compute a capacity: this is the function
 * the capture flow, the item plan, the drawer and the map all read, so a slot
 * unlock reaches every one of them by reaching none of them specially.
 *
 * ## Derived, and deliberately not logged
 *
 * Capacity is a function of gyms cleared, gyms cleared is a function of history,
 * and history is what a replay rebuilds from the decision log. So capacity
 * reconstructs identically without being stored, consumes no RNG, and adds no
 * logged decision — which is why `RUN_LOG_VERSION` does not move for this patch.
 * Storing it would create a second copy of a derived number, and the failure mode
 * of that is a saved run whose capacity disagrees with its own gym count.
 */
export function partyCapacity(state: RunState): number {
  return partyCapacityAfter(gymsCleared(state));
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
 * Put the chosen member in front of the gym battle. **Stage 4.7, Part 2.**
 *
 * The state transition for a `{ kind: 'lead' }` decision, and it is a reorder:
 * `party.setLead` moves the member to slot 0, `battleMembersFor` sends the
 * party in order, and that is the entire mechanism. There is no lead flag to
 * keep in agreement with the party order.
 *
 * Refuses a fainted member rather than clamping to a legal one, like every
 * other decision in this file that can be handed something illegal. A choice
 * silently turned into a different choice is a log that replays into a
 * different run.
 */
export function chooseLead(state: RunState, index: number): RunState {
  const refusal = leadRefusal(state.party, index);
  if (refusal) throw new RangeError(`Cannot lead with slot ${index}: ${refusal}`);
  return { ...state, party: setLead(state.party, index) };
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
   * The shelf as it was shown, with relic cards already collapsed.
   *
   * Present only when this node is a shop. `resolveNode` prefers it over
   * `node.shop` for the same reason `reward` holds the card rather than the
   * index: the thing the player was asked about and the thing that gets
   * applied have to be one object. A shop is the only node read twice.
   */
  shopStock?: ShopStock;
  /**
   * The move a gym clear hands over. **Stage 4.8, item 2 Part A.**
   *
   * Present only on a gym the player won, and it is a *TM* from this stage on:
   * `resolveNode` stows it, nobody is named, and the three fields that used to
   * ride beside it — the recipient, the displaced slot and the decline flag —
   * are gone with the question they answered.
   */
  gymMove?: Reward;
  /**
   * The branch answers for the evolutions this gym clear applies. **Stage 4.9.**
   *
   * Present only on a gym the player won that is not the last; one entry per
   * branching step in walk order, and nothing for a single-target step. Same
   * discipline as the fields above: `playRun` asks, `resolveNode` applies, and
   * `core/evolution.ts` owns the walk both sides use.
   */
  evolutions?: number[];
  /**
   * The move a question mark room handed over, and where it landed.
   *
   * Present only when the *chosen* event outcome grants one — which is a `T2`
   * or a `T3`, so it depends on the archetype the player pressed and on the
   * band the run stands at. Both are functions of state a replay reconstructs
   * exactly, which is what lets the question be conditional at all.
   *
   * Its own field rather than the gym's or the card's, for the reason theirs
   * are separate from each other: a node can pay more than one move, and one
   * field would make two grants fight over it.
   */
  eventMove?: Reward;
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
  /** The event option taken, as its archetype. See `RunDecision`'s `event`. */
  eventChoice?: EventArchetype;
  /** Present for battle nodes: the outcome, and the party as the sim left it. */
  battle?: {
    result: BattleResult;
    /**
     * The party as the *sim* left it — vitals, not identity.
     *
     * `BattleMemberState` rather than `PokemonState` from Stage 4.7: a battle
     * read-back knows HP, PP, status and faints, and knows nothing about when a
     * member joined the run or what it has contributed. `party.applyBattleState`
     * is what folds this onto the run's own party, and it names the fields it
     * takes for exactly this reason.
     */
    party: BattleMemberState[];
    /**
     * Per-member counters for this battle, in send order. **Stage 4.7, Part 5.**
     *
     * Carried on the result rather than folded in by the driver for the reason
     * every other payout is: `resolveNode` owns state transitions and the
     * battle layer owns facts. It is also what makes the counters replayable —
     * they are a function of the protocol, which is a function of the seed and
     * the decisions, so a replay rebuilds them rather than restoring them.
     */
    contribution: Contribution[];
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
  party: BattleMemberState[];
  /** What each member did in this battle, in send order. See `NodeResult`. */
  contribution: Contribution[];
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
/**
 * The level the party moves to when the segment's gym falls, or null at the
 * last gym, where a win ends the run and nothing levels.
 *
 * **The one gate for asking and for applying.** `playRun` asks the evolution
 * questions when this is non-null and `resolveNode` applies the level and the
 * evolutions under the same test, so the two cannot disagree about whether a
 * clear levels the party.
 */
export function gymClearLevel(state: RunState): number | null {
  const next = state.currentSegment + 1;
  return next >= state.segments.length ? null : playerLevel(next);
}

export function resolveNode(state: RunState, result: NodeResult): RunState {
  if (state.outcome) throw new Error('Run has already ended');

  let party = state.party;
  if (result.battle) party = applyBattleState(party, result.battle.party, result.battle.contribution);
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
  /*
   * The run this node's outcome is folded onto. `state` until an event moves
   * it, and the spread every return below is built from, so a field an event
   * changes reaches the next node without being named here.
   */
  let base: RunState = state;
  /*
   * What the run's relics are worth at this node, folded once and read at
   * three sites below. **The held set is read as the node was *entered*
   * with**, which matters for the one node that can change it: an event that
   * pays a relic does not also pay that relic's per-node passive on the node
   * that handed it over.
   *
   * One fold rather than a `hasRelic` check at each site — the rule
   * `core/relics.ts` opens with, and the reason it is a fold at all.
   */
  const relicEffects = applyRelicPassives(state.relics);
  let currency = state.currency;
  if (result.battle?.result.winner === 'p1') {
    currency += nodePayout(result.node, state.currentSegment, relicEffects);
  }

  if (result.eventChoice !== undefined && result.node.event) {
    const option = optionOf(result.node.event, result.eventChoice);
    if (!option) {
      throw new RangeError(`Event option ${result.eventChoice} is not on ${result.node.event.eventId}`);
    }
    const outcome = chosenEventOutcome(result, state);
    if (outcome) {
      /*
       * The Toll is paid first, and separately from the outcome's own cost.
       *
       * It is a *price*, not a `T0` setback: the player read it before pressing
       * the button and the `T2` it buys is guaranteed. Folding it into the
       * outcome would make the result screen describe a cost the tier pools
       * never contained.
       */
      const priced = option.toll
        ? applyToll({ ...base, party, currency }, option.toll, state.tuning)
        : { ...base, party, currency };
      /*
       * **The fold becomes the base the rest of this function builds on**, and
       * that is the third version of this line and the one that stops the bug
       * from having a fourth.
       *
       * It was `party = after.party; currency = after.currency` from Stage
       * 4.5.1 (`0b450d2`), dropping `backpack`, so every item an event ever
       * paid was folded into a value nobody read. The event rejig found that
       * and destructured three fields instead, which fixed the bag and left
       * `relics` behind — so a `T2` relic and every `T3` windfall announced a
       * relic and granted nothing, which is the playtest report this patch
       * answers.
       *
       * Naming fields is the defect. `base` carries whatever
       * `applyEventOutcome` changed, including whatever it learns to change
       * next, and the three locals below are re-read from it only because they
       * are modified again further down. `test/event-inventory.test.ts` holds
       * the seam, per effect kind rather than per field.
       */
      base = applyEventOutcome(priced, outcome, state.tuning);
      /*
       * The taught move, after the fold and through `applyReward`.
       *
       * After, because a `T0` consolation heal and a `T2` move can arrive in
       * the same node and the move must land on the member as the fold left
       * them. Through `applyReward` rather than a `teachMove` call here,
       * because that is the one function a card, a shop TM and a gym clear all
       * go through, and a second teaching path is how two of them would drift.
       */
      if (result.eventMove) base = applyReward(base, result.eventMove);
      party = base.party;
      currency = base.currency;
      backpack = base.backpack;
    }
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
  if (isWiped(party)) return { ...base, party, backpack, currency, history, outcome: 'defeat' };

  if (result.node.kind === 'gym') {
    // A gym that did not end in a win ends the run, wipe or not: a turn-limit
    // draw against a gym leader is a gym the player did not beat.
    if (result.battle?.result.winner !== 'p1') {
      return { ...base, party, backpack, currency, history, outcome: 'defeat' };
    }
    const nextSegment = state.currentSegment + 1;
    if (nextSegment >= state.segments.length) {
      return { ...base, party, backpack, currency, history, outcome: 'victory' };
    }
    /*
     * Clearing a gym is the only thing that levels the party, and — Stage 4.9 —
     * the only thing that evolves it.
     *
     * There is no XP and no grinding: the level is a function of segment index
     * (data/scaling.ts). Levelling happens *after* the node's damage has been
     * folded in and after the wipe check, so a gym won on one HP is a segment
     * started on the same share of a bigger bar rather than a free heal.
     *
     * Evolution runs after the level, because a threshold is read against the
     * new level, and before the gym's cards, because a targeted card must land
     * on the member as it will be: `maxHp` moves twice here (the level, then
     * the species) and both have to precede the share-preserving teach.
     */
    const clearLevel = gymClearLevel(state) ?? playerLevel(nextSegment);
    let cleared: RunState = {
      ...base,
      // Order matters: fold in the node, then heal, then level, then evolve.
      // Healing before levelling means the fraction `levelParty` carries is the
      // healed one, so a full heal at the gym really is full at the new level
      // rather than full-at-the-old-max rounded down.
      party: evolveParty(
        levelParty(
          recoverParty(betweenNodes(party, state.tuning, relicEffects), state.tuning.gymClearHealFraction),
          clearLevel,
        ),
        clearLevel,
        result.evolutions ?? [],
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
    /*
     * **Part A before Part B. Stage 4.8, item 2.**
     *
     * The guaranteed move applies first, in the order the player was asked, so a
     * replay folds the two in the same order the live run did. It matters in one
     * direction and it is the same direction the comment above describes: both
     * land on a member whose `maxHp` has just moved, and a chosen card that
     * happened to target the same member must see the move already taught rather
     * than race it.
     */
    /*
     * **The capture first, ahead of both cards. Item 1.**
     *
     * `playRun` asks the move questions against the party with the capture
     * already in it, so the recipient index it recorded names a slot in *that*
     * party. Folding the cards in first would resolve the same index against a
     * party one member shorter — or, after a release, against a party whose
     * members have all shifted down one — and the move would land on somebody
     * else. The two orders have to be the same order, and this is it.
     *
     * Unreachable on this branch, as the note inside says: a gym node carries
     * no acquisition and no event. Written correctly anyway, because
     * "unreachable because of another knob" is not a guarantee.
     */
    if (result.acquisition) {
      const { party: acquired, freed } = applyAcquisition(
        cleared.party,
        result.acquisition.offer,
        result.acquisition.decision,
        // The segment the party is *now* in, not the one the fight was in. The
        // party was levelled to `playerLevel(nextSegment)` a few lines above,
        // and a member joining at the old segment's level would be the 4.7 tax
        // reintroduced on exactly one branch.
        cleared.currentSegment,
        /*
         * The capacity as it was when the decision was *asked*, which is
         * `state` and deliberately not `cleared`.
         *
         * `cleared.history` already contains this gym, so `partyCapacity`
         * would read one slot more here than `playRun` read when it checked
         * the same decision for legality — and a decision accepted by the
         * check and refused by the application is a thrown `RangeError` on a
         * replay. Reading the pre-resolution state makes the two provably the
         * same number rather than the same number by coincidence.
         *
         * It is unreachable today: a gym node is not a wild node and carries
         * no event, so `result.acquisition` is always null on this branch. It
         * is written correctly anyway, because "unreachable because of another
         * knob" is not a guarantee, and `test/capture.test.ts` asserts the two
         * capacities agree rather than trusting this comment.
         */
        partyCapacity(state),
      );
      cleared = {
        ...cleared,
        party: acquired,
        backpack: stowAll(cleared.backpack, freed),
      };
    }

    /*
     * **Part A before Part B**, in the order the player was asked, so a replay
     * folds the two in the same order the live run did. It matters in one
     * direction and it is the same direction the notes above describe: both
     * land on a member whose `maxHp` has just moved, and a chosen card that
     * happened to target the same member must see the move already taught
     * rather than race it.
     *
     * `gymMoveDeclined` teaches nobody. The `?? 0` beside it is why it has to
     * be a flag and not an absent target: a missing index would fall through to
     * slot 0 and hand the lead a move the player refused.
     */
    if (result.gymMove) cleared = applyReward(cleared, result.gymMove);
    if (result.reward) cleared = applyReward(cleared, result.reward);
    return cleared;
  }

  let advanced: RunState = {
    ...base,
    party: betweenNodes(party, state.tuning, relicEffects),
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
      result.shopStock ?? result.node.shop,
      result.purchases,
    );
  }

  /*
   * **The acquisition, ahead of the reward. Item 1, and the order reversed.**
   *
   * It used to come last, on the rule that "a fixed order is what stops the two
   * being a race" — which was right about needing a fixed order and free to
   * pick either one, because nothing then depended on which. Something does
   * now: `playRun` asks who learns a move *after* the capture is decided and
   * against the party the capture produced, so the recorded index names a slot
   * in that party. Applying the card first would resolve it against a party one
   * member shorter, and after a release against one whose members had all
   * shifted down a slot — the move would land on somebody else, silently, and
   * only on the nodes that do both.
   *
   * So the rule is the same rule with the order pinned by something real: the
   * capture is applied first because the question after it was asked that way.
   *
   * Still after the wipe check, for the reason every other payout is: a party
   * gained after the run ended would be a run un-ending itself.
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
      advanced.currentSegment,
      // Pre-resolution, matching `playRun`'s legality check and the gym branch
      // above. Nothing on this path clears a gym, so it is also `advanced`'s.
      partyCapacity(state),
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

  /*
   * The reward, applied after the capture and only here.
   *
   * After the wipe check, so a heal can never resurrect a finished run — and
   * `playRun` will not even have asked, because it gates the question on
   * winning the fight. After `betweenNodes`, so a heal reward is not undone by
   * the node boundary that follows it. After the capture, per the note above.
   *
   * This is the hook Stage 1 built `resolveNode` around, and `applyReward` is
   * the only path through it. A reward screen that changed party state itself
   * would bypass the seam, and the symptom would be a replay that reconstructs
   * a different run from the same log.
   */
  if (result.reward) advanced = applyReward(advanced, result.reward);
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
  chooseEventOption: (event: EventInstance, state: RunState) => Promise<EventArchetype>;
  /*
   * `chooseMoveRecipient` and `chooseMoveToReplace` were here and are retired,
   * not deprecated.
   *
   * They were the two questions a taught move asked at the node that paid for
   * it, and no move is taught at a node any more. Both questions still get
   * asked — a TM has to reach somebody eventually — but they are asked while a
   * player composes an `ItemPlan`, which is one decision recorded as one entry,
   * so they are internal to whoever is answering `chooseItemPlan` rather than
   * being policy methods with their own log entries.
   *
   * Leaving them on the interface would have left two seams nothing calls, and
   * the next reader would have to discover by grep that answering them changes
   * nothing. `RunDecision` loses `target` and `replace` for the same reason.
   */
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
    /**
     * The party slots the run has right now. **Stage 4.8, item 1.**
     *
     * Handed in rather than left for the policy to work out, because the policy
     * is where "is there room" is decided and a policy reading a fixed size is
     * the exact failure the item warns about: a bot that declines at three while
     * the run has five slots measures a game nobody is playing. It is the same
     * number `decisionRefusal` then checks the answer against.
     */
    capacity: number,
  ) => Promise<AcquisitionDecision>;
  /**
   * Who leads the gym battle. A party slot. **Stage 4.7, Part 2.**
   *
   * Asked once per gym, between the last node of a segment and the gym itself,
   * on a screen that is not a node: it costs no step from the node budget, it
   * carries no tier, it pays nothing, and it consumes no RNG. A gym was
   * previously just another node the player walked into, and this is the one
   * decision that belongs in front of it.
   *
   * Takes the `GymDefinition` because the leader's type is the whole of what
   * makes one lead better than another here, and takes the state like every
   * other question on this interface. What it does *not* do is annotate,
   * order, or mark the party by matchup — the leader's type is on screen, the
   * party is on screen, and connecting them is the decision. See the Part 4
   * editorial rule.
   *
   * The answer is applied with `party.setLead`, which is a reorder. Returning
   * the slot of a fainted member is refused rather than clamped.
   */
  chooseLead: (
    party: readonly PokemonState[],
    gym: GymDefinition,
    state: RunState,
  ) => Promise<number>;
  /**
   * Which branch a member evolves along. **Stage 4.9.**
   *
   * Asked on a gym clear for each member whose species forks at the new level,
   * after the level-up and before the gym's own questions. The question names
   * the member and the options in dex order; the answer is an index into them.
   * There is no decline: evolution is automatic, and a member with one target
   * never reaches this. Player decisions consume no RNG, so the seed is
   * untouched by whatever is answered here.
   */
  chooseEvolution: (question: EvolutionQuestion, state: RunState) => Promise<number>;
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
  /**
   * Fired after every node resolves, with the run state either side of it.
   *
   * **Observation only, and it exists because of a specific failure.** The
   * simulator used to report what an event *cost* by reading the outcome
   * object — the thing that says a cost was applied — rather than by looking at
   * the run. That is a measurement which cannot see the one defect it most
   * needs to: a cost folded correctly and then dropped by the caller reads as
   * charged, because the outcome object still says it was. `resolveNode` did
   * exactly that with `backpack` for four stages
   * (`docs/generation.md` section 14).
   *
   * So this hands out both states and lets the caller diff them. It changes
   * nothing about the run: `beforeNode` is the state the node was resolved
   * from and the fired value is the same object the loop continues with.
   */
  onNodeResolved?: (before: RunState, after: RunState, result: NodeResult) => void;
  /**
   * One opponent for every fight in the run.
   *
   * **Kept, and no longer the default.** The simulator's controlled
   * comparisons rest on it — `--policy no-switch` is the same AI wrapped, and
   * `--ai pinned` is the pre-tier opponent — so a caller that wants one bot in
   * every fight still gets exactly that. When it is set, `opponentFor` is not
   * consulted and no tier is read.
   */
  opponent?: Policy;
  /**
   * The opponent for one node, built fresh for each fight.
   *
   * **Per node, because a tier is a property of the node and noise is a
   * property of the battle.** `aiTierFor` reads the node's kind, its tier and
   * its segment; the profile's rolls come from a stream derived from that
   * battle's own sim seed, which map generation drew under `nodeKey`. Building
   * one policy for the whole run would share a single noise sequence across
   * every fight, so a run's eighth battle would depend on how long its first
   * one lasted — which is a draw whose position depends on play, and the seeds
   * document forbids exactly that.
   *
   * Defaults to `tieredOpponentFor`. A caller overriding it is the simulator
   * isolating one flag.
   */
  opponentFor?: (node: NodeSpec, segment: number) => Policy;
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
  const opponentFor = opponentBuilder(options);

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
      /*
       * The pre-gym question, asked here and only here.
       *
       * Inside the node loop and *before* `playNode`, in the branch that
       * already knows the gym is next, so "exactly one lead decision per gym"
       * is a property of the control flow rather than of a counter somebody
       * has to keep right. `atGym` is derived from state, so a replay asks at
       * exactly the same points.
       *
       * It consumes no RNG and it is not a node: nothing about the map, the
       * step budget or the payouts is touched by it.
       */
      const gym = gymForSegment(state.currentSegment);
      const index = await policy.chooseLead(state.party, gym, state);
      record({ kind: 'lead', index });
      state = chooseLead(state, index);
      options.onState?.(state);
    } else {
      const choice = await policy.chooseNode(nodeOptions(state), state);
      record({ kind: 'node', index: choice });
      node = nextNode(state, choice);
    }

    const result = await playNode(state, node, policy, record, opponentFor, options);

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
      const stock = resolveStock(result.node.shop, state.relics);
      result.shopStock = stock;
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
      /*
       * **The two questions a bought TM used to ask are gone with the teach.**
       *
       * A purchased move goes into the bag like everything else, so a basket
       * holding two TMs asks nothing at all here and the running-party dance
       * above it is no longer needed: nothing a purchase does can change what
       * the next purchase in the same basket is allowed to do. `applyPurchases`
       * folds them in the same shelf order and the two readings stay identical
       * because there is now only one thing to read.
       */
    }

    if (result.node.event) {
      const event = result.node.event;
      const archetype = await policy.chooseEventOption(event, state);
      record({ kind: 'event', archetype });
      /*
       * The archetype names the button, and the button has to be one the run
       * was actually offered. A policy answering `attune` at a band below
       * `known` is refused here rather than silently paid: that is a log
       * replaying into a decision the run never presented, which is the failure
       * the whole decision-log design exists to prevent.
       */
      const band = resolveCapability(state, event.requires);
      const chosen = presentedOptions(event, band).find((option) => option.archetype === archetype);
      if (!chosen) {
        throw new RangeError(
          `Event option ${archetype} was not offered at band ${band} (${presentedOptions(event, band)
            .map((option) => option.archetype)
            .join(', ')})`,
        );
      }
      result.eventChoice = archetype;

      /*
       * **The two questions this used to ask are gone, and that absence is the
       * playtest report that opened the stage.**
       *
       * An event's move grant was the one route that never let the player say
       * no. It was not chosen over two alternatives the way a card was, and it
       * carried no decline the way a gym's did, so a 40 BP Water Gun could land
       * on a Lv14 Deino and take a slot for it. It is a TM now: the grant still
       * resolves here — `chosenEventOutcome` is still the single definition of
       * which of the sixteen drawn outcomes this button pays, read rather than
       * re-derived — and what changed is only that the move it names goes into
       * the bag instead of onto a Pokemon.
       *
       * `RUN_LOG_VERSION` moved to 14 when these two entries arrived here and
       * moves to 18 now they are gone, for the same reason both times: a
       * question in a place the previous log has no answer for is a changed
       * sequence, and so is its absence.
       */
      const paid = chosenEventOutcome(result, state);
      const move = paid ? grantedMove(paid) : null;
      if (move) result.eventMove = { kind: 'tm', move };
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
    /*
     * Resolved once, here, against what the run holds right now.
     *
     * A relic card is drawn abstract at map generation — a shuffled relic
     * order and an ordinary fallback — because which relic is still available
     * depends on play. `resolveOffer` collapses it, and it is called in
     * exactly one place so that the card the player is shown, the index the
     * log stores, and the card `applyReward` applies are the same object. It
     * consumes no RNG and it is idempotent; an offer with no relic in it is
     * returned unchanged.
     */
    const drawn = won ? (result.node.reward ?? null) : null;
    const offer = drawn ? resolveOffer(drawn, state.relics) : null;
    let reviewedIndex: number | null = null;

    if (result.battle && policy.reviewBattle) {
      const picked = await policy.reviewBattle(
        {
          node: result.node,
          result: result.battle.result,
          won,
          party: result.battle.party,
          contribution: result.battle.contribution,
          currencyEarned: won ? nodePayout(result.node, state.currentSegment, applyRelicPassives(state.relics)) : 0,
          offer,
        },
        state,
      );
      // Null for a node with no offer is the expected answer and records
      // nothing. A number there would be an answer to a question nobody asked.
      if (offer) reviewedIndex = picked ?? 0;
    }

    /*
     * **Part A of a gym clear, asked before the cards. Stage 4.8, item 2.**
     *
     * A gym pays twice: a guaranteed move at the gym band chain, then a choice of
     * two. The move is asked first because it is the unconditional half — the
     * player is told what they got, then asked what they want — and because the
     * order inside the decision log has to be fixed by the code rather than by
     * which branch happened to run.
     *
     * Gated on the win, like every other payout: `node.gymMove` is drawn for every
     * gym at map generation, and a gym that was not beaten ends the run.
     *
     * **This is what moved `RUN_LOG_VERSION`.** The questions are the existing
     * `target` and `replace` pair, but they are asked in a place no earlier log has
     * an answer for, and the guard's own comment is explicit that "a new question
     * in a new place is a changed sequence even when every entry in it is an old
     * shape". `docs/generation.md` section 7c records the deviation from the
     * prompt, which expected no bump.
     */
    /*
     * **Stage 4.9: the evolutions a gym clear unlocks, asked first.**
     *
     * Before the gym's own questions, in the order `resolveNode` applies them:
     * the party levels, then evolves, then takes its cards. Only the branches
     * are questions; a single-target step is applied without one, so a party
     * that never reaches a fork adds nothing to the log. The gate is
     * `gymClearLevel` — the last gym's win ends the run and levels nobody, so
     * it asks nobody. `pendingEvolutionQuestion` is fed the answers so far and
     * returns the next unanswered fork, which is how a mid-chain branch
     * (Wurmple) is asked before the step that depends on it is computed.
     */
    if (result.node.kind === 'gym' && result.battle?.result.winner === 'p1') {
      const level = gymClearLevel(state);
      if (level !== null) {
        const answers: number[] = [];
        for (
          let question = pendingEvolutionQuestion(state.party, level, answers);
          question;
          question = pendingEvolutionQuestion(state.party, level, answers)
        ) {
          const index = await policy.chooseEvolution(question, state);
          record({ kind: 'evolve', index });
          if (!Number.isInteger(index) || index < 0 || index >= question.options.length) {
            throw new RangeError(
              `Evolution choice ${index} out of range for ${question.member.spec.species} (${question.options.length} options)`,
            );
          }
          answers.push(index);
        }
        result.evolutions = answers;
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
    const offered = acquisitionOffered(result, state);
    const earned = result.battle ? result.battle.result.winner === 'p1' : true;
    if (offered && earned) {
      const decision = await policy.chooseAcquisition(offered, state.party, partyCapacity(state));
      record({ kind: 'acquisition', decision });
      const refusal = decisionRefusal(state.party, decision, partyCapacity(state));
      if (refusal) throw new RangeError(`Acquisition decision is not legal: ${refusal}`);
      result.acquisition = { offer: offered, decision };
    }

    /*
     * **Every move question, asked here, against the party the capture left.**
     *
     * This is item 1. It used to run above the block before it, and the order
     * was wrong in a way that only shows on the one node that does both: a wild
     * fight that pays a TM and then offers its Pokemon asked "who learns
     * Earthquake" while the Pokemon the player was about to catch was still
     * standing on the other side of the field. The new member was never on the
     * list, and the player had already spent the card by the time they could
     * have wanted it there.
     *
     * **That ordering problem is gone with the questions, and the ordering is
     * kept anyway.** Nothing at this node names a party member any more — a
     * move goes to the bag — so no index here has to agree with a party
     * somewhere else. What survives is the plainer reason for the same order:
     * a capture is the biggest thing a node can hand over, and the item plan
     * asked at the end of the node has to be composed against the party that
     * actually came out of it.
     */

    if (result.node.kind === 'gym' && result.node.gymMove && result.battle?.result.winner === 'p1') {
      const granted = result.node.gymMove;
      /*
       * **The decline that used to live here is gone, and it is not a
       * regression.**
       *
       * A gym's move was the one taught move nobody chose over alternatives, so
       * it was the one that could be handed back — that was the argument, and it
       * was right for a game where a move was taught the moment it arrived.
       * Under a TM inventory nothing is taught at a node, so there is no moment
       * here to decline: the gym's move goes into the bag on the same terms as
       * every other, and the decision it was standing in for — is this worth a
       * slot — is now asked of it by the capacity rule, continuously, until the
       * player spends it or throws it away.
       *
       * So `DECLINED_MOVE` and the `allowSkip` overload are retired rather than
       * extended to the other three routes, which is what the playtest report
       * asked for and the opposite of what the design it arrived with needs.
       * `docs/spec/gymrun-stage-moves-as-inventory-tms.md` section 6.
       */
      result.gymMove = granted;
    }

    /*
     * The card, and nothing after it.
     *
     * **`isTargeted` and the pair of questions behind it are gone from this
     * seam.** A move card now pays a TM into the bag exactly as an item card
     * pays an item, so there is no longer a class of card that needs a party
     * member named at the moment it is taken — which was the last thing making
     * a move card a different kind of object from every other reward.
     */
    if (offer) {
      /*
       * **The card is recorded here, after Part A, exactly where it was.**
       *
       * The answer itself was taken at the top, on the result screen, and it
       * has been sitting in `reviewedIndex` ever since — that is unchanged and
       * predates this patch. What the log fixes is the *order the entries go
       * in*, and this pair is the one Stage 4.8 item 2 pinned: the gym's
       * unconditional move before the card chosen over two others. Moving the
       * `reward` entry above it would have been a second reordering with
       * nothing asking for it.
       */
      const index = reviewedIndex ?? (await policy.chooseReward(offer, state));
      reviewedIndex = null;
      record({ kind: 'reward', index });
      const choice = offer.options[index];
      if (!choice) throw new RangeError(`Reward choice ${index} out of range (${offer.options.length} offered)`);
      result.reward = choice;
    }

    const beforeNode = state;
    state = resolveNode(state, result);
    options?.onNodeResolved?.(beforeNode, state, result);

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
      state = applyItemPlan(
        state,
        plan,
        backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics)),
        canTeachAt(result.node.kind),
      );
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
export function acquisitionOffered(result: NodeResult, run: CapabilityContext): AcquisitionOffer | null {
  if (result.node.acquisition) return result.node.acquisition;
  const outcome = chosenEventOutcome(result, run);
  /*
   * The grant list rather than the outcome itself, since the rejig: an outcome
   * is a list of effects and a Pokemon is one of them. `T3` pairs it with an
   * item, so the offer is never the only thing in the list.
   */
  const offered = outcome?.grant.find((effect) => effect.kind === 'acquisition');
  return offered?.kind === 'acquisition' ? offered.offer : null;
}

/**
 * The outcome the chosen event button actually pays. **The single definition.**
 *
 * Both callers go through it — `acquisitionOffered` above, to find a capture,
 * and `resolveNode` to fold the payout — because they have to agree about
 * which of the three drawn outcomes applies. Two independent band
 * computations is two chances to read a different party, and the symptom
 * would be a capture card offered for an outcome the run then did not apply.
 *
 * The band is read from the state the node was *entered* with. That is the
 * state the map screen showed the requirement against, so the band the player
 * was told about is the band they get — a fight that killed the run's only
 * Water type on the way in does not silently downgrade the payout.
 */
export function chosenEventOutcome(result: NodeResult, run: CapabilityContext): EventOutcome | null {
  const event = result.node.event;
  if (!event || result.eventChoice === undefined) return null;
  const option = optionOf(event, result.eventChoice);
  if (!option) return null;
  return outcomeFor(option, resolveCapability(run, event.requires));
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
    teaches: plan.teaches.map((teach) => ({ ...teach })),
    discardTms: [...plan.discardTms],
  };
}

/**
 * The four axes this build stamps a log with and checks a log against.
 *
 * One function so the stamp and the guard cannot disagree: `makeLog` writes
 * exactly what `versionMismatch` reads.
 */
export function currentVersions(): RunLogVersions {
  return {
    runLog: RUN_LOG_VERSION,
    contentHash: CONTENT_HASH,
    aiVersion: AI_VERSION,
    randomizerVersion: RANDOMIZER_VERSION,
  };
}

/** The one place a `RunLog` is built, so every stamp on it agrees. */
function makeLog(seed: string, decisions: RunDecision[]): RunLog {
  return { seed, versions: currentVersions(), decisions };
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
 * The opponent a fight is played by, and where a tier becomes a behaviour.
 *
 * **The first time node tier changes how a fight plays rather than only what it
 * pays.** Stage 3 put the risk gradient in the reward pools and nowhere else,
 * so an elite node paid better for a fight that played identically to a normal
 * one. `data/ai.ts` holds the table; there is no logic here beyond reading it.
 *
 * The stream is the battle's own, per `core/rng.ts`'s `createAiStream`: fixed
 * by the seed, unmoved by anything the player does, and consuming nothing from
 * any keyed stream. A replay re-runs this same builder over the same nodes and
 * draws the same values in the same order, which is what keeps a run log
 * replayable when the opponent's choices are not in it.
 */
export function tieredOpponentFor(node: NodeSpec, segment: number): Policy {
  const tier = aiTierFor(node.kind, node.tier, segment);
  const encounter = node.encounter;
  // A node with no encounter never reaches here through `playNode`, and a
  // caller asking anyway gets the deterministic form rather than a throw.
  if (!encounter) return aiPolicy(AI_TIERS[tier]);
  return aiPolicy(AI_TIERS[tier], createAiStream(encounter.simSeed, 'p2'));
}

function opponentBuilder(options: PlayRunOptions): (node: NodeSpec, segment: number) => Policy {
  if (options.opponent) return () => options.opponent as Policy;
  return options.opponentFor ?? tieredOpponentFor;
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
  opponentFor: (node: NodeSpec, segment: number) => Policy,
  options: PlayRunOptions,
): Promise<NodeResult> {
  if (!node.encounter) return { node };
  const opponent = opponentFor(node, state.currentSegment);

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
      contribution: run.contribution,
      casualties: run.casualties,
      consumed: run.consumed,
    },
  };
}

// ---------------------------------------------------------------------------
// Scripted policies
// ---------------------------------------------------------------------------

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
export function defaultItemPlan(state: RunState, canTeach = false): ItemPlan {
  const capacity = backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics));
  const assignments: ItemAssignment[] = [];

  let taken = 0;
  state.party.forEach((member, slot) => {
    if (member.item !== undefined) return;
    const item = state.backpack[taken];
    if (item === undefined) return;
    assignments.push({ slot, item });
    taken++;
  });

  /*
   * **Rule 3: at a rest or a shop, teach every TM to slot 0, displacing what
   * `defaultMoveReplacement` names.**
   *
   * This is the old baseline restated, not a new judgement. Before moves became
   * inventory, `scriptedRunPolicy` answered `chooseMoveRecipient` with `0` and
   * `chooseMoveToReplace` with `defaultMoveReplacement`, so every scripted run
   * took every move it was paid and put it on the lead. A baseline that stopped
   * teaching would make every seed-pinned figure in this repo a measurement of
   * a game where movesets never improve, and the drift would look like the
   * stage's doing rather than the baseline's.
   *
   * Walked against the party the earlier teaches have already changed, because
   * `applyItemPlan` reads them in order and a `replaceSlot` chosen against a
   * stale moveset is what it throws on.
   */
  const teaches: TmTeach[] = [];
  const kept = [...state.tms];
  if (canTeach) {
    let lead = state.party[0];
    for (const move of state.tms) {
      if (!lead) break;
      const need = replacementNeeded(lead, move);
      const incoming = describeMove(move);
      if (need === 'choose' && !incoming) continue;
      const replaceSlot = need === 'choose' ? defaultMoveReplacement(lead, incoming!) : null;
      teaches.push({ move, slot: 0, replaceSlot });
      lead = teachMove(lead, move, replaceSlot);
      kept.splice(kept.indexOf(move), 1);
    }
  }

  /*
   * Over the line, the oldest items go, then the oldest TMs — the same order
   * `reconcileItemPlan` sheds in, and the reason is the same: the two lists
   * have no shared clock, so "the oldest" can only be stated within one of
   * them.
   */
  const left = state.backpack.slice(taken);
  const over = left.length + kept.length - Math.max(0, capacity);
  const fromItems = Math.max(0, Math.min(over, left.length));
  return {
    assignments,
    discards: left.slice(0, fromItems),
    teaches,
    discardTms: over > fromItems ? kept.slice(0, over - fromItems) : [],
  };
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
    /*
     * Slot 0, which is the party order the run already had. The baseline
     * changes nothing about who leads, which is what makes it a baseline: a
     * scripted answer with a matchup preference in it would put a routing
     * heuristic into every sweep this policy appears in. `--policy lead-swap`
     * in the simulator is where a real preference belongs.
     */
    chooseLead: async () => 0,
    // The first branch in dex order. Same reasoning as the lead: a baseline
    // with a preference would put an evolution heuristic into every sweep.
    chooseEvolution: async () => 0,
    chooseReward: async () => 0,
    // Buys nothing. A scripted baseline that spent money would make every
    // sweep it appears in a measurement of one shopping heuristic.
    chooseShopPurchases: async () => [],
    chooseEventOption: async () => 'safe',
    // The lead, which is slot 0 and the member the Stage 3 code targeted
    // implicitly. A baseline that spread items around would make every sweep it
    // appears in a measurement of one targeting heuristic.
    // The lead, which is slot 0 and the member the Stage 3 code targeted
    // implicitly. A baseline that spread moves around would make every sweep it
    // appears in a measurement of one targeting heuristic.
    /*
     * Slot 0, and **never the decline**, even at the gym where one is offered.
     *
     * A baseline that sometimes refused a free move would measure a different
     * game from one that never does, and every balance figure recorded against
     * this policy would carry a move-economy heuristic inside it. The decline
     * is a player's judgement about a party this policy does not have opinions
     * about. `scripts/sim.ts` is where a bot that weighs it belongs.
     */
    /*
     * Fills the party, then declines.
     *
     * Not "always decline", which would measure a game with no acquisition in
     * it, and not "always take", which at a full party means releasing someone
     * on every offer and would measure a bot churning its own team. Taking
     * while there is room is the floor on competent play, which is what a
     * baseline wants.
     */
    chooseAcquisition: async (_offer, party, capacity) =>
      hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
    chooseItemPlan: async (state) => defaultItemPlan(state, canTeachNow(state)),
    battle,
  };
}

// ---------------------------------------------------------------------------
// Save, resume, replay
// ---------------------------------------------------------------------------

/** The axes, in the order a mismatch is reported. The schema first: a log with no block fails here. */
export const VERSION_AXES = ['runLog', 'contentHash', 'aiVersion', 'randomizerVersion'] as const satisfies readonly (keyof RunLogVersions)[];

export type VersionAxis = (typeof VERSION_AXES)[number];

/** One axis that did not match: which, what the log said, what this build is. */
export interface VersionMismatch {
  axis: VersionAxis;
  recorded: string;
  expected: string;
}

/**
 * The first axis on which a log disagrees with this build, or null if none.
 *
 * One guard for all four axes, so there is one message format and one place
 * a fifth axis would be added. Checked in `VERSION_AXES` order.
 *
 * A log with no `versions` block at all — every log from before this release
 * — is refused on the `runLog` axis without reading further, whatever its
 * loose `version` field says: the block is the schema, and a log without it is
 * a log recorded on an older one. That field is read for the *message* only,
 * so a `gymrun-run-12` log is refused with its own version quoted rather than
 * as `(none)`. A message that names both sides is the whole point.
 */
export function versionMismatch(log: RunLog): VersionMismatch | null {
  const expected = currentVersions();
  const versions: unknown = log.versions;
  if (typeof versions !== 'object' || versions === null) {
    const legacy = (log as unknown as { version?: unknown }).version;
    return { axis: 'runLog', recorded: typeof legacy === 'string' ? legacy : '(none)', expected: expected.runLog };
  }
  const recorded = versions as Partial<Record<VersionAxis, unknown>>;
  for (const axis of VERSION_AXES) {
    const value = recorded[axis];
    if (value !== expected[axis]) {
      return { axis, recorded: typeof value === 'string' ? value : '(none)', expected: expected[axis] };
    }
  }
  return null;
}

/** The one message format. Names the axis and both values. */
export function describeVersionMismatch(mismatch: VersionMismatch): string {
  return (
    `RunLog version mismatch on ${mismatch.axis}: the log was recorded on ${mismatch.recorded}, ` +
    `this build is ${mismatch.expected}. The same seed and decisions would not reproduce the same run.`
  );
}

/** Whether a stored log was recorded against this build on every axis. */
export function isReplayable(log: RunLog): boolean {
  return versionMismatch(log) === null;
}

/**
 * Reject an incompatible log loudly.
 *
 * Replaying a log from another build would not fail — it would produce a
 * plausible run that is not the run the player recorded, which is the worst
 * available outcome. So: refuse, and say which axis and what was found. Each
 * axis points at a different fix — a `runLog` mismatch means the log is old,
 * `contentHash` means a tuning pass moved the data under it, `aiVersion` that
 * the opponent plays differently, `randomizerVersion` that a draw moved in
 * code — and a reader diagnosing the refusal wants to know which.
 */
export function assertReplayable(log: RunLog): void {
  const mismatch = versionMismatch(log);
  if (mismatch) throw new Error(describeVersionMismatch(mismatch));
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
      return decision.kind === 'event' ? decision.archetype : exhausted('event');
    },
    /*
     * `allowSkip` is threaded straight through to the live tail. The recorded
     * head needs nothing for it: a log entry carries whatever was answered the
     * first time, `DECLINED_MOVE` included, and `askMoveQuestions` is the one
     * that decides whether that answer is legal where it lands. A replay that
     * offered the decline somewhere the recording did not would be the two runs
     * asking different questions, which is the failure the guard above refuses
     * the log for rather than something to reconcile here.
     */
    chooseAcquisition: async (offer, party, capacity) => {
      const decision = next('acquisition');
      if (!decision) return live ? live.chooseAcquisition(offer, party, capacity) : exhausted('acquisition');
      return decision.kind === 'acquisition' ? decision.decision : exhausted('acquisition');
    },
    chooseLead: async (party, gym, state) => {
      const decision = next('lead');
      if (!decision) return live ? live.chooseLead(party, gym, state) : exhausted('lead');
      return decision.kind === 'lead' ? decision.index : exhausted('lead');
    },
    chooseEvolution: async (question, state) => {
      const decision = next('evolve');
      if (!decision) return live ? live.chooseEvolution(question, state) : exhausted('evolve');
      return decision.kind === 'evolve' ? decision.index : exhausted('evolve');
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
