/**
 * Sword and Shield's Champion Cup, from Serebii's walkthrough page.
 *
 * pokemondb's Sword and Shield roster page has no Champion Cup, so Leon, Hop,
 * Marnie, Bede's challenge and the finals rematches come from here. Each
 * opponent is `<b>Battle</b>: <Name>` followed by one or more
 * `<table class="trainer">`, one per starter variant, each with a
 * `/pokedex-swsh/<slug>` link per member and a `<td class="level">Level N</td>`
 * per member in the same order. No set moves and no items, as with the rest
 * of Gen 5 to 9.
 */
import { readFileSync } from 'node:fs';

import type { RawEncounter } from './model';
import { must } from './model';
import { speciesFromAlt } from './parse-pokemondb';
import { sourcePath } from './fetch';

const ROLE: Record<string, { role: RawEncounter['role']; className: string; classKey: string; gymType?: string }> = {
  marnie: { role: 'rival', className: 'Rival', classKey: 'RIVAL' },
  hop: { role: 'rival', className: 'Rival', classKey: 'RIVAL' },
  bede: { role: 'rival', className: 'Rival', classKey: 'RIVAL' },
  leon: { role: 'champion', className: 'Champion', classKey: 'CHAMPION' },
  nessa: { role: 'gym', className: 'Leader', classKey: 'LEADER', gymType: 'Water' },
  allister: { role: 'gym', className: 'Leader', classKey: 'LEADER', gymType: 'Ghost' },
  bea: { role: 'gym', className: 'Leader', classKey: 'LEADER', gymType: 'Fighting' },
  raihan: { role: 'gym', className: 'Leader', classKey: 'LEADER', gymType: 'Dragon' },
};

export function parseSerebiiCup(): RawEncounter[] {
  const html = readFileSync(sourcePath('serebii', 'swsh-championcup.html'), 'utf8');
  const out: RawEncounter[] = [];
  // Walk the page in order: a "Battle:" line names the opponent for every
  // trainer table until the next one. The level cells sit after a nested
  // items table inside the trainer table, so a table runs to the next
  // trainer table or the next "Battle:" line, never to the first `</table>`.
  const tokens = [...html.matchAll(/<b>Battle<\/b>:\s*([A-Za-z]+)|<table class="trainer">/g)];
  let name: string | null = null;
  let counter = 0;
  tokens.forEach((token, index) => {
    if (token[1]) {
      name = token[1];
      return;
    }
    if (!name) return;
    const end = tokens[index + 1]?.index ?? html.length;
    const table = html.slice(token.index, end);
    // A member cell links its dex page (`sirfetch'd` keeps its apostrophe,
    // `mr.rime` its dot) and carries the name as the alt text. A regional
    // form is in the image file name, not the alt: `078-g.png` is Galarian
    // Rapidash, `-a` Alolan; a `-gi` Gigantamax image is the base species.
    const species = [...table.matchAll(/href="\/pokedex-swsh\/([a-z0-9'.-]+)"><img src="\/swordshield\/pokemon\/\d+(-[a-z]+)?\.png" alt="([^"]+)"/g)].map((m) => {
      const slug = must(m[1], 'slug').replace(/['.]/g, '');
      const alt = must(m[3], 'alt');
      const form = m[2] === '-g' ? 'Galarian' : m[2] === '-a' ? 'Alolan' : null;
      return { slug, alt: form ? `${form} ${alt}` : alt };
    });
    const levels = [...table.matchAll(/<td class="level"[^>]*>Level (\d+)<\/td>/g)].map((m) => Number(m[1]));
    if (species.length === 0 || species.length !== levels.length) {
      throw new Error(`Champion Cup table for ${name}: ${species.length} species against ${levels.length} levels`);
    }
    // The version-exclusive finals opponent shares one "Battle:" line (Bea or
    // Allister); the type icons in the table say whose it is, by the type
    // most of its members carry.
    const typeCounts = new Map<string, number>();
    for (const m of table.matchAll(/\/pokedex-swsh\/([a-z]+)\.shtml/g)) typeCounts.set(must(m[1], 'type'), (typeCounts.get(must(m[1], 'type')) ?? 0) + 1);
    const tableType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const named = ROLE[name.toLowerCase()];
    const typed = named?.gymType && tableType && named.gymType.toLowerCase() !== tableType ? Object.entries(ROLE).find(([, r]) => r.gymType?.toLowerCase() === tableType) : undefined;
    const who = typed ? typed[0] : name.toLowerCase();
    const shown = who.charAt(0).toUpperCase() + who.slice(1);
    const role = ROLE[who];
    if (!role) throw new Error(`Champion Cup: no role for ${shown}`);
    counter += 1;
    const row: RawEncounter = {
      game: 'swsh',
      className: role.className,
      classKey: role.classKey,
      name: shown,
      place: 'Wyndon Stadium',
      party: species.map((entry, i) => ({ species: speciesFromAlt(entry.alt, entry.slug), level: must(levels[i], 'level') })),
      role: role.role,
      cite: `championcup.shtml ${shown} #${counter}`,
    };
    if (role.gymType) row.gymType = role.gymType;
    out.push(row);
  });
  return out;
}
