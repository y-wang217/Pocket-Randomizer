/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Black and White: 23 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const BW_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['black-white/gymleaders-elitefour'],
};

export const BW_ROWS: readonly EncounterRow[] = [
  { id: 'bw/cilan-1', game: 'bw', gen: 5, trainer: { name: "Cilan", class: "Leader", sprite: 'cilan' }, role: 'gym', place: "Striaton City Gym", gymType: 'Grass', party: "lillipup:12|pansage:14", cite: "#gym-1 Cilan" },
  { id: 'bw/chili-1', game: 'bw', gen: 5, trainer: { name: "Chili", class: "Leader", sprite: 'chili' }, role: 'gym', place: "Striaton City Gym", gymType: 'Fire', party: "lillipup:12|pansear:14", cite: "#gym-1 Chili" },
  { id: 'bw/cress-1', game: 'bw', gen: 5, trainer: { name: "Cress", class: "Leader", sprite: 'cress' }, role: 'gym', place: "Striaton City Gym", gymType: 'Water', party: "lillipup:12|panpour:14", cite: "#gym-1 Cress" },
  { id: 'bw/lenora-1', game: 'bw', gen: 5, trainer: { name: "Lenora", class: "Leader", sprite: 'lenora' }, role: 'gym', place: "Nacrene City Gym", gymType: 'Normal', party: "herdier:18|watchog:20", cite: "#gym-2 Lenora" },
  { id: 'bw/burgh-1', game: 'bw', gen: 5, trainer: { name: "Burgh", class: "Leader", sprite: 'burgh' }, role: 'gym', place: "Castelia City Gym", gymType: 'Bug', party: "whirlipede:21|dwebble:21|leavanny:23", cite: "#gym-3 Burgh" },
  { id: 'bw/elesa-1', game: 'bw', gen: 5, trainer: { name: "Elesa", class: "Leader", sprite: 'elesa' }, role: 'gym', place: "Nimbasa City Gym", gymType: 'Electric', party: "emolga:25|emolga:25|zebstrika:27", cite: "#gym-4 Elesa" },
  { id: 'bw/clay-1', game: 'bw', gen: 5, trainer: { name: "Clay", class: "Leader", sprite: 'clay' }, role: 'gym', place: "Driftveil City Gym", gymType: 'Ground', party: "krokorok:29|palpitoad:29|excadrill:31", cite: "#gym-5 Clay" },
  { id: 'bw/skyla-1', game: 'bw', gen: 5, trainer: { name: "Skyla", class: "Leader", sprite: 'skyla' }, role: 'gym', place: "Mistralton City Gym", gymType: 'Flying', party: "swoobat:33|unfezant:33|swanna:35", cite: "#gym-6 Skyla" },
  { id: 'bw/brycen-1', game: 'bw', gen: 5, trainer: { name: "Brycen", class: "Leader", sprite: 'brycen' }, role: 'gym', place: "Icirrus City Gym", gymType: 'Ice', party: "vanillish:37|cryogonal:37|beartic:39", cite: "#gym-7 Brycen" },
  { id: 'bw/drayden-1', game: 'bw', gen: 5, trainer: { name: "Drayden", class: "Leader", sprite: 'drayden' }, role: 'gym', place: "Opelucid City Gym", gymType: 'Dragon', party: "fraxure:41|druddigon:41|haxorus:43", cite: "#gym-8 Drayden" },
  { id: 'bw/iris-1', game: 'bw', gen: 5, trainer: { name: "Iris", class: "Leader", sprite: 'iris' }, role: 'gym', place: "Opelucid City Gym", gymType: 'Dragon', party: "fraxure:41|druddigon:41|haxorus:43", cite: "#gym-8 Iris" },
  { id: 'bw/shauntal-1', game: 'bw', gen: 5, trainer: { name: "Shauntal", class: "Elite Four", sprite: 'shauntal' }, role: 'elite', place: "Pokemon League", party: "cofagrigus:48|jellicent:48|golurk:48|chandelure:50", cite: "#elite4-1 Shauntal" },
  { id: 'bw/shauntal-2', game: 'bw', gen: 5, trainer: { name: "Shauntal", class: "Elite Four", sprite: 'shauntal' }, role: 'elite', place: "Pokemon League", party: "cofagrigus:71|jellicent:71|froslass:71|drifblim:71|golurk:71|chandelure:73", cite: "#elite4-1 Shauntal - rematch" },
  { id: 'bw/grimsley-1', game: 'bw', gen: 5, trainer: { name: "Grimsley", class: "Elite Four", sprite: 'grimsley' }, role: 'elite', place: "Pokemon League", party: "scrafty:48|liepard:48|krookodile:48|bisharp:50", cite: "#elite4-2 Grimsley" },
  { id: 'bw/grimsley-2', game: 'bw', gen: 5, trainer: { name: "Grimsley", class: "Elite Four", sprite: 'grimsley' }, role: 'elite', place: "Pokemon League", party: "sharpedo:71|liepard:71|scrafty:71|drapion:71|krookodile:71|bisharp:73", cite: "#elite4-2 Grimsley - rematch" },
  { id: 'bw/caitlin-1', game: 'bw', gen: 5, trainer: { name: "Caitlin", class: "Elite Four", sprite: 'caitlin' }, role: 'elite', place: "Pokemon League", party: "reuniclus:48|musharna:48|sigilyph:48|gothitelle:50", cite: "#elite4-3 Caitlin" },
  { id: 'bw/caitlin-2', game: 'bw', gen: 5, trainer: { name: "Caitlin", class: "Elite Four", sprite: 'caitlin' }, role: 'elite', place: "Pokemon League", party: "musharna:71|sigilyph:71|bronzong:71|reuniclus:71|gothitelle:71|metagross:73", cite: "#elite4-3 Caitlin - rematch" },
  { id: 'bw/marshal-1', game: 'bw', gen: 5, trainer: { name: "Marshal", class: "Elite Four", sprite: 'marshal' }, role: 'elite', place: "Pokemon League", party: "throh:48|sawk:48|conkeldurr:48|mienshao:50", cite: "#elite4-4 Marshal" },
  { id: 'bw/marshal-2', game: 'bw', gen: 5, trainer: { name: "Marshal", class: "Elite Four", sprite: 'marshal' }, role: 'elite', place: "Pokemon League", party: "breloom:71|throh:71|sawk:71|toxicroak:71|mienshao:71|conkeldurr:73", cite: "#elite4-4 Marshal - rematch" },
  { id: 'bw/alder-1', game: 'bw', gen: 5, trainer: { name: "Alder", class: "Champion", sprite: 'alder' }, role: 'champion', place: "Pokemon League", party: "accelgor:75|bouffalant:75|druddigon:75|vanilluxe:75|escavalier:75|volcarona:77", cite: "#champion-5 Alder" },
  { id: 'bw/n-1', game: 'bw', gen: 5, trainer: { name: "N", class: "Team Plasma", sprite: 'n' }, role: 'boss', place: "N's Castle", party: "zekrom:52|carracosta:50|vanilluxe:50|archeops:50|zoroark:50|klinklang:50", cite: "#trainers-misc Team Plasma N" },
  { id: 'bw/n-2', game: 'bw', gen: 5, trainer: { name: "N", class: "Team Plasma", sprite: 'n' }, role: 'boss', place: "N's Castle", party: "reshiram:52|carracosta:50|vanilluxe:50|archeops:50|zoroark:50|klinklang:50", cite: "#trainers-misc Team Plasma N" },
  { id: 'bw/ghetsis-1', game: 'bw', gen: 5, trainer: { name: "Ghetsis", class: "Team Plasma", sprite: 'ghetsis-gen5bw' }, role: 'boss', place: "N's Castle", party: "cofagrigus:52|bouffalant:52|seismitoad:52|bisharp:52|eelektross:52|hydreigon:54", cite: "#trainers-misc Team Plasma Ghetsis" },
];
