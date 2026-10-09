/**
 * The sandbox's scenarios. `test` is the first encounter, Appendix A, moved
 * onto the seven-deep board: the enemies on the backline row nearest the
 * danger zone. The rest are scenarios in the shape
 * `docs/handoff/card-battle-log-reading.md` section 8 asks for. An enemy with
 * no `pos` starts on a free enemy backline tile drawn from the seed.
 *
 * Units' tiles are where each starts before the player places it.
 */
import type { EncounterDef, Pos } from '../core/cards/defs';

const at = (lane: Pos['lane'], col: Pos['col']): Pos => ({ lane, col });

/** The Puppeteer's default placement: the home row nearest the danger zone. */
const PUPPETEER_FRONT = [
  { def: 'A', pos: at(1, 2) },
  { def: 'B', pos: at(2, 2) },
  { def: 'C', pos: at(3, 2) },
] as const;

export const ENCOUNTERS: Readonly<Record<string, EncounterDef>> = {
  skirmish: {
    id: 'skirmish',
    name: 'Skirmish',
    blurb: 'Two Drones and a Lancer, anywhere on the enemy backline.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [{ def: 'drone' }, { def: 'lancer' }, { def: 'drone' }],
  },
  test: {
    id: 'test',
    name: 'Front line',
    blurb: 'The first encounter: one enemy per lane, on the row nearest the danger zone.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'drone', pos: at(1, 6) },
      { def: 'lancer', pos: at(2, 6) },
      { def: 'drone', pos: at(3, 6) },
    ],
  },
  staggered: {
    id: 'staggered',
    name: 'Staggered',
    blurb: 'The Lancer holds the middle forward; both Drones start deep.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'drone', pos: at(1, 7) },
      { def: 'lancer', pos: at(2, 6) },
      { def: 'drone', pos: at(3, 7) },
    ],
  },
  // `docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A4: every
  // spawn fixed, in the order listed, which is the order they act.
  'turret-alley': {
    id: 'turret-alley',
    name: 'Turret Alley',
    blurb: 'Two Turrets hold the outer lanes; a Hound runs the middle.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'turret', pos: at(1, 7) },
      { def: 'hound', pos: at(2, 6) },
      { def: 'turret', pos: at(3, 7) },
    ],
  },
  'wall-and-gun': {
    id: 'wall-and-gun',
    name: 'Wall and Gun',
    blurb: 'Two Bulwarks march on the outer lanes; a Sniper waits behind.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'bulwark', pos: at(1, 6) },
      { def: 'sniper', pos: at(2, 7) },
      { def: 'bulwark', pos: at(3, 6) },
    ],
  },
  'the-pack': {
    id: 'the-pack',
    name: 'The Pack',
    blurb: 'Three Hounds on the front row, a Pikeman behind them.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'hound', pos: at(1, 6) },
      { def: 'hound', pos: at(2, 6) },
      { def: 'hound', pos: at(3, 6) },
      { def: 'pikeman', pos: at(2, 7) },
    ],
  },
};

