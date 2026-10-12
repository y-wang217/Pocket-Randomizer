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
  // Checkpoint 5a: a talent for each shape the author named
  // (`docs/spec/gymrun-card-run-shapes-prompt.md`). Every number is a first draft.
  battery: {
    id: 'battery',
    name: 'Battery',
    unit: 'A',
    text: '+1 MP at the start of each turn',
    // Bodyguard and battery: the Commander only nukes and banks mana.
    abilities: [{ k: 'mpAtTurnStart', n: 1 }],
  },
  'field-medic': {
    id: 'field-medic',
    name: 'Field Medic',
    unit: 'A',
    text: 'Shields and Repairs from its cards +1',
    // The Puppeteer: the Commander keeps the others standing.
    abilities: [
      { k: 'bonus', effect: 'shield', n: 1 },
      { k: 'bonus', effect: 'repair', n: 1 },
    ],
  },
  'siege-mode': {
    id: 'siege-mode',
    name: 'Siege Mode',
    unit: 'B',
    text: 'Blast +1 from the danger zone',
    // Escort artillery: walked into the danger zone, the Gunner lays it down.
    abilities: [{ k: 'bonus', effect: 'blast', n: 1, inDanger: true }],
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    unit: 'B',
    text: 'Equipment it plays: next hand +1',
    // Control: the Gunner runs the equipment.
    abilities: [{ k: 'equipmentDraws', n: 1 }],
  },
  bodyguard: {
    id: 'bodyguard',
    name: 'Bodyguard',
    unit: 'C',
    text: 'A Shield on itself also Covers its neighbours',
    // Bodyguard and battery: the Dasher builds tanky and blocks.
    abilities: [{ k: 'coverOnShield' }],
  },
  sweep: {
    id: 'sweep',
    name: 'Sweep',
    unit: 'C',
    text: 'Slash +1',
    // Control: the Dasher sweeps them down.
    abilities: [{ k: 'bonus', effect: 'slash', n: 1 }],
  },
};

/**
 * Every unit's talents. A boss offers two talents and a stat: Marksman while
 * it is untaken (everything taken away is given back), then the next untaken
 * talents in the order the boss drew at generation (`offersFor`).
 */
export const UNIT_TALENTS: Readonly<Record<UnitDefId, readonly string[]>> = {
  A: ['battery', 'field-medic'],
  B: ['marksman', 'siege-mode', 'quartermaster'],
  C: ['bodyguard', 'sweep'],
};

/** The talent a boss offers first while it is untaken: the Gunner's ability, given back. */
export const GIVEN_BACK = 'marksman';

/** How many of a boss's three offers are talents; the rest are stats. */
export const TALENT_OFFERS = 2;
