/**
 * Defender Mode v0's inspect copy: what each gym badge does, and each
 * consumable's effect line. **Bible Rev 25, D100 and D102.**
 *
 * Read by `ui/` only, so `build-config/content-hash.ts` excludes it: a
 * reworded line must not refuse every defender seed recorded before it (D12).
 * The numbers each line restates live in `data/defender.ts` and
 * `data/consumables.ts`, which are hashed.
 *
 * Item effect lines follow section 8: under eight words, no prefix, one
 * clause. The badge lines are inspect text and may run to two.
 */
export const BADGE_COPY: Readonly<Record<string, { name: string; effect: string }>> = {
  Fire: {
    name: 'Fire badge',
    effect: 'The flame move gains crit stages on repeat use: +1, +2, +3. Any other move, a switch or a faint resets it.',
  },
  Psychic: {
    name: 'Psychic badge',
    effect: "Shows the opponent's chosen action before you pick. Never a replacement after a faint.",
  },
  Flying: {
    name: 'Flying badge',
    effect: 'Speed times 1.1. A fifth move, once per battle: Peck, or Pluck at the final stage.',
  },
};

/** The line under a badge's name on any badge mark's inspect. */
export const BADGE_SCOPE = 'Gym-type members only.';

/**
 * The line on a dimmed badge mark's inspect (bible D112, 2026-10-06): why the
 * badge is off, and what lights it again. The numbers it restates are
 * `core/defender/badge.ts`'s `badgesActive`.
 */
export const BADGE_OFF_COPY = 'Off while a Pokemon of another type stands in the gym. The Stranger\'s Pass lights it again.';

export const CONSUMABLE_COPY: Readonly<Record<string, string>> = {
  potion: 'Heals 20 HP.',
  superpotion: 'Heals 60 HP.',
  hyperpotion: 'Heals 120 HP.',
};

/** Shown on a consumable's inspect, beside the effect line. */
export const CONSUMABLE_RULE = 'Between battles only. One use.';
