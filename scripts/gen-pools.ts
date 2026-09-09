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
  /** Chance of rolling male, 0..1. `null` for a genderless species. */
  maleChance: number | null;
}

/**
 * The species' real male chance, or null if it has no gender.
 *
 * **Baked in at build time because the engine does not apply it.** The sim
 * assigns gender with `battle.sample(['M', 'F'])` whenever a set does not name
 * one (`sim/pokemon.ts`), which is a flat coin flip that ignores `genderRatio`
 * entirely — Combee comes out 50/50 rather than the 87.5% male its own data
 * declares. GYMRUN rolls gender itself from this number, so the ratio is the
 * one the dex states.
 *
 * `species.gender` is set only for gender-*locked* species: 'N' for the
 * genderless, 'M' or 'F' for the handful that are always one. Everything else
 * carries a `genderRatio` and an empty `gender`.
 */
function maleChanceOf(species: Species): number | null {
  if (species.gender === 'N') return null;
  if (species.gender === 'M') return 1;
  if (species.gender === 'F') return 0;
  const ratio = species.genderRatio;
  if (!ratio) return 0.5;
  const total = ratio.M + ratio.F;
  return total > 0 ? ratio.M / total : null;
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
    maleChance: maleChanceOf(species),
  }))
  // Sorted by dex number, not by name or by band. The order is a draw order:
  // the randomizer picks an index into a filtered view of this list, so a
  // stable, meaningful sort is what keeps a regeneration from reshuffling
  // every seed for cosmetic reasons.
  .sort((a, b) => (dex.species.get(a.id).num - dex.species.get(b.id).num) || a.id.localeCompare(b.id));

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/**
 * Base-power cuts between move bands. Mirrors BST_CUTS in spirit.
 *
 * **Bands are numbered 1 to 4 from Stage 4.6b**, where they were 0 to 3. The
 * renumbering is not cosmetic: 4.6b puts the band on reward cards, in the
 * balance report and in every conversation about the ramp, and a table that
 * says "band 1" while the code says 0 is a translation everybody has to
 * remember and somebody eventually gets wrong. Species bands stay 0-based
 * because they are never named outside this codebase.
 *
 * The first cut is **55 and not the spec's 50**, which is a ratified
 * exception: 55 is where Stage 2 put it after measuring that segments 1-2 need
 * opponents under 55 BP to produce a fight lasting more than a turn, and
 * moving it to 50 would have re-opened that measurement for the sake of a
 * round number.
 */
const POWER_CUTS = [55, 75, 95] as const;

function powerBandOf(basePower: number): number {
  const index = POWER_CUTS.findIndex((cut) => basePower <= cut);
  return (index === -1 ? POWER_CUTS.length : index) + 1;
}

/**
 * Expected hits for a multi-hit move. 1 for everything else.
 *
 * A fixed count is itself; a `[2, 5]` range is 3.167, which is the gen 5+
 * distribution (2 and 3 at a third each, 4 and 5 at a sixth each). Skill Link
 * would make it 5 and is ignored: abilities are drawn off-species, so every
 * move would have to be banded for an ability it usually will not have.
 */
function expectedHits(move: Move): number {
  const hits = move.multihit;
  if (!hits) return 1;
  if (Array.isArray(hits)) {
    const low = hits[0] ?? 1;
    const high = hits[1] ?? low;
    return low === 2 && high === 5 ? 3.167 : (low + high) / 2;
  }
  return hits;
}

/**
 * The base power a move actually applies in a turn.
 *
 * **The one place the dex's own number is not taken at face value, and it is a
 * mechanical correction rather than a balance one.** `basePower` on a multi-hit
 * move is per *hit*: Population Bomb reports 20 and lands ten times, so the
 * generated table would file the hardest move in the game as band 1 — the
 * weakest card there is — and a reward screen would offer it as a beginner's
 * pick.
 *
 * Stage 4.6b's override table (`data/moveOverrides.ts`) exists for moves whose
 * power lies about their strength, and this class is deliberately *not* left to
 * it. An override is a hand-written exception justified by evidence; this is
 * arithmetic the dex already knows, and computing it here means it stays right
 * when the dex changes a hit count.
 */
function effectivePower(move: Move): number {
  return Math.round(move.basePower * expectedHits(move));
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
const STATUS_BY_IMPACT: Record<string, readonly string[]> = {
  setup: [
    'Swords Dance', 'Nasty Plot', 'Calm Mind', 'Bulk Up', 'Dragon Dance', 'Agility',
    'Iron Defense', 'Amnesia', 'Work Up', 'Hone Claws', 'Shell Smash', 'Quiver Dance',
    'Coil', 'Cosmic Power', 'Rock Polish', 'Curse', 'Growth', 'Acid Armor',
  ],
  recovery: [
    'Recover', 'Roost', 'Synthesis', 'Moonlight', 'Morning Sun', 'Soft-Boiled',
    'Slack Off', 'Milk Drink', 'Rest', 'Shore Up', 'Strength Sap', 'Life Dew',
    'Leech Seed', 'Aqua Ring', 'Wish',
  ],
  status: [
    'Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Glare', 'Sleep Powder', 'Spore',
    'Hypnosis', 'Yawn', 'Stun Spore', 'Poison Powder', 'Confuse Ray', 'Sing',
  ],
  pressure: [
    'Screech', 'Charm', 'Scary Face', 'Metal Sound', 'Fake Tears', 'Tickle',
    'Eerie Impulse', 'Protect', 'Substitute', 'Reflect', 'Light Screen', 'Safeguard',
    'Tailwind', 'Taunt', 'Encore', 'Disable',
  ],
};

/**
 * The impact tag, which is the status half of Stage 4.6b's banding.
 *
 * **These four groups already existed here as comments.** They were written in
 * Stage 2 as a note on why the list is curated, and 4.6b needs exactly the
 * distinction they draw: a status move has no base power, so it has no band,
 * and offering a Swords Dance as a "band 1" reward would read as the weakest
 * card in the game. Promoting the comment to data is cheaper and more honest
 * than inventing a second taxonomy beside it.
 *
 * A single move's tag can be corrected in `data/moveOverrides.ts` without
 * regenerating; the groups are the default, not the last word.
 */
const STATUS_MOVES: readonly string[] = Object.values(STATUS_BY_IMPACT).flat();

function impactOf(name: string): string {
  const found = Object.entries(STATUS_BY_IMPACT).find(([, names]) => names.includes(name));
  if (!found) throw new Error(`Status move "${name}" has no impact group`);
  return found[0];
}

interface MoveRow {
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number;
  /** Null for a status move: no base power, so no band. See `impact`. */
  band: number | null;
  /** Status moves only. */
  impact: string | null;
}

function moveRow(move: Move): MoveRow {
  const status = move.category === 'Status';
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy === true ? 101 : move.accuracy,
    band: status ? null : powerBandOf(effectivePower(move)),
    impact: status ? impactOf(move.name) : null,
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
    .map((row) => `  { id: '${row.id}', species: ${quote(row.species)}, types: [${row.types.map(quote).join(', ')}], bst: ${row.bst}, band: ${row.band}, maleChance: ${row.maleChance} },`)
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
  /**
   * Chance of rolling male, 0..1, or \`null\` for a genderless species.
   *
   * Here rather than asked of the dex at runtime, because \`core/randomizer.ts\`
   * does not import the sim — and because the sim would give the wrong answer
   * anyway. Showdown assigns an unnamed gender with a flat \`sample(['M','F'])\`
   * that ignores \`genderRatio\`, so Combee comes out 50/50 rather than 87.5%
   * male. GYMRUN rolls it from this number instead and hands the sim a concrete
   * gender, which also means one fewer draw off the battle PRNG per Pokemon.
   */
  maleChance: number | null;
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
    .map((row) => `  { id: '${row.id}', name: ${quote(row.name)}, type: ${quote(row.type)}, category: '${row.category}', basePower: ${row.basePower}, accuracy: ${row.accuracy}, band: ${row.band}, impact: null },`)
    .join('\n');
  const status = statusRows
    .map((row) => `  { id: '${row.id}', name: ${quote(row.name)}, type: ${quote(row.type)}, category: 'Status', basePower: 0, accuracy: ${row.accuracy}, band: null, impact: '${row.impact}' },`)
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
  /**
   * 1 (weakest) to ${POWER_CUTS.length + 1} for damaging moves, cut from base power at
   * ${POWER_CUTS.join(', ')}. **Null for a status move**, which has no base power and
   * therefore no band — see \`impact\`.
   *
   * This is the *computed* band. \`data/moveOverrides.ts\` can replace it for a
   * move whose base power lies about its strength, and \`bandOf()\` there is the
   * one function that should be asked.
   */
  band: number | null;
  /**
   * What a status move actually does, for the pools that gate on it.
   *
   * Null for damaging moves, which are gated by band instead. The four groups
   * are curated in \`scripts/gen-pools.ts\`; \`impactOf()\` in
   * \`data/moveOverrides.ts\` is the one function that should be asked, because a
   * single move's tag can be corrected without regenerating this file.
   */
  impact: MoveImpact | null;
}

/** What a status move is for. Damaging moves carry a band instead. */
export type MoveImpact = 'setup' | 'recovery' | 'status' | 'pressure';

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

/**
 * The highest band the *computed* banding produces.
 *
 * Not the ceiling anything should clamp to: an override in
 * \`data/moveOverrides.ts\` can move a move above it, so the live ceiling is
 * \`MAX_MOVE_BAND\` there, derived from the entries with overrides applied. This
 * is here as a record of what the generator itself emits.
 */
export const COMPUTED_MAX_MOVE_BAND = ${POWER_CUTS.length + 1};
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
for (let band = 1; band <= POWER_CUTS.length + 1; band++) {
  const rows = damagingRows.filter((row) => row.band === band);
  const types = new Set(rows.map((row) => row.type));
  console.log(`  band ${band}: ${String(rows.length).padStart(3)} moves across ${types.size}/18 types`);
}
console.log(`status moves: ${statusRows.length}`);
for (const impact of Object.keys(STATUS_BY_IMPACT)) {
  const rows = statusRows.filter((row) => row.impact === impact);
  console.log(`  ${impact.padEnd(8)}: ${String(rows.length).padStart(3)} moves`);
}
console.log(`abilities: ${abilityRows.length}`);
