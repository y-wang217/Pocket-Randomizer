/**
 * What the player may start a run as.
 *
 * Stage 1 shipped this as eleven hand-picked Pokemon with hand-picked kits, and
 * the reasoning was sound at the time: the player carries one Pokemon through a
 * whole segment, so a dud roll is a lost run they never had a hand in.
 *
 * Stage 2 keeps the *guarantee* and drops the whitelist. The guarantee is now a
 * **band window** over data/speciesPools.ts — fully evolved, roughly 490+ base
 * stat total — while segment 0's opponents draw from bands 0 and 1. The player
 * therefore starts meaningfully ahead of the first gym and the curve catches up
 * around segment 4, which is the same promise the whitelist made with three
 * hundred species instead of eleven and nothing to keep in sync.
 *
 * The ability and the moveset are rolled by the randomizer like everything
 * else. That is not a detail: a randomizer where the *opponents* are randomized
 * and the player's Pokemon is a curated set piece is a game about reacting to
 * chaos rather than a game about playing it.
 *
 * `getStarterPool(unlocked)` survives unchanged in shape because it is Stage
 * 5's seam, and unlocks are strictly **additive** — appended after the base
 * pool, never inserted and never removed. Generation draws an index into this
 * list, so an unlock that reordered it would change what every previously
 * recorded seed offers.
 */
import { isSpeciesBlacklisted } from './blacklists';
import { SPECIES_POOL, type SpeciesEntry } from './speciesPools';

/**
 * The bands a starter is drawn from.
 *
 * The one place the randomizer deliberately favours the player, and the number
 * to move if the simulator says gym 1 is either a formality or a wall.
 */
export const STARTER_BANDS: readonly number[] = [3, 4];

const BASE: readonly SpeciesEntry[] = SPECIES_POOL.filter(
  (entry) => STARTER_BANDS.includes(entry.band) && !isSpeciesBlacklisted(entry.id),
);

/**
 * Species that exist but are not offered until unlocked.
 *
 * Empty, and that is the honest state of it: there is no unlock system yet, so
 * there is nothing to unlock. Stage 5 fills this and changes nothing else.
 */
const LOCKED: readonly SpeciesEntry[] = [];

/**
 * The species a run may offer as starters, in a fixed draw order.
 *
 * @param unlocked Ids the player has unlocked. Stage 2 never passes it.
 */
export function getStarterPool(unlocked?: readonly string[]): readonly SpeciesEntry[] {
  if (!unlocked || unlocked.length === 0) return BASE;
  const wanted = new Set(unlocked);
  return [...BASE, ...LOCKED.filter((entry) => wanted.has(entry.id))];
}
