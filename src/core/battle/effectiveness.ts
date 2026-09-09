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
}

/** The ability-effect lookup, injected so `view.ts` stays a leaf. */
export type AbilityEffects = (abilityId: string) => readonly AbilityTypeEffect[];


/** Just enough of a move to answer the question. */
export interface EffectivenessMove {
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
): EffectivenessResult {
  if (move.category === 'Status') return NO_EFFECTIVENESS;

  const naive = typeMultiplier(move.type, defender.types);
  const ability = defender.ability;
  if (!ability || !reveal.ability) {
    return { multiplier: naive, band: bandOf(naive), abilityAffected: false };
  }

  const modified = applyAbilityEffects(naive, move.type, move.flags, abilityEffects(ability.id));
  return {
    multiplier: modified,
    band: bandOf(modified),
    abilityAffected: modified !== naive,
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
