/**
 * Source constants to Showdown ids, checked against the dex.
 *
 * A pret constant is `SPECIES_MR_MIME`, `MOVE_DOUBLE_SLAP`, `ITEM_KINGS_ROCK`,
 * or in the Game Boy projects the bare `MR_MIME`, `DOUBLESLAP`, `KINGS_ROCK`.
 * Lower-casing and dropping the separators lands on the Showdown id almost
 * every time, and the dex says when it does not. A species or move that does
 * not resolve **throws**: the importer refuses to emit a table with a hole in
 * it. An item that does not resolve is dropped and counted, because the Game
 * Boy games' `BERRY` and `GOLD_BERRY` have no modern counterpart and a missing
 * held item is a smaller lie than a missing move.
 */
import { Dex } from '@pkmn/sim';

const dex = Dex.forGen(9);

/** The few constants whose id is not the lower-cased name. */
const SPECIES_ALIASES: Record<string, string> = {
  NIDORAN_M: 'nidoranm',
  NIDORAN_F: 'nidoranf',
  FARFETCHD: 'farfetchd',
  FARFETCH_D: 'farfetchd',
  HO_OH: 'hooh',
  MIME_JR: 'mimejr',
  PORYGON_Z: 'porygonz',
  MR_MIME: 'mrmime',
};

/** Platinum's `form` field, for the species whose non-zero form is a different Showdown id. */
const FORMS: Record<string, Record<number, string>> = {
  wormadam: { 1: 'wormadamsandy', 2: 'wormadamtrash' },
  rotom: { 1: 'rotomheat', 2: 'rotomwash', 3: 'rotomfrost', 4: 'rotomfan', 5: 'rotommow' },
  giratina: { 1: 'giratinaorigin' },
  shaymin: { 1: 'shayminsky' },
  deoxys: { 1: 'deoxysattack', 2: 'deoxysdefense', 3: 'deoxysspeed' },
  shellos: { 1: 'shellos' },
  gastrodon: { 1: 'gastrodon' },
  unown: {},
  burmy: { 1: 'burmy', 2: 'burmy' },
  pichu: { 1: 'pichu' },
};

function strip(constant: string, prefix: string): string {
  return constant.startsWith(prefix) ? constant.slice(prefix.length) : constant;
}

function toId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const unresolvedItems = new Map<string, number>();

export function speciesId(constant: string, form = 0): string {
  const bare = strip(constant, 'SPECIES_');
  const base = SPECIES_ALIASES[bare] ?? toId(bare);
  const species = dex.species.get(base);
  if (!species.exists) throw new Error(`Unknown species constant ${constant} (tried ${base})`);
  if (form !== 0) {
    const forme = FORMS[species.id]?.[form];
    if (forme === undefined) throw new Error(`Unknown form ${form} for ${constant}`);
    if (!dex.species.get(forme).exists) throw new Error(`Form id ${forme} is not in the dex`);
    return forme;
  }
  return species.id;
}

/** The Game Boy projects suffix the move Psychic to keep it apart from the type. */
const MOVE_ALIASES: Record<string, string> = {
  PSYCHIC_M: 'psychic',
  VICEGRIP: 'vicegrip',
  VISE_GRIP: 'vicegrip',
  HI_JUMP_KICK: 'highjumpkick',
  FAINT_ATTACK: 'feintattack',
  SMELLING_SALT: 'smellingsalts',
};

export function moveId(constant: string): string | null {
  const bare = strip(constant, 'MOVE_');
  if (bare === 'NONE' || bare === 'NO_MOVE') return null;
  const move = dex.moves.get(MOVE_ALIASES[bare] ?? toId(bare));
  if (!move.exists) throw new Error(`Unknown move constant ${constant}`);
  return move.id;
}

export function itemId(constant: string): string | null {
  const bare = strip(constant, 'ITEM_');
  if (bare === 'NONE' || bare === 'NO_ITEM') return null;
  const item = dex.items.get(toId(bare));
  if (!item.exists) {
    unresolvedItems.set(bare, (unresolvedItems.get(bare) ?? 0) + 1);
    return null;
  }
  return item.id;
}

/** `TRAINER_CLASS_BIRD_KEEPER` or `BIRD KEEPER` to `Bird Keeper`. */
export function titleCase(text: string): string {
  return text
    .replace(/[<{]pkmn[>}]/gi, 'POKEMON')
    .replace(/#/g, 'POKE')
    .replace(/\bPKMN\b/g, 'POKEMON')
    .replace(/POK[EÉé]MON/gi, 'POKEMON')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|[\s.&-])([a-z])/g, (_m, before: string, letter: string) => before + letter.toUpperCase());
}

/** Names whose display form is not a title-cased constant. */
const NAME_OVERRIDES: Record<string, string> = {
  'LT.SURGE': 'Lt. Surge',
  LT_SURGE: 'Lt. Surge',
  'TATE&LIZA': 'Tate & Liza',
  TATE_AND_LIZA: 'Tate & Liza',
  Wake: 'Crasher Wake',
};

/** A trainer name as the game wrote it, in display case, with the Game Boy shout-case folded. */
export function displayName(raw: string): string {
  const cleaned = raw.replace(/\{TRNAME\}/g, '').replace(/[@]/g, '').trim();
  const override = NAME_OVERRIDES[cleaned];
  if (override) return override;
  if (cleaned === cleaned.toUpperCase()) return titleCase(cleaned);
  return cleaned;
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
