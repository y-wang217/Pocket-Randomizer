/** The first encounter, `test`. Appendix A, First encounter. */
import type { EncounterDef } from '../core/cards/defs';

export const ENCOUNTERS: Readonly<Record<string, EncounterDef>> = {
  test: {
    id: 'test',
    deckId: 'puppeteer',
    units: [
      { def: 'A', pos: { lane: 1, col: 2 } },
      { def: 'B', pos: { lane: 2, col: 2 } },
      { def: 'C', pos: { lane: 3, col: 2 } },
    ],
    enemies: [
      { def: 'drone', pos: { lane: 1, col: 5 } },
      { def: 'lancer', pos: { lane: 2, col: 5 } },
      { def: 'drone', pos: { lane: 3, col: 5 } },
    ],
  },
};
