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
import type { Ability, Move, Species } from '@pkmn/sim';
import { SYNTHETIC_BY_METHOD, syntheticThreshold, type EvoMethod } from '../src/data/evolutionThresholds';

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
 *   - `isNonstandard` must be null or `'Past'`. Future/CAP/Custom/LGPE entries
 *     are out: their data is another ruleset's or nobody's. **`Past` is in
 *     from Stage 4.9.** It was out on the argument above, and the argument was
 *     wrong for this game: a `Past` species is one Scarlet/Violet does not
 *     ship, not one whose gen 9 stats and types are missing — the dex carries
 *     them all — and GYMRUN runs Custom Game and validates nothing. Excluding
 *     them cost 265 species, most of them the low-tier base forms a level-7
 *     start is made of (Pidgey, Caterpie, Rattata, Spearow), and left the
 *     segment-0 Rock gym drawing from six species.
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
    (species.isNonstandard === null || species.isNonstandard === 'Past') &&
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
  /** Pool id this evolves from; null for a base form or a parent outside the pool. */
  prevo: string | null;
  /** The level this species becomes a legal stage at; null iff it has no dex prevo. */
  evoLevel: number | null;
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

const allowedSpecies: Species[] = dex.species.all().filter(speciesAllowed);
const allowedIds = new Set(allowedSpecies.map((species) => species.id));

/**
 * Where a species sits in its evolution line, as two facts on the *child*.
 *
 * Child-side rather than a list of targets on the parent, for three reasons
 * `core/evolution.ts` spells out: eligibility ("may this species exist at
 * level L") reads one field on the entry being drawn; targets are derived by
 * inverting `prevo` in dex order, which gives a branching choice a stable
 * index for the run log for free; and a dropped edge is handled by asymmetry —
 * a child whose parent is outside the pool keeps its `evoLevel` (it is still
 * not a base form and must not be drawn at level 5) but is nobody's target.
 *
 * The level is the dex's own where the dex has one. Every other method gets a
 * synthetic level from `data/evolutionThresholds.ts`, which is the Kaizo
 * convention and is where the numbers are argued. In the gen 9 dex no typed
 * evolution carries an `evoLevel`, so "dex level or synthetic" is a clean
 * split rather than a precedence rule.
 */
const thresholdMemo = new Map<string, number>();

/** The level `species` becomes a legal stage at; 0 for a base form. Memoised, because a chain asks for its parent's. */
function thresholdOf(species: Species): number {
  if (!species.prevo) return 0;
  const cached = thresholdMemo.get(species.id);
  if (cached !== undefined) return cached;
  const parent = dex.species.get(species.prevo);
  const method = (species.evoType ?? 'other') as EvoMethod;
  const level = species.evoLevel ?? syntheticThreshold(species.id, method, bandOf(bstOf(species)), thresholdOf(parent));
  thresholdMemo.set(species.id, level);
  return level;
}

function evolutionOf(species: Species): { prevo: string | null; evoLevel: number | null } {
  if (!species.prevo) return { prevo: null, evoLevel: null };
  const parent = dex.species.get(species.prevo);
  return { prevo: allowedIds.has(parent.id) ? parent.id : null, evoLevel: thresholdOf(species) };
}

const speciesRows: SpeciesRow[] = allowedSpecies
  .map((species) => ({
    id: species.id,
    species: species.name,
    types: [...species.types],
    bst: bstOf(species),
    band: bandOf(bstOf(species)),
    maleChance: maleChanceOf(species),
    ...evolutionOf(species),
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
 * ## Five bands, and the cuts sit in the dex's own gaps
 *
 * This read `[55, 75, 95]` and now reads `[60, 75, 90, 110]`. Two changes at
 * once, and they answer different complaints.
 *
 * **Band 1 was too narrow to draw from.** At 82 moves it held one Psychic move
 * and one Dragon move, which is why `MOVESET.stabWindow` had to exist at all —
 * the forced first slot of those species was not a draw. At 117 it is a real
 * pool: types whose entire band-1 slice is one attack category go from six to
 * three, and types with fewer than three band-1 moves from four to two. That is
 * what makes closing the window affordable, and closing the window is what stops
 * segments 0-2 fielding 36% band 2 against a written 20%.
 *
 * **Band 4 was too coarse to mean anything.** It ran 96 and up, so Stone Edge,
 * Gigaton Hammer and Population Bomb were the same label. The split at 110 puts
 * the recoil, stat-drop and signature moves — Close Combat, Flare Blitz, Draco
 * Meteor, Overheat, Boomburst, Head Smash — in a band of their own, which is
 * what the last two segments are for.
 *
 * **No move has effective power in 91-94 or in 111-119.** The new cuts land in
 * empty ranges the dex already has, so not one move is reclassified by an
 * arbitrary edge. That is the whole argument for these four numbers rather than
 * four neighbouring ones, and it is checkable: change a cut, re-run, and the
 * census in the report moves.
 *
 * The old first cut was **55 and not the spec's 50**, a ratified exception from
 * Stage 2 on a measurement that segments 1-2 need opponents under 55 BP to
 * produce a fight lasting more than a turn. That exception is retired rather
 * than raised: the 60 here is not a relaxation of it but a consequence of the
 * measurement above, and the fight-length question it answered now belongs to
 * the level curve, which moved in the same patch.
 *
 * Census, argument and the learnset validation the per-band shares are fitted
 * to: `docs/reports/early-game-band-and-curve.md`.
 */
const POWER_CUTS = [60, 75, 90, 110] as const;

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

/**
 * Moves whose **user** must be a particular species or forme.
 *
 * Aura Wheel is Morpeko's and Hyperspace Fury is Hoopa-Unbound's. Handed to
 * anything else, `@pkmn/sim` does not weaken the move or re-target it — it
 * refuses to run it at all, prints the hint naming the form that may, and the
 * turn is spent. A wild Kilowattrel shipped with Aura Wheel therefore had three
 * move slots, not four, for the whole fight, on every turn, against every
 * opponent.
 *
 * This is not a learnset rule creeping in. Nothing here asks whether a species
 * *may* learn a move — Swablu keeps Slash and Kilowattrel keeps Brick Break,
 * because that is the randomizer and not a bug. It is the same mechanical test
 * as every other set in this file: the engine cannot play these, so the balance
 * sweep cannot measure them.
 *
 * **A move gated on the user's *type* is not one of these, and that is a ruling
 * rather than an oversight.** `-22` cut Double Shock beside these two, on the
 * argument that a non-Electric holder's copy fails on every turn of every
 * fight. The author's ruling at `-23` is that a type gate leaves a valid battle
 * move that is merely unusual: one holder in eighteen can use it, and a STAB
 * slot makes that likelier than the draw suggests. So Double Shock is back in
 * the pool and Burn Up would be too if gen 9 did not already call it
 * `Unobtainable`. `docs/generation.md` section 52 is the account.
 *
 * Dark Void is named although it reaches nothing: it is a status move, and the
 * status pool is hand-picked below rather than filtered. The set is a statement
 * about the class, and one that leaned on another rule holding would be wrong
 * the day that rule moved.
 *
 * `auditUserLocked` below is what keeps the list honest against a `@pkmn/sim`
 * upgrade, in both directions.
 */
const USER_LOCKED = new Set(['aurawheel', 'hyperspacefury', 'darkvoid']);

/**
 * The tell a species-locked move leaves in the dex, read off the engine rather
 * than remembered.
 *
 * All three refuse in the same shape: a `-fail` in `onTry` or `onTryMove`,
 * guarded by a test on the *source* Pokemon's species or forme. A conditional
 * move reads differently — Counter wants to have been hit, Belch wants a berry
 * eaten — and is gated by battle state the user can reach, not by what the user
 * is.
 *
 * A type gate (`pokemon.hasType('Electric')`) is deliberately not this tell any
 * more; see the ruling above.
 *
 * Deliberately not the thing that decides the pool: `USER_LOCKED` decides, so
 * regenerating is a function of a list a reader can see, not of a regex over
 * compiled upstream source. This is the audit that makes the list loud when it
 * goes stale.
 */
function userLocked(move: Move): boolean {
  const handlers = [move.onTry, move.onTryMove].filter(Boolean).map(String).join('\n');
  if (!handlers.includes("'-fail'")) return false;
  return /\b(?:source|pokemon|attacker)\.species\.(?:name|baseSpecies)\b/.test(handlers);
}

/**
 * Fails the generation if the dex and `USER_LOCKED` have drifted apart.
 *
 * Both directions matter and they fail for different reasons. A move the dex
 * locks and the list does not is the defect this set exists for, arriving in a
 * new generation. A move the list names and the dex no longer locks is worse in
 * a quieter way: it means the tell above stopped matching — upstream rewrote
 * the handler, or compiled it differently — and a silent detector would let the
 * next Aura Wheel through while the list still looked maintained.
 */
function auditUserLocked(): void {
  const found = new Set(dex.moves.all().filter(userLocked).map((move) => String(move.id)));
  const missing = [...found].filter((id) => !USER_LOCKED.has(id));
  const stale = [...USER_LOCKED].filter((id) => !found.has(id));
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `USER_LOCKED is out of date with the gen ${GEN} dex. ` +
      `Locked by the dex and not by the list: ${missing.join(', ') || 'none'}. ` +
      `Named by the list and no longer locked by the dex: ${stale.join(', ') || 'none'}. ` +
      'Read the handler in @pkmn/sim before editing either — a move that stopped ' +
      'failing is a real change, and a tell that stopped matching is not.',
    );
  }
}

auditUserLocked();

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
    !SELF_HALVING.has(id) && !UNSCOREABLE.has(id) && !USER_LOCKED.has(id);
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
/**
 * Abilities that do nothing at all on a Pokemon this game can draw.
 *
 * The same test as the move sets above, one layer along: not "is it weak" but
 * "can the engine run it here". An ability the randomizer rolls onto a Magikarp
 * is the loudest thing about a run, and that stays — Wonder Guard on a Rhydon
 * is the feature. What goes is the ability that is a **blank slot**: it prints
 * nothing, modifies nothing, and cannot be told apart from having no ability at
 * all, which is the one roll `No Ability` was excluded for being.
 *
 * Three groups, three different reasons, kept apart because they go stale
 * differently.
 *
 * **1. The holder has to be one species.** Every handler is gated on the
 * holder's base species, so on anything else the ability is inert. Commander is
 * in here for two reasons at once — Tatsugiri or Dondozo, *and* doubles — and
 * is listed once.
 *
 * **2. No in-battle effect whatever.** Multitype and RKS System are the Arceus
 * and Silvally case: they carry no event handlers, because the type change is
 * the species and the plate or memory together, and neither species is
 * drawable. Ball Fetch, Honey Gather and Run Away carry none either, for the
 * different reason that what they do happens outside a battle — and GYMRUN's
 * wild encounters are fought, never fled.
 *
 * **Being handlerless is not by itself a reason, and the file that proves it is
 * `data/abilityEffects.ts`:** Levitate has no handler either, and its Ground
 * immunity is a hardcoded branch in `Pokemon#isGrounded`. Battle Armor, Shell
 * Armor, Corrosion, Dancer, Early Bird, Stall and Tera Shell are the same shape.
 * So this group is named, never derived, and `auditInertAbilities` fails if the
 * handlerless set changes at all.
 *
 * **3. It only ever acts on an ally.** GYMRUN is `gen9customgame`, a singles
 * format with one Pokemon a side, so no ally is ever on the field. In
 * `@pkmn/sim` an `onAlly*` event fires for the holder too, which is why Steely
 * Spirit, Aroma Veil, Sweet Veil, Flower Veil and Victory Star are **not** here
 * — they act on themselves and are left alone. The ones below opt out of that,
 * either with an explicit `!== this.effectState.target`, or by iterating
 * `allies()` and `adjacentAllies()`, which exclude the holder.
 */
const SPECIES_LOCKED_ABILITIES = [
  'battlebond', 'commander', 'disguise', 'flowergift', 'forecast', 'gulpmissile',
  'hungerswitch', 'iceface', 'powerconstruct', 'schooling', 'shieldsdown',
  'stancechange', 'terashift', 'zenmode', 'zerotohero',
];

const NO_BATTLE_EFFECT_ABILITIES = [
  // The plate and the memory: the type change is species plus item, and the
  // two species that have it are not drawable.
  'multitype', 'rkssystem',
  // Out-of-battle abilities. The sim implements no part of them.
  'ballfetch', 'honeygather', 'runaway',
];

const ALLY_ONLY_ABILITIES = [
  // Explicitly not the holder: `attacker !== this.effectState.target`, or the
  // same test spelled on the target.
  'battery', 'powerspot', 'friendguard', 'telepathy',
  // Iterate `allies()` or `adjacentAllies()`, both of which exclude the holder.
  'healer', 'costar', 'curiousmedicine', 'hospitality', 'plus', 'minus',
  // Wait for an ally to faint, or for one to use an item.
  'receiver', 'powerofalchemy', 'symbiosis',
];

const INERT_ABILITIES = new Set([
  ...SPECIES_LOCKED_ABILITIES,
  ...NO_BATTLE_EFFECT_ABILITIES,
  ...ALLY_ONLY_ABILITIES,
]);

/**
 * Abilities a tell below flags that **do their whole job anyway**.
 *
 * Named rather than quietly excluded from the tells, because each is a claim
 * that could be wrong and a reader deserves to see which ones were checked
 * rather than assumed. Every one was read out of the gen 9 dex.
 *
 * The ally tell over-reaches for one structural reason: in `@pkmn/sim` an
 * `onAlly*` event fires for the holder too, and `isAlly` is true of a Pokemon
 * and itself. So an ability that *mentions* an ally is usually one that acts on
 * the holder as well, and the ones that genuinely need a partner are the ones
 * that opt the holder out.
 */
const FIRES_WITHOUT_AN_ALLY = new Set([
  'steelyspirit',   // onAllyBasePower with no self-exclusion: boosts its own Steel moves.
  'aromaveil',      // blocks Taunt, Encore and Disable on itself.
  'sweetveil',      // blocks sleep and Yawn on itself.
  'flowerveil',     // a Grass holder keeps its own stats and status.
  'victorystar',    // `source.isAlly(holder)` is true of the holder itself.
  'armortail',      // onFoeTryMove: blocks the opponent's priority move.
  'dazzling',       // the same, under a different name.
  'queenlymajesty', // and again.
  'competitive',    // the ally test is an *exclusion*: it fires on a foe's drop.
  'defiant',        // the same.
  'mummy',          // onDamagingHit against whoever touched it.
  'lingeringaroma', // the same.
  'toxicdebris',    // sets hazards when hit; the ally test only picks the side.
]);

/**
 * Abilities the species tell flags that are **not** species-locked.
 *
 * Drizzle and Drought name a species to *defer* to the primal orbs rather than
 * to gate themselves; on anything else they set the weather as always. Klutz
 * and Neutralizing Gas have one delegating handler apiece, which the tell
 * cannot tell apart from a gate — Klutz's effect is a flag the item code reads,
 * and Neutralizing Gas sweeps `getAllActive()`.
 */
const SPECIES_NAMED_ANYWAY = new Set(['drizzle', 'drought', 'klutz', 'neutralizinggas']);

/** Every event handler the dex hangs on an ability, with its hook name. */
function abilityHandlers(ability: Ability): [string, string][] {
  return Object.entries(ability)
    .filter(([key, value]) => key.startsWith('on') && typeof value === 'function')
    .map(([key, value]) => [key, String(value)] as [string, string]);
}

/**
 * Every handler is gated on the holder's species, or delegates to one that is.
 *
 * The delegation clause is load-bearing: Forecast's `onStart` is one call to
 * `singleEvent('WeatherChange')` and carries no gate of its own, while the
 * handler it forwards to bails on anything that is not a Castform.
 */
function speciesLockedAbility(ability: Ability): boolean {
  const handlers = abilityHandlers(ability);
  if (handlers.length === 0) return false;
  return handlers.every(([, body]) =>
    /\bspecies\.(?:name|id|baseSpecies)\b|\bbaseSpecies\.baseSpecies\b/.test(body) ||
    /singleEvent\(|this\.effect\.on/.test(body));
}

/** Every handler is about an ally: the hook says so, or the body names one. */
function allyShapedAbility(ability: Ability): boolean {
  const handlers = abilityHandlers(ability);
  if (handlers.length === 0) return false;
  return handlers.every(([key, body]) =>
    key.startsWith('onAlly') || /\bisAlly\(|\b(?:allies|adjacentAllies)\(\)/.test(body));
}

/**
 * Fails the generation when the dex and the lists above disagree.
 *
 * Every direction is a different failure and each one is worth the throw:
 *
 *   - A species-locked ability the lists miss is the next Stance Change on a
 *     Pidgey, arriving with a new generation.
 *   - A named one the tell no longer finds means upstream rewrote the handler.
 *     The ability may now do something, or the detector may have gone blind,
 *     and those two want a human to tell them apart.
 *   - A handlerless ability that is neither named inert nor named hardcoded is
 *     the Levitate trap: it looks empty and is not.
 *   - An ally-shaped ability that is in no list is one nobody has decided about.
 *
 * Nothing here decides the pool. `INERT_ABILITIES` decides, so regenerating is
 * a function of three lists a reader can see rather than of a regex over
 * compiled upstream source.
 */
const ENGINE_HARDCODED = new Set([
  // Handlerless in the data and implemented inside the engine: `Pokemon#isGrounded`
  // for Levitate, the crit and status branches for the rest. This set is the
  // reason group 2 is named rather than derived.
  'levitate', 'battlearmor', 'shellarmor', 'corrosion', 'dancer', 'earlybird',
  'stall', 'terashell',
]);

function auditInertAbilities(abilities: readonly Ability[]): void {
  const problems: string[] = [];
  const ids = abilities.map((ability) => String(ability.id));

  const lockedByDex = abilities.filter(speciesLockedAbility).map((ability) => String(ability.id));
  const missedLocks = lockedByDex.filter((id) => !INERT_ABILITIES.has(id) && !SPECIES_NAMED_ANYWAY.has(id));
  const staleLocks = SPECIES_LOCKED_ABILITIES.filter((id) => !lockedByDex.includes(id));
  if (missedLocks.length > 0) problems.push(`species-locked in the dex, in no list: ${missedLocks.join(', ')}`);
  if (staleLocks.length > 0) problems.push(`listed as species-locked, no longer reads that way: ${staleLocks.join(', ')}`);

  const handlerless = abilities.filter((ability) => abilityHandlers(ability).length === 0).map((a) => String(a.id));
  const unclassified = handlerless.filter((id) => !INERT_ABILITIES.has(id) && !ENGINE_HARDCODED.has(id));
  const grewHandlers = [...ENGINE_HARDCODED, ...NO_BATTLE_EFFECT_ABILITIES]
    .filter((id) => ids.includes(id) && !handlerless.includes(id));
  if (unclassified.length > 0) problems.push(`handlerless and unclassified: ${unclassified.join(', ')}`);
  if (grewHandlers.length > 0) problems.push(`listed as handlerless, now carries handlers: ${grewHandlers.join(', ')}`);

  const allyShaped = abilities.filter(allyShapedAbility).map((ability) => String(ability.id));
  const undecided = allyShaped.filter((id) => !INERT_ABILITIES.has(id) && !FIRES_WITHOUT_AN_ALLY.has(id));
  const staleAlly = ALLY_ONLY_ABILITIES.filter((id) => !allyShaped.includes(id));
  if (undecided.length > 0) problems.push(`ally-shaped and undecided: ${undecided.join(', ')}`);
  if (staleAlly.length > 0) problems.push(`listed as ally-only, no longer reads that way: ${staleAlly.join(', ')}`);

  const unknown = [...INERT_ABILITIES].filter((id) => !ids.includes(id));
  if (unknown.length > 0) problems.push(`cut by name but not a standard gen ${GEN} ability: ${unknown.join(', ')}`);

  if (problems.length > 0) {
    throw new Error(
      `The inert-ability lists are out of date with the gen ${GEN} dex.\n  ` +
      problems.join('\n  ') +
      '\nRead the handler in @pkmn/sim before editing a list. An ability that ' +
      'started doing something is a real change; a tell that stopped matching is not.',
    );
  }
}

const standardAbilities: Ability[] = dex.abilities
  .all()
  .filter((ability) => ability.exists && ability.isNonstandard === null && ability.id !== 'noability');

auditInertAbilities(standardAbilities);

const abilityRows: string[] = standardAbilities
  .filter((ability) => !INERT_ABILITIES.has(String(ability.id)))
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
    .map((row) => `  { id: '${row.id}', species: ${quote(row.species)}, types: [${row.types.map(quote).join(', ')}], bst: ${row.bst}, band: ${row.band}, maleChance: ${row.maleChance}, prevo: ${row.prevo === null ? 'null' : `'${row.prevo}'`}, evoLevel: ${row.evoLevel} },`)
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
  /**
   * The pool id this species evolves **from**, or \`null\` for a base form.
   *
   * Also \`null\` when the dex parent is outside the pool (a tagged legendary,
   * a forme): the edge is dropped, and this species is then nobody's target.
   * \`data/evolution.ts\` inverts this field to find what a species becomes.
   */
  prevo: string | null;
  /**
   * The level at which this species is a legal stage: the dex's own
   * \`evoLevel\` for a level-up evolution, else the synthetic threshold from
   * \`data/evolutionThresholds.ts\`. \`null\` iff the dex gives it no prevo at
   * all. The randomizer will not draw a species below this level, and a party
   * member evolves into it the first time its level reaches it.
   */
  evoLevel: number | null;
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
{
  // The evolution report. Read it: these are the facts `data/evolutionThresholds.ts`
  // and `test/evolution-data.test.ts` argue over, printed where they change.
  const byId = new Map(speciesRows.map((row) => [row.id, row]));
  const past = allowedSpecies.filter((species) => species.isNonstandard === 'Past').length;
  console.log(`  of which \`Past\` (not in Scarlet/Violet): ${past}`);
  const baseForms = speciesRows.filter((row) => row.evoLevel === null);
  console.log(`base forms: ${baseForms.length}`);
  for (const band of [...new Set(speciesRows.map((row) => row.band))].sort()) {
    console.log(`  band ${band}: ${String(baseForms.filter((row) => row.band === band).length).padStart(3)} base forms`);
  }
  const synthetic = new Map<string, number>();
  for (const species of allowedSpecies) {
    if (species.prevo && !species.evoLevel) {
      const method = species.evoType ?? 'other';
      synthetic.set(method, (synthetic.get(method) ?? 0) + 1);
    }
  }
  console.log(`synthetic thresholds: ${[...synthetic].map(([method, n]) => `${method} ${n}`).join(', ')}`);
  for (const method of Object.keys(SYNTHETIC_BY_METHOD)) {
    if (!synthetic.has(method)) console.log(`  (no ${method} evolution in the pool)`);
  }
  const dropped = allowedSpecies.filter((species) => species.prevo && !allowedIds.has(dex.species.get(species.prevo).id));
  console.log(`dropped edges (parent outside the pool): ${dropped.map((species) => `${species.prevo} -> ${species.name}`).join(', ') || 'none'}`);
  const families = new Map<string, SpeciesRow[]>();
  for (const row of speciesRows) if (row.prevo) families.set(row.prevo, [...(families.get(row.prevo) ?? []), row]);
  const branching = [...families].filter(([, children]) => children.length > 1);
  console.log(`branching families: ${branching.length}`);
  for (const [parent, children] of branching) {
    const levels = new Set(children.map((child) => child.evoLevel));
    console.log(`  ${byId.get(parent)?.species ?? parent} -> ${children.map((child) => `${child.species} ${child.evoLevel}`).join(', ')}${levels.size > 1 ? '   <-- UNEQUAL' : ''}`);
  }
  const late = speciesRows.filter((row) => (row.evoLevel ?? 0) > 50).map((row) => `${row.species} ${row.evoLevel}`);
  console.log(`thresholds above 50: ${late.join(', ') || 'none'}`);
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
