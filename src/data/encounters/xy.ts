/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * X and Y: 13 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const XY_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['x-y/gymleaders-elitefour'],
};

export const XY_ROWS: readonly EncounterRow[] = [
  { id: 'xy/viola-1', game: 'xy', gen: 6, trainer: { name: "Viola", class: "Leader", sprite: 'viola' }, role: 'gym', place: "Santalune City Gym", gymType: 'Bug', party: "surskit:10|vivillon:12", cite: "#gym-1 Viola" },
  { id: 'xy/grant-1', game: 'xy', gen: 6, trainer: { name: "Grant", class: "Leader", sprite: 'grant' }, role: 'gym', place: "Cyllage City Gym", gymType: 'Rock', party: "amaura:25|tyrunt:25", cite: "#gym-2 Grant" },
  { id: 'xy/korrina-1', game: 'xy', gen: 6, trainer: { name: "Korrina", class: "Leader", sprite: 'korrina' }, role: 'gym', place: "Shalour City Gym", gymType: 'Fighting', party: "mienfoo:29|machoke:28|hawlucha:32", cite: "#gym-3 Korrina" },
  { id: 'xy/ramos-1', game: 'xy', gen: 6, trainer: { name: "Ramos", class: "Leader", sprite: 'ramos' }, role: 'gym', place: "Coumarine City Gym", gymType: 'Grass', party: "jumpluff:30|weepinbell:31|gogoat:34", cite: "#gym-4 Ramos" },
  { id: 'xy/clemont-1', game: 'xy', gen: 6, trainer: { name: "Clemont", class: "Leader", sprite: 'clemont' }, role: 'gym', place: "Lumiose City Gym", gymType: 'Electric', party: "emolga:35|magneton:35|heliolisk:37", cite: "#gym-5 Clemont" },
  { id: 'xy/valerie-1', game: 'xy', gen: 6, trainer: { name: "Valerie", class: "Leader", sprite: 'valerie' }, role: 'gym', place: "Laverre City Gym", gymType: 'Fairy', party: "mrmime:39|mawile:38|sylveon:42", cite: "#gym-6 Valerie" },
  { id: 'xy/olympia-1', game: 'xy', gen: 6, trainer: { name: "Olympia", class: "Leader", sprite: 'olympia' }, role: 'gym', place: "Anistar City Gym", gymType: 'Psychic', party: "sigilyph:44|slowking:45|meowstic:48", cite: "#gym-7 Olympia" },
  { id: 'xy/wulfric-1', game: 'xy', gen: 6, trainer: { name: "Wulfric", class: "Leader", sprite: 'wulfric' }, role: 'gym', place: "Snowbelle City Gym", gymType: 'Ice', party: "abomasnow:56|avalugg:59|cryogonal:55", cite: "#gym-8 Wulfric" },
  { id: 'xy/wikstrom-1', game: 'xy', gen: 6, trainer: { name: "Wikstrom", class: "Elite Four", sprite: 'wikstrom' }, role: 'elite', place: "Pokemon League", party: "klefki:63|probopass:63|aegislash:65|scizor:63", cite: "#elite4-1 Wikstrom" },
  { id: 'xy/malva-1', game: 'xy', gen: 6, trainer: { name: "Malva", class: "Elite Four", sprite: 'malva' }, role: 'elite', place: "Pokemon League", party: "pyroar:63|talonflame:65|torkoal:63|chandelure:63", cite: "#elite4-2 Malva" },
  { id: 'xy/drasna-1', game: 'xy', gen: 6, trainer: { name: "Drasna", class: "Elite Four", sprite: 'drasna' }, role: 'elite', place: "Pokemon League", party: "dragalge:63|altaria:63|noivern:65|druddigon:63", cite: "#elite4-3 Drasna" },
  { id: 'xy/siebold-1', game: 'xy', gen: 6, trainer: { name: "Siebold", class: "Elite Four", sprite: 'siebold' }, role: 'elite', place: "Pokemon League", party: "clawitzer:63|starmie:63|gyarados:63|barbaracle:65", cite: "#elite4-4 Siebold" },
  { id: 'xy/diantha-1', game: 'xy', gen: 6, trainer: { name: "Diantha", class: "Champion", sprite: 'diantha' }, role: 'champion', place: "Pokemon League", party: "hawlucha:64|aurorus:65|tyrantrum:65|goodra:66|gourgeist:65|gardevoir:68", cite: "#champion-1 Diantha" },
];
