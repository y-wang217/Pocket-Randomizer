/**
 * Defender Mode v0's screen words. **Bible Rev 24, D100.**
 *
 * The budgets these sit under: the mode choice is 2 (one word per control),
 * the gym type select screen is 4 (the instruction), the pre-gym screen keeps
 * its "Choose lead". Everything else on the mode's surfaces is a glyph, a
 * number or a proper noun.
 */
export const MODE_COPY = {
  attacker: 'Attack',
  defender: 'Defend',
  /** The accessible name of the pair, never painted. */
  label: 'Run mode',
} as const;

export const DEFENDER_SCREEN_COPY = {
  /** The gym type select screen's instruction. Four words. */
  gymSelect: 'Choose your gym type',
  /** The draft and recruit screens' instruction, in the starter screen's slot. */
  draft: 'Draft one',
  recruit: 'Recruit one',
  /** The trade card's accessible name: offered for asked. Never painted. */
  tradeLabel: (offered: string, asked: string): string => `${offered} for ${asked}`,
  /** A consumable's use refused in the Bag. */
  useRefused: (reason: string): string => `Not used: ${reason}`,
} as const;

/** The decision feed's lines for the mode's decisions. Bible R11. */
export const DEFENDER_FEED_COPY = {
  gymType: (type: string): string => `Gym · ${type}`,
  draft: (species: string): string => `Draft · ${species}`,
  door: (trainerClass: string): string => `Door · ${trainerClass}`,
  recruit: (species: string): string => `Recruit · ${species}`,
  consume: (item: string, member: string): string => `Used · ${item} on ${member}`,
} as const;
