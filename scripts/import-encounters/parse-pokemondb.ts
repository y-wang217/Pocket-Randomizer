/**
 * Gen 5 to 9: the gym leader, Elite Four, champion and notable-trainer pages
 * on pokemondb.net, one page per game.
 *
 * Bulbapedia was the ruling's source and sits behind a browser challenge
 * from this container, so it cannot be read programmatically or pinned.
 * pokemondb publishes the same rosters with levels in one clean page per
 * game: `<h2 id="gym-N|kahuna-N|captain-N|teamstar-N|elite4-N|champion-N|trainers-misc">`
 * sections, each holding one or more `span.trainer-head` (the name, a badge,
 * "X type Pokémon" or a location link) followed by `div.trainer-pkmn`
 * infocards (`/pokedex/<slug>`, an alt text that carries the forme, `Level N`).
 * No moves and no items, which is the shape Gen 1 has too. A page has no
 * revision id, so the pin is the fetch date plus the counts the data test
 * holds; a refetch that changes a roster is loud.
 */
import { readFileSync } from 'node:fs';

import { Dex } from '@pkmn/sim';

import type { GameId, PartyMember } from '../../src/data/encounters/types';
import { sourcePath } from './fetch';
import { must, type RawEncounter } from './model';
import { GAME_REGION } from './model';
import { displayName } from './names';

const dex = Dex.forGen(9);

/** Who the "Other trainers" sections hold. Anyone not listed is reported, never guessed. */
const RIVALS = new Set(['cheren', 'bianca', 'hugh', 'calem', 'serena', 'shauna', 'tierno', 'trevor', 'brendan', 'may', 'wally', 'hau', 'gladion', 'trace', 'hop', 'marnie', 'nemona', 'arven', 'penny', 'barry', 'lillie', 'bede']);
const BOSSES = new Set(['n', 'ghetsis', 'colress', 'zinzolin', 'lysandre', 'xerosic', 'archie', 'maxie', 'guzma', 'lusamine', 'plumeria', 'faba', 'rose', 'oleana', 'cyrus', 'mars', 'jupiter', 'saturn', 'giovanni', 'archer', 'jessie', 'james', 'red', 'blue', 'green', 'leaf', 'clavell', 'cassiopeia', 'kieran', 'carmine', 'sada', 'turo', 'ai sada', 'ai turo', 'nemona', 'drayton', 'lacey', 'crispin', 'amarys', 'mustard', 'klara', 'avery', 'peony', 'sordward', 'shielbert', 'leon', 'volo', "game freak's morimoto"]);

/** Entity-decoded, tag-stripped, whitespace-folded text. */
function text(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é')
    .replace(/&middot;/g, '·')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The alt text to a Showdown species id. "Alolan Ninetales" is
 * `Ninetales-Alola`, "Lycanroc (Midnight Form)" is `Lycanroc-Midnight`, and
 * a forme that is the base ("Lycanroc (Midday Form)", "Aegislash (Shield
 * Forme)") is the base. Every candidate is tried against the dex; none
 * resolving throws, the way `names.ts` does for a constant.
 */
export function speciesFromAlt(alt: string, slug: string): string {
  const candidates: string[] = [];
  const regional = /^(Alolan|Galarian|Hisuian|Paldean) (.+)$/.exec(alt);
  if (regional) {
    const suffix = { Alolan: 'Alola', Galarian: 'Galar', Hisuian: 'Hisui', Paldean: 'Paldea' }[regional[1] as 'Alolan'];
    candidates.push(`${regional[2]}-${suffix}`);
  }
  const forme = /^(.+?) \((.+?)\)$/.exec(alt);
  if (forme) {
    const words = must(forme[2], 'forme').replace(/\b(Form|Forme|Style|Mode|Size|Standard)\b/g, '').trim();
    const galar = /Galarian/.test(words);
    const rest = words.replace(/Galarian/, '').trim();
    if (galar) candidates.push(rest ? `${forme[1]}-Galar-${rest}` : `${forme[1]}-Galar`);
    if (rest) candidates.push(`${forme[1]}-${rest}`);
    candidates.push(must(forme[1], 'species'));
  }
  candidates.push(alt, slug);
  for (const candidate of candidates) {
    const species = dex.species.get(candidate);
    if (species.exists) return species.id;
  }
  throw new Error(`Unknown species "${alt}" (slug ${slug})`);
}

interface Head {
  name: string;
  note: string;
  party: PartyMember[];
}

function parseSection(sectionHtml: string): Head[] {
  const heads: Head[] = [];
  const chunks = sectionHtml.split(/(?=<span class="infocard trainer-head")/).slice(1);
  for (const chunk of chunks) {
    const name = /class="ent-name">([^<]*)</.exec(chunk);
    const small = /<small>([\s\S]*?)<\/small>\s*<\/span>/.exec(chunk);
    const party: PartyMember[] = [];
    for (const card of chunk.matchAll(/<div class="infocard trainer-pkmn">([\s\S]*?)<\/div>/g)) {
      const body = must(card[1], 'infocard');
      const slug = /href="\/pokedex\/([a-z0-9-]+)"/.exec(body);
      const alt = /alt="([^"]+)"/.exec(body);
      const level = /Level (\d+)/.exec(body);
      if (!slug || !alt || !level) throw new Error(`Unreadable infocard under ${name?.[1] ?? '?'}: ${text(body)}`);
      party.push({ species: speciesFromAlt(text(must(alt[1], 'alt')), must(slug[1], 'slug')), level: Number(level[1]) });
    }
    if (!name || party.length === 0) continue;
    heads.push({ name: text(must(name[1], 'name')), note: small ? text(must(small[1], 'note')) : '', party });
  }
  return heads;
}

const SECTION_ROLE: Record<string, { role: 'gym' | 'elite' | 'champion' | 'boss'; className: string; classKey: string }> = {
  gym: { role: 'gym', className: 'Leader', classKey: 'LEADER' },
  kahuna: { role: 'gym', className: 'Kahuna', classKey: 'KAHUNA' },
  captain: { role: 'gym', className: 'Captain', classKey: 'CAPTAIN' },
  elite4: { role: 'elite', className: 'Elite Four', classKey: 'ELITE_FOUR' },
  champion: { role: 'champion', className: 'Champion', classKey: 'CHAMPION' },
  teamstar: { role: 'boss', className: 'Team Star', classKey: 'TEAM_STAR_BOSS' },
};

export const unplacedNames = new Map<string, string>();

export function parsePokemondb(game: GameId): RawEncounter[] {
  const html = readFileSync(sourcePath('pokemondb', `${game}.html`), 'utf8');
  const out: RawEncounter[] = [];
  const sections = html.split(/(?=<h2 id=")/).slice(1);
  for (const section of sections) {
    const heading = /^<h2 id="([a-z0-9-]+)">([^<]*)<\/h2>/.exec(section);
    if (!heading) continue;
    const id = must(heading[1], 'section id');
    const title = text(must(heading[2], 'section title'));
    const kind = id.replace(/-\d+$/, '');
    const city = /, (.+)$/.exec(title)?.[1];
    for (const head of parseSection(section)) {
      const baseName = head.name.replace(/\s*-\s*rematch(\s*\d+)?$/i, '');
      const teamPrefix = /^(Team \w+|Pokémon Trainer|Pokemon Trainer) (.+)$/.exec(baseName);
      const name = displayName(teamPrefix ? must(teamPrefix[2], 'name') : baseName);
      const typeMatch = /(\w+) type Pokémon/.exec(head.note);
      const location = /^(.*?)(?: Mixed types| \w+ type Pokémon)?$/.exec(head.note.replace(/^\([^)]*\)\s*/, ''))?.[1]?.replace(/\b\w+ Badge\b/, '').trim();
      const section = SECTION_ROLE[kind];
      let role: RawEncounter['role'];
      let className: string;
      let classKey: string;
      if (section) {
        ({ role, className, classKey } = section);
      } else {
        const key = name.toLowerCase();
        if (RIVALS.has(key)) {
          role = 'rival';
          className = 'Rival';
          classKey = 'RIVAL';
        } else if (BOSSES.has(key) || teamPrefix) {
          role = 'boss';
          className = teamPrefix ? must(teamPrefix[1], 'class').replace('Pokémon', 'Pokemon') : 'Pokemon Trainer';
          classKey = className.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        } else {
          unplacedNames.set(`${game}:${name}`, head.note);
          role = 'route';
          className = 'Pokemon Trainer';
          classKey = 'PKMN_TRAINER';
        }
      }
      const place =
        kind === 'gym' && city ? `${city} Gym`
        : kind === 'kahuna' && city ? city
        : kind === 'elite4' || kind === 'champion' ? (game === 'lgpe' ? 'Indigo Plateau' : 'Pokemon League')
        : kind === 'teamstar' ? 'Team Star Base'
        : location && location.length > 0 && !/^Mixed types$/.test(location) ? location
        : GAME_REGION[game];
      const row: RawEncounter = {
        game,
        className,
        classKey,
        name,
        place,
        party: head.party,
        cite: `#${id} ${head.name}`,
      };
      if (role === 'gym' && typeMatch) row.gymType = must(typeMatch[1], 'type');
      row.role = role;
      out.push(row);
    }
  }
  return out;
}
