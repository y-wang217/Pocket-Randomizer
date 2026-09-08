/**
 * How a defender's ability changes what a move does to it, for **display only**.
 *
 * Nothing here reaches the engine. @pkmn/sim resolves every one of these
 * correctly and has since Stage 0; this table exists so the move button can say
 * so *before* the player commits a turn to finding out.
 *
 * ## Why it is a table rather than a dex read
 *
 * @pkmn/sim implements these as event handler *functions* on the ability data.
 * There is no field to read: Volt Absorb is an `onTryHit` closure, Thick Fat is
 * a pair of `onSourceModifyAtk`/`onSourceModifySpA` closures. Nothing in the
 * data says "Electric" or "0.5" in a form a lookup can use.
 *
 * The entries below were derived by reading those closures out of the gen 9 dex
 * rather than from memory, and then — because that method has a hole big enough
 * to drive a Rhydon through — checked against the engine itself.
 *
 * **The hole is Levitate.** It has no handler at all. Its Ground immunity is a
 * hardcoded branch in `Pokemon#isGrounded`, so a table built by introspecting
 * ability data contains every absorbing ability in the game *except the one
 * players actually know the name of*. `test/ability-effects.test.ts` therefore
 * sweeps the whole generated ability pool through `probeAbilityImmunity`, which
 * asks the engine, and fails if any ability grants an immunity this table does
 * not carry. That test is the reason to trust the file; the derivation is only
 * the reason it was quick to write.
 *
 * ## What is deliberately absent
 *
 * Conditional and non-type-keyed damage modifiers are **not** here, and the
 * omission is a decision rather than a backlog:
 *
 *   - **Filter, Solid Rock, Prism Armor** (0.75x on super-effective hits) and
 *     **Tera Shell** — these change the number without changing the *matchup*,
 *     and a `2x` badge quietly reading `1.5x` teaches the player a type chart
 *     that is wrong everywhere else.
 *   - **Multiscale, Shadow Shield, Ice Scales** — conditional on HP or on the
 *     move's category rather than its type. A badge that means something
 *     different depending on the defender's current HP is not a badge.
 *   - **Wonder Skin, Good as Gold** — status-move immunities. Status moves
 *     carry no effectiveness badge at all (see `view.ts`), so there is nothing
 *     for these to modify.
 *
 * The badge answers "what does the type chart do here", and these would make it
 * answer something else while looking the same.
 */
import type { AbilityTypeEffect } from '../core/battle/view';

/**
 * Keyed by dex ability id — lowercase, no punctuation, the form
 * `Dex.abilities.get(name).id` returns. `wellbakedbody`, not `Well-Baked Body`.
 */
export const ABILITY_EFFECTS: Readonly<Record<string, readonly AbilityTypeEffect[]>> = {
  // --- absorbing abilities: the type is simply refused --------------------
  //
  // Every one of these is a routine sight in GYMRUN rather than a curiosity.
  // Abilities are drawn from the whole pool rather than a species' legal set,
  // so Water Absorb on a Charizard is as likely as Water Absorb on anything
  // else, and the player has no meta knowledge to fall back on.
  levitate: [{ kind: 'immune', types: ['Ground'] }],
  eartheater: [{ kind: 'immune', types: ['Ground'] }],
  voltabsorb: [{ kind: 'immune', types: ['Electric'] }],
  motordrive: [{ kind: 'immune', types: ['Electric'] }],
  lightningrod: [{ kind: 'immune', types: ['Electric'] }],
  waterabsorb: [{ kind: 'immune', types: ['Water'] }],
  stormdrain: [{ kind: 'immune', types: ['Water'] }],
  flashfire: [{ kind: 'immune', types: ['Fire'] }],
  wellbakedbody: [{ kind: 'immune', types: ['Fire'] }],
  sapsipper: [{ kind: 'immune', types: ['Grass'] }],

  /**
   * Dry Skin is two effects, which is why the lookup returns a list.
   *
   * Water does nothing to it and Fire does 1.25x. Collapsing that to one entry
   * would have meant choosing which half of the ability to be honest about.
   */
  dryskin: [
    { kind: 'immune', types: ['Water'] },
    { kind: 'multiply', types: ['Fire'], factor: 1.25 },
  ],

  // --- absorbing by move flag rather than by type -------------------------
  //
  // These are the ones a player cannot possibly predict from the button, which
  // is exactly why they are here. Shadow Ball, Aura Sphere and Focus Blast are
  // all `bullet` moves; Boomburst and Hyper Voice are `sound`.
  bulletproof: [{ kind: 'flag-immune', flags: ['bullet'] }],
  soundproof: [{ kind: 'flag-immune', flags: ['sound'] }],
  overcoat: [{ kind: 'flag-immune', flags: ['powder'] }],
  windrider: [{ kind: 'flag-immune', flags: ['wind'] }],

  // --- flat type-keyed multipliers ---------------------------------------
  //
  // These read exactly like a chart entry to a player deciding a turn — "Fire
  // does half to this" — so folding them into the badge tells the truth rather
  // than blurring it. That is the line: type-keyed and unconditional gets
  // folded in, conditional or category-keyed does not. See the header.
  thickfat: [{ kind: 'multiply', types: ['Fire', 'Ice'], factor: 0.5 }],
  heatproof: [{ kind: 'multiply', types: ['Fire'], factor: 0.5 }],
  waterbubble: [{ kind: 'multiply', types: ['Fire'], factor: 0.5 }],
  purifyingsalt: [{ kind: 'multiply', types: ['Ghost'], factor: 0.5 }],
  fluffy: [{ kind: 'multiply', types: ['Fire'], factor: 2 }],

  // --- the special case ---------------------------------------------------
  /**
   * Wonder Guard: only super-effective moves land at all.
   *
   * Its own kind rather than an immunity list, because the set of types it
   * blocks depends on the *defender's* types and changes the moment anything
   * alters them. Shedinja is blacklisted from generation, but the ability is
   * not — it is drawn off-species like everything else, so a gym leader's
   * Snorlax with Wonder Guard is a fight the player needs to be able to read.
   */
  wonderguard: [{ kind: 'wonder-guard' }],
};

/**
 * The lookup `view.ts` takes. Empty for anything not in the table, which shows
 * the naive type chart result — the documented fallback everywhere in this
 * stage.
 */
export function abilityEffects(abilityId: string): readonly AbilityTypeEffect[] {
  return ABILITY_EFFECTS[abilityId] ?? [];
}
