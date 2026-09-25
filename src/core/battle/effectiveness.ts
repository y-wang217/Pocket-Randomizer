/**
 * What a move would do to the Pokemon standing opposite, as a named band.
 *
 * ## Why this is its own file
 *
 * The playtest note that opened Stage 4.5.2 asked for effectiveness to be
 * computed "per move, not per Pokemon". It already was — `view.ts` has taken a
 * move's own type against the defender since Stage 4.5, and the species' types
 * have never entered into it. What was missing is this: the answer only existed
 * as a **bare multiplier**, computed inside a projection that needs a
 * `BattleFacts` snapshot to run at all.
 *
 * That has two costs. The small one is testability — asserting "Ground does
 * nothing to a Flying type" meant building a battle. The larger one is that a
 * multiplier is not a vocabulary: every caller re-derives the four cases from
 * the number, and `1` and `null` both mean "print nothing" while meaning
 * completely different things. A status move has **no** effectiveness; a
 * neutral move has one and it is ordinary. Collapsing them is how a status move
 * ends up wearing a `0x` badge.
 *
 * So the band is the type, the multiplier rides along for display, and this
 * file is a leaf: no sim, no DOM, no `BattleFacts`. The type chart arrives as
 * an injected lookup because the real one lives behind `@pkmn/sim` in
 * `driver.ts`, and rule 4 says only the adapter may import it. Hand-rolling a
 * chart here to avoid the parameter is exactly what the spec forbids — the
 * whole argument for printing a number is that it is the number the turn will
 * use, and a second chart is a second answer waiting to disagree.
 */
/**
 * The four answers, and there is no fifth.
 *
 * `neutral` is a real answer rather than an absence, which is the distinction
 * the multiplier could not carry. Whether a neutral move is worth a badge is a
 * *rendering* decision and belongs to the renderer — `scene.ts` prints nothing
 * for it, because four buttons each saying "ordinary" is four badges the player
 * learns to skip and the `0x` gets skipped with them.
 */
export type Effectiveness = 'none' | 'resisted' | 'neutral' | 'super';

/**
 * How the defender's ability changes what a move does to it.
 *
 * Hand-curated in `data/abilityEffects.ts` rather than read off the dex,
 * because @pkmn/sim implements these as event handler *functions* and there is
 * nothing in the data to introspect. A gap in that table shows the naive type
 * chart result, which is the documented fallback everywhere else in this file —
 * and `test/ability-effects.test.ts` sweeps the generated ability pool against
 * a probe battle so a missing immunity fails the suite rather than reaching a
 * player.
 */
export type AbilityTypeEffect =
  /** Absorbs a type outright: Levitate, Volt Absorb, Flash Fire. */
  | { kind: 'immune'; types: readonly string[] }
  /**
   * Absorbs by move *flag* rather than by type: Bulletproof, Soundproof.
   *
   * Here because the alternative is a lie the player would catch immediately.
   * Shadow Ball is a `bullet` move, so a visible Bulletproof turns a 2x badge
   * into a 0x one on a button whose type says nothing about it — exactly the
   * Levitate-on-a-Rhydon case, arriving through a different door.
   */
  | { kind: 'flag-immune'; flags: readonly string[] }
  /** Flat type-keyed damage multiplier: Thick Fat, Heatproof, Fluffy. */
  | { kind: 'multiply'; types: readonly string[]; factor: number }
  /** Wonder Guard: everything that is not super effective does nothing. */
  | { kind: 'wonder-guard' };

/** What the player is allowed to see of the opponent. See `data/tuning.ts`. */
export interface RevealPolicy {
  ability: boolean;
  item: boolean;
  /**
   * Whether the player may be told how many Pokemon the opponent brought.
   *
   * Unlike the two above it is not a tuning knob, it is a property of the
   * node: a trainer and a gym leader arrive with a team the player can see,
   * and a wild encounter is whatever the grass has left. So this one is set
   * per fight rather than per run, and the screen renders `?` where it is
   * false — the count is withheld, never guessed at and never quietly
   * replaced by the number it would have been.
   */
  teamSize: boolean;
}

/** The ability-effect lookup, injected so `view.ts` stays a leaf. */
export type AbilityEffects = (abilityId: string) => readonly AbilityTypeEffect[];


/** Just enough of a move to answer the question. */
export interface EffectivenessMove {
  /** The dex id, for the three moves Grassy Terrain halves by name. Optional: a test that asks about a type need not name a move. */
  id?: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  /** Dex flags — `bullet`, `sound`, `powder`, ... — for the flag-keyed immunities. */
  flags: readonly string[];
}

/** Just enough of a defender. */
export interface EffectivenessDefender {
  types: readonly string[];
  ability: { id: string; name: string } | null;
}

export interface EffectivenessResult {
  /**
   * Null for status moves, and only for status moves.
   *
   * Not `1`, and not `0`. A Thunder Wave aimed at a Ground type is stopped by
   * the paralysis immunity, not by the type chart, and `0x` on that button
   * would be a true-sounding number attached to the wrong reason.
   */
  multiplier: number | null;
  /** Null exactly when `multiplier` is. */
  band: Effectiveness | null;
  /** True when a *visible* ability moved the answer off the naive chart result. */
  abilityAffected: boolean;
  /**
   * The field's own factor for this move, folded into `multiplier`. **Stage
   * 4.11 Tier 2b, D49.** 1 when the board does nothing to this move, and 1 for
   * a status move. The id of the effect that moved it is `fieldCause`, so the
   * button can point its number at the reason the way it points a Levitate
   * `0x` at the ability.
   */
  fieldFactor: number;
  /** The sim id of the weather or terrain behind `fieldFactor`, or null when it is 1. */
  fieldCause: string | null;
}

/**
 * The board, as the forecast needs it. **Stage 4.11 Tier 2b, D49.**
 *
 * The ids are `FieldFacts`'s; the two grounded flags are the projection's
 * business, because whether a hidden Levitate counts is a reveal question and
 * this file does not read the reveal policy for anything but the ability.
 */
export interface FieldContext {
  weather: string | null;
  terrain: string | null;
  /** An ability is holding the weather off, so it does nothing. */
  suppressed: boolean;
  attackerGrounded: boolean;
  defenderGrounded: boolean;
  /**
   * The chart's factor for this move against the Flying type alone, which is
   * what Strong winds takes away. The adapter reads it off the dex beside
   * `typeMultiplier`; 1 when the defender is not Flying or the move is not
   * strong against it.
   */
  flyingWeakness: number;
}

/** The three moves Grassy Terrain halves against a grounded target. */
const GRASSY_HALVED = new Set(['earthquake', 'bulldoze', 'magnitude']);

/**
 * What the weather and terrain on the board do to this move's damage, as the
 * engine does it. **Stage 4.11 Tier 2b, D49.**
 *
 * Only the factors that multiply the move: rain and sun on Water and Fire,
 * the primal weathers' outright refusal, Strong winds taking the Flying
 * weakness off, and the four terrains on a grounded attacker or target.
 * Sandstorm's Rock Sp. Def and snow's Ice Defense are stat-side and are not
 * a number on the move, so they are not here — the field glyph's inspect
 * says them. A suppressed weather does nothing. Terrain reads grounding the
 * way the engine does: the attacker's for the 1.3, the target's for the
 * halvings.
 */
export function fieldFactor(
  move: EffectivenessMove,
  defender: EffectivenessDefender,
  field: FieldContext,
): { factor: number; cause: string | null } {
  if (move.category === 'Status') return { factor: 1, cause: null };
  let factor = 1;
  let cause: string | null = null;
  const by = (id: string, f: number): void => {
    factor *= f;
    cause ??= id;
  };

  const weather = field.suppressed ? null : field.weather;
  switch (weather) {
    case 'raindance':
      if (move.type === 'Water') by(weather, 1.5);
      if (move.type === 'Fire') by(weather, 0.5);
      break;
    case 'primordialsea':
      if (move.type === 'Water') by(weather, 1.5);
      if (move.type === 'Fire') by(weather, 0);
      break;
    case 'sunnyday':
      if (move.type === 'Fire') by(weather, 1.5);
      if (move.type === 'Water') by(weather, 0.5);
      break;
    case 'desolateland':
      if (move.type === 'Fire') by(weather, 1.5);
      if (move.type === 'Water') by(weather, 0);
      break;
    case 'deltastream': {
      // The Flying part of the target's typing stops being a weakness.
      const flying = defender.types.includes('Flying') ? field.flyingWeakness : 1;
      if (flying > 1) by(weather, 1 / flying);
      break;
    }
    default:
      break;
  }

  switch (field.terrain) {
    case 'electricterrain':
      if (move.type === 'Electric' && field.attackerGrounded) by(field.terrain, 1.3);
      break;
    case 'grassyterrain':
      if (move.type === 'Grass' && field.attackerGrounded) by(field.terrain, 1.3);
      if (move.id && GRASSY_HALVED.has(move.id) && field.defenderGrounded) by(field.terrain, 0.5);
      break;
    case 'psychicterrain':
      if (move.type === 'Psychic' && field.attackerGrounded) by(field.terrain, 1.3);
      break;
    case 'mistyterrain':
      if (move.type === 'Dragon' && field.defenderGrounded) by(field.terrain, 0.5);
      break;
    default:
      break;
  }

  return { factor, cause };
}

/** The chart lookup, injected. `driver.typeMultiplier` is the one real implementation. */
export type TypeMultiplier = (moveType: string, defenderTypes: readonly string[]) => number;

/**
 * The status-move answer, named once so every branch returns the same object.
 *
 * A constant rather than three literals, because "status moves have no
 * effectiveness" is a rule and a rule written three times is a rule that gets
 * edited twice.
 */
const NO_EFFECTIVENESS: EffectivenessResult = {
  multiplier: null,
  band: null,
  abilityAffected: false,
  fieldFactor: 1,
  fieldCause: null,
};

/**
 * A move against a defender, with abilities folded in only when visible.
 *
 * **The rule that matters: never show 2x where a visible Levitate makes it
 * 0x.** Abilities are randomized off-species in this game, so Levitate on a
 * Rhydon is routine rather than a curiosity, and a UI that lies about it once
 * trains the player to distrust every number it prints afterwards. When the
 * ability is hidden the naive chart result is shown instead — which is not a
 * lie, it is exactly what a player reasoning from types alone would conclude.
 */
export function moveEffectiveness(
  move: EffectivenessMove,
  defender: EffectivenessDefender,
  typeMultiplier: TypeMultiplier,
  abilityEffects: AbilityEffects,
  reveal: RevealPolicy,
  field?: FieldContext,
): EffectivenessResult {
  if (move.category === 'Status') return NO_EFFECTIVENESS;

  const naive = typeMultiplier(move.type, defender.types);
  const ability = defender.ability;
  const chart =
    !ability || !reveal.ability ? naive : applyAbilityEffects(naive, move.type, move.flags, abilityEffects(ability.id));
  /*
   * The field's factor, folded in last. **D49.** C1's second exception: the
   * weather or terrain on the board is a fact about the present board, and
   * the number on the button is the number the hit will use. Folded after the
   * ability so that an immunity stays 0 whatever the weather says.
   */
  const { factor, cause } = field ? fieldFactor(move, defender, field) : { factor: 1, cause: null };
  const multiplier = chart * factor;
  return {
    multiplier,
    band: bandOf(multiplier),
    abilityAffected: chart !== naive,
    fieldFactor: factor,
    fieldCause: factor === 1 ? null : cause,
  };
}

/**
 * A multiplier as a band.
 *
 * The chart produces 0, 0.25, 0.5, 1, 2 and 4, and abilities can land on 1.25
 * or 0.75 between them (Thick Fat, Heatproof, Dry Skin), so the comparison is
 * `< 1` and `> 1` rather than a lookup table of the six chart values. An
 * ability that shaves a neutral hit to 0.75 has genuinely resisted it.
 */
export function bandOf(multiplier: number): Effectiveness {
  if (multiplier === 0) return 'none';
  if (multiplier < 1) return 'resisted';
  return multiplier > 1 ? 'super' : 'neutral';
}

/**
 * The band in the player's words, for a label or an `aria-label`.
 *
 * Here rather than in the UI because it is the same kind of thing as the enum
 * itself — the names the four cases go by — and a screen that spelled them out
 * inline would be a second place for "not very effective" to be worded.
 */
export const EFFECTIVENESS_LABELS: Record<Effectiveness, string> = {
  none: 'No effect',
  resisted: 'Not very effective',
  neutral: 'Neutral',
  super: 'Super effective',
};

/**
 * Fold a defender's ability effects into a type-chart multiplier.
 *
 * A list rather than a single effect, because Dry Skin is both — immune to
 * Water and taking 1.25x from Fire — and collapsing it to one would have meant
 * picking which half of the ability to tell the truth about. Exported for
 * testing.
 */
export function applyAbilityEffects(
  multiplier: number,
  moveType: string,
  moveFlags: readonly string[],
  effects: readonly AbilityTypeEffect[],
): number {
  let out = multiplier;
  for (const effect of effects) {
    switch (effect.kind) {
      case 'immune':
        if (effect.types.includes(moveType)) out = 0;
        break;
      case 'flag-immune':
        if (effect.flags.some((flag) => moveFlags.includes(flag))) out = 0;
        break;
      case 'multiply':
        if (effect.types.includes(moveType)) out *= effect.factor;
        break;
      case 'wonder-guard':
        // Blocks everything that is not super effective. A move already at 0
        // stays at 0; 0.5x, 1x and 0.25x all become 0.
        if (out <= 1) out = 0;
        break;
    }
  }
  return out;
}
