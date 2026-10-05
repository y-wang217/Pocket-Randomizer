/**
 * The encounter library, held to the dex and to its own sources.
 *
 * The tables are generated from pinned revisions of the pret decompilations,
 * so a typo is impossible and a drift is not: @pkmn/sim moves, the importer
 * can be edited, and a regenerate can quietly lose a game. This suite pins
 * the shape the library had when it was reviewed. A regenerate that changes a
 * count or widens the set of species outside the pool is a deliberate act
 * and updates the pins here in the same commit.
 */
import { readFileSync } from 'node:fs';

import { Dex } from '@pkmn/sim';
import { describe, expect, it } from 'vitest';

import { BLACKLISTED_SPECIES } from '../src/data/blacklists';
import { ENCOUNTERS, ENCOUNTER_TABLES, decodeParty, encodeParty, encounterById } from '../src/data/encounters';
import type { GameId } from '../src/data/encounters/types';
import { SPECIES_POOL } from '../src/data/speciesPools';

const dex = Dex.forGen(9);
const root = new URL('..', import.meta.url).pathname;

const pins = JSON.parse(readFileSync(`${root}scripts/import-encounters/sources.json`, 'utf8')) as {
  repos: Record<string, { sha: string; paths: string[] }>;
  pokemondb: { fetchedAt: string; pages: Record<string, string> };
  serebii: { fetchedAt: string; pages: Record<string, string> };
};
const spriteList = new Set(
  (JSON.parse(readFileSync(`${root}scripts/import-encounters/sprites.json`, 'utf8')) as { ids: string[] }).ids,
);
const poolSpecies = new Set(SPECIES_POOL.map((entry) => entry.id));

/**
 * The library as reviewed at checkpoints 2 and 3. A regenerate updates these
 * on purpose. Gen 1 to 4 are every trainer in the game; Gen 5 to 9 are the
 * bosses pokemondb's roster pages list, rematches included.
 */
const EXPECTED_COUNTS: Record<string, number> = {
  rby: 352,
  yellow: 343,
  gs: 495,
  crystal: 541,
  rs: 693,
  emerald: 852,
  frlg: 639,
  platinum: 725,
  hgss: 734,
  bw: 23,
  b2w2: 20,
  xy: 13,
  oras: 18,
  sm: 23,
  usum: 31,
  lgpe: 31,
  swsh: 32,
  bdsp: 38,
  sv: 36,
};

describe('the encounter library', () => {
  it('is large enough to be a library rather than a roster', () => {
    expect(ENCOUNTERS.length).toBeGreaterThan(500);
  });

  it('holds exactly the tables it was reviewed with', () => {
    const counts = Object.fromEntries(
      Object.entries(ENCOUNTER_TABLES).map(([game, table]) => [game, table.records.length]),
    );
    expect(counts).toEqual(EXPECTED_COUNTS);
    expect(ENCOUNTERS.length).toBe(Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0));
  });

  it('has ids unique across every game, each under its own game', () => {
    const seen = new Set<string>();
    for (const [game, table] of Object.entries(ENCOUNTER_TABLES)) {
      for (const record of table.records) {
        expect(record.id.startsWith(`${game}/`), record.id).toBe(true);
        expect(record.game, record.id).toBe(game);
        expect(seen.has(record.id), `duplicate ${record.id}`).toBe(false);
        seen.add(record.id);
      }
    }
    expect(encounterById('rby/brock-1')?.trainer.name).toBe('Brock');
    expect(encounterById('nowhere/nobody-1')).toBeNull();
  });

  it('is sorted by id, because the order is the draw order', () => {
    for (let i = 1; i < ENCOUNTERS.length; i += 1) {
      expect(ENCOUNTERS[i - 1]!.id < ENCOUNTERS[i]!.id, `${ENCOUNTERS[i - 1]!.id} before ${ENCOUNTERS[i]!.id}`).toBe(true);
    }
  });

  it('cites a pinned revision or date per game, and a label per row', () => {
    for (const [game, table] of Object.entries(ENCOUNTER_TABLES)) {
      if (table.source.repo.startsWith('pokemondb.net')) {
        // One page from pokemondb, and for Sword and Shield the Champion Cup
        // page from Serebii after it, both fetched on the pinned date.
        expect(table.source.sha, `${game} fetch date`).toBe(pins.pokemondb.fetchedAt);
        const serebii = pins.serebii.pages[game];
        if (serebii) {
          expect(pins.serebii.fetchedAt, `${game} serebii fetch date`).toBe(table.source.sha);
          expect(table.source.repo).toBe('pokemondb.net, serebii.net');
          expect([...table.source.files]).toEqual([pins.pokemondb.pages[game], serebii]);
        } else {
          expect(table.source.repo).toBe('pokemondb.net');
          expect([...table.source.files]).toEqual([pins.pokemondb.pages[game]]);
        }
      } else {
        const repo = table.source.repo.replace(/^pret\//, '');
        const pin = pins.repos[repo];
        expect(pin, `${game} pins ${repo}`).toBeDefined();
        expect(table.source.sha, `${game} revision`).toBe(pin!.sha);
        expect([...table.source.files]).toEqual(pin!.paths);
      }
      for (const record of table.records) expect(record.cite.length, record.id).toBeGreaterThan(0);
    }
  });
});

describe('the party encoding', () => {
  it('decodes every row the files carry, and reads Brock as the game shipped him', () => {
    // `index.ts` already decoded every row at load, so reaching here is the
    // proof the grammar is total over the files; the round trip is the rest.
    for (const record of ENCOUNTERS) {
      expect(decodeParty(encodeParty(record.party), record.id)).toEqual(record.party.map((m) => ({ ...m })));
    }
    expect(encounterById('rby/brock-1')!.party).toEqual([
      { species: 'geodude', level: 12 },
      { species: 'onix', level: 14 },
    ]);
    const withMoves = ENCOUNTERS.find((r) => r.party.some((m) => m.moves && m.item));
    expect(withMoves, 'a record with set moves and an item').toBeDefined();
    const member = withMoves!.party.find((m) => m.moves && m.item)!;
    expect(encodeParty([member])).toBe(`${member.species}:${member.level}@${member.item}>${member.moves!.join(',')}`);
  });

  it('refuses a cell outside the grammar', () => {
    expect(() => decodeParty('')).toThrow(/empty party/);
    expect(() => decodeParty('geodude', 'x')).toThrow(/malformed/);
    expect(() => decodeParty('geodude:12|', 'x')).toThrow(/malformed/);
    expect(() => decodeParty('Geodude:12', 'x')).toThrow(/malformed/);
    expect(decodeParty('onix:14#M')).toEqual([{ species: 'onix', level: 14, gender: 'M' }]);
  });
});

describe('every record', () => {
  it('names species, moves and items the dex knows', () => {
    for (const record of ENCOUNTERS) {
      expect(record.party.length, record.id).toBeGreaterThan(0);
      for (const member of record.party) {
        expect(dex.species.get(member.species).exists, `${record.id} ${member.species}`).toBe(true);
        expect(member.level, `${record.id} level`).toBeGreaterThanOrEqual(1);
        expect(member.level, `${record.id} level`).toBeLessThanOrEqual(100);
        for (const move of member.moves ?? []) expect(dex.moves.get(move).exists, `${record.id} ${move}`).toBe(true);
        if (member.moves) expect(member.moves.length, `${record.id} moves`).toBeLessThanOrEqual(4);
        if (member.item) expect(dex.items.get(member.item).exists, `${record.id} ${member.item}`).toBe(true);
      }
    }
  });

  it('keeps the set of species outside the pool to the ones reviewed', () => {
    // The fit rule drops these at draw time. A regenerate that widens the
    // set, or a pool change that shrinks it, is a deliberate act. Gen 1 to 4
    // contribute a blacklisted species and two Wormadam formes; Gen 5 to 9
    // add the regional formes the pool excludes and the two box legendaries
    // N fields in Black and White.
    const outside = new Set<string>();
    for (const record of ENCOUNTERS) {
      for (const member of record.party) {
        if (!poolSpecies.has(member.species) || BLACKLISTED_SPECIES.includes(member.species)) outside.add(member.species);
      }
    }
    expect([...outside].sort()).toEqual([
      'aegislash',
      'darmanitangalar',
      'dudunsparcethreesegment',
      'dugtrioalola',
      'exeggutoralola',
      'golemalola',
      'lycanrocmidnight',
      'marowakalola',
      'ninetalesalola',
      'oricoriopompom',
      'rapidashgalar',
      'reshiram',
      'sandslashalola',
      'shedinja',
      'toxtricitylowkey',
      'weezinggalar',
      'wormadamsandy',
      'wormadamtrash',
      'yamaskgalar',
      'zekrom',
    ]);
  });

  it('wears a sprite the CDN listing has, or none', () => {
    let missing = 0;
    for (const record of ENCOUNTERS) {
      if (record.trainer.sprite === null) {
        missing += 1;
        continue;
      }
      expect(spriteList.has(record.trainer.sprite), `${record.id} ${record.trainer.sprite}`).toBe(true);
    }
    // Platinum's PI class, one Emerald row with no class text, and Game
    // Freak's Morimoto in BDSP, who has no sprite on the CDN at all.
    expect(missing).toBe(6);
  });

  it('carries a gym type only on a gym, and one the dex knows', () => {
    for (const record of ENCOUNTERS) {
      if (record.gymType !== undefined) {
        expect(record.role, record.id).toBe('gym');
        expect(dex.types.get(record.gymType).exists, `${record.id} ${record.gymType}`).toBe(true);
      }
      expect(record.trainer.name.length, record.id).toBeGreaterThan(0);
      expect(record.trainer.class.length, record.id).toBeGreaterThan(0);
      expect(record.place.length, record.id).toBeGreaterThan(0);
      expect(record.gen, record.id).toBeGreaterThanOrEqual(1);
      expect(record.gen, record.id).toBeLessThanOrEqual(9);
    }
  });
});

describe('the leaders are who the games say', () => {
  it('names the leaders the games had, once per game at least', () => {
    const expectLeader = (game: GameId, name: string, type: string) => {
      const rows = ENCOUNTERS.filter((r) => r.game === game && r.role === 'gym' && r.trainer.name === name);
      expect(rows.length, `${game} ${name}`).toBeGreaterThan(0);
      for (const row of rows) expect(row.gymType, row.id).toBe(type);
    };
    expectLeader('rby', 'Brock', 'Rock');
    expectLeader('rby', 'Giovanni', 'Ground');
    expectLeader('crystal', 'Clair', 'Dragon');
    expectLeader('crystal', 'Morty', 'Ghost');
    expectLeader('emerald', 'Tate & Liza', 'Psychic');
    expectLeader('platinum', 'Crasher Wake', 'Water');
    expectLeader('hgss', 'Janine', 'Poison');
    // Gen 5 to 9: the thin types from checkpoint 1 widen here.
    expectLeader('bw', 'Drayden', 'Dragon');
    expectLeader('bw', 'Iris', 'Dragon');
    expectLeader('swsh', 'Raihan', 'Dragon');
    expectLeader('swsh', 'Allister', 'Ghost');
    expectLeader('sv', 'Ryme', 'Ghost');
    expectLeader('sm', 'Hala', 'Fighting');
    expect(ENCOUNTERS.filter((r) => r.game === 'bw' && r.trainer.name === 'Shauntal').every((r) => r.role === 'elite')).toBe(true);
    expect(ENCOUNTERS.filter((r) => r.game === 'bw' && r.trainer.name === 'N').every((r) => r.role === 'boss' && r.place === "N's Castle")).toBe(true);
    // Koga is Elite Four in Johto, a gym leader in Kanto.
    expect(ENCOUNTERS.filter((r) => r.game === 'crystal' && r.trainer.name === 'Koga').every((r) => r.role === 'elite')).toBe(true);
    expect(ENCOUNTERS.filter((r) => r.game === 'frlg' && r.trainer.name === 'Koga').every((r) => r.role === 'gym')).toBe(true);
  });

  it('reads Red and Blue as the games shipped them', () => {
    const brock = encounterById('rby/brock-1')!;
    expect(brock.party.map((m) => `${m.species}:${m.level}`)).toEqual(['geodude:12', 'onix:14']);
    expect(brock.place).toBe('Pewter City Gym');
    expect(brock.trainer.sprite).toBe('brock-gen1rb');
    const lance = encounterById('rby/lance-1')!;
    expect(lance.role).toBe('elite');
    expect(lance.party[lance.party.length - 1]).toEqual({ species: 'dragonite', level: 62 });
  });
});
