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

/** The sandbox's scenarios: what its Menu lists. */
export const SCENARIOS: Readonly<Record<string, EncounterDef>> = {
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
  // Parts C and D: waves, each harder than the last, ending in the boss
  // (`docs/spec/gymrun-card-battle-rulings-waves-boss-reskin.md`, C7 and C8).
  siege: {
    id: 'siege',
    name: 'Siege',
    blurb: 'Three waves, each harder, the Colossus last. HP carries over; shields and MP do not.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'drone', pos: at(1, 6) },
      { def: 'lancer', pos: at(2, 7) },
      { def: 'hound', pos: at(3, 6) },
    ],
    waves: [
      [
        { def: 'bulwark', pos: at(1, 6) },
        { def: 'sniper', pos: at(2, 7) },
        { def: 'lancer' },
        { def: 'hound', pos: at(3, 6) },
      ],
      // Part D: the Colossus covers L1-L2, C6-C7, and grants the Harpoon as it arrives.
      [{ def: 'colossus', pos: at(1, 6) }],
    ],
  },
};

const quest = (id: string, name: string, blurb: string, enemies: EncounterDef['enemies']): EncounterDef => ({
  id,
  name,
  blurb,
  deckId: 'puppeteer',
  units: PUPPETEER_FRONT,
  enemies,
});

/**
 * The card run's own fights (`docs/spec/gymrun-card-run-prompt.md`): the
 * first two act bosses, and the quests a Town, a City or a ? ambush sends the
 * player on, three tiers for the three acts. Every enemy spawns on a tile
 * drawn from the battle's seed. Provisional, like every grade
 * (`docs/generation.md` 125r).
 */
export const RUN_ENCOUNTERS: Readonly<Record<string, EncounterDef>> = {
  'colossus-lair': {
    id: 'colossus-lair',
    name: 'Colossus Lair',
    blurb: 'The Colossus alone. It grants the Harpoon as it arrives.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [{ def: 'colossus', pos: at(1, 6) }],
  },
  'colossus-escort': {
    id: 'colossus-escort',
    name: 'Colossus Escort',
    blurb: 'The Colossus with two Hounds running the open lane.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'colossus', pos: at(1, 6) },
      { def: 'hound', pos: at(3, 6) },
      { def: 'hound', pos: at(3, 7) },
    ],
  },
  'bandit-camp': quest('bandit-camp', 'Bandit Camp', 'Two Hounds and a Lancer.', [{ def: 'hound' }, { def: 'lancer' }, { def: 'hound' }]),
  'stray-drones': quest('stray-drones', 'Stray Drones', 'Two Drones.', [{ def: 'drone' }, { def: 'drone' }]),
  outriders: quest('outriders', 'Outriders', 'Two Hounds, a Drone and a Lancer.', [{ def: 'hound' }, { def: 'drone' }, { def: 'hound' }, { def: 'lancer' }]),
  'gun-nest': quest('gun-nest', 'Gun Nest', 'A Turret, a Lancer and a Hound.', [{ def: 'turret' }, { def: 'lancer' }, { def: 'hound' }]),
  raiders: quest('raiders', 'Raiders', 'A Sniper, a Hound and a Bulwark.', [{ def: 'sniper' }, { def: 'hound' }, { def: 'bulwark' }]),
  warband: quest('warband', 'Warband', 'A Pikeman, a Hound and a Drone.', [{ def: 'pikeman' }, { def: 'hound' }, { def: 'drone' }]),
  gatehouse: quest('gatehouse', 'Gatehouse', 'Defend the gate: a Bulwark and a Lancer.', [{ def: 'bulwark' }, { def: 'lancer' }]),
  'the-walls': quest('the-walls', 'The Walls', 'Defend the walls: a Bulwark, a Turret and a Hound.', [{ def: 'bulwark' }, { def: 'turret' }, { def: 'hound' }]),
  'last-stand': quest('last-stand', 'Last Stand', 'Defend the keep: a Bulwark, a Pikeman and a Sniper.', [{ def: 'bulwark' }, { def: 'pikeman' }, { def: 'sniper' }]),
};

/** Every encounter the engine can lay out: the sandbox's scenarios and the card run's fights. */
export const ENCOUNTERS: Readonly<Record<string, EncounterDef>> = { ...SCENARIOS, ...RUN_ENCOUNTERS };
