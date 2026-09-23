/**
 * The exposure-label word for every glyph in the sheet. **Milestone M6.1, for
 * design bible R7.**
 *
 * R7: *"The first time a glyph family appears for this player, a small label
 * renders beside it for that screen. The label returns once more on the third
 * exposure, then never."* This file is the word. `ui/exposure-labels.ts`
 * decides when it shows, and `ui/theme/glyphs.ts` reads the same word as each
 * glyph's accessible name, so a screen reader and a first-run player are told
 * the same thing.
 *
 * ## One word per glyph, not per family
 *
 * Section 7: *"A player who reads three starter cards has seen category, type,
 * band, PP and the six stats with words once."* The word a fist needs is
 * `Physical`, not `Category`: the family name says what kind of fact a mark is,
 * and only the glyph's own name says which one. So the table is keyed by glyph
 * id, and every entry is a name the rest of the game already uses.
 *
 * **Each under three words**, per the milestone. `test/glyph-labels.test.ts`
 * holds that, holds that every glyph in the sheet has an entry, and holds the
 * hedge-word list against every entry.
 *
 * **Type glyphs are not here.** A type's label is the type's own name, which
 * is a proper noun the dex supplies and not copy anyone writes, so the sheet
 * labels those from `TYPE_ICON_NAMES` directly.
 *
 * ## Excluded from `contentHash`
 *
 * Listed in `build-config/content-hash.ts`. Nothing under `src/core/` imports
 * it at any depth, and a label is presentation.
 */
export const GLYPH_LABELS: Readonly<Record<string, string>> = {
  'category-physical': 'Physical',
  'category-special': 'Special',
  'category-status': 'Status',

  'band-pip-on': 'Band',
  'band-pip-off': 'Band',

  pp: 'PP',

  'accuracy-target': 'Accuracy',
  'accuracy-never-miss': 'Never misses',

  'priority-up': 'Moves first',
  'priority-down': 'Moves last',

  'effectiveness-edge': 'Effectiveness',

  'status-brn': 'Burn',
  'status-par': 'Paralysis',
  'status-psn': 'Poison',
  'status-tox': 'Toxic',
  'status-slp': 'Sleep',
  'status-frz': 'Freeze',

  'stat-hp': 'HP',
  'stat-atk': 'Attack',
  'stat-def': 'Defense',
  'stat-spa': 'Special Attack',
  'stat-spd': 'Special Defense',
  'stat-spe': 'Speed',

  'capability-cut': 'Cut',
  'capability-surf': 'Surf',
  'capability-strength': 'Strength',
  'capability-rockSmash': 'Rock Smash',
  'capability-fly': 'Fly',
  'capability-waterfall': 'Waterfall',
  'capability-dive': 'Dive',
  'capability-flash': 'Flash',
  'capability-band-on': 'Reach',
  'capability-band-off': 'Reach',
};

/**
 * The word for a mark that is not a glyph in the sheet but reports a family.
 * **D41.** A volatile condition is lettering with no sheet entry (D19 put the
 * volatiles in the Status family without drawing them), and the effectiveness
 * forecast is a fraction on the button's edge. Both are labelled by their
 * family's word.
 */
export const FAMILY_LABELS = {
  status: 'Condition',
  effectiveness: 'Effectiveness',
} as const;
