/**
 * Battle state. **Plain JSON**: no classes, no `Map`, no `Set`, no functions,
 * so a state can be saved, diffed, logged and pasted into a bug report.
 *
 * The plan lives here, not in the UI. `select` and `unselect` edit
 * `state.plan`, and every legality question is answered from this object.
 */
import type { CardOwner, Col, Cond, EnemyDefId, Lane, Pos, UnitBoost, UnitDefId } from './defs';

export type { Pos, Lane, Col };

export type UnitId = UnitDefId;
/** `e{spawnIndex}`. */
export type EnemyId = string;
/** `c{index}` in the deck's unshuffled order. */
export type CardIid = string;

export interface UnitState {
  id: UnitId;
  /** `null` once fainted: a fainted unit leaves the board. */
  pos: Pos | null;
  hp: number;
  maxHp: number;
  shield: number;
  baseShield: number;
  mp: number;
  fainted: boolean;
  /** Start-of-turn MP still owed by a card (Focus): one entry per grant. */
  pendingMp: { n: number; turns: number }[];
}

export interface Intent {
  act: 'none' | 'strike' | 'pierce' | 'slash' | 'shield' | 'scream';
  n: number;
  /** The step's name for its act, when it has one (Crush, Stomp). */
  label?: string;
  /** The tiles the action will hit, from the enemy's position when telegraphed. */
  tiles: Pos[];
}

export interface EnemyState {
  id: EnemyId;
  def: EnemyDefId;
  spawnIndex: number;
  /** `null` once dead, and before its wave arrives. */
  pos: Pos | null;
  hp: number;
  shield: number;
  baseShield: number;
  /** The wave it belongs to, from 0. */
  wave: number;
  /** Where it arrives: its scenario tile, or the one drawn for it at creation (`null` only before then). */
  spawn: Pos | null;
  /** Index into the script's cycle of the step it is on. */
  step: number;
  /** Turns of a Harpoon's pin still to come (D); 0 when free. */
  pinned: number;
  /** The base shield a Harpoon took, returned on its second pinned turn. */
  stripped: number;
  /** Its one stalk is spent (D3). */
  stalked: boolean;
  /** The step's conditions, evaluated once in the move phase; the act reads these. */
  conds: Partial<Record<Cond, boolean>>;
  intent: Intent | null;
}

export interface CardInstance {
  iid: CardIid;
  def: string;
  owner: CardOwner;
  /** Granted by an enemy (the Colossus's Harpoon), not dealt from the deck: drawn black. */
  granted?: true;
}

/** `reserve`: a card an enemy grants, out of the battle until its wave arrives. */
export type PileName = 'draw' | 'hand' | 'discard' | 'spent' | 'removed' | 'reserve';
export type Piles = Record<PileName, CardIid[]>;

/** A unit for a friendly choice, an enemy for a damage target. */
export type TargetId = UnitId | EnemyId;

export interface Choice {
  unit?: TargetId;
  tile?: Pos;
}

export interface PlannedPlay {
  card: CardIid;
  unit: UnitId;
  choice?: Choice;
}

export interface BattleState {
  seed: string;
  encounterId: string;
  deckId: string;
  /** Draws taken from the battle's own stream; see `docs/generation.md` section 125. */
  rngDraws: number;
  /** The round of the current wave: it starts again at 1 each wave. */
  round: number;
  /** The wave being fought, from 0. */
  wave: number;
  /**
   * `deploy` until the player starts the battle: units are placed, the hand
   * is drawn, and no enemy has moved or telegraphed yet.
   */
  phase: 'deploy' | 'plan' | 'won' | 'lost';
  /** In encounter order, which is the deck's unit order. */
  units: UnitState[];
  /** In spawn order. */
  enemies: EnemyState[];
  cards: Record<CardIid, CardInstance>;
  piles: Piles;
  plan: PlannedPlay[];
  /** Uses left on each card that has the keyword, by instance (D7). */
  uses: Record<CardIid, number>;
  /** Extra draws owed to the next hand (Need Help). */
  pendingDraws: { n: number; filter: 'notOwner'; owner: CardOwner }[];
  /** The card run's boosts to each unit (`Loadout.units`); absent in a sandbox battle. */
  boosts?: Partial<Record<UnitDefId, UnitBoost>>;
}

export type Action =
  | { type: 'select'; card: CardIid; unit: UnitId; choice?: Choice }
  | { type: 'unselect'; planIndex: number }
  | { type: 'commit' }
  /** Deploy only: put a unit on a home tile, swapping with a unit already there. */
  | { type: 'place'; unit: UnitId; tile: Pos }
  /** Deploy only: the placement stands and round 1 begins. */
  | { type: 'start' };

/** Why a card cannot be played by a unit right now. */
export type PlayBlock = 'noMp' | 'noSlot' | 'wrongZone' | 'noTarget' | 'fainted' | 'outOfRange';

export type IllegalReason =
  | PlayBlock
  | 'malformed'
  | 'battleOver'
  | 'notInHand'
  | 'alreadyPlanned'
  | 'notOwner'
  | 'badChoice'
  /** Legal alone, but it would make an earlier play in the plan illegal. */
  | 'breaksPlan'
  | 'badPlanIndex'
  /** A card action before the battle has started. */
  | 'deploying'
  /** A placement after it has. */
  | 'notDeploying';
