/**
 * The card engine's definition vocabulary: what a card, a unit, an enemy, an
 * encounter and the rule table are. **The card battle engine, checkpoint 1.**
 *
 * Every shape here is a typed union of plain data, never a callback, so a
 * definition serializes, replays, and can be scored by a bot without running
 * anything (`docs/spec/gymrun-card-battle-engine-prompt.md` section 2). The
 * tables themselves live in `src/cardData/`, outside `src/data/`, so the run's
 * `contentHash` cannot see them (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 *
 * Nothing here imports `@pkmn/*` or anything of the Showdown battle path. The
 * card engine is a separate system that shares only `core/rng.ts` with a run.
 */

export type Lane = 1 | 2 | 3;
export type Col = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A tile. Lane 1 is the upper lane; column 1 is the player's back edge. */
export interface Pos {
  lane: Lane;
  col: Col;
}

export type Side = 'player' | 'enemy';
export type Zone = 'playerBackline' | 'danger' | 'enemyBackline';

export type UnitDefId = 'A' | 'B' | 'C';
export type ClassId = 'special' | 'ranged' | 'melee';
export type TypeId = 'fire' | 'plasma' | 'water';
export type CardOwner = UnitDefId | 'neutral';
export type EnemyDefId = 'drone' | 'lancer';

export type DamageKeyword = 'strike' | 'pierce' | 'slash' | 'blast';

/** The effects reserved for later slices. A shipped card may not use one. */
export const RESERVED_EFFECTS = ['stealth', 'repair', 'push', 'pull'] as const;
export type ReservedEffect = (typeof RESERVED_EFFECTS)[number];

export type Effect =
  | { k: DamageKeyword; n: number }
  | { k: 'move'; n: number }
  | { k: 'shield'; n: number; to: 'self' | 'friendly' }
  | { k: 'target'; n: number }
  | { k: 'gainMp'; n: number }
  | { k: 'mpNextTurns'; n: number; turns: number }
  /** Command: a Move of `n` placed in another friendly unit's slot. */
  | { k: 'grantMove'; n: number }
  /** Need Help: extra cards on the next hand, none owned by the player of the card. */
  | { k: 'drawNext'; n: number; filter: 'notOwner' }
  | { k: ReservedEffect; n: number };

export interface CardDef {
  id: string;
  name: string;
  owner: CardOwner;
  cost: number;
  /** `null` until the author's types arrive. The slice reads no type. */
  type: TypeId | null;
  effects: readonly Effect[];
  /** Once per battle: after it resolves the card leaves for `spent`. */
  once?: boolean;
}

export type Ability =
  /** A: MP at the start of each of its turns, turn 1 included. */
  | { k: 'mpAtTurnStart'; n: number }
  /** B: the first card each turn resolves a Strike as a Pierce while at full HP. */
  | { k: 'firstCardConverts'; from: 'strike'; to: 'pierce'; while: 'fullHp' };

export interface UnitDef {
  id: UnitDefId;
  name: string;
  role: string;
  class: ClassId;
  hp: number;
  baseShield: number;
  abilities: readonly Ability[];
}

export type Cond = 'slashInRange';
export type MoveRule = 'none' | 'hunt' | 'advance' | { if: Cond; then: MoveRule; else: MoveRule };
export type ActRule =
  | { k: 'none' }
  | { k: 'strike' | 'pierce' | 'slash' | 'shield'; n: number }
  | { if: Cond; then: ActRule; else: ActRule };
export interface EnemyStep {
  move: MoveRule;
  act: ActRule;
}

/** A union of one member today; a weighted pool is a second member later. */
export type EnemyScript = { kind: 'cycle'; steps: readonly EnemyStep[] };

export interface EnemyDef {
  id: EnemyDefId;
  name: string;
  hp: number;
  baseShield: number;
  script: EnemyScript;
}

export interface DeckDef {
  id: string;
  name: string;
  units: readonly UnitDefId[];
  /** One entry per card instance, in the order the unshuffled draw pile holds them. */
  cards: readonly string[];
}

export interface EncounterDef {
  id: string;
  /** What the sandbox's scenario list shows. */
  name: string;
  blurb: string;
  deckId: string;
  /** Where each unit starts before the player places it: a tile of `RULES.deployZone`. */
  units: readonly { def: UnitDefId; pos: Pos }[];
  /**
   * In spawn order, which is the order enemies act and move in. An enemy with
   * no `pos` starts on a free tile of `RULES.spawnZone`, drawn from the
   * battle's seed when the battle is created.
   */
  enemies: readonly { def: EnemyDefId; pos?: Pos }[];
}

export type HuntTieBreak = 'nearestLane' | 'lowestHp' | 'upperLane';

/**
 * Every rule default of the design snapshot, as one typed object. The ids are
 * the snapshot's (R for rules, E for enemies). A value that names a reading
 * rather than a number is still a value here, so a resolver branches on the
 * table rather than on a literal of its own.
 */
export interface Rules {
  board: { lanes: 3; cols: 7 };
  zones: Readonly<Record<Zone, readonly Col[]>>;
  /** Where the player places its units before round 1. */
  deployZone: Zone;
  /** Where an enemy the encounter does not place starts. */
  spawnZone: Zone;
  /** Which columns each side may stand in. */
  reach: Readonly<Record<Side, { min: Col; max: Col }>>;
  /** The column step that points away from a side's own edge. */
  forward: Readonly<Record<Side, 1 | -1>>;
  handSize: number;
  /** R2 is the cap. MP starts at `start` and gains `gainPerRound` after each turn. */
  mp: { start: number; gainPerRound: number; cap: number };
  /** R3. */
  playerShieldClears: 'nextTurnStart';
  /** R4. Strike hits the first opposing unit in the lane counted from the attacker's side of the board. */
  strikeReach: 'anyDistanceInLane';
  /** R5. Slash covers the next `slashCols` column; Blast picks a tile in the next `blastCols`. */
  patterns: { slashCols: number; blastCols: number; blastNeighbours: 'orthogonal' };
  /** Which zone a damage keyword may be played from. */
  keywordZone: Readonly<Record<DamageKeyword, 'anywhere' | 'danger'>>;
  /** A damage card is playable only while its pattern would hit at least one opposing unit. */
  damageNeedsTarget: boolean;
  /** R6. */
  targetOnFriendly: 'friendlyUnits';
  /** R10. */
  faintScope: 'battle';
  /** R11. */
  baseShield: 'oneTime';
  /** R12. */
  mpFromCards: 'usableNextTurn';
  /** R13. */
  targetOnPattern: 'chosenUnitAnyRange';
  /** R14. */
  friendlyFire: boolean;
  /** R15. A Move of N reaches tiles 1 to N orthogonal steps away through empty tiles. */
  moveShape: 'orthogonalInsideReach';
  /** E1. */
  huntTieBreak: readonly HuntTieBreak[];
  /** E2. With no reachable candidate lane the enemy stays. */
  huntDistance: 'anyLanesBeforeBlocker';
  /** E3. The enemy columns from which slashInRange can hold. */
  enemySlashFromCols: readonly Col[];
  /** E4. */
  advance: { cols: number; limitCol: Col; ifBlocked: 'wait' };
  /** E5. */
  enemyShieldClears: 'ownNextAction';
  /** E6. */
  startingStep: 'rolledPerEnemy';
  /** A battle still running after this many rounds ends as a loss. */
  roundCap: number;
}

/**
 * The guard bot's evaluation weights (`core/cards/guard.ts`): what a board is
 * worth to a player who plays to keep every unit alive. Tuned by
 * `npm run cards:train`; the shipped values live in `cardData/guardWeights.ts`.
 */
export interface GuardWeights {
  /** A won battle, on top of what the board it ends on is worth. */
  win: number;
  /** Keeping each unit alive. */
  unit: Readonly<Record<UnitDefId, number>>;
  /** Per point of HP a living unit has. */
  hp: number;
  /** Per point of base shield a living unit has left. */
  baseShield: number;
  /** Per MP a living unit holds. */
  mp: number;
  /** Per point of HP, shield and base shield left on the enemies. A cost. */
  enemyHp: number;
  /** Per enemy still standing. A cost. */
  enemyAlive: number;
  /** Per point of telegraphed damage aimed at a unit, scaled by how little it can take. A cost. */
  threat: number;
  /** The share of a unit's value at stake when a telegraph would knock it out. A cost. */
  lethal: number;
  /**
   * Per enemy standing in a lane a unit also stands in, where a Strike can
   * reach it. Lining up an attack is progress a one-round search cannot
   * otherwise see: without it the bot can stall, safe and doing nothing.
   */
  reach: number;
  /**
   * How much `reach` grows each round, as a share of itself: a battle that
   * drags on makes lining up an attack worth more than staying safe, so a
   * stalemate breaks.
   */
  urgency: number;
  /** Per unit standing in the danger zone: positive is bold, negative is careful. */
  forward: number;
  /** Per round played. A cost, so a quicker win is worth more. */
  round: number;
}

/** How hard the guard bot searches. Wider is stronger and slower. */
export interface GuardSearch {
  /** Partial plans kept at each depth of a round's search. */
  beam: number;
  /** The most cards a plan may hold. */
  maxPlays: number;
  /** Placements, of every one possible, that get a full round 1 search. */
  deployShortlist: number;
}
