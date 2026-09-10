/**
 * The battle screen's projection. Derived, never stored.
 *
 * ## Why this file exists
 *
 * Stage 4.5 adds no mechanics. Everything it displays — the physical/special
 * split, stat stages, speed order, type effectiveness — has been resolving
 * correctly in the engine since Stage 0. The only thing missing was that the
 * player could not *see* it, so the decisions those mechanics create were
 * invisible and the game read as a coin flip with sprites.
 *
 * The obvious way to fix that is to hand the battle screen the run's own data:
 * it already has `RunState`, the opponent's `PokemonSpec` is right there, and
 * three lines of `state.segments[i].nodes[j].encounter.team[0].ability` would
 * put an ability on screen this afternoon. **That is the seam that rots.** It
 * couples a pixel to a run-state field, it reads information the player has not
 * been shown, and — the part that makes it dangerous rather than merely ugly —
 * it would survive every test in the suite, because nothing asserts on where a
 * screen got a number from.
 *
 * So there is one projection, and the battle screen reads it and nothing else.
 * `test/boundaries.test.ts` asserts that the battle UI imports no `core/run`
 * internals, in the same style as the no-`core`-to-`ui` and no-unseeded-RNG
 * rules, because a rule this easy to break silently deserves a test.
 *
 * (Those checks are deliberately crude — a regex over the source, not an AST
 * walk — so this comment cannot spell the banned call out. That bluntness is
 * the feature: it is what makes them impossible to talk your way past.)
 *
 * ## What it is not
 *
 * `BattleUiView` is **not** `core/types.ts`'s `BattleView`. That type is the
 * *policy* view — the thing the greedy AI and the balance sweep decide from —
 * and it is deliberately restricted to what a player could know, with
 * `foe.ability` always null. Widening it would hand the AI an ability it has
 * not seen and move every number in the Stage 2 report. So the two coexist
 * under different names, and the policy view is untouched by this stage.
 *
 * The name is the one deviation from the Stage 4.5 brief, which asked for
 * `BattleView`. Three of its six proposed type names already exist in
 * `core/types.ts` with different meanings, and taking those names would mean
 * either renaming the policy seam mid-stage — touching the AI, in a stage whose
 * headline constraint is that the simulator output must not move — or having
 * `scene.ts` import two different types called `BattleView`. Prefixing was the
 * cheaper of the three.
 *
 * ## Derived, never stored
 *
 * Nothing here is serialized, written to a run log, or held in `RunState`. It
 * is a pure function of a `BattleFacts` snapshot, which is why it can be tested
 * against hand-built facts with no sim and no DOM.
 */
import {
  applyParalysis,
  applyStage,
  BOOSTABLE_STATS,
  statAtLevel,
} from './stats';
import {
  moveEffectiveness,
  type AbilityEffects,
  type Effectiveness,
  type RevealPolicy,
} from './effectiveness';
/*
 * The ability-effect table, the reveal policy and the fold that applies them
 * moved to `effectiveness.ts` in Stage 4.5.2, and are re-exported here.
 *
 * They went because that file became the leaf: it answers "what does this move
 * do to that Pokemon" and needs all three, while this file answers "what does
 * the whole screen render" and needs them only to pass along. Importing
 * upward would have made the two mutually recursive. The re-export is so the
 * move is invisible to `driver.ts`, `scene.ts` and the tests, which have named
 * these through `view.ts` since Stage 4.5.
 */
export {
  applyAbilityEffects,
  type AbilityEffects,
  type AbilityTypeEffect,
  type RevealPolicy,
} from './effectiveness';
import type { Gender, StatName, StatsTable, StatStages, StatusName, SwitchView } from '../types';
import { archetypeOf } from '../archetype';
import type { Archetype } from '../../data/archetypes';

// ---------------------------------------------------------------------------
// The input: a plain-data snapshot from the adapter
// ---------------------------------------------------------------------------

/**
 * A speed modifier the engine applied, tagged with where it came from.
 *
 * Tagged rather than pre-multiplied because the visibility rule below has to be
 * able to *drop* the ability-sourced ones. A single fully-modified number
 * cannot be un-modified.
 */
export interface SpeedFacts {
  /** Effective Speed exactly as the engine computes it: boosts, status, item, ability. */
  engine: number;
  /** True when an ability is contributing to `engine`. Drives the visibility branch. */
  abilityModified: boolean;
}

/** One side's active Pokemon, as plain data. No sim types cross this line. */
export interface ActiveFacts {
  species: string;
  /** Nickname if the spec set one, otherwise the species. */
  name: string;
  level: number;
  /**
   * Male, female, or genderless. Read only, displayed next to the level.
   *
   * Read off the sim's Pokemon rather than the spec, because this is the fact
   * about the body actually on the field. From Stage 4.5.1 the two agree —
   * the spec names a gender and the sim uses it — but a spec built by hand
   * still gets the engine's own coin flip, and the battle screen should show
   * what is fighting rather than what was asked for.
   */
  gender: Gender;
  types: string[];
  hp: number;
  maxHp: number;
  fainted: boolean;
  status: StatusName | null;
  /**
   * Pre-boost stats.
   *
   * For the player these are exact, straight off the `|request|` payload's
   * `side.pokemon[].stats`. For the opponent the protocol sends nothing, so the
   * adapter computes them with `stats.ts` from species base stats and level —
   * which is exact too, because GYMRUN has one fixed spread. See that file.
   */
  stats: Record<StatName, number>;
  /**
   * Species base stats, carried so the visibility fallback can recompute.
   *
   * Widened to include HP in Stage 4.7: `core/archetypeOf` reads it, and a
   * classification that skipped HP would call every bulky Pokemon with modest
   * defences an attacker.
   */
  baseStats: StatsTable;
  boosts: StatStages;
  /** Volatile condition ids currently on this Pokemon: `confusion`, `substitute`, ... */
  volatiles: string[];
  ability: { id: string; name: string } | null;
  item: { id: string; name: string } | null;
  speed: SpeedFacts;
}

/** A move offered this turn, before effectiveness is computed against a defender. */
export interface MoveFacts {
  slot: number;
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number | true;
  pp: number;
  maxPp: number;
  usable: boolean;
  /** Dex move flags — `bullet`, `sound`, `powder`, `wind`, `contact`, ... */
  flags: readonly string[];
  /**
   * The naive type-chart multiplier against the defender's current types.
   *
   * Computed by the adapter from the dex type chart, with no ability applied.
   * Ability effects are layered on here, under the visibility rule.
   */
  typeMultiplier: number;
}

/**
 * Everything the adapter hands over for one turn.
 *
 * The switch panel and the three request flags are carried through unchanged
 * from the policy view rather than re-derived, and they are here rather than
 * left behind for one reason: **the battle screen reads this and nothing
 * else.** A screen that got its stat panel from one projection and its bench
 * from another would have two sources of truth about the same turn, and the
 * boundary test could only ever police one of them.
 *
 * `SwitchView` is reused as-is. It is already display vocabulary — the bench
 * rows have rendered from it since Stage 4, including the `block` reason that
 * says *why* a switch is refused — and a parallel copy would be a second thing
 * to keep in step with the sim's request for no gain.
 */
export interface BattleFacts {
  turn: number;
  ended: boolean;
  player: ActiveFacts;
  opponent: ActiveFacts;
  moves: MoveFacts[];
  /** This side's bench, exactly as the policy view reports it. */
  switches: SwitchView[];
  /** The sim wants a switch and will not accept a move. */
  forceSwitch: boolean;
  /** The sim says the active Pokemon may not switch out. */
  trapped: boolean;
  /** This side owes the sim a decision. */
  awaitingChoice: boolean;
  /** Trick Room is on, so the *slower* side moves first. */
  invertedSpeed: boolean;
}

// ---------------------------------------------------------------------------
// The output
// ---------------------------------------------------------------------------

/**
 * One stat, in the three numbers the panel shows.
 *
 * `base` and `effective` are equal at stage 0, which is the common case and the
 * reason the panel renders quietly: `formatStat` returns the bare number when
 * nothing has changed it, so the row only grows decoration once something
 * happens to it.
 */
export interface StatView {
  /** Computed, pre-boost. */
  base: number;
  /** -6..+6. */
  stage: number;
  /** Post-boost, post-status, post-item. */
  effective: number;
}

export interface StatusView {
  id: StatusName;
  /** `BRN`, `PAR`, ... */
  label: string;
}

export interface VolatileView {
  id: string;
  label: string;
}

/** A revealable fact about the opponent. `revealed` carries the tuning flag through. */
export interface RevealedView {
  id: string;
  name: string;
  revealed: boolean;
}

export interface ActiveUiView {
  species: string;
  name: string;
  types: string[];
  level: number;
  /**
   * Male, female, or genderless. Never narrowed by the reveal policy.
   *
   * Gender is on the `|switch|` line the moment a Pokemon appears, so hiding it
   * would be hiding something the protocol already announced — and the reveal
   * policy exists for the two things a player genuinely could not otherwise
   * know (`revealOpponentAbility`, `revealOpponentItem`), not for everything
   * that happens to be about the opponent.
   */
  gender: Gender;
  hp: { current: number; max: number; fraction: number };
  /** HP is not boostable, so it is not in here. It is in `hp`. */
  stats: Record<StatName, StatView>;
  status: StatusView | null;
  volatiles: VolatileView[];
  ability: RevealedView | null;
  item: RevealedView | null;
  fainted: boolean;
  /**
   * What this stat block is built to do. **Stage 4.7, Part 7.**
   *
   * Computed here rather than in the screen, because `core/` is where the
   * classification lives and rule 5 says the battle UI reads this projection
   * and nothing else. A screen that imported `archetypeOf` would be a screen
   * that could feed it something other than the stats it is showing.
   *
   * Not gated by the reveal policy, and that is the point of deriving it from
   * base stats: it is a restatement of numbers already on both panels since
   * Stage 4.5, not a peek at anything. `revealOpponentAbility` and
   * `revealOpponentItem` gate the two facts a player genuinely could not
   * otherwise know, and this is not one of them.
   */
  archetype: Archetype;
}

export interface MoveUiView {
  slot: number;
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number | true;
  pp: number;
  maxPp: number;
  usable: boolean;
  /**
   * The multiplier this move would take against the current defender.
   *
   * Null for status moves, which do not roll damage and whose effectiveness
   * badge would be a category error. 1 means neutral, and the button renders
   * nothing for it — a row where every move says "1x" is a row the player
   * stops reading.
   */
  effectiveness: number | null;
  /**
   * The same answer as a name, and the one the renderer should branch on.
   *
   * Null exactly when `effectiveness` is — that is, for status moves and
   * nothing else. The multiplier could not carry that distinction: `1` and
   * `null` both mean "print no badge" while meaning completely different
   * things, and a renderer that only had the number had to rediscover which
   * was which. See `core/battle/effectiveness.ts`.
   */
  band: Effectiveness | null;
  /**
   * True when a *visible* ability changed `effectiveness` away from the type
   * chart. The button says so, because "Ground does nothing to this Rhydon"
   * needs a reason attached or it reads as a bug.
   */
  abilityAffected: boolean;
}

export interface BattleUiView {
  turn: number;
  ended: boolean;
  player: ActiveUiView;
  opponent: ActiveUiView;
  moves: MoveUiView[];
  /**
   * Which side moves first, given everything the player has been shown.
   *
   * Three states and no fourth. No percentage, no probability, and a genuine
   * tie is reported as a tie rather than dressed up as a coin flip the UI can
   * predict — the sim rolls it, and pretending otherwise would be the same
   * category of lie as a 2x badge over a visible Levitate.
   */
  fasterSide: 'player' | 'opponent' | 'tie';
  switches: SwitchView[];
  forceSwitch: boolean;
  trapped: boolean;
  awaitingChoice: boolean;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<StatusName, string> = {
  brn: 'BRN',
  par: 'PAR',
  psn: 'PSN',
  tox: 'TOX',
  slp: 'SLP',
  frz: 'FRZ',
};

/**
 * Volatiles worth a chip, and what to call them.
 *
 * An allowlist rather than everything in `pokemon.volatiles`, because the engine
 * tracks a great many internal ones — `lockedmove`, `mustrecharge`,
 * `choicelock`, per-move counters — that are either already visible elsewhere
 * (a Choice lock shows as three disabled buttons) or are bookkeeping the player
 * has no decision to make about. Showing all of them would bury the handful
 * that change a decision.
 *
 * Every id here needs an entry in `data/statusInfo.ts`, in both directions:
 * `test/tooltips.test.ts` fails on a chip with no explanation behind it *and*
 * on an explanation for a chip that can never appear.
 */
const VOLATILE_LABELS: Record<string, string> = {
  confusion: 'Confused',
  substitute: 'Substitute',
  leechseed: 'Leech Seed',
  flinch: 'Flinched',
  // Distinct labels because the two can be on a Pokemon at once, and two chips
  // both reading "Trapped" would look like a bug rather than two conditions.
  // `data/statusInfo.ts` uses the same two words.
  partiallytrapped: 'Bound',
  trapped: 'Trapped',
  taunt: 'Taunt',
  encore: 'Encore',
  disable: 'Disable',
  attract: 'Infatuated',
  curse: 'Cursed',
  nightmare: 'Nightmare',
  yawn: 'Drowsy',
  perishsong: 'Perish Song',
  torment: 'Torment',
  aquaring: 'Aqua Ring',
  ingrain: 'Ingrain',
  focusenergy: 'Focused',
};

/** The volatile ids the panel will render, for the tooltip-coverage test. */
export const DISPLAYED_VOLATILES: readonly string[] = Object.keys(VOLATILE_LABELS);

// ---------------------------------------------------------------------------
// The projection
// ---------------------------------------------------------------------------

/**
 * Build the battle screen's view.
 *
 * Pure. Given the same facts, reveal policy and ability table it returns the
 * same object, which is what makes it testable from a scripted protocol log
 * with no DOM and no sim.
 */
export function buildBattleUiView(
  facts: BattleFacts,
  reveal: RevealPolicy,
  abilityEffects: AbilityEffects,
): BattleUiView {
  const player = toActiveUiView(facts.player, { ability: true, item: true });
  const opponent = toActiveUiView(facts.opponent, reveal);

  return {
    turn: facts.turn,
    ended: facts.ended,
    player,
    opponent,
    moves: facts.moves.map((move) =>
      toMoveUiView(move, facts.opponent, reveal, abilityEffects),
    ),
    fasterSide: fasterSide(facts, reveal),
    switches: facts.switches,
    forceSwitch: facts.forceSwitch,
    trapped: facts.trapped,
    awaitingChoice: facts.awaitingChoice,
  };
}

/**
 * Your own side sees everything about itself, always. The reveal policy only
 * ever narrows the opponent — which is why it is a parameter here rather than a
 * property of the facts.
 */
function toActiveUiView(facts: ActiveFacts, reveal: RevealPolicy): ActiveUiView {
  const max = facts.maxHp || 1;
  return {
    species: facts.species,
    name: facts.name,
    types: facts.types,
    level: facts.level,
    gender: facts.gender,
    hp: {
      current: facts.hp,
      max: facts.maxHp,
      fraction: Math.max(0, Math.min(1, facts.hp / max)),
    },
    stats: statViews(facts),
    status: facts.status ? { id: facts.status, label: STATUS_LABELS[facts.status] } : null,
    volatiles: facts.volatiles
      .filter((id) => id in VOLATILE_LABELS)
      .map((id) => ({ id, label: VOLATILE_LABELS[id] ?? id })),
    ability: facts.ability
      ? { id: facts.ability.id, name: facts.ability.name, revealed: reveal.ability }
      : null,
    item: facts.item ? { id: facts.item.id, name: facts.item.name, revealed: reveal.item } : null,
    fainted: facts.fainted,
    archetype: archetypeOf(facts.baseStats),
  };
}

/**
 * The five boostable stats, each as base / stage / effective.
 *
 * Speed is the exception and it is handled below rather than here. Every other
 * stat's effective value is base with the stage applied, full stop — burn's
 * Attack cut and paralysis' Speed cut are the only status modifiers in the
 * game, and burn is applied inside the damage formula rather than to the stat,
 * so showing a reduced Attack number for a burned Pokemon would be showing a
 * number the engine never computes.
 */
function statViews(facts: ActiveFacts): Record<StatName, StatView> {
  const out = {} as Record<StatName, StatView>;
  for (const stat of BOOSTABLE_STATS) {
    const base = facts.stats[stat];
    const stage = facts.boosts[stat] ?? 0;
    out[stat] = {
      base,
      stage,
      effective: stat === 'spe' ? facts.speed.engine : applyStage(base, stage),
    };
  }
  return out;
}

/**
 * Effectiveness against the current defender, with abilities folded in only
 * when the player can see them.
 *
 * **The rule that matters: never show 2x where a visible Levitate makes it 0x.**
 * Ability randomization is off-species in this game, so Levitate on a Rhydon is
 * routine rather than a curiosity, and a UI that lies about it once trains the
 * player to distrust every number it prints afterwards. When the ability is
 * hidden the naive chart result is shown instead — which is not a lie, it is
 * exactly what a player reasoning from types alone would conclude.
 */
function toMoveUiView(
  move: MoveFacts,
  defender: ActiveFacts,
  reveal: RevealPolicy,
  abilityEffects: AbilityEffects,
): MoveUiView {
  const base = {
    slot: move.slot,
    id: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy,
    pp: move.pp,
    maxPp: move.maxPp,
    usable: move.usable,
  };

  /*
   * The whole answer comes from one pure helper, and the adapter's chart lookup
   * is handed to it as a closure over the multiplier it already computed.
   *
   * `MoveFacts.typeMultiplier` is the naive chart result for *this* move
   * against *this* defender, so the "lookup" here is a constant function. That
   * looks redundant and is not: it keeps `moveEffectiveness` a function of a
   * chart rather than of a pre-computed number, which is what lets a unit test
   * hand it `driver.typeMultiplier` directly and assert Ground against Flying
   * without building a battle.
   */
  const result = moveEffectiveness(
    move,
    defender,
    () => move.typeMultiplier,
    abilityEffects,
    reveal,
  );

  return {
    ...base,
    effectiveness: result.multiplier,
    band: result.band,
    abilityAffected: result.abilityAffected,
  };
}

/**
 * Which side moves first, and the single highest-value readout on the screen.
 *
 * It is the reason the stat panel is worth building at all. "Do I kill it
 * before it kills me" is the whole of most turns, and until this stage the
 * player had no way to answer it short of losing the fight once.
 *
 * The engine's own number is used wherever it can be: `facts.speed.engine` is
 * `Pokemon#getStat('spe')`, which has already run the `ModifySpe` event and so
 * folds in stat stages, paralysis, Choice Scarf and every speed ability — Swift
 * Swim, Chlorophyll, Quick Feet, Unburden and the rest — correctly and for
 * free. Reimplementing that list is how a speed readout drifts from the turn
 * order it claims to describe.
 *
 * The one case that cannot use it is an opponent whose ability is hidden *and*
 * whose ability is contributing to that number. Folding it in would leak the
 * ability through the arrow; ignoring the problem would show a number that
 * disagrees with the turn that follows. So the visible layers are recomputed —
 * stat, stage, paralysis, and the revealed item — and the arrow is the honest
 * conclusion from what the player has been shown. This branch is unreachable at
 * the default tuning, where the ability is revealed.
 */
export function fasterSide(facts: BattleFacts, reveal: RevealPolicy): 'player' | 'opponent' | 'tie' {
  const player = facts.player.speed.engine;
  const opponent = visibleSpeed(facts.opponent, reveal);

  if (player === opponent) return 'tie';
  const playerFirst = facts.invertedSpeed ? player < opponent : player > opponent;
  return playerFirst ? 'player' : 'opponent';
}

/**
 * Effective Speed as far as the player can tell.
 *
 * The engine's number when everything contributing to it is visible, and a
 * recomputation from the visible layers otherwise. The recomputation covers
 * exactly three things because exactly three things can be visible: the stat
 * itself, the stage, and paralysis. The item is folded in by id against the
 * Stage 3 whitelist, which contains one speed item.
 */
function visibleSpeed(facts: ActiveFacts, reveal: RevealPolicy): number {
  if (reveal.ability || !facts.speed.abilityModified) return facts.speed.engine;

  let speed = applyStage(statAtLevel(facts.baseStats.spe, facts.level), facts.boosts.spe ?? 0);
  if (facts.status === 'par') speed = applyParalysis(speed);
  if (reveal.item && facts.item?.id === 'choicescarf') speed = Math.floor(speed * 1.5);
  return speed;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * `Atk 152 +1 228` when boosted, `Atk 152` when not.
 *
 * The neutral case is the bare number with no decoration, and that is the point
 * of the format: six rows of `152 +0 152` is six rows of noise, and a panel
 * that is always shouting cannot shout when something actually changes. The
 * stage and the effective value appear together or not at all.
 */
export function formatStat(label: string, stat: StatView): string {
  if (stat.stage === 0) return `${label} ${stat.base}`;
  const sign = stat.stage > 0 ? '+' : '';
  return `${label} ${stat.base} ${sign}${stat.stage} ${stat.effective}`;
}

/**
 * `4x`, `2x`, `0.5x`, `0.25x`, `0x` — and nothing at all for neutral.
 *
 * Neutral returns null rather than `"1x"` so the button row stays readable.
 * Four buttons each carrying a badge that says "this is ordinary" is four
 * badges the player learns to skip, and the one that says `0x` gets skipped
 * with them.
 */
export function formatEffectiveness(multiplier: number | null): string | null {
  if (multiplier === null || multiplier === 1) return null;
  if (multiplier === 0) return '0x';
  // 0.25 and 0.5 are the only fractional values the chart produces; toString
  // renders them without trailing zeros, and 4x/2x come out as integers.
  return `${multiplier}x`;
}
