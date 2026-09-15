/**
 * The level at which an evolution that the dex does not put a level on fires.
 *
 * GYMRUN has no stones, no trades, no friendship and no held items that evolve
 * anything: a Pokemon's species moves exactly when its level does, on a gym
 * clear (design rule 2, `core/evolution.ts`). So every evolution needs a level,
 * and the dex only supplies one for the plain level-up kind. The rest — trade,
 * stone, friendship, "knows a move", "holding an item at night", "walk 1000
 * steps" — get one here, the way the Kaizo romhacks do it: the method is
 * deleted and a level is put in its place, at roughly the point in the game
 * where the original method would have been reachable.
 *
 * **This is a data table a tuning pass edits, and it is hashed.** The numbers
 * are read by `scripts/gen-pools.ts` at generation time and baked into
 * `speciesPools.ts` as each species' `evoLevel`, so changing one here and not
 * regenerating is a table that lies; `test/evolution-data.test.ts` recomputes
 * every entry from this function and fails on the first one that drifted.
 *
 * Three rules, each held by that test:
 *
 *   - **Floor by band.** A synthetic threshold is never below the floor for the
 *     evolved form's own band. Power is gated behind gyms (Stage 4.9's whole
 *     point), and a 550-BST form whose only evolution method is "other" must
 *     not fire at the method default while its dex-levelled peers wait until
 *     the fifties. A *real* dex level is never raised by this: Kaizo changes
 *     methods, not levels.
 *   - **Chains are monotone.** A synthetic threshold is never below the
 *     parent's own, so a line cannot ask for its third stage before its
 *     second. The parent's level is passed in by the generator; a real dex
 *     level below its parent (Azumarill's 18 under a Marill at the friendship
 *     default) is the reason the friendship default is as low as it is.
 *   - **Siblings agree.** Every branch of a branching family shares one
 *     threshold, or the branch that qualifies first fires alone and the choice
 *     is never asked. A synthetic sibling of a dex-levelled one takes the dex
 *     level; an all-synthetic family gets one override.
 *   - **Ceiling.** No synthetic threshold is above the level the run ends at,
 *     or the line can never finish. Real dex levels above it are allowed to
 *     exist and never fire (Hydreigon 64, Volcarona 59, Dragapult 60); the
 *     test pins that list so a change surfaces.
 */
/** The dex's non-level evolution methods, as `@pkmn/sim` names them. */
export type EvoMethod =
  | 'trade'
  | 'useItem'
  | 'levelMove'
  | 'levelExtra'
  | 'levelFriendship'
  | 'levelHold'
  | 'other';

export interface SyntheticLevel {
  level: number;
  /** Why this number. Not optional: a threshold with no reason is a guess. */
  reason: string;
}

/**
 * The default level per method.
 *
 * Reference points, all first-pass and all the simulator's to move: Crystal
 * Kaizo turns every trade evolution into a level-up; Emerald Kaizo puts Golem
 * at 42, Machamp and Gengar at 50, Alakazam at 55, and sells stones at the
 * third gym's department store.
 */
export const SYNTHETIC_BY_METHOD: Readonly<Record<EvoMethod, SyntheticLevel>> = {
  levelFriendship: {
    level: 16,
    reason:
      'the baby lines (Pichu, Cleffa, Azurill, Togepi, Riolu): happiness at Kaizo pace is the first gym or two, and it has to sit under Azumarill\'s real 18. A friendship final form is lifted by its band floor (Crobat, Lucario, Blissey at 36)',
  },
  useItem: {
    level: 30,
    reason: 'a stone is a mid-game find; Crystal Kaizo sells them at Goldenrod, the third gym, and the gym 4 clear (27 to 33) crosses 30',
  },
  levelMove: {
    level: 32,
    reason: 'the "knows move X" lines (Tangrowth, Yanmega, Lickilicky, Mamoswine) learn that move in the low thirties',
  },
  levelHold: {
    level: 35,
    reason: 'held-item-at-night lines (Weavile, Gliscor): a late-second-half item, so the gym 5 clear',
  },
  levelExtra: {
    level: 30,
    reason: 'location and condition lines (Magnezone, Crabominable, Pawmot, Sylveon): the condition is deleted, the level kept at the stone default',
  },
  other: {
    level: 30,
    reason: 'the odd ones (Sirfetch\'d, Runerigus, Milotic, Kingambit): the stone default, and the band floor below is what keeps the powerful ones late',
  },
  trade: {
    level: 36,
    reason: 'Crystal Kaizo makes every trade evolution a level-up; 36 is the third-stage starter level, the level the run already treats as "a family finishes"',
  },
};

/**
 * The lowest level a synthetic threshold may sit at, by the evolved form's band.
 *
 * Band 3 is the starters' final stages, which the dex puts at 36; band 4 is
 * the pseudo-legendaries, which the dex puts at 48 to 55. A synthetic-method
 * form of the same weight is gated the same way.
 */
export const SYNTHETIC_FLOOR_BY_BAND: readonly number[] = [0, 0, 20, 36, 50];

/**
 * Per-species exceptions, by the **evolved** form's id.
 *
 * Starts near empty and every entry carries its reason, the `blacklists.ts`
 * posture. Two reasons are admissible: a Kaizo reference number, or the
 * sibling rule above.
 */
export const SYNTHETIC_OVERRIDES: Readonly<Record<string, SyntheticLevel>> = {
  golem: { level: 42, reason: 'Emerald Kaizo: Graveler to Golem at 42' },
  machamp: { level: 50, reason: 'Emerald Kaizo: Machoke to Machamp at 50' },
  gengar: { level: 50, reason: 'Emerald Kaizo: Haunter to Gengar at 50' },
  alakazam: { level: 55, reason: 'Emerald Kaizo: Kadabra to Alakazam at 55' },
  politoed: { level: 37, reason: 'sibling rule: Poliwhirl branches; 37 is Emerald Kaizo\'s Politoed level and Poliwrath matches it' },
  poliwrath: { level: 37, reason: 'sibling rule: matches Politoed so the Poliwhirl branch is asked rather than decided by whichever fires first' },
  slowking: { level: 37, reason: 'sibling rule: Slowbro is a real 37, so the Slowpoke branch fires together' },
  gallade: { level: 30, reason: 'sibling rule: Gardevoir is a real 30, so the Kirlia branch fires together (the band floor would have put this at 36)' },
  froslass: { level: 42, reason: 'sibling rule: Glalie is a real 42, so the Snorunt branch fires together' },
};

/**
 * The synthetic threshold for `evolvedId`, evolving by `method` into a form of
 * `band` from a parent whose own threshold is `parentLevel` (0 for a base
 * form). Pure; `scripts/gen-pools.ts` bakes the result and the drift test
 * recomputes it.
 */
export function syntheticThreshold(evolvedId: string, method: EvoMethod, band: number, parentLevel: number): number {
  const override = SYNTHETIC_OVERRIDES[evolvedId];
  if (override) return override.level;
  const floor = SYNTHETIC_FLOOR_BY_BAND[Math.max(0, Math.min(SYNTHETIC_FLOOR_BY_BAND.length - 1, band))] ?? 0;
  return Math.max(SYNTHETIC_BY_METHOD[method].level, floor, parentLevel);
}
