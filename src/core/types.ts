/**
 * The vocabulary shared by every layer of GYMRUN.
 *
 * Nothing here knows about the DOM, and nothing here knows about @pkmn/sim.
 * That is the point: `ui/` and `core/battle/driver.ts` both speak these types,
 * so either can be replaced without touching the other.
 */

/** The two sides of a battle, named the way the sim protocol names them. */
export type SideId = 'p1' | 'p2';

export function opposingSide(side: SideId): SideId {
  return side === 'p1' ? 'p2' : 'p1';
}

// ---------------------------------------------------------------------------
// Team specs
// ---------------------------------------------------------------------------

/**
 * A Pokemon described declaratively, never as a Showdown export string.
 *
 * Stage 0 hardcodes two of these in data/mons.ts. Stage 2's randomizer will
 * emit the exact same type from generated rolls. The battle layer must never
 * be able to tell the difference — that is the whole reason this type exists
 * instead of a paste.
 */
export interface PokemonSpec {
  species: string;
  ability: string;
  /** Up to 4. Illegal-for-the-species moves are allowed and expected. */
  moves: string[];
  level: number;
  /** Unused in Stage 0, but wired through the sim so items work on day one. */
  item?: string;
  nickname?: string;
}

export type TeamSpec = PokemonSpec[];

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

/**
 * A decision a side can submit.
 *
 * Stage 0 shipped this as a one-member union specifically so that adding
 * `{ kind: 'switch' }` would be an additive change the compiler walks us
 * through. Stage 2 is that change, and it arrives earlier than Stage 4 for a
 * reason worth writing down: gym leaders now field more than one Pokemon, and
 * a side with a bench gets a **forced switch request** from the sim the moment
 * its active faints. A policy that can only answer `move N` cannot answer it.
 *
 * Stage 4 is where the second member stops being reachable only on a forced
 * switch. Voluntary mid-turn switching changes what a turn *is* — it consumes
 * one, and the incoming member takes the opponent's attack — so every balance
 * number recorded before this stage was measured in a different game and none
 * of them carried forward. The type did not have to change, which was the whole
 * point of writing it as a union in Stage 0.
 */
export type Choice =
  | { kind: 'move'; /** 1-based, matching the sim's `move N`. */ slot: number }
  | { kind: 'switch'; /** 1-based index into the side's current team order. */ slot: number };

export function moveChoice(slot: number): Choice {
  return { kind: 'move', slot };
}

export function switchChoice(slot: number): Choice {
  return { kind: 'switch', slot };
}

// ---------------------------------------------------------------------------
// Difficulty tiers
// ---------------------------------------------------------------------------

/**
 * How hard a node is, carried on every node and passed to the randomizer.
 *
 * Stage 2 writes `normal` everywhere and never displays it. It exists now
 * because Stage 3 exposes it to the player and keys reward pools to it, and
 * retrofitting a field onto generated map data would invalidate every seed
 * recorded before the change. `data/scaling.ts` holds what each tier actually
 * does; at `normal` it does nothing at all, which is the honest state of it.
 */
export type Tier = 'normal' | 'hard' | 'elite';

// ---------------------------------------------------------------------------
// Battle view — what a policy is allowed to see
// ---------------------------------------------------------------------------

export type StatName = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type BoostName = StatName | 'accuracy' | 'evasion';
export type StatStages = Record<BoostName, number>;
export type StatsTable = Record<'hp' | StatName, number>;
export type StatusName = 'brn' | 'par' | 'slp' | 'frz' | 'psn' | 'tox';

export const BOOST_NAMES: readonly BoostName[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];

export function emptyStatStages(): StatStages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
}

export interface MoveView {
  /** 1-based slot, the value to hand back in a `Choice`. */
  slot: number;
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  /** 0 for status moves; `basePower` as the sim reports it. */
  basePower: number;
  accuracy: number | true;
  pp: number;
  maxPp: number;
  /** False when the move is disabled, out of PP, or otherwise unusable now. */
  usable: boolean;
}

/**
 * A benched Pokemon, as offered to a forced switch.
 *
 * Public only to its own side. The opponent's bench is not in `BattleView` at
 * all: a policy that could read it would be estimating matchups with
 * information no player has, and the balance sweep would then be measuring a
 * bot that cheats.
 */
export interface SwitchView {
  /** 1-based index into the side's *current* team order, for `switch N`. */
  slot: number;
  species: string;
  name: string;
  level: number;
  types: string[];
  ability: string;
  /** Move ids, so a policy can estimate what this member would threaten with. */
  moves: string[];
  hp: number;
  maxHp: number;
  hpFraction: number;
  status: StatusName | null;
  fainted: boolean;
  /** False when the sim will not accept a switch to it right now. */
  usable: boolean;
  /**
   * Why it is not usable, or null when it is.
   *
   * Carried rather than derived because the reasons are not all visible from
   * the rest of this record: `fainted` and `active` are, and trapping is not —
   * it is a property of the *opponent* that the adapter read off the request.
   * The battle screen shows an illegal switch disabled with this reason
   * attached rather than hiding the row, so a trapped player can see that they
   * are trapped instead of watching their bench silently disappear.
   *
   * Typed as the string union in `battle/switching.ts`, spelled out here
   * because core/types.ts may not import from battle/.
   */
  block: 'fainted' | 'active' | 'trapped' | 'maybe-trapped' | null;
}

/** A Pokemon as seen on the field. */
export interface ActiveView {
  species: string;
  /** Nickname if the spec set one, otherwise the species. */
  name: string;
  level: number;
  types: string[];
  hp: number;
  maxHp: number;
  /** 0..1, precomputed so the UI never divides by a zero maxHp. */
  hpFraction: number;
  status: StatusName | null;
  statStages: StatStages;
  fainted: boolean;
  /**
   * Known ability, or null when it is not public information.
   *
   * Your own Pokemon always reports its ability. The opponent's reports null:
   * Stage 0 does not track what an ability has revealed about itself, and
   * handing the AI an ability it has not seen used would make the Stage 2
   * balance sweep measure a bot with information no player has. Reveal
   * tracking is the honest way to fill this in later.
   */
  ability: string | null;
}

/**
 * The state a policy decides from.
 *
 * `foe` is public information only — species, level, HP fraction, status,
 * boosts. A policy cannot read the opponent's exact stats or held item any
 * more than a human player could, so the greedy AI has to estimate damage the
 * same way a person does. Keeping that honest now means the Stage 2 balance
 * sweep measures something real.
 */
export interface BattleView {
  /** Which side this view belongs to. */
  side: SideId;
  turn: number;
  ended: boolean;
  me: ActiveView;
  foe: ActiveView;
  /** The moves available this turn, or empty when no choice is pending. */
  moves: MoveView[];
  /** This side's bench. Empty until a party is larger than one. */
  switches: SwitchView[];
  /**
   * True when the sim wants a switch and will not accept a move.
   *
   * A policy must branch on this before it reads `moves`, which is empty here.
   * `usableSwitches(view)` in battle/policy.ts is the intended way to answer.
   */
  forceSwitch: boolean;
  /** True when this side owes the sim a decision. */
  awaitingChoice: boolean;
  /**
   * True when the sim says the active Pokemon may not switch out.
   *
   * A property of the turn rather than of any one bench member, which is why it
   * is here as well as on every blocked `SwitchView`: the battle screen greys
   * the whole panel with one label rather than repeating "trapped" three times,
   * and a policy can skip scoring switches entirely.
   *
   * Covers the sim's `maybeTrapped` as well as its `trapped`. See
   * `battle/switching.ts` for why an unrevealed Arena Trap has to count.
   */
  trapped: boolean;
}

// ---------------------------------------------------------------------------
// Results and logs
// ---------------------------------------------------------------------------

export type BattleEndCause =
  | 'faint'
  /** Ran past the turn cap without a winner. */
  | 'turn-limit'
  /** The sim declared a tie. */
  | 'tie';

export interface BattleResult {
  winner: SideId | null;
  turns: number;
  cause: BattleEndCause;
}

/** One decision, recorded exactly as submitted. */
export interface Decision {
  turn: number;
  side: SideId;
  choice: Choice;
}

/**
 * The replayable record of a single battle.
 *
 * It stores the seed and the decision sequence and nothing else. No HP, no
 * damage rolls, no protocol text — every one of those is *derived*, and
 * storing derived state is how replay logs silently drift out of agreement
 * with the engine that produced them.
 *
 * `version` exists so a log recorded against different mons or a different
 * @pkmn/sim can be recognised as unreplayable rather than replayed wrongly.
 */
export interface BattleLog {
  seed: string;
  version: string;
  decisions: Decision[];
}

// ---------------------------------------------------------------------------
// Party state
// ---------------------------------------------------------------------------

/**
 * A move as an *offer*: everything a card needs to show, with nothing about who
 * knows it.
 *
 * The same fields `MoveView` carries minus the two that only exist once a
 * Pokemon holds the move — the slot it sits in and the PP left on it. That is
 * the point of the separate type: a move reward has no slot and no remaining
 * PP, and giving it placeholder values for both is how a card ends up rendering
 * "PP 0/15" for a move nobody has used.
 *
 * `maxPp` is here because it is a property of the move rather than of the
 * holder, and Part 5 requires a reward card to show it alongside type, base
 * power and category — the same four numbers the battle screen shows, so that a
 * move looks identical everywhere the player sees it.
 */
export interface MoveSpec {
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  /** 0 for status moves. */
  basePower: number;
  accuracy: number | true;
  maxPp: number;
}

/** Remaining PP for one move slot, carried between encounters. */
export interface MoveState {
  id: string;
  name: string;
  pp: number;
  maxPp: number;
}

/**
 * A party member between encounters.
 *
 * This is the *only* thing that persists across a node boundary, and it is
 * deliberately small: identity plus the three resources a run spends — HP, PP
 * and a status condition. Stat stages, volatiles, weather and everything else
 * the sim tracks are per-battle by definition and are not carried, because
 * carrying them would mean serializing a chunk of the engine's internal state
 * and hoping it means the same thing in the next battle.
 *
 * `spec` is the unchanging identity. Everything else is the run's damage to it.
 */
export interface PokemonState {
  spec: PokemonSpec;
  maxHp: number;
  hp: number;
  moves: MoveState[];
  status: StatusName | null;
  fainted: boolean;
  /**
   * The held item, by dex id. Undefined for a Pokemon holding nothing.
   *
   * Here rather than on `spec`, even though `PokemonSpec.item` exists and is
   * what the sim reads. A held item is something the run *did* — acquired,
   * swapped, lost — which puts it on the same side of the identity line as HP
   * and PP. `core/items.ts` merges the two at the moment a battle starts and
   * explains why that merge lives in exactly one place.
   */
  item?: string;
}

// ---------------------------------------------------------------------------
// The backpack
// ---------------------------------------------------------------------------

/**
 * A held item, by dex id. The key `data/items.ts` is indexed on.
 *
 * A named alias rather than a bare `string` because from Stage 4.5.1 an item id
 * travels: it sits on a Pokemon, it sits in the backpack, it moves between the
 * two, and it appears in the run log. Four places calling it `string` is four
 * places where a species id or a move id typechecks just as well.
 */
export type ItemId = string;

/**
 * What one party slot should be holding once a plan is applied.
 *
 * A *destination*, not a move. "Slot 2 holds the Leftovers" replays to the same
 * layout from any starting arrangement, where "take the Leftovers off slot 1
 * and put it on slot 2" only replays correctly if slot 1 was holding it — which
 * is the sort of precondition a log should never have to carry.
 *
 * `null` means the slot holds nothing, and the item it *was* holding goes back
 * to the backpack. Nothing is destroyed by an assignment.
 */
export interface ItemAssignment {
  slot: number;
  item: ItemId | null;
}

/**
 * Everything the player did to their items at one node boundary, as one act.
 *
 * **One decision, not a stream of them, and that is what makes free
 * reassignment loggable.** The spec asks that items be reassignable "any number
 * of times between nodes, at no cost". A log that recorded every swap would
 * grow without bound with the player's fidgeting and would replay their
 * indecision rather than their decision. A log that records the *layout they
 * committed to* is the same size whether they moved one item or twenty, which
 * is why `assignments` is a destination list and not a move list.
 *
 * `discards` is separate because it is the one irreversible act here. Every
 * other part of a plan can be undone by a later plan; a discarded item is gone.
 * The capacity rule is what forces the choice — see `tuning.backpackCapacity` —
 * and `items.applyItemPlan` throws rather than silently trimming if a plan
 * leaves the backpack over it.
 */
export interface ItemPlan {
  assignments: ItemAssignment[];
  discards: ItemId[];
}

// ---------------------------------------------------------------------------
// Run logs
// ---------------------------------------------------------------------------

/**
 * One decision the player made, in the order they made it.
 *
 * Note what is absent: turn numbers on battle choices. A turn number is
 * *derived* — replaying the decisions reproduces it — and the rule that a log
 * holds nothing derived is what keeps replay from drifting. The battle side is
 * absent for the same reason: the player is always p1 and the opponent is a
 * deterministic policy, so recording the opponent's choices would be recording
 * the engine's output rather than the player's input.
 */
export type RunDecision =
  | { kind: 'starter'; index: number }
  | { kind: 'node'; index: number }
  | { kind: 'battle'; choice: Choice }
  /**
   * Which of the three cards was taken. An index, not the reward.
   *
   * The reward itself is *derived* — the offer was drawn from the `rewards`
   * stream at map generation, so replaying the seed reconstructs all three
   * options — and the rule that a log holds nothing derived is what keeps
   * replay from drifting. A log storing `{kind:'item', item:'leftovers'}` would
   * keep replaying happily after a pool edit and hand the player an item their
   * run never offered.
   */
  | { kind: 'reward'; index: number }
  /**
   * Which shelf slots were bought, as indexes into the shop's stock.
   *
   * A set, recorded in the order the player selected them and applied in shelf
   * order — see `economy.applyPurchases`. Indexes rather than items, for the
   * same reason a reward is an index: the shelf is reconstructible from the
   * seed, and a log naming the item would survive a price change and buy
   * something the run never stocked.
   */
  | { kind: 'shop'; indexes: number[] }
  /** Which event option was taken. The outcome was drawn when the map was built. */
  | { kind: 'event'; index: number }
  /**
   * Which party member a targeted reward landed on, as a party slot.
   *
   * Recorded only when the card was actually targeted — an item, a TM or a
   * tutor. A heal is party-wide and a currency card lands nowhere, so asking
   * about those would put an entry in the log for a question nobody was asked,
   * and replay would run out of step at the first one.
   */
  | { kind: 'target'; index: number }
  /**
   * What the player did with a Pokemon on offer.
   *
   * **The one decision stored as a value rather than an index, and the
   * exception is principled.** Every other entry here is an index into
   * something the seed reconstructs, because storing the reward itself would
   * survive a pool edit and hand the player something their run never offered.
   * An acquisition decision is not a selection from a generated list — it is
   * "no", "yes", or "yes, and drop slot 2" — so the value *is* the input, and
   * there is nothing derived in it to drift.
   *
   * Typed structurally here rather than imported from `core/acquisition.ts`,
   * because core/types.ts is the bottom of the dependency graph and imports
   * nothing.
   */
  | {
      kind: 'acquisition';
      decision: { kind: 'decline' } | { kind: 'accept' } | { kind: 'release'; slot: number };
    }
  /**
   * What the player did with their items at this node boundary.
   *
   * **Stored as a value, and it is the second exception to the index rule.**
   * The first is `acquisition`, above, and the justification is the same: a
   * plan is not a selection from a list the seed reconstructs, it is a layout
   * the player composed out of things they already own. There is nothing
   * derived in it to drift when a pool is edited.
   *
   * Recorded only at boundaries where there was something to manage — see
   * `items.needsItemPlan`, which is the single definition shared by the
   * question and the replay, for the same reason `rewards.isTargeted` is.
   */
  | { kind: 'items'; plan: ItemPlan }
  /**
   * Which move slot a taught move displaced, 0-based.
   *
   * **Stage 4.5.1's logic change, and the reason it is a separate entry from
   * `target`.** The two questions are asked in sequence — who learns it, then
   * what it costs them — and they are different questions with different
   * answers, so folding them into one entry would mean a log that could not
   * express "the player picked slot 2, then changed their mind about which move
   * to drop".
   *
   * Recorded only when a replacement was actually chosen. A member with a free
   * move slot is never asked, and neither is one that already knows the move —
   * both conditions are derived from the member and the move, which a replay
   * reconstructs exactly. See `party.replacementNeeded`, which is the single
   * definition shared by the question and the replay.
   */
  | { kind: 'replace'; slot: number };

/**
 * The replayable record of a whole run: a seed and a decision sequence.
 *
 * Stage 0's version of this type held one battle's decisions. Stage 1 widens it
 * to the full run — starter pick, node picks and battle choices interleaved in
 * play order — which is a breaking change to the format, so `version` moves
 * from `gymrun-0.1.0` to the run-log version and old logs are rejected
 * explicitly rather than replayed as something they are not.
 */
export interface RunLog {
  seed: string;
  version: string;
  /**
   * The randomizer's data-and-draw-order version.
   *
   * Separate from `version` on purpose. `version` moves when the *engine* or
   * the log format changes; this moves when a tuning pass changes what a seed
   * rolls — a species pool regenerated, a band window widened, a draw added in
   * the middle of `rollMoveset`. Those changes leave the decision sequence
   * perfectly replayable and quietly reinterpret it as a different run, which
   * is the worst available outcome for a game whose whole promise is that a
   * shared seed is a shared run. So it is checked, and a mismatch throws.
   */
  randomizerVersion: string;
  decisions: RunDecision[];
}
