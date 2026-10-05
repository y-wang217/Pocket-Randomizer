/**
 * The encounter library, whole. **Stage 6.0.**
 *
 * One table per game under this directory; this file is the sum of them, in
 * id order, so that anything drawing from the library reads one stable
 * sequence whatever order the game files are listed in. The query and fit
 * layer that turns a record into a GYMRUN team arrives with the `core/`
 * wiring and sits beside this; until then the library is a record.
 *
 * Gen 1 to 4 are read from the pret decompilations at a pinned revision,
 * every trainer in the game. Gen 5 to 9 are read from pokemondb's roster
 * pages on a pinned date: the gym leaders, kahunas, captains, Elite Four,
 * champions, rivals and villains, with levels and no set moves; Sword and
 * Shield's Champion Cup from Serebii the same way.
 *
 * The game files carry each party as one string (`types.ts`, `EncounterRow`)
 * and this file decodes them once at load. Nothing below this line sees a
 * row, so the encoding is a bundle-size fact and not a draw fact.
 *
 * Since checkpoint 9 the library is in two halves: the bosses, statically
 * imported here, and the Gen 1 to 4 route trainers, installed by the host
 * through `installRouteTables` (`full.ts`). The accessors throw until the
 * install, so a run can never be generated against half of the library.
 */
import { B2W2_ROWS, B2W2_SOURCE } from './b2w2';
import { BDSP_ROWS, BDSP_SOURCE } from './bdsp';
import { BW_ROWS, BW_SOURCE } from './bw';
import { CRYSTAL_ROWS, CRYSTAL_SOURCE } from './crystal';
import { EMERALD_ROWS, EMERALD_SOURCE } from './emerald';
import { FRLG_ROWS, FRLG_SOURCE } from './frlg';
import { GS_ROWS, GS_SOURCE } from './gs';
import { HGSS_ROWS, HGSS_SOURCE } from './hgss';
import { LGPE_ROWS, LGPE_SOURCE } from './lgpe';
import { ORAS_ROWS, ORAS_SOURCE } from './oras';
import { PLATINUM_ROWS, PLATINUM_SOURCE } from './platinum';
import { RBY_ROWS, RBY_SOURCE } from './rby';
import { RS_ROWS, RS_SOURCE } from './rs';
import { SM_ROWS, SM_SOURCE } from './sm';
import { SV_ROWS, SV_SOURCE } from './sv';
import { SWSH_ROWS, SWSH_SOURCE } from './swsh';
import type { EncounterRecord, EncounterRow, EncounterSource, GameId } from './types';
import { decodeRow } from './types';
import { USUM_ROWS, USUM_SOURCE } from './usum';
import { XY_ROWS, XY_SOURCE } from './xy';
import { YELLOW_ROWS, YELLOW_SOURCE } from './yellow';

export type { EncounterRecord, EncounterRow, EncounterSource, GameId, PartyMember, TrainerRole } from './types';
export { GAME_LABEL, decodeParty, encodeParty } from './types';

export interface EncounterTable {
  source: EncounterSource;
  records: readonly EncounterRecord[];
}

/** One game's rows decoded, once, at load: the only place a row becomes a record. */
function table(source: EncounterSource, rows: readonly EncounterRow[]): EncounterTable {
  return { source, records: rows.map(decodeRow) };
}

/**
 * Every game's bosses, rivals, leaders, Elite Four and villains, keyed by
 * game, with where they came from: the half of the library the main chunk
 * carries. **Checkpoint 9.** The Gen 1 to 4 route trainers (`<game>-routes.ts`,
 * four fifths of the bytes) are not here: the host installs them through
 * `installRouteTables` before any run, and until it does the accessors below
 * throw rather than answer with a half-stocked library.
 */
const BOSS_TABLES: Readonly<Record<GameId, EncounterTable>> = {
  rby: table(RBY_SOURCE, RBY_ROWS),
  yellow: table(YELLOW_SOURCE, YELLOW_ROWS),
  gs: table(GS_SOURCE, GS_ROWS),
  crystal: table(CRYSTAL_SOURCE, CRYSTAL_ROWS),
  rs: table(RS_SOURCE, RS_ROWS),
  emerald: table(EMERALD_SOURCE, EMERALD_ROWS),
  frlg: table(FRLG_SOURCE, FRLG_ROWS),
  platinum: table(PLATINUM_SOURCE, PLATINUM_ROWS),
  hgss: table(HGSS_SOURCE, HGSS_ROWS),
  bw: table(BW_SOURCE, BW_ROWS),
  b2w2: table(B2W2_SOURCE, B2W2_ROWS),
  xy: table(XY_SOURCE, XY_ROWS),
  oras: table(ORAS_SOURCE, ORAS_ROWS),
  sm: table(SM_SOURCE, SM_ROWS),
  usum: table(USUM_SOURCE, USUM_ROWS),
  lgpe: table(LGPE_SOURCE, LGPE_ROWS),
  swsh: table(SWSH_SOURCE, SWSH_ROWS),
  bdsp: table(BDSP_SOURCE, BDSP_ROWS),
  sv: table(SV_SOURCE, SV_ROWS),
};

const byId = (records: readonly EncounterRecord[]): Map<string, EncounterRecord> => new Map(records.map((record) => [record.id, record]));

/** The registry: null until the host installs the route tables. The one mutable seam in `data/`. */
let installed: { tables: Readonly<Record<GameId, EncounterTable>>; all: readonly EncounterRecord[]; byId: Map<string, EncounterRecord> } | null = null;

const NOT_INSTALLED =
  "The encounter library's route tables are not installed. Under Node, import 'src/data/encounters/full' before generating a run; in the app, await the dynamic import of the same module (ui/app.ts does this before its first run). A run generated without them would draw from a half-stocked library, so this throws instead.";

/**
 * Install the route tables. **Checkpoint 9, the bundle seam.** Called by
 * `full.ts` at its load, which the app imports dynamically before its first
 * run and every Node entry imports statically. Idempotent: the same tables
 * again is a no-op; a different set is a data error and throws, because a
 * library that changed under a running app would reinterpret its seed.
 */
export function installRouteTables(routes: Readonly<Partial<Record<GameId, readonly EncounterRow[]>>>): void {
  const tables = Object.fromEntries(
    (Object.keys(BOSS_TABLES) as GameId[]).map((game) => {
      const base = BOSS_TABLES[game];
      const extra = routes[game];
      return [game, extra ? { source: base.source, records: [...base.records, ...extra.map(decodeRow)] } : base];
    }),
  ) as Record<GameId, EncounterTable>;
  // The whole library in id order. The order is the draw order, so it is
  // sorted here and not left to the import list or the install order.
  const all = Object.values(tables)
    .flatMap((entry) => entry.records)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (installed) {
    const same = installed.all.length === all.length && installed.all.every((record, index) => record.id === all[index]!.id);
    if (!same) throw new Error('The encounter library\'s route tables were installed twice with different contents');
    return;
  }
  installed = { tables, all, byId: byId(all) };
}

/** True once the host has installed the route tables. */
export function routeTablesInstalled(): boolean {
  return installed !== null;
}

/** Every game's table, keyed by game, with where it came from. Throws until the route tables are installed. */
export function encounterTables(): Readonly<Record<GameId, EncounterTable>> {
  if (!installed) throw new Error(NOT_INSTALLED);
  return installed.tables;
}

/** The whole library in id order, the draw order. Throws until the route tables are installed. */
export function allEncounters(): readonly EncounterRecord[] {
  if (!installed) throw new Error(NOT_INSTALLED);
  return installed.all;
}

/** The bosses alone, for the data test's split check: never the draw's input. */
export function bossTables(): Readonly<Record<GameId, EncounterTable>> {
  return BOSS_TABLES;
}

/** One record by id, or null. A missing id is a data error upstream, never a draw. Throws until the route tables are installed. */
export function encounterById(id: string): EncounterRecord | null {
  if (!installed) throw new Error(NOT_INSTALLED);
  return installed.byId.get(id) ?? null;
}
