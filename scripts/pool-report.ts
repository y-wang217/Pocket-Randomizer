/**
 * The move pool instrument: what is drawable, by whom, and how thin the draw is.
 *
 * **Written for the 2026-09-17 validation report and kept, for the reason
 * `docs/generation.md` section 28 gives about the iOS instrument: a number
 * quoted in a document and produced by a script nobody can run again is a
 * number that cannot be checked.** Every figure in
 * `docs/reports/moveset-pool-validation.md` comes out of this file, so the
 * report is re-derivable rather than remembered.
 *
 * Read-only. It draws no run, writes no file and imports nothing from `ui/`.
 * The one place it consumes randomness it does so through `core/rng.ts` and a
 * fixed seed prefix, like every other measurement in this project — see
 * `docs/balance.md` section 0 on why a prefix is part of a stamp.
 *
 *   npm run pool-report
 *   npm run pool-report -- --seeds 4000
 */
import { generateStarters } from '../src/core/randomizer';
import { createRng } from '../src/core/rng';
import { STARTERS_KEY } from '../src/core/streamKeys';
import { isMoveBlacklisted } from '../src/data/blacklists';
import { bandOf, impactOf } from '../src/data/moveOverrides';
import { DAMAGING_MOVES, STATUS_MOVES, type MoveEntry } from '../src/data/movePools';
import { MOVESET, SEGMENTS } from '../src/data/scaling';
import { getStarterPool, STARTER_MOVE_BANDS } from '../src/data/starters';

/** The eighteen, in the order the type chart lists them. */
const TYPES: readonly string[] = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

/**
 * What the randomizer may actually draw, blacklist applied.
 *
 * Both lists are filtered the same way `core/randomizer.ts` filters them, and
 * for the same reason: a report that counted banned moves would be describing
 * a pool nobody plays against.
 */
const DAMAGING = DAMAGING_MOVES.filter((move) => !isMoveBlacklisted(move.id));
const STATUS = STATUS_MOVES.filter((move) => !isMoveBlacklisted(move.id));
const BY_NAME = new Map<string, MoveEntry>([...DAMAGING, ...STATUS].map((move) => [move.name, move]));

const seedArg = process.argv.indexOf('--seeds');
const SEEDS = seedArg === -1 ? 2000 : Number(process.argv[seedArg + 1] ?? 2000);
/** The prefix the figures are stamped with. Changing it changes the population. */
const PREFIX = 'POOL';

const pct = (part: number, whole: number): string => `${((100 * part) / whole).toFixed(1)}%`;

function heading(title: string): void {
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);
}

// ---------------------------------------------------------------------------
// 1. What the pool holds
// ---------------------------------------------------------------------------

heading('1. Pool composition');

console.log(`damaging ${DAMAGING.length}   status ${STATUS.length}   (blacklist applied)`);

const byBand = new Map<number, number>();
for (const move of DAMAGING) {
  const band = bandOf(move) ?? 0;
  byBand.set(band, (byBand.get(band) ?? 0) + 1);
}
console.log('\ndamaging by band:', [...byBand].sort((a, b) => a[0] - b[0]).map(([b, n]) => `${b}:${n}`).join('  '));

const byImpact = new Map<string, number>();
for (const move of STATUS) {
  const impact = impactOf(move) ?? 'none';
  byImpact.set(impact, (byImpact.get(impact) ?? 0) + 1);
}
console.log('status by impact: ', [...byImpact].sort().map(([i, n]) => `${i}:${n}`).join('  '));

const statusTypes = new Map<string, number>();
for (const move of STATUS) statusTypes.set(move.type, (statusTypes.get(move.type) ?? 0) + 1);
const noStatus = TYPES.filter((type) => !statusTypes.has(type));
console.log('status types with none:', noStatus.length ? noStatus.join(', ') : '(none)');

// ---------------------------------------------------------------------------
// 2. The per-band, per-type slices — the table the early game rests on
// ---------------------------------------------------------------------------

heading('2. Damaging moves by band and type, with the attack-category split');

const BANDS = [...byBand.keys()].sort((a, b) => a - b);
const slice = (band: number, type: string): MoveEntry[] =>
  DAMAGING.filter((move) => bandOf(move) === band && move.type === type);

console.log(['type'.padEnd(9), ...BANDS.map((b) => `b${b}`.padStart(4))].join(' '), '   band-1 split');
for (const type of TYPES) {
  const counts = BANDS.map((band) => String(slice(band, type).length).padStart(4));
  const one = slice(1, type);
  const phys = one.filter((move) => move.category === 'Physical').length;
  const spec = one.filter((move) => move.category === 'Special').length;
  const flag = one.length > 0 && (phys === 0 || spec === 0) ? '  <- one category only' : '';
  console.log(type.padEnd(9), counts.join(' '), `   ${phys}P/${spec}S${flag}`);
}

console.log('\nSegments and the move bands they draw from:');
for (const row of SEGMENTS) {
  console.log(`  segment ${row.segment}  moveBandWeights ${JSON.stringify(row.moveBandWeights)}`);
}

// ---------------------------------------------------------------------------
// 3. The forced STAB slot, per starter, per candidate window
// ---------------------------------------------------------------------------

heading('3. The forced STAB slot: how many moves the first slot may draw');

const STARTERS = getStarterPool();
/** The windows compared in the report. The first is what ships today. */
const WINDOWS: readonly (readonly number[])[] = [[1], [1, 2], [1, 2, 3]];

console.log(`starter pool: ${STARTERS.length} species; STARTER_MOVE_BANDS ${JSON.stringify(STARTER_MOVE_BANDS)}`);
console.log(`MOVESET ${JSON.stringify(MOVESET)}\n`);

for (const window of WINDOWS) {
  let total = 0;
  let deterministic = 0;
  let thin = 0;
  let bothCategories = 0;
  for (const entry of STARTERS) {
    const pool = DAMAGING.filter(
      (move) => window.includes(bandOf(move) ?? 0) && entry.types.includes(move.type),
    );
    total += pool.length;
    if (pool.length <= 1) deterministic += 1;
    if (pool.length <= 3) thin += 1;
    if (pool.some((m) => m.category === 'Physical') && pool.some((m) => m.category === 'Special')) {
      bothCategories += 1;
    }
  }
  const n = STARTERS.length;
  console.log(
    `window ${`[${window.join(',')}]`.padEnd(9)}`,
    `mean ${(total / n).toFixed(1).padStart(5)} options`,
    `| deterministic ${String(deterministic).padStart(3)} (${pct(deterministic, n)})`,
    `| <=3 options ${String(thin).padStart(3)} (${pct(thin, n)})`,
    `| both categories ${pct(bothCategories, n)}`,
  );
}

console.log('\nThe species with exactly one legal first move today:');
for (const entry of STARTERS) {
  const pool = DAMAGING.filter((move) => bandOf(move) === 1 && entry.types.includes(move.type));
  if (pool.length > 1) continue;
  const only = pool[0];
  console.log(
    ' ',
    entry.species.padEnd(12),
    entry.types.join('/').padEnd(16),
    only ? `${only.name} (${only.category} ${only.basePower})` : '(nothing in band)',
  );
}

// ---------------------------------------------------------------------------
// 4. What a real starter roll produces
// ---------------------------------------------------------------------------

heading(`4. Real starter rolls, ${SEEDS} seeds on prefix ${PREFIX}`);

let rolls = 0;
let typeTotal = 0;
let oneType = 0;
let carriesNormal = 0;
let damagingTotal = 0;
let carriesStatus = 0;

for (let i = 0; i < SEEDS; i++) {
  const rng = createRng(`${PREFIX}${i}`);
  for (const spec of generateStarters(3, 7, rng.randomizer.at(STARTERS_KEY))) {
    const moves = spec.moves.map((name) => BY_NAME.get(name)).filter((m): m is MoveEntry => !!m);
    const attacks = moves.filter((move) => move.category !== 'Status');
    const types = new Set(attacks.map((move) => move.type));
    rolls += 1;
    typeTotal += types.size;
    if (types.size <= 1) oneType += 1;
    if (attacks.some((move) => move.type === 'Normal')) carriesNormal += 1;
    if (moves.some((move) => move.category === 'Status')) carriesStatus += 1;
    damagingTotal += attacks.length;
  }
}

console.log(`starter options rolled: ${rolls}`);
console.log(`mean distinct attacking types: ${(typeTotal / rolls).toFixed(2)}`);
console.log(`one attacking type or fewer:   ${pct(oneType, rolls)}`);
console.log(`carries a Normal-type attack:  ${pct(carriesNormal, rolls)}`);
console.log(`carries a status move:         ${pct(carriesStatus, rolls)}`);
console.log(`mean damaging moves:           ${(damagingTotal / rolls).toFixed(2)}`);

/*
 * The Normal share of the band, which is what makes `stabBias` the wrong lever.
 *
 * Every coverage slot that `stabBias` does *not* restrict to STAB draws
 * uniformly from its band, so the chance it comes back Normal is exactly
 * Normal's share of that band. Lowering `stabBias` hands more slots to that
 * draw. This is arithmetic rather than a measurement, and the report says so.
 */
heading('5. Normal share per band — the arithmetic behind the stabBias finding');
for (const band of BANDS) {
  const inBand = DAMAGING.filter((move) => bandOf(move) === band);
  const normal = inBand.filter((move) => move.type === 'Normal').length;
  console.log(`  band ${band}: Normal is ${normal}/${inBand.length} = ${pct(normal, inBand.length)} of the band`);
}
console.log(
  `\n  stabBias is ${MOVESET.stabBias}, so a coverage slot is open ${pct(1 - MOVESET.stabBias, 1)} of the time.`,
);
