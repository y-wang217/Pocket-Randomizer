/**
 * The Gen 5 to 9 rivals, from Serebii's per-character pages. **Checkpoint 8.**
 *
 * pokemondb's leader pages carry no rival fight, so Cheren, Bianca, Hugh,
 * Brendan, May, Wally, Hau, Gladion, Trace, Hop, Marnie, Bede and Barry come
 * from the pages Serebii keeps per character (`blackwhite/cheren.shtml`,
 * `swordshield/hop.shtml`, `letsgopikachueevee/rival.shtml` and so on),
 * pinned in `sources.json`. X and Y and Scarlet and Violet have no such page
 * under any slug that was tried, so Calem, Serena, Shauna, Tierno, Trevor,
 * Nemona, Arven and Penny stay a recorded gap.
 *
 * Every page is one `<table class="trainer">` per fight (one per starter
 * variant, footed `<i>Grookey Chosen</i>`), across four template eras:
 *
 *   - the first row links each member's dex page around an image, whose file
 *     name carries a regional form (`026-a.png`);
 *   - the second row's first cell names the trainer with their class
 *     (`Pokémon Trainer Hop`, `Gym Leader Marnie`, `Champion Rival`), and the
 *     cells after it link each member by name, which is the one place every
 *     era writes the species as text;
 *   - `<td class="level">Level N</td>` per member, in order;
 *   - an `Attacks:` cell per member with `attackdex` links, blank slots as
 *     empty links, and a `Hold Item:` cell per member, `No Item` or a name.
 *
 * The place is the nearest preceding `Location: X` line, else the encounter
 * heading, else the region. Set moves and items are kept where the page's
 * cells line up one per member, and dropped for the fight otherwise, so a
 * row is never half-annotated.
 */
import { readFileSync } from 'node:fs';

import { Dex } from '@pkmn/sim';

import type { GameId, PartyMember } from '../../src/data/encounters/types';
import { sourcePath } from './fetch';
import { GAME_REGION, must, type RawEncounter } from './model';
import { speciesFromAlt } from './parse-pokemondb';

const dex = Dex.forGen(9);

/** The pages per game, and the name a page's `Rival` placeholder stands for. */
export const RIVAL_PAGES: Readonly<Partial<Record<GameId, readonly { page: string; name: string }[]>>> = {
  bw: [
    { page: 'blackwhite/cheren.shtml', name: 'Cheren' },
    { page: 'blackwhite/bianca.shtml', name: 'Bianca' },
  ],
  b2w2: [{ page: 'black2white2/rival.shtml', name: 'Hugh' }],
  oras: [
    { page: 'omegarubyalphasapphire/rival.shtml', name: 'Brendan / May' },
    { page: 'omegarubyalphasapphire/wally.shtml', name: 'Wally' },
  ],
  sm: [
    { page: 'sunmoon/hau.shtml', name: 'Hau' },
    { page: 'sunmoon/gladion.shtml', name: 'Gladion' },
  ],
  usum: [
    { page: 'ultrasunultramoon/hau.shtml', name: 'Hau' },
    { page: 'ultrasunultramoon/gladion.shtml', name: 'Gladion' },
  ],
  lgpe: [{ page: 'letsgopikachueevee/rival.shtml', name: 'Trace' }],
  swsh: [
    { page: 'swordshield/hop.shtml', name: 'Hop' },
    { page: 'swordshield/marnie.shtml', name: 'Marnie' },
    { page: 'swordshield/bede.shtml', name: 'Bede' },
  ],
  bdsp: [{ page: 'brilliantdiamondshiningpearl/barry.shtml', name: 'Barry' }],
};

/** The gym a rival later leads, for the pages' `Gym Leader` rows. */
const LATER_GYM: Record<string, string> = { Bede: 'Fairy', Marnie: 'Dark' };

const FORM: Record<string, string> = { '-a': 'Alolan', '-g': 'Galarian', '-h': 'Hisuian', '-p': 'Paldean' };

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&eacute;|&#233;|�/g, 'é')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The file name a page is saved under: `<game>-<basename>.html`, as `fetchSerebii` writes it. */
export function serebiiFile(game: GameId, page: string): string {
  return `${game}-${page.split('/').pop()!.replace(/\.shtml$/, '')}.html`;
}

interface Head {
  className: string;
  classKey: string;
  names: string[];
  role: RawEncounter['role'];
  gymType?: string;
}

/** The trainer cell's class and name, as the game prints them. */
function headOf(cell: string, fallbackName: string, game: GameId): Head {
  const match = /^(PKMN Trainer|Pok\S{0,8}?mon Trainer|Gym Leader|Champion|Team Skull)\s+(.+)$/.exec(cell);
  const rawClass = match ? must(match[1], 'class') : 'Pokémon Trainer';
  const rawName = match ? must(match[2], 'name').trim() : fallbackName;
  const names = (rawName === 'Rival' ? fallbackName : rawName).split('/').map((n) => n.trim()).filter(Boolean);
  if (rawClass === 'Gym Leader') {
    const type = LATER_GYM[names[0] ?? ''];
    return { className: 'Leader', classKey: 'LEADER', names, role: 'gym', ...(type ? { gymType: type } : {}) };
  }
  if (rawClass === 'Champion') return { className: 'Champion', classKey: 'CHAMPION', names, role: 'champion' };
  if (rawClass === 'Team Skull') return { className: 'Team Skull', classKey: 'TEAM_SKULL', names, role: 'rival' };
  // The games print the rival as a Pokémon Trainer; Let's Go prints `Rival`.
  if (game === 'lgpe') return { className: 'Rival', classKey: 'RIVAL', names, role: 'rival' };
  return { className: 'Pokemon Trainer', classKey: 'PKMN_TRAINER', names, role: 'rival' };
}

export function parseSerebiiRivals(game: GameId): RawEncounter[] {
  const pages = RIVAL_PAGES[game] ?? [];
  const out: RawEncounter[] = [];
  for (const { page, name: fallbackName } of pages) {
    const html = readFileSync(sourcePath('serebii', serebiiFile(game, page)), 'utf8');
    const basename = page.split('/').pop()!;
    let counter = 0;
    let cursor = 0;
    let lastEnd = 0;
    // A starter variant's table follows its sibling with no heading between, so the place carries forward.
    let place = GAME_REGION[game];
    for (;;) {
      const start = html.indexOf('<table class="trainer"', cursor);
      if (start === -1) break;
      const firstLevel = html.indexOf('class="level"', start);
      if (firstLevel === -1) break;
      const end = html.indexOf('</table>', firstLevel);
      const table = html.slice(start, end === -1 ? html.length : end + 8);
      cursor = end === -1 ? html.length : end + 8;

      // Where: the nearest `Location:` line since the previous table, else the encounter heading.
      const between = html.slice(lastEnd, start);
      lastEnd = cursor;
      const locations = [...between.matchAll(/<b>Location<\/b>:?\s*([^<]+)</g)];
      const headings = [...between.matchAll(/Encounter \d+\s*[:\-–]\s*([^<]+)</g)];
      const placeRaw = locations[locations.length - 1]?.[1] ?? headings[headings.length - 1]?.[1];
      if (placeRaw) place = text(placeRaw).split(',')[0]!.trim() || GAME_REGION[game];

      const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => must(m[1], 'row'));
      const nameRow = rows.find((row) => /<td[^>]*>\s*(?:PKMN Trainer|Pok\S{0,8}?mon Trainer|Gym Leader|Champion|Team Skull)\s/.test(row));
      const nameCell = nameRow ? text(must(/<td[^>]*>([\s\S]*?)<\/td>/.exec(nameRow)?.[1], 'name cell')) : '';
      const head = headOf(nameCell, fallbackName, game);

      // Members: the named links of the second row, with the first row's image suffix for the form.
      const named = [...table.matchAll(/<td align="center">\s*<a href="\/pokedex-[a-z0-9-]+\/[^"]+">([^<]+)<\/a>/g)].map((m) => text(must(m[1], 'species')));
      const forms = [...table.matchAll(/<img src="\/[a-z]+\/pokemon\/(?:small\/)?\d+(-[a-z]+)?\.png"/g)].map((m) => m[1] ?? '');
      const levels = [...table.matchAll(/<td class="level"[^>]*>\s*Level (\d+)/g)].map((m) => Number(m[1]));
      if (named.length === 0 || named.length !== levels.length) {
        throw new Error(`${game} ${basename} table ${counter + 1} (${head.names.join('/')}): ${named.length} species against ${levels.length} levels`);
      }
      const party: PartyMember[] = named.map((speciesName, i) => {
        const form = FORM[forms[i] ?? ''] ?? null;
        const slug = speciesName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return { species: speciesFromAlt(form ? `${form} ${speciesName}` : speciesName, slug), level: must(levels[i], 'level') };
      });

      // Moves and items only where the cells line up one per member.
      const attackCells = [...table.matchAll(/<b>Attacks<\/b>:([\s\S]*?)<\/td>/g)].map((m) => must(m[1], 'attacks'));
      if (attackCells.length === party.length) {
        attackCells.forEach((cell, i) => {
          const ids = [...cell.matchAll(/attackdex-[a-z0-9-]+\/([a-z0-9]+)\.shtml">([^<]+)</g)]
            .map((m): string | null => {
              const byId = dex.moves.get(must(m[1], 'move id'));
              if (byId.exists) return String(byId.id);
              const byName = dex.moves.get(text(must(m[2], 'move name')));
              return byName.exists ? String(byName.id) : null;
            })
            .filter((id): id is string => id !== null);
          if (ids.length > 0) party[i]!.moves = ids;
        });
      }
      const itemCells = [...table.matchAll(/<b>Hold Item<\/b>:<br \/>([\s\S]*?)<\/td>/g)].map((m) => text(must(m[1], 'item')));
      if (itemCells.length === party.length) {
        itemCells.forEach((cell, i) => {
          if (!cell || /^No Item$/i.test(cell)) return;
          const item = dex.items.get(cell);
          if (item.exists) party[i]!.item = String(item.id);
        });
      }

      for (const name of head.names) {
        counter += 1;
        const row: RawEncounter = {
          game,
          className: head.className,
          classKey: head.classKey,
          name,
          place,
          party: party.map((member) => ({ ...member, ...(member.moves ? { moves: [...member.moves] } : {}) })),
          role: head.role,
          cite: `${basename} ${name} #${counter}`,
        };
        if (head.gymType) row.gymType = head.gymType;
        out.push(row);
      }
    }
  }
  return out;
}
