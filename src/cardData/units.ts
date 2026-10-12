/** The Puppeteer deck's three units. Appendix A, Units, and the author's card sheet. */
import type { UnitDef, UnitDefId } from '../core/cards/defs';

export const UNITS: Readonly<Record<UnitDefId, UnitDef>> = {
  A: {
    id: 'A',
    name: 'Commander',
    role: 'Commander',
    class: 'special',
    hp: 1,
    baseShield: 1,
    abilities: [{ k: 'mpAtTurnStart', n: 1 }],
  },
  B: {
    id: 'B',
    name: 'Gunner',
    role: 'Gunner',
    class: 'ranged',
    hp: 2,
    baseShield: 1,
    // Its first-card Pierce is the Marksman talent now (`talents.ts`): the
    // card run's Gunner earns it from a boss, the sandbox's Puppeteer fields it.
    abilities: [],
  },
  C: {
    id: 'C',
    name: 'Sword dasher',
    role: 'Sword dasher',
    class: 'melee',
    hp: 3,
    baseShield: 2,
    abilities: [],
  },
};
