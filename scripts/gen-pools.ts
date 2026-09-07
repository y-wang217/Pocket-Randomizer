/**
 * Emit `src/data/speciesPools.ts`, `src/data/movePools.ts` and
 * `src/data/abilities.ts` from @pkmn/sim's dex.
 *
 *   npm run gen:pools
 *
 * These three tables are *generated* rather than hand-written, and that is a
 * decision worth defending. Stage 1's pools were 24 hand-picked Pokemon with
 * hand-picked kits, and hand-picking is exactly what Stage 2 exists to stop
 * doing — a randomizer drawing from a curated list of two dozen species is a
 * shuffler, not a randomizer, and the Stage 2 done condition is that each seed
 * feels different. Six hundred species with dex-accurate typing is a pool worth
 * drawing from; six hundred species typed by hand is six hundred chances to
 * typo a type and find out in one node of one seed.
 *
 * What is *not* generated is everything a balance pass touches: which bands a
 * segment may draw from (data/scaling.ts), which entries are forbidden
 * (data/blacklists.ts), and the gyms themselves (data/gyms.ts). Those are
 * hand-written because they are the levers. The pools are the inventory.
 *
 * The exclusion rules below are the interesting part of this file. Each one is
 * a mechanic the Stage 2 engine cannot honestly play or the balance sweep
 * cannot honestly measure, and each is commented with which.
 *
 * Regenerating is a **draw-order change**: bump `RANDOMIZER_VERSION` in
 * src/core/randomizer.ts or every recorded seed silently reinterprets.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Dex } from '@pkmn/sim';
import type { Move, Species } from '@pkmn/sim';

const GEN = 9;
const dex = Dex.forGen(GEN);
const OUT = new URL('../src/data/', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------

/**
 * Base-stat-total cuts between bands.
 *
 * Five bands rather than three because the run is eight segments long and a
 * three-band curve would mean two and a half segments per step of the ladder.
 * The cuts are where the dex's own population is lumpy: 340 is roughly the
 * top of the unevolved mons, 490 the top of the "solid but not a threat"
 * middle, 540 the floor of the pseudo-legendary tier.
 */
const BST_CUTS = [340, 420, 490, 540] as const;

function bandOf(bst: number): number {
  return BST_CUTS.findIndex((cut) => bst <= cut) === -1 ? BST_CUTS.length : BST_CUTS.findIndex((cut) => bst <= cut);
}

function bstOf(species: Species): number {
  return Object.values(species.baseStats).reduce((total, stat) => total + stat, 0);
}

/**
 * Species the randomizer may draw.
 *
 *   - `isNonstandard` must be null. Past/Future/CAP/Custom entries have data,
 *     but their data is a different generation's and the balance numbers this
 *     stage produces should describe one ruleset.
 *   - No alternate formes, battle-only formes or item-locked formes. A Mega
 *     needs a stone the run has no way to give it, and a battle-only forme
 *     handed straight to the sim is a Pokemon that cannot legally be on the
 *     field. Regional forms are lost with them, which is a real cost paid for
 *     a rule with no exceptions to audit.
 *   - No Legendary, Mythical, Paradox or Ultra Beast tags. Not because they
 *     are strong — the bands handle strength — but because a run that can roll
 *     Arceus into a wild encounter is a run whose difficulty is a lottery.
 *     Four paradoxes are untagged upstream and are named in `UNTAGGED_PARADOX`.
 *
 * Pseudo-legendaries stay in, at band 4. They are obtainable Pokemon and the
 * band window is exactly the mechanism for keeping them out of segment 1.
 */
/**
 * Paradox Pokemon the dex forgets to tag.
 *
 * The four DLC paradoxes carry no `Paradox` tag in @pkmn/sim's data, so the
 * tag filter below lets them through — and it did, until a segment 7 Dragon gym
 * fielded a Raging Bolt. Named explicitly rather than caught by a base-stat
 * heuristic, because a heuristic that catches these also catches every
 * pseudo-legendary, and those belong in band 4.
 *
 * Check this list against `tags` whenever @pkmn/sim is upgraded; the day
 * upstream tags them it becomes a harmless no-op.
 */
const UNTAGGED_PARADOX = new Set(['gougingfire', 'ragingbolt', 'ironboulder', 'ironcrown']);

function speciesAllowed(species: Species): boolean {
  if (UNTAGGED_PARADOX.has(species.id)) return false;
  return (
    species.exists &&
    species.num > 0 &&
    species.isNonstandard === null &&
    !species.forme &&
    !species.battleOnly &&
    !species.requiredItem &&
    (species.tags ?? []).length === 0
  );
}

interface SpeciesRow {
  id: string;
  species: string;
  types: string[];
  bst: number;
  band: number;
}

const speciesRows: SpeciesRow[] = dex.species
  .all()
  .filter(speciesAllowed)
  .map((species) => ({
    id: species.id,
    species: species.name,
    types: [...species.types],
    bst: bstOf(species),
    band: bandOf(bstOf(species)),
  }))
  // Sorted by dex number, not by name or by band. The order is a draw order:
  // the randomizer picks an index into a filtered view of this list, so a
  // stable, meaningful sort is what keeps a regeneration from reshuffling
  // every seed for cosmetic reasons.
  .sort((a, b) => (dex.species.get(a.id).num - dex.species.get(b.id).num) || a.id.localeCompare(b.id));

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/** Base-power cuts between move bands. Mirrors BST_CUTS in spirit. */
const POWER_CUTS = [55, 75, 95] as const;

function powerBandOf(basePower: number): number {
  const index = POWER_CUTS.findIndex((cut) => basePower <= cut);
  return index === -1 ? POWER_CUTS.length : index;
}

/**
 * Moves the engine can honestly play and the sweep can honestly measure.
 *
 * Every exclusion here is mechanical, not aesthetic. A randomizer that only
 * rolls good moves is a curator with extra steps; these are the moves that
 * would make a *number in the balance report wrong*.
 */
const SELF_KO = new Set([
  // Ends a run on the opponent's turn rather than on the player's play.
  'explosion', 'selfdestruct', 'mistyexplosion', 'finalgambit', 'memento',
  'healingwish', 'lunardance',
]);

const SWITCH_MOVES = new Set([
  // The driver gains a switch choice in this stage, but only on a faint. A
  // move whose entire point is a voluntary switch still silently does half of
  // what it says, and no policy knows to value the half it does.
  'uturn', 'voltswitch', 'flipturn', 'batonpass', 'teleport', 'partingshot',
  'shedtail', 'chillyreception',
]);

const OHKO_ADJACENT = new Set([
  // A coin flip that ends a run is not difficulty. `ohko` catches the four
  // proper ones; these are the ones that behave like them.
  'guillotine', 'horndrill', 'fissure', 'sheercold',
]);

const SELF_HALVING = new Set([
  // Half your own HP for one hit reads to the greedy AI as free damage,
  // because the calc scores the hit and not the cost. That is a policy the
  // sweep would then report as stronger than it is.
  'mindblown', 'steelbeam', 'chloroblast',
]);

const UNSCOREABLE = new Set([
  // Damage that is a function of something @smogon/calc does not model from a
  // BattleView. The greedy AI would mis-score every one of them, and a
  // mis-scored move makes the greedy-vs-random gap meaningless.
  'return', 'frustration', 'naturalgift', 'fling', 'lastresort', 'dreameater',
  'belch', 'steelroller', 'focuspunch', 'bide', 'struggle', 'suckerpunch',
  'beatup', 'presentmove', 'present', 'spitup', 'stuffcheeks', 'terablast',
  'terastarstorm', 'ragefist', 'storedpower', 'powertrip', 'punishment',
  'grassknot', 'lowkick', 'heatcrash', 'heavyslam', 'electroball', 'gyroball',
  'wringout', 'crushgrip', 'hardpress', 'eruption', 'waterspout',
  'flail', 'reversal', 'endeavor', 'painsplit',
]);

function moveAllowed(move: Move): boolean {
  if (!move.exists || move.isNonstandard !== null) return false;
  if (move.isZ || move.isMax) return false;
  if (move.category === 'Status') return false;
  if (move.basePower <= 0) return false;
  if (move.ohko) return false;
  // Charge and recharge turns: the calc scores one turn of a two-turn move, so
  // a policy that picks them looks twice as strong as it plays.
  if (move.flags['charge'] || move.self?.volatileStatus === 'mustrecharge') return false;
  // Below 70% accuracy a move is a coin flip the report cannot separate from
  // a balance problem. `true` means "never misses".
  if (move.accuracy !== true && move.accuracy < 70) return false;
  const id = move.id;
  return !SELF_KO.has(id) && !SWITCH_MOVES.has(id) && !OHKO_ADJACENT.has(id) &&
    !SELF_HALVING.has(id) && !UNSCOREABLE.has(id);
}

/**
 * The status moves the randomizer may roll, hand-picked.
 *
 * This is the one list in this file that is *not* a filter over the dex, and
 * the reason is that most status moves are conditional on something a 1v1
 * with no switching does not have: hazards nobody switches into, screens for a
 * partner that does not exist, weather with no follow-up. Rolling those is not
 * variety, it is a wasted move slot, and a wasted move slot is how a generated
 * Pokemon becomes a dead encounter.
 *
 * These forty do something on the turn they are used, or on the next one.
 */
const STATUS_MOVES: readonly string[] = [
  // setup
  'Swords Dance', 'Nasty Plot', 'Calm Mind', 'Bulk Up', 'Dragon Dance', 'Agility',
  'Iron Defense', 'Amnesia', 'Work Up', 'Hone Claws', 'Shell Smash', 'Quiver Dance',
  'Coil', 'Cosmic Power', 'Rock Polish', 'Curse', 'Growth', 'Acid Armor',
  // recovery
  'Recover', 'Roost', 'Synthesis', 'Moonlight', 'Morning Sun', 'Soft-Boiled',
  'Slack Off', 'Milk Drink', 'Rest', 'Shore Up', 'Strength Sap', 'Life Dew',
  'Leech Seed', 'Aqua Ring', 'Wish',
  // status
  'Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Glare', 'Sleep Powder', 'Spore',
  'Hypnosis', 'Yawn', 'Stun Spore', 'Poison Powder', 'Confuse Ray', 'Sing',
  // pressure
  'Screech', 'Charm', 'Scary Face', 'Metal Sound', 'Fake Tears', 'Tickle',
  'Eerie Impulse', 'Protect', 'Substitute', 'Reflect', 'Light Screen', 'Safeguard',
  'Tailwind', 'Taunt', 'Encore', 'Disable',
];

interface MoveRow {
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number;
  band: number;
}

function moveRow(move: Move): MoveRow {
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy === true ? 101 : move.accuracy,
    band: move.category === 'Status' ? 0 : powerBandOf(move.basePower),
  };
}

const damagingRows: MoveRow[] = dex.moves
  .all()
  .filter(moveAllowed)
  .map(moveRow)
  .sort((a, b) => a.id.localeCompare(b.id));

const statusRows: MoveRow[] = [...new Set(STATUS_MOVES)]
  .map((name) => {
    const move = dex.moves.get(name);
    if (!move.exists || move.isNonstandard !== null) {
      throw new Error(`Status move "${name}" is not a standard gen ${GEN} move`);
    }
    if (move.category !== 'Status') throw new Error(`"${name}" is not a status move`);
    return moveRow(move);
  })
  .sort((a, b) => a.id.localeCompare(b.id));

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

/**
 * The full ability pool: every standard ability in the generation.
 *
 * Not the species' legal abilities. That is the whole point of a randomizer,
 * and the engine takes it because GYMRUN runs Custom Game with no validator
 * (see the header of core/battle/driver.ts).
 *
 * `No Ability` goes because it is the dex's placeholder for "none" rather than
 * an ability, and rolling it would be rolling a blank 1% of the time.
 */
const abilityRows: string[] = dex.abilities
  .all()
  .filter((ability) => ability.exists && ability.isNonstandard === null && ability.id !== 'noability')
  .map((ability) => ability.name)
  .sort((a, b) => a.localeCompare(b));

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const BANNER = `/**
 * GENERATED FILE — do not hand-edit.
 *
 * Produced by \`npm run gen:pools\` (scripts/gen-pools.ts) from @pkmn/sim's gen
 * ${GEN} dex. The selection rules, and the reasoning behind each exclusion, live
 * in that script. Hand-edits are lost on the next run; change the rules there.
 *
 * Regenerating changes what every recorded seed produces. Bump
 * RANDOMIZER_VERSION in src/core/randomizer.ts when you do.
 */`;

function emitSpecies(): string {
  const rows = speciesRows
    .map((row) => `  { id: '${row.id}', species: ${quote(row.species)}, types: [${row.types.map(quote).join(', ')}], bst: ${row.bst}, band: ${row.band} },`)
    .join('\n');

  return `${BANNER}

/** A species the randomizer may draw: identity, typing, and a power band. */
export interface SpeciesEntry {
  /** Dex id. Blacklists and gym restrictions key off this, not the name. */
  id: string;
  species: string;
  /** One or two, exactly as the dex reports them. Drives STAB and gym identity. */
  types: readonly string[];
  /** Base stat total, the number the band was cut from. Kept for tuning reads. */
  bst: number;
  /** 0 (weakest) to ${BST_CUTS.length}. data/scaling.ts says which bands a segment may draw. */
  band: number;
}

/**
 * Every drawable species, in dex order.
 *
 * The order is a **draw order**: the randomizer picks an index into a filtered
 * view of this list. Re-sorting it reshuffles every recorded seed.
 */
export const SPECIES_POOL: readonly SpeciesEntry[] = [
${rows}
];

/** The highest band any entry carries. */
export const MAX_SPECIES_BAND = ${BST_CUTS.length};
`;
}

function emitMoves(): string {
  const damaging = damagingRows
    .map((row) => `  { id: '${row.id}', name: ${quote(row.name)}, type: ${quote(row.type)}, category: '${row.category}', basePower: ${row.basePower}, accuracy: ${row.accuracy}, band: ${row.band} },`)
    .join('\n');
  const status = statusRows
    .map((row) => `  { id: '${row.id}', name: ${quote(row.name)}, type: ${quote(row.type)}, category: 'Status', basePower: 0, accuracy: ${row.accuracy}, band: 0 },`)
    .join('\n');

  return `${BANNER}

/** A move the randomizer may draw. */
export interface MoveEntry {
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  /** 0 for status moves. */
  basePower: number;
  /** 101 means "never misses"; the dex reports that as \`true\`. */
  accuracy: number;
  /** 0 (weakest) to ${POWER_CUTS.length} for damaging moves; always 0 for status. */
  band: number;
}

/**
 * Damaging moves, by move id.
 *
 * As with the species pool, the order is a draw order. It is sorted by id
 * rather than by power so that adding a move to the dex inserts it in one
 * place rather than shifting a whole band.
 */
export const DAMAGING_MOVES: readonly MoveEntry[] = [
${damaging}
];

/**
 * Status moves, hand-picked rather than filtered.
 *
 * See scripts/gen-pools.ts: most status moves are conditional on something a
 * 1v1 with no voluntary switching does not have, and a conditional move that
 * never fires is a dead move slot rather than variety.
 */
export const STATUS_MOVES: readonly MoveEntry[] = [
${status}
];

/** The highest band any damaging move carries. */
export const MAX_MOVE_BAND = ${POWER_CUTS.length};
`;
}

function emitAbilities(): string {
  return `${BANNER}

/**
 * Every standard ability in the generation, alphabetically.
 *
 * The randomizer draws from **this** list rather than from a species' legal
 * abilities, which is the single loudest thing about a randomizer run: your
 * Magikarp can have Levitate, and the gym leader's Rhydon can have Wonder
 * Guard. Custom Game applies no validator, so the engine takes it.
 *
 * Entries are removed at draw time by data/blacklists.ts, never from here.
 */
export const ABILITY_POOL: readonly string[] = [
${abilityRows.map((name) => `  ${quote(name)},`).join('\n')}
];
`;
}

function quote(value: string): string {
  return value.includes("'") ? `"${value}"` : `'${value}'`;
}

writeFileSync(join(OUT, 'speciesPools.ts'), emitSpecies());
writeFileSync(join(OUT, 'movePools.ts'), emitMoves());
writeFileSync(join(OUT, 'abilities.ts'), emitAbilities());

console.log(`species: ${speciesRows.length}`);
for (let band = 0; band <= BST_CUTS.length; band++) {
  const rows = speciesRows.filter((row) => row.band === band);
  console.log(`  band ${band}: ${String(rows.length).padStart(3)} species`);
}
console.log(`damaging moves: ${damagingRows.length}`);
for (let band = 0; band <= POWER_CUTS.length; band++) {
  const rows = damagingRows.filter((row) => row.band === band);
  const types = new Set(rows.map((row) => row.type));
  console.log(`  band ${band}: ${String(rows.length).padStart(3)} moves across ${types.size}/18 types`);
}
console.log(`status moves: ${statusRows.length}`);
console.log(`abilities: ${abilityRows.length}`);
