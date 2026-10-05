/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Black and White: 23 encounters. A row's `cite` is its label
 * inside the files named below.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRecord, EncounterSource } from './types';

export const BW_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['black-white/gymleaders-elitefour'],
};

export const BW_ENCOUNTERS: readonly EncounterRecord[] = [
  { id: 'bw/cilan-1', game: 'bw', gen: 5, trainer: { name: "Cilan", class: "Leader", sprite: 'cilan' }, role: 'gym', place: "Striaton City Gym", gymType: 'Grass', party: [{ species: 'lillipup', level: 12 }, { species: 'pansage', level: 14 }], cite: "#gym-1 Cilan" },
  { id: 'bw/chili-1', game: 'bw', gen: 5, trainer: { name: "Chili", class: "Leader", sprite: 'chili' }, role: 'gym', place: "Striaton City Gym", gymType: 'Fire', party: [{ species: 'lillipup', level: 12 }, { species: 'pansear', level: 14 }], cite: "#gym-1 Chili" },
  { id: 'bw/cress-1', game: 'bw', gen: 5, trainer: { name: "Cress", class: "Leader", sprite: 'cress' }, role: 'gym', place: "Striaton City Gym", gymType: 'Water', party: [{ species: 'lillipup', level: 12 }, { species: 'panpour', level: 14 }], cite: "#gym-1 Cress" },
  { id: 'bw/lenora-1', game: 'bw', gen: 5, trainer: { name: "Lenora", class: "Leader", sprite: 'lenora' }, role: 'gym', place: "Nacrene City Gym", gymType: 'Normal', party: [{ species: 'herdier', level: 18 }, { species: 'watchog', level: 20 }], cite: "#gym-2 Lenora" },
  { id: 'bw/burgh-1', game: 'bw', gen: 5, trainer: { name: "Burgh", class: "Leader", sprite: 'burgh' }, role: 'gym', place: "Castelia City Gym", gymType: 'Bug', party: [{ species: 'whirlipede', level: 21 }, { species: 'dwebble', level: 21 }, { species: 'leavanny', level: 23 }], cite: "#gym-3 Burgh" },
  { id: 'bw/elesa-1', game: 'bw', gen: 5, trainer: { name: "Elesa", class: "Leader", sprite: 'elesa' }, role: 'gym', place: "Nimbasa City Gym", gymType: 'Electric', party: [{ species: 'emolga', level: 25 }, { species: 'emolga', level: 25 }, { species: 'zebstrika', level: 27 }], cite: "#gym-4 Elesa" },
  { id: 'bw/clay-1', game: 'bw', gen: 5, trainer: { name: "Clay", class: "Leader", sprite: 'clay' }, role: 'gym', place: "Driftveil City Gym", gymType: 'Ground', party: [{ species: 'krokorok', level: 29 }, { species: 'palpitoad', level: 29 }, { species: 'excadrill', level: 31 }], cite: "#gym-5 Clay" },
  { id: 'bw/skyla-1', game: 'bw', gen: 5, trainer: { name: "Skyla", class: "Leader", sprite: 'skyla' }, role: 'gym', place: "Mistralton City Gym", gymType: 'Flying', party: [{ species: 'swoobat', level: 33 }, { species: 'unfezant', level: 33 }, { species: 'swanna', level: 35 }], cite: "#gym-6 Skyla" },
  { id: 'bw/brycen-1', game: 'bw', gen: 5, trainer: { name: "Brycen", class: "Leader", sprite: 'brycen' }, role: 'gym', place: "Icirrus City Gym", gymType: 'Ice', party: [{ species: 'vanillish', level: 37 }, { species: 'cryogonal', level: 37 }, { species: 'beartic', level: 39 }], cite: "#gym-7 Brycen" },
  { id: 'bw/drayden-1', game: 'bw', gen: 5, trainer: { name: "Drayden", class: "Leader", sprite: 'drayden' }, role: 'gym', place: "Opelucid City Gym", gymType: 'Dragon', party: [{ species: 'fraxure', level: 41 }, { species: 'druddigon', level: 41 }, { species: 'haxorus', level: 43 }], cite: "#gym-8 Drayden" },
  { id: 'bw/iris-1', game: 'bw', gen: 5, trainer: { name: "Iris", class: "Leader", sprite: 'iris' }, role: 'gym', place: "Opelucid City Gym", gymType: 'Dragon', party: [{ species: 'fraxure', level: 41 }, { species: 'druddigon', level: 41 }, { species: 'haxorus', level: 43 }], cite: "#gym-8 Iris" },
  { id: 'bw/shauntal-1', game: 'bw', gen: 5, trainer: { name: "Shauntal", class: "Elite Four", sprite: 'shauntal' }, role: 'elite', place: "Pokemon League", party: [{ species: 'cofagrigus', level: 48 }, { species: 'jellicent', level: 48 }, { species: 'golurk', level: 48 }, { species: 'chandelure', level: 50 }], cite: "#elite4-1 Shauntal" },
  { id: 'bw/shauntal-2', game: 'bw', gen: 5, trainer: { name: "Shauntal", class: "Elite Four", sprite: 'shauntal' }, role: 'elite', place: "Pokemon League", party: [{ species: 'cofagrigus', level: 71 }, { species: 'jellicent', level: 71 }, { species: 'froslass', level: 71 }, { species: 'drifblim', level: 71 }, { species: 'golurk', level: 71 }, { species: 'chandelure', level: 73 }], cite: "#elite4-1 Shauntal - rematch" },
  { id: 'bw/grimsley-1', game: 'bw', gen: 5, trainer: { name: "Grimsley", class: "Elite Four", sprite: 'grimsley' }, role: 'elite', place: "Pokemon League", party: [{ species: 'scrafty', level: 48 }, { species: 'liepard', level: 48 }, { species: 'krookodile', level: 48 }, { species: 'bisharp', level: 50 }], cite: "#elite4-2 Grimsley" },
  { id: 'bw/grimsley-2', game: 'bw', gen: 5, trainer: { name: "Grimsley", class: "Elite Four", sprite: 'grimsley' }, role: 'elite', place: "Pokemon League", party: [{ species: 'sharpedo', level: 71 }, { species: 'liepard', level: 71 }, { species: 'scrafty', level: 71 }, { species: 'drapion', level: 71 }, { species: 'krookodile', level: 71 }, { species: 'bisharp', level: 73 }], cite: "#elite4-2 Grimsley - rematch" },
  { id: 'bw/caitlin-1', game: 'bw', gen: 5, trainer: { name: "Caitlin", class: "Elite Four", sprite: 'caitlin' }, role: 'elite', place: "Pokemon League", party: [{ species: 'reuniclus', level: 48 }, { species: 'musharna', level: 48 }, { species: 'sigilyph', level: 48 }, { species: 'gothitelle', level: 50 }], cite: "#elite4-3 Caitlin" },
  { id: 'bw/caitlin-2', game: 'bw', gen: 5, trainer: { name: "Caitlin", class: "Elite Four", sprite: 'caitlin' }, role: 'elite', place: "Pokemon League", party: [{ species: 'musharna', level: 71 }, { species: 'sigilyph', level: 71 }, { species: 'bronzong', level: 71 }, { species: 'reuniclus', level: 71 }, { species: 'gothitelle', level: 71 }, { species: 'metagross', level: 73 }], cite: "#elite4-3 Caitlin - rematch" },
  { id: 'bw/marshal-1', game: 'bw', gen: 5, trainer: { name: "Marshal", class: "Elite Four", sprite: 'marshal' }, role: 'elite', place: "Pokemon League", party: [{ species: 'throh', level: 48 }, { species: 'sawk', level: 48 }, { species: 'conkeldurr', level: 48 }, { species: 'mienshao', level: 50 }], cite: "#elite4-4 Marshal" },
  { id: 'bw/marshal-2', game: 'bw', gen: 5, trainer: { name: "Marshal", class: "Elite Four", sprite: 'marshal' }, role: 'elite', place: "Pokemon League", party: [{ species: 'breloom', level: 71 }, { species: 'throh', level: 71 }, { species: 'sawk', level: 71 }, { species: 'toxicroak', level: 71 }, { species: 'mienshao', level: 71 }, { species: 'conkeldurr', level: 73 }], cite: "#elite4-4 Marshal - rematch" },
  { id: 'bw/alder-1', game: 'bw', gen: 5, trainer: { name: "Alder", class: "Champion", sprite: 'alder' }, role: 'champion', place: "Pokemon League", party: [{ species: 'accelgor', level: 75 }, { species: 'bouffalant', level: 75 }, { species: 'druddigon', level: 75 }, { species: 'vanilluxe', level: 75 }, { species: 'escavalier', level: 75 }, { species: 'volcarona', level: 77 }], cite: "#champion-5 Alder" },
  { id: 'bw/n-1', game: 'bw', gen: 5, trainer: { name: "N", class: "Team Plasma", sprite: 'n' }, role: 'boss', place: "N's Castle", party: [{ species: 'zekrom', level: 52 }, { species: 'carracosta', level: 50 }, { species: 'vanilluxe', level: 50 }, { species: 'archeops', level: 50 }, { species: 'zoroark', level: 50 }, { species: 'klinklang', level: 50 }], cite: "#trainers-misc Team Plasma N" },
  { id: 'bw/n-2', game: 'bw', gen: 5, trainer: { name: "N", class: "Team Plasma", sprite: 'n' }, role: 'boss', place: "N's Castle", party: [{ species: 'reshiram', level: 52 }, { species: 'carracosta', level: 50 }, { species: 'vanilluxe', level: 50 }, { species: 'archeops', level: 50 }, { species: 'zoroark', level: 50 }, { species: 'klinklang', level: 50 }], cite: "#trainers-misc Team Plasma N" },
  { id: 'bw/ghetsis-1', game: 'bw', gen: 5, trainer: { name: "Ghetsis", class: "Team Plasma", sprite: 'ghetsis-gen5bw' }, role: 'boss', place: "N's Castle", party: [{ species: 'cofagrigus', level: 52 }, { species: 'bouffalant', level: 52 }, { species: 'seismitoad', level: 52 }, { species: 'bisharp', level: 52 }, { species: 'eelektross', level: 52 }, { species: 'hydreigon', level: 54 }], cite: "#trainers-misc Team Plasma Ghetsis" },
];
