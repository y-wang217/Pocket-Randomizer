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
 * Switching is out of scope for Stage 0, so the union has one member. It is a
 * discriminated union rather than a bare number specifically so that adding
 * `{ kind: 'switch' }` later is an additive change that the compiler will walk
 * us through, instead of a signature break.
 */
export type Choice = { kind: 'move'; /** 1-based, matching the sim's `move N`. */ slot: number };

export function moveChoice(slot: number): Choice {
  return { kind: 'move', slot };
}

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
  /** True when this side owes the sim a decision. */
  awaitingChoice: boolean;
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
  | { kind: 'battle'; choice: Choice };

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
  decisions: RunDecision[];
}
