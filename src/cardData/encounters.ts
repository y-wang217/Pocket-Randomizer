/**
 * The sandbox's scenarios. `test` is the first encounter, Appendix A, moved
 * onto the seven-deep board: the enemies on the backline row nearest the
 * danger zone. The rest are scenarios in the shape
 * `docs/handoff/card-battle-log-reading.md` section 8 asks for. An enemy with
 * no `pos` starts on a free enemy backline tile drawn from the seed.
 *
 * Units' tiles are where each starts before the player places it.
 */
import type { EncounterDef, EnemyDefId, EnemySpawn, Pos } from '../core/cards/defs';

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
    blurb: 'Three waves, each harder, the Colossus last. Only the cards reset between waves.',
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
  // Checkpoint 6: act 2's boss, the Warlord, with a Hound on either side of it.
  'warlord-guard': {
    id: 'warlord-guard',
    name: "Warlord's Guard",
    blurb: 'The Warlord holds the middle lane, a Hound on either side.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [
      { def: 'hound', pos: at(1, 6) },
      { def: 'warlord', pos: at(2, 6) },
      { def: 'hound', pos: at(3, 6) },
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

/**
 * Two light waves that open a run fight, each on tiles drawn from the battle's
 * seed. Grades in the comments; each act's are heavier than the last.
 */
const LEAD: Readonly<Record<string, readonly EnemySpawn[]>> = {
  lancers: [{ def: 'lancer' }, { def: 'lancer' }], // 2
  houndLancer: [{ def: 'hound' }, { def: 'lancer' }], // 2
  hounds: [{ def: 'hound' }, { def: 'hound' }], // 2
  lancerDrone: [{ def: 'lancer' }, { def: 'drone' }], // 3
  turretHound: [{ def: 'turret' }, { def: 'hound' }], // 3
  drones: [{ def: 'drone' }, { def: 'drone' }], // 4
  bulwarkLancer: [{ def: 'bulwark' }, { def: 'lancer' }], // 3
  sniperHound: [{ def: 'sniper' }, { def: 'hound' }], // 4
  pikemanHound: [{ def: 'pikeman' }, { def: 'hound' }], // 4
};

/**
 * The veteran of each enemy (checkpoint 6): the same body, a harder pattern
 * (`enemies.ts`). Act 2's lead waves field them, and every wave of act 3.
 */
export const VETERAN: Readonly<Partial<Record<EnemyDefId, EnemyDefId>>> = {
  drone: 'drone-mk2',
  lancer: 'lancer-captain',
  hound: 'dire-hound',
  turret: 'heavy-turret',
  bulwark: 'juggernaut',
  sniper: 'deadeye',
  pikeman: 'halberdier',
};

/**
 * How each act scales its fights (checkpoint 6), by act index: the HP every
 * enemy gains, bosses included, and which waves field veterans.
 */
export const ACT_SCALING: readonly { hpBonus: number; veterans: 'none' | 'leads' | 'all' }[] = [
  { hpBonus: 0, veterans: 'none' },
  { hpBonus: 1, veterans: 'leads' },
  { hpBonus: 2, veterans: 'all' },
];

const veteran = (wave: readonly EnemySpawn[]): EnemySpawn[] => wave.map((spawn) => ({ ...spawn, def: VETERAN[spawn.def] ?? spawn.def }));

/**
 * How many lead waves a run fight on each floor plays before its scenario (the
 * author's ruling of 2026-10-13): floor 1's fights are the scenario alone, one
 * wave, and its boss fight one lead wave then the boss; each floor after adds
 * a lead wave to both. A quest or an ambush is a fight of its floor.
 */
export const FLOOR_LEADS: readonly { fight: number; boss: number }[] = [
  { fight: 0, boss: 1 },
  { fight: 1, boss: 2 },
  { fight: 2, boss: 2 },
];

/**
 * A run fight: its floor's lead waves back to back, then the scenario itself on
 * its own tiles, HP carried between them (`docs/spec/gymrun-card-run-shapes-prompt.md`,
 * Q1 (a)); a scenario of waves already (Siege) is played as it is. Scaled for
 * its act (checkpoint 6).
 */
const runFight = (base: EncounterDef, leads: readonly [keyof typeof LEAD, keyof typeof LEAD] | null, act: number, boss = false): EncounterDef => {
  const scale = ACT_SCALING[act]!;
  const lead = (wave: readonly EnemySpawn[]): readonly EnemySpawn[] => (scale.veterans === 'none' ? wave : veteran(wave));
  const own = (wave: readonly EnemySpawn[]): readonly EnemySpawn[] => (scale.veterans === 'all' ? veteran(wave) : wave);
  const count = FLOOR_LEADS[act]![boss ? 'boss' : 'fight'];
  const waves = leads ? [...leads.slice(0, count).map((id) => lead(LEAD[id]!)), own(base.enemies)] : [own(base.enemies), ...(base.waves ?? []).map(own)];
  const named = ['One wave', 'Two waves', 'Three waves'][waves.length - 1]!;
  return {
    ...base,
    id: `run-${base.id}`,
    blurb: leads && waves.length > 1 ? `${named}. Last: ${base.blurb}` : base.blurb,
    enemies: waves[0]!,
    waves: waves.slice(1),
    ...(scale.hpBonus > 0 ? { hpBonus: scale.hpBonus } : {}),
  };
};

const BASES: Readonly<Record<string, EncounterDef>> = { ...SCENARIOS, ...RUN_ENCOUNTERS };

/**
 * Every fight the card run sends the player into, as its floor's waves
 * (`FLOOR_LEADS`). Siege is three waves already and is played as it is.
 * Provisional: the first draft of the chains, for the author to playtest.
 */
export const RUN_FIGHTS: Readonly<Record<string, EncounterDef>> = Object.fromEntries(
  (
    [
      // Act 1.
      ['test', ['lancers', 'houndLancer'], 0],
      ['staggered', ['houndLancer', 'lancers'], 0],
      ['colossus-lair', ['lancers', 'hounds'], 0, true],
      ['bandit-camp', ['lancers', 'houndLancer'], 0],
      ['stray-drones', ['houndLancer', 'lancers'], 0],
      ['gatehouse', ['hounds', 'lancers'], 0],
      // Act 2: its boss is the Warlord now (checkpoint 6); Colossus Escort stays a sandbox scenario.
      ['skirmish', ['hounds', 'lancerDrone'], 1],
      ['turret-alley', ['lancerDrone', 'turretHound'], 1],
      ['warlord-guard', ['drones', 'turretHound'], 1, true],
      ['outriders', ['lancerDrone', 'hounds'], 1],
      ['gun-nest', ['hounds', 'lancerDrone'], 1],
      ['the-walls', ['lancerDrone', 'turretHound'], 1],
      // Act 3.
      ['the-pack', ['bulwarkLancer', 'sniperHound'], 2],
      ['wall-and-gun', ['pikemanHound', 'sniperHound'], 2],
      ['siege', null, 2],
      ['raiders', ['bulwarkLancer', 'pikemanHound'], 2],
      ['warband', ['pikemanHound', 'bulwarkLancer'], 2],
      ['last-stand', ['sniperHound', 'bulwarkLancer'], 2],
    ] as const
  ).map(([base, leads, act, boss]) => {
    const fight = runFight(BASES[base]!, leads, act, boss === true);
    return [fight.id, fight];
  }),
);

/**
 * The tutorial's battle (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`):
 * one Target Dummy in the middle of the danger zone, in the Gunner's lane, so
 * Shoot reaches it from where the Gunner starts. Not a scenario: the tutorial
 * opens it, and the Menu's list, the bench and the trainer leave it out.
 */
export const TUTORIAL_ENCOUNTERS: Readonly<Record<string, EncounterDef>> = {
  tutorial: {
    id: 'tutorial',
    name: 'Tutorial',
    blurb: 'One Target Dummy. It never moves and never fights back.',
    deckId: 'puppeteer',
    units: PUPPETEER_FRONT,
    enemies: [{ def: 'dummy', pos: at(2, 4) }],
  },
};

/** Every encounter the engine can lay out: the sandbox's scenarios, the card run's fights, their three-wave chains and the tutorial's. */
export const ENCOUNTERS: Readonly<Record<string, EncounterDef>> = { ...SCENARIOS, ...RUN_ENCOUNTERS, ...RUN_FIGHTS, ...TUTORIAL_ENCOUNTERS };

/** What the bench and the trainer play: every encounter but the tutorial's. */
export const BENCH_IDS: readonly string[] = Object.keys(ENCOUNTERS).filter((id) => !Object.hasOwn(TUTORIAL_ENCOUNTERS, id));
