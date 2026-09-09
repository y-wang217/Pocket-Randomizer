/**
 * What the six stat abbreviations mean, for a player who has never met them.
 *
 * **Atk versus SpA is the exact distinction a non-player cannot infer**, and it
 * is the reason this file exists. Every other abbreviation on the screen is
 * either self-evident (HP) or guessable from context (Spe, next to an arrow
 * showing who moves first). "Atk" and "SpA" are two three-letter labels that
 * differ by one character and decide which of a defender's two completely
 * separate defences a move is resolved against — and nothing on the panel says
 * so. A player who does not know is not reading a harder game; they are reading
 * a game whose numbers are decoration.
 *
 * The text is here rather than in `ui/scene.ts` for the same reason
 * `data/categoryInfo.ts` and `data/statusInfo.ts` exist: a sentence describing
 * a mechanic, written in the file that renders it, drifts from the mechanic.
 *
 * ## What these entries may and may not say
 *
 * Part 4 of the Stage 4.5.1 spec governs this file as much as it governs a
 * reward card. Every entry answers *what is this number* and *what is it
 * resolved against*. None of them says which stat is good, which Pokemon wants
 * it, or what the player should do about it — `pairsWith` names the opposing
 * stat because that is a fact about the damage formula, not a recommendation.
 *
 * The line the `advice` field in `categoryInfo` walks is deliberately not
 * walked here. That file's advice describes how to *read* the panel ("compare
 * your Atk with their Def"), which is instruction in the interface. A stat
 * tooltip saying "you want this one" would be instruction in the game.
 */

export interface StatEntry {
  /** The abbreviation as the panel prints it. */
  abbreviation: string;
  /** The full name, which is most of what a first-time reader needs. */
  label: string;
  /** What the number does, in one sentence. No judgement. */
  mechanics: string;
  /**
   * The stat on the other side of the calculation, or null.
   *
   * Attack is meaningless without Defence: the whole point of the split is that
   * a move reads one of two attacking stats against one of two defending ones,
   * and naming the pair is what makes the panel legible as two columns rather
   * than six unrelated numbers.
   */
  pairsWith: string | null;
}

/** Keyed by the `StatName` the view layer uses, plus `hp`. */
export const STAT_INFO: Readonly<Record<string, StatEntry>> = {
  hp: {
    abbreviation: 'HP',
    label: 'Hit Points',
    mechanics:
      'How much damage this Pokemon can take before it faints. The number on the stat panel is the maximum; the bar above it is what is left.',
    pairsWith: null,
  },
  atk: {
    abbreviation: 'Atk',
    label: 'Attack',
    mechanics:
      'Used for damage from PHYS moves only. A move badged SPEC ignores this number completely.',
    pairsWith: 'Def',
  },
  def: {
    abbreviation: 'Def',
    label: 'Defence',
    mechanics:
      'Reduces damage from PHYS moves only. It does nothing at all against a move badged SPEC.',
    pairsWith: 'Atk',
  },
  spa: {
    abbreviation: 'SpA',
    label: 'Special Attack',
    mechanics:
      'Used for damage from SPEC moves only. A move badged PHYS ignores this number completely. This is a different stat from Atk, not a variant of it.',
    pairsWith: 'SpD',
  },
  spd: {
    abbreviation: 'SpD',
    label: 'Special Defence',
    mechanics:
      'Reduces damage from SPEC moves only. It does nothing at all against a move badged PHYS. This is a different stat from Def, not a variant of it.',
    pairsWith: 'SpA',
  },
  spe: {
    abbreviation: 'Spe',
    label: 'Speed',
    mechanics:
      'Decides which side moves first each turn. The arrow on the Speed row points at whoever is currently faster.',
    pairsWith: null,
  },
};

export function statInfo(stat: string): StatEntry | null {
  return STAT_INFO[stat.toLowerCase()] ?? null;
}

/** Every stat this file describes, in panel order. */
export const STAT_ORDER: readonly string[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
