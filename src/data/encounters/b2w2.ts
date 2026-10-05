/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Black 2 and White 2: 20 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const B2W2_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['black-white-2/gymleaders-elitefour'],
};

export const B2W2_ROWS: readonly EncounterRow[] = [
  { id: 'b2w2/cheren-1', game: 'b2w2', gen: 5, trainer: { name: "Cheren", class: "Leader", sprite: 'cheren-gen5bw2' }, role: 'gym', place: "Aspertia City Gym", gymType: 'Normal', party: "patrat:11|lillipup:13", cite: "#gym-1 Cheren" },
  { id: 'b2w2/roxie-1', game: 'b2w2', gen: 5, trainer: { name: "Roxie", class: "Leader", sprite: 'roxie' }, role: 'gym', place: "Virbank City Gym", gymType: 'Poison', party: "koffing:16|whirlipede:18", cite: "#gym-2 Roxie" },
  { id: 'b2w2/burgh-1', game: 'b2w2', gen: 5, trainer: { name: "Burgh", class: "Leader", sprite: 'burgh' }, role: 'gym', place: "Castelia City Gym", gymType: 'Bug', party: "swadloon:22|dwebble:22|leavanny:24", cite: "#gym-3 Burgh" },
  { id: 'b2w2/elesa-1', game: 'b2w2', gen: 5, trainer: { name: "Elesa", class: "Leader", sprite: 'elesa-gen5bw2' }, role: 'gym', place: "Nimbasa City Gym", gymType: 'Electric', party: "emolga:28|flaaffy:28|zebstrika:30", cite: "#gym-4 Elesa" },
  { id: 'b2w2/clay-1', game: 'b2w2', gen: 5, trainer: { name: "Clay", class: "Leader", sprite: 'clay' }, role: 'gym', place: "Driftveil City Gym", gymType: 'Ground', party: "krokorok:31|sandslash:31|excadrill:33", cite: "#gym-5 Clay" },
  { id: 'b2w2/skyla-1', game: 'b2w2', gen: 5, trainer: { name: "Skyla", class: "Leader", sprite: 'skyla' }, role: 'gym', place: "Mistralton City Gym", gymType: 'Flying', party: "swoobat:37|skarmory:37|swanna:39", cite: "#gym-6 Skyla" },
  { id: 'b2w2/drayden-1', game: 'b2w2', gen: 5, trainer: { name: "Drayden", class: "Leader", sprite: 'drayden' }, role: 'gym', place: "Opelucid City Gym", gymType: 'Dragon', party: "druddigon:46|flygon:46|haxorus:48", cite: "#gym-7 Drayden" },
  { id: 'b2w2/marlon-1', game: 'b2w2', gen: 5, trainer: { name: "Marlon", class: "Leader", sprite: 'marlon' }, role: 'gym', place: "Humilau City Gym", gymType: 'Water', party: "carracosta:49|wailord:49|jellicent:51", cite: "#gym-8 Marlon" },
  { id: 'b2w2/shauntal-1', game: 'b2w2', gen: 5, trainer: { name: "Shauntal", class: "Elite Four", sprite: 'shauntal' }, role: 'elite', place: "Pokemon League", party: "cofagrigus:56|drifblim:56|golurk:56|chandelure:58", cite: "#elite4-1 Shauntal" },
  { id: 'b2w2/shauntal-2', game: 'b2w2', gen: 5, trainer: { name: "Shauntal", class: "Elite Four", sprite: 'shauntal' }, role: 'elite', place: "Pokemon League", party: "cofagrigus:72|mismagius:72|froslass:72|drifblim:72|golurk:72|chandelure:74", cite: "#elite4-1 Shauntal - rematch" },
  { id: 'b2w2/grimsley-1', game: 'b2w2', gen: 5, trainer: { name: "Grimsley", class: "Elite Four", sprite: 'grimsley' }, role: 'elite', place: "Pokemon League", party: "liepard:56|scrafty:56|krookodile:56|bisharp:58", cite: "#elite4-2 Grimsley" },
  { id: 'b2w2/grimsley-2', game: 'b2w2', gen: 5, trainer: { name: "Grimsley", class: "Elite Four", sprite: 'grimsley' }, role: 'elite', place: "Pokemon League", party: "liepard:72|houndoom:72|scrafty:72|honchkrow:72|krookodile:72|bisharp:74", cite: "#elite4-2 Grimsley - rematch" },
  { id: 'b2w2/caitlin-1', game: 'b2w2', gen: 5, trainer: { name: "Caitlin", class: "Elite Four", sprite: 'caitlin' }, role: 'elite', place: "Pokemon League", party: "musharna:56|sigilyph:56|reuniclus:56|gothitelle:58", cite: "#elite4-3 Caitlin" },
  { id: 'b2w2/caitlin-2', game: 'b2w2', gen: 5, trainer: { name: "Caitlin", class: "Elite Four", sprite: 'caitlin' }, role: 'elite', place: "Pokemon League", party: "musharna:72|sigilyph:72|reuniclus:72|gothitelle:72|gallade:72|metagross:74", cite: "#elite4-3 Caitlin - rematch" },
  { id: 'b2w2/marshal-1', game: 'b2w2', gen: 5, trainer: { name: "Marshal", class: "Elite Four", sprite: 'marshal' }, role: 'elite', place: "Pokemon League", party: "throh:56|sawk:56|mienshao:56|conkeldurr:58", cite: "#elite4-4 Marshal" },
  { id: 'b2w2/marshal-2', game: 'b2w2', gen: 5, trainer: { name: "Marshal", class: "Elite Four", sprite: 'marshal' }, role: 'elite', place: "Pokemon League", party: "throh:72|sawk:72|mienshao:72|medicham:72|lucario:72|conkeldurr:74", cite: "#elite4-4 Marshal - rematch" },
  { id: 'b2w2/iris-1', game: 'b2w2', gen: 5, trainer: { name: "Iris", class: "Champion", sprite: 'iris-gen5bw2' }, role: 'champion', place: "Pokemon League", party: "hydreigon:57|druddigon:57|aggron:57|archeops:57|lapras:57|haxorus:59", cite: "#champion-1 Iris" },
  { id: 'b2w2/iris-2', game: 'b2w2', gen: 5, trainer: { name: "Iris", class: "Champion", sprite: 'iris-gen5bw2' }, role: 'champion', place: "Pokemon League", party: "hydreigon:76|druddigon:76|aggron:76|archeops:76|lapras:76|haxorus:78", cite: "#champion-1 Iris - rematch" },
  { id: 'b2w2/colress-1', game: 'b2w2', gen: 5, trainer: { name: "Colress", class: "Team Plasma", sprite: 'colress' }, role: 'boss', place: "Unova", party: "magneton:50|magnezone:50|metang:50|beheeyem:50|klinklang:50", cite: "#trainers-misc Team Plasma Colress" },
  { id: 'b2w2/ghetsis-1', game: 'b2w2', gen: 5, trainer: { name: "Ghetsis", class: "Team Plasma", sprite: 'ghetsis' }, role: 'boss', place: "Unova", party: "cofagrigus:50|eelektross:50|drapion:50|toxicroak:50|seismitoad:50|hydreigon:52", cite: "#trainers-misc Team Plasma Ghetsis" },
];
