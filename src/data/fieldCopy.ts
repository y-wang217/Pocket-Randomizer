/**
 * The weather and terrain on the board, as words. **Stage 4.11, Tier 1.**
 *
 * ## Why the words are here and the reading is in `core/`
 *
 * `core/battle/driver.ts` reports the sim's ids (`raindance`,
 * `electricterrain`) on `BattleFacts.field`; `core/battle/view.ts` gives each
 * its mark. Neither carries a word, for the same reason `flagWords.ts` gives:
 * a tuning pass rewords a readout, it does not re-read a board. So the words
 * live here, under `data/`, and are read by `ui/` alone.
 *
 * ## Present tense, and a different table from `flagWords.ts`
 *
 * `FIELD_WORDS` there is the *event* — `Rain` on the strip when rain began.
 * This is the *state* — what is true on the board now, on the header glyph's
 * inspect and nowhere else at rest. The bible's section 3 row for the field
 * state says the glyph carries it and inspect names it; nothing here is a word
 * at rest. The same word set is shared where the concept is, deliberately, so
 * the player learns one vocabulary.
 *
 * ## Part 4 applies to every line here
 *
 * Each effect line restates what the engine does, never whether it is good:
 * *Water moves 1.5x* is correct, *Water moves are strong now* is not. The
 * primal weathers get their own lines because what distinguishes them is what
 * cannot be done under them, which is exactly the fact inspect exists for.
 *
 * ## This table must never enter `contentHash`
 *
 * Same argument as `flagWords.ts`: no RNG, no generation, and two players on
 * one seed holding different copies of this file play the identical run with
 * different words on it. `build-config/content-hash.ts` lists it with that
 * reason, and `test/content-hash.test.ts` walks the import graph to hold that
 * nothing under `core/` reaches it.
 */

/** How each sim id reads as the state of the board. */
export const FIELD_NAMES: Record<string, string> = {
  raindance: 'Rain',
  primordialsea: 'Heavy rain',
  sunnyday: 'Harsh sunlight',
  desolateland: 'Extreme sun',
  sandstorm: 'Sandstorm',
  hail: 'Hail',
  snow: 'Snow',
  snowscape: 'Snow',
  deltastream: 'Strong winds',
  electricterrain: 'Electric Terrain',
  grassyterrain: 'Grassy Terrain',
  mistyterrain: 'Misty Terrain',
  psychicterrain: 'Psychic Terrain',
};

/** What each does, as the engine does it. One line, on inspect only. */
export const FIELD_EFFECTS: Record<string, string> = {
  raindance: 'Water moves 1.5x, Fire moves 0.5x. Thunder and Hurricane never miss. Swift Swim doubles Speed.',
  primordialsea: 'Water moves 1.5x. Fire moves fail outright. Cannot be replaced by ordinary weather.',
  sunnyday: 'Fire moves 1.5x, Water moves 0.5x. Solar Beam fires in one turn. Chlorophyll doubles Speed.',
  desolateland: 'Fire moves 1.5x. Water moves fail outright. Cannot be replaced by ordinary weather.',
  sandstorm: 'Every Pokemon that is not Rock, Ground or Steel loses 1/16 of its HP each turn. Rock types have 1.5x Sp. Def. Sand Rush doubles Speed.',
  hail: 'Every Pokemon that is not Ice loses 1/16 of its HP each turn. Blizzard never misses. Slush Rush doubles Speed.',
  snow: 'Ice types have 1.5x Defense. Blizzard never misses. Slush Rush doubles Speed.',
  snowscape: 'Ice types have 1.5x Defense. Blizzard never misses. Slush Rush doubles Speed.',
  deltastream: 'Moves that would be super effective against Flying types do normal damage instead. Cannot be replaced by ordinary weather.',
  electricterrain: 'Electric moves 1.3x for grounded Pokemon. Grounded Pokemon cannot fall asleep.',
  grassyterrain: 'Grass moves 1.3x for grounded Pokemon. Grounded Pokemon recover 1/16 of their HP each turn. Earthquake, Bulldoze and Magnitude do 0.5x.',
  mistyterrain: 'Dragon moves 0.5x against grounded Pokemon. Grounded Pokemon cannot be given a status condition.',
  psychicterrain: 'Psychic moves 1.3x for grounded Pokemon. Grounded Pokemon cannot be hit by priority moves.',
};

/** The line added under a weather an ability is holding off. */
export const FIELD_SUPPRESSED = 'An ability on the field is holding this weather off. It does nothing until that Pokemon leaves.';

/** The state of the board as a word, falling back to the id rather than to nothing. */
export function fieldName(id: string): string {
  return FIELD_NAMES[id] ?? id;
}

/** The effect line, or null for an id this table does not know. */
export function fieldEffect(id: string): string | null {
  return FIELD_EFFECTS[id] ?? null;
}
