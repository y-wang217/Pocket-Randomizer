/**
 * Talents: abilities a unit gains for the rest of a run, offered by a boss in
 * place of a stat (`docs/spec/gymrun-card-run-shapes-prompt.md`). The first
 * is the Gunner's old ability, taken off the unit by the author's ruling of
 * 2026-10-11 ("remove ranger's pierce for an upgrade") and given back here.
 * The sandbox's Puppeteer deck fields it from the start (`cards.ts`).
 */
import type { TalentDef, UnitDefId } from '../core/cards/defs';

export const TALENTS: Readonly<Record<string, TalentDef>> = {
  marksman: {
    id: 'marksman',
    name: 'Marksman',
    unit: 'B',
    text: 'First card each turn: a Strike becomes a Pierce while at full HP',
    // The card sheet reads "first card played each turn gains pierce if HP
    // full". Only a Strike has a Pierce to become, so `from` names it; a card
    // with no Strike is unaffected.
    abilities: [{ k: 'firstCardConverts', from: 'strike', to: 'pierce', while: 'fullHp' }],
  },
};

/**
 * The talents a boss offers each unit, in order: the unit's slot on a boss
 * screen offers the first it has not taken, and a stat once it has them all.
 */
export const UNIT_TALENTS: Readonly<Record<UnitDefId, readonly string[]>> = {
  A: [],
  B: ['marksman'],
  C: [],
};
