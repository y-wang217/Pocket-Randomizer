/**
 * Import the Gen 1 to 4 trainer rosters from the pret decompilations into
 * `src/data/encounters/`.
 *
 *   npm run gen:encounters                  parse the fetched sources and emit the tables
 *   npm run gen:encounters -- --fetch       fetch the pinned sources first
 *   npm run gen:encounters -- --report      print the counts and stop; emit nothing
 *   npm run gen:encounters -- --refresh-sprites   re-scrape the CDN's trainer sprite list
 *
 * The report is what `docs/research/encounter-sources.md` quotes.
 */
import { BLACKLISTED_SPECIES } from '../../src/data/blacklists';
import { DAMAGING_MOVES, STATUS_MOVES } from '../../src/data/movePools';
import { SPECIES_POOL } from '../../src/data/speciesPools';
import type { EncounterRecord, EncounterSource, GameId } from '../../src/data/encounters/types';
import { emitGame, toRecords } from './emit';
import { fetchAll, fetchPokemondb, fetchSerebii, loadPokemondb, loadSerebii, loadSources } from './fetch';
import type { RawEncounter } from './model';
import { GAME_LABEL } from './model';
import { unresolvedItems } from './names';
import { parseGen1 } from './parse-gen1';
import { parseGen2 } from './parse-gen2';
import { parseGen3 } from './parse-gen3';
import { parseHgss, parsePlatinum } from './parse-gen4';
import { parsePokemondb, unplacedNames } from './parse-pokemondb';
import { parseSerebiiCup } from './parse-serebii-cup';
import { parseSerebiiRivals } from './parse-serebii-rivals';
import { refreshSpriteList } from './sprites';

const POKEMONDB_GAMES: GameId[] = ['bw', 'b2w2', 'xy', 'oras', 'sm', 'usum', 'lgpe', 'swsh', 'bdsp', 'sv'];

const IMPORTS: { game: GameId; repo: string; parse: () => RawEncounter[] }[] = [
  { game: 'rby', repo: 'pokered', parse: () => parseGen1('pokered', 'rby') },
  { game: 'yellow', repo: 'pokeyellow', parse: () => parseGen1('pokeyellow', 'yellow') },
  { game: 'gs', repo: 'pokegold', parse: () => parseGen2('pokegold', 'gs') },
  { game: 'crystal', repo: 'pokecrystal', parse: () => parseGen2('pokecrystal', 'crystal') },
  { game: 'rs', repo: 'pokeruby', parse: () => parseGen3('pokeruby', 'rs') },
  { game: 'emerald', repo: 'pokeemerald', parse: () => parseGen3('pokeemerald', 'emerald') },
  { game: 'frlg', repo: 'pokefirered', parse: () => parseGen3('pokefirered', 'frlg') },
  { game: 'platinum', repo: 'pokeplatinum', parse: parsePlatinum },
  { game: 'hgss', repo: 'pokeheartgold', parse: parseHgss },
  // pokemondb's roster pages carry no Champion Cup and no rival; Serebii's pages supply both, appended under the same game.
  ...POKEMONDB_GAMES.map((game) => ({ game, repo: 'pokemondb', parse: () => [...parsePokemondb(game), ...(game === 'swsh' ? parseSerebiiCup() : []), ...parseSerebiiRivals(game)] })),
];

const poolSpecies = new Set(SPECIES_POOL.map((s) => s.id).filter((id) => !BLACKLISTED_SPECIES.includes(id)));
const poolMoves = new Set([...DAMAGING_MOVES, ...STATUS_MOVES].map((m) => m.id));

interface Stats {
  game: GameId;
  records: number;
  byRole: Record<string, number>;
  withMoves: number;
  withItems: number;
  members: number;
  membersInPool: number;
  moves: number;
  movesInPool: number;
  aceInPool: number;
  withSprite: number;
  levelMin: number;
  levelMax: number;
}

function stats(game: GameId, records: EncounterRecord[]): Stats {
  const s: Stats = {
    game,
    records: records.length,
    byRole: {},
    withMoves: 0,
    withItems: 0,
    members: 0,
    membersInPool: 0,
    moves: 0,
    movesInPool: 0,
    aceInPool: 0,
    withSprite: 0,
    levelMin: Infinity,
    levelMax: -Infinity,
  };
  for (const r of records) {
    s.byRole[r.role] = (s.byRole[r.role] ?? 0) + 1;
    if (r.party.some((m) => m.moves)) s.withMoves += 1;
    if (r.party.some((m) => m.item)) s.withItems += 1;
    if (r.trainer.sprite) s.withSprite += 1;
    const ace = r.party[r.party.length - 1];
    if (ace && poolSpecies.has(ace.species)) s.aceInPool += 1;
    for (const m of r.party) {
      s.members += 1;
      if (poolSpecies.has(m.species)) s.membersInPool += 1;
      s.levelMin = Math.min(s.levelMin, m.level);
      s.levelMax = Math.max(s.levelMax, m.level);
      for (const move of m.moves ?? []) {
        s.moves += 1;
        if (poolMoves.has(move)) s.movesInPool += 1;
      }
    }
  }
  return s;
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`;
}

function printReport(all: Stats[], records: EncounterRecord[]): void {
  console.log('| game | encounters | gym | elite | champion | rival | boss | route | with moves | with items | levels |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of all) {
    const r = s.byRole;
    console.log(
      `| ${GAME_LABEL[s.game]} | ${s.records} | ${r.gym ?? 0} | ${r.elite ?? 0} | ${r.champion ?? 0} | ${r.rival ?? 0} | ${r.boss ?? 0} | ${r.route ?? 0} | ${s.withMoves} | ${s.withItems} | ${s.levelMin}-${s.levelMax} |`,
    );
  }
  const total = all.reduce((n, s) => n + s.records, 0);
  console.log(`| **total** | **${total}** | | | | | | | | | |`);
  console.log('');
  console.log('| game | members in species pool | aces in species pool | set moves in move pool | sprite resolved |');
  console.log('|---|---|---|---|---|');
  for (const s of all) {
    console.log(
      `| ${GAME_LABEL[s.game]} | ${s.membersInPool}/${s.members} (${pct(s.membersInPool, s.members)}) | ${s.aceInPool}/${s.records} (${pct(s.aceInPool, s.records)}) | ${s.movesInPool}/${s.moves} (${pct(s.movesInPool, s.moves)}) | ${s.withSprite}/${s.records} (${pct(s.withSprite, s.records)}) |`,
    );
  }
  console.log('');
  const missingSprites = new Map<string, number>();
  for (const r of records) {
    if (!r.trainer.sprite) {
      const key = r.role === 'route' ? `${r.game}:${r.trainer.class}` : `${r.game}:${r.trainer.name}`;
      missingSprites.set(key, (missingSprites.get(key) ?? 0) + 1);
    }
  }
  console.log(`Unresolved sprites (${missingSprites.size} distinct): ${[...missingSprites.entries()].map(([k, n]) => `${k} (${n})`).join(', ')}`);
  console.log('');
  const outOfPool = new Map<string, number>();
  for (const r of records) for (const m of r.party) if (!poolSpecies.has(m.species)) outOfPool.set(m.species, (outOfPool.get(m.species) ?? 0) + 1);
  console.log(`Species outside the pool (${outOfPool.size} distinct): ${[...outOfPool.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(', ')}`);
  console.log('');
  const movesOut = new Map<string, number>();
  for (const r of records) for (const m of r.party) for (const mv of m.moves ?? []) if (!poolMoves.has(mv)) movesOut.set(mv, (movesOut.get(mv) ?? 0) + 1);
  console.log(`Set moves outside the pool (${movesOut.size} distinct): ${[...movesOut.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(', ')}`);
  console.log('');
  console.log(`Other-trainers names with no role (${unplacedNames.size}): ${[...unplacedNames.entries()].map(([k, v]) => `${k} [${v}]`).join(', ') || 'none'}`);
  console.log('');
  console.log(`Items with no modern counterpart, dropped: ${[...unresolvedItems.entries()].map(([k, n]) => `${k} (${n})`).join(', ') || 'none'}`);
  console.log('');
  const gymTypes = new Map<string, Set<string>>();
  for (const r of records) if (r.role === 'gym' && r.gymType) {
    if (!gymTypes.has(r.gymType)) gymTypes.set(r.gymType, new Set());
    gymTypes.get(r.gymType)!.add(`${r.trainer.name} (${r.game})`);
  }
  console.log('Named trainers and their sprites, by game:');
  for (const entry of IMPORTS) {
    const seen = new Map<string, string>();
    for (const r of records) if (r.game === entry.game && r.role !== 'route') seen.set(r.trainer.name, r.trainer.sprite ?? '(none)');
    console.log(`- ${GAME_LABEL[entry.game]}: ${[...seen.entries()].map(([n, s]) => `${n} → ${s}`).join(', ')}`);
  }
  console.log('');
  console.log('Gym leaders by type:');
  for (const [type, leaders] of [...gymTypes.entries()].sort()) console.log(`- ${type}: ${[...leaders].join(', ')}`);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has('--refresh-sprites')) await refreshSpriteList();
  if (args.has('--fetch')) {
    fetchAll();
    await fetchPokemondb();
    await fetchSerebii();
  }
  const sources = loadSources();
  const pokemondb = loadPokemondb();
  const serebii = loadSerebii();
  const all: Stats[] = [];
  const everything: EncounterRecord[] = [];
  for (const entry of IMPORTS) {
    let source: EncounterSource;
    if (entry.repo === 'pokemondb') {
      const page = pokemondb.pages[entry.game];
      if (!page) throw new Error(`${entry.game} has no pokemondb page in sources.json`);
      const extra = serebii.pages[entry.game] ?? [];
      source = extra.length > 0
        ? { repo: 'pokemondb.net, serebii.net', sha: pokemondb.fetchedAt, files: [page, ...extra] }
        : { repo: 'pokemondb.net', sha: pokemondb.fetchedAt, files: [page] };
    } else {
      const pin = sources[entry.repo];
      if (!pin) throw new Error(`${entry.repo} is not pinned in sources.json`);
      source = { repo: `pret/${entry.repo}`, sha: pin.sha, files: pin.paths };
    }
    const records = toRecords(entry.parse());
    all.push(stats(entry.game, records));
    everything.push(...records);
    if (!args.has('--report')) emitGame(entry.game, records, source);
  }
  const ids = new Set<string>();
  for (const r of everything) {
    if (ids.has(r.id)) throw new Error(`Duplicate id ${r.id}`);
    ids.add(r.id);
  }
  printReport(all, everything);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
