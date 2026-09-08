/**
 * What the three move categories mean, for a player who has never met them.
 *
 * The badge on a move button says `PHYS`, `SPEC` or `STAT`, and three letters
 * are enough to *compare* four buttons at a glance — which is most of what the
 * badge is for. They are not enough to learn from. "PHYS" does not tell anyone
 * that the move will be resolved against their Attack and the defender's
 * Defence, and that is the whole decision the physical/special split exists to
 * create.
 *
 * So the badge is a tooltip trigger like every other one on the screen, and the
 * text is here rather than in `scene.ts` for the same reason the status text is
 * in `data/statusInfo.ts`: a sentence describing a mechanic, written in the
 * file that renders it, drifts from the mechanic.
 *
 * The split has been resolving correctly in the engine since Stage 0 — Choice
 * Band has found Attack and Choice Specs Special Attack for two stages. Stage
 * 4.5 did not implement it. It made it legible.
 */

export interface CategoryEntry {
  label: string;
  mechanics: string;
  advice: string;
}

/** Keyed by the lowercased category name, as `Dex.moves.get(id).category` reports it. */
export const CATEGORY_INFO: Readonly<Record<string, CategoryEntry>> = {
  physical: {
    label: 'Physical',
    mechanics:
      'Damage is calculated from your Attack against the defender’s Defence. Both are on the stat panels above.',
    advice:
      'Compare your Atk with their Def. A Pokemon with high Attack and low Sp. Atk wants these moves and almost nothing else.',
  },
  special: {
    label: 'Special',
    mechanics:
      'Damage is calculated from your Sp. Atk against the defender’s Sp. Def. Both are on the stat panels above.',
    advice:
      'Compare your SpA with their SpD. A burn does not weaken these, which is often the reason to reach for one.',
  },
  status: {
    label: 'Status',
    mechanics:
      'Deals no damage at all. These inflict conditions, change stat stages, heal, or set something up.',
    advice:
      'Spending a turn to gain an advantage. Worth it when you can survive the reply — check the Speed row before committing.',
  },
};

export function categoryInfo(category: string): CategoryEntry | null {
  return CATEGORY_INFO[category.toLowerCase()] ?? null;
}
