/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Sword and Shield: 20 encounters. A row's `cite` is its label
 * inside the files named below.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRecord, EncounterSource } from './types';

export const SWSH_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['sword-shield/gymleaders'],
};

export const SWSH_ENCOUNTERS: readonly EncounterRecord[] = [
  { id: 'swsh/milo-1', game: 'swsh', gen: 8, trainer: { name: "Milo", class: "Leader", sprite: 'milo' }, role: 'gym', place: "Turffield Gym", gymType: 'Grass', party: [{ species: 'gossifleur', level: 19 }, { species: 'eldegoss', level: 20 }], cite: "#gym-1 Milo" },
  { id: 'swsh/milo-2', game: 'swsh', gen: 8, trainer: { name: "Milo", class: "Leader", sprite: 'milo' }, role: 'gym', place: "Turffield Gym", gymType: 'Grass', party: [{ species: 'shiftry', level: 60 }, { species: 'eldegoss', level: 60 }, { species: 'bellossom', level: 61 }, { species: 'cherrim', level: 61 }, { species: 'flapple', level: 62 }], cite: "#gym-1 Milo - rematch" },
  { id: 'swsh/nessa-1', game: 'swsh', gen: 8, trainer: { name: "Nessa", class: "Leader", sprite: 'nessa' }, role: 'gym', place: "Hulbury Gym", gymType: 'Water', party: [{ species: 'goldeen', level: 22 }, { species: 'arrokuda', level: 23 }, { species: 'drednaw', level: 24 }], cite: "#gym-2 Nessa" },
  { id: 'swsh/nessa-2', game: 'swsh', gen: 8, trainer: { name: "Nessa", class: "Leader", sprite: 'nessa' }, role: 'gym', place: "Hulbury Gym", gymType: 'Water', party: [{ species: 'golisopod', level: 60 }, { species: 'pelipper', level: 60 }, { species: 'quagsire', level: 61 }, { species: 'toxapex', level: 61 }, { species: 'drednaw', level: 62 }], cite: "#gym-2 Nessa - rematch" },
  { id: 'swsh/kabu-1', game: 'swsh', gen: 8, trainer: { name: "Kabu", class: "Leader", sprite: 'kabu' }, role: 'gym', place: "Motostoke Gym", gymType: 'Fire', party: [{ species: 'ninetales', level: 25 }, { species: 'arcanine', level: 25 }, { species: 'centiskorch', level: 27 }], cite: "#gym-3 Kabu" },
  { id: 'swsh/kabu-2', game: 'swsh', gen: 8, trainer: { name: "Kabu", class: "Leader", sprite: 'kabu' }, role: 'gym', place: "Motostoke Gym", gymType: 'Fire', party: [{ species: 'torkoal', level: 60 }, { species: 'ninetales', level: 60 }, { species: 'arcanine', level: 61 }, { species: 'salazzle', level: 61 }, { species: 'centiskorch', level: 62 }], cite: "#gym-3 Kabu - rematch" },
  { id: 'swsh/bea-1', game: 'swsh', gen: 8, trainer: { name: "Bea", class: "Leader", sprite: 'bea' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Fighting', party: [{ species: 'hitmontop', level: 34 }, { species: 'pangoro', level: 34 }, { species: 'sirfetchd', level: 35 }, { species: 'machamp', level: 36 }], cite: "#gym-4 Bea" },
  { id: 'swsh/bea-2', game: 'swsh', gen: 8, trainer: { name: "Bea", class: "Leader", sprite: 'bea' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Fighting', party: [{ species: 'hawlucha', level: 60 }, { species: 'grapploct', level: 60 }, { species: 'sirfetchd', level: 61 }, { species: 'falinks', level: 61 }, { species: 'machamp', level: 62 }], cite: "#gym-4 Bea - rematch" },
  { id: 'swsh/allister-1', game: 'swsh', gen: 8, trainer: { name: "Allister", class: "Leader", sprite: 'allister' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Ghost', party: [{ species: 'yamaskgalar', level: 34 }, { species: 'mimikyu', level: 34 }, { species: 'cursola', level: 35 }, { species: 'gengar', level: 36 }], cite: "#gym-4 Allister" },
  { id: 'swsh/allister-2', game: 'swsh', gen: 8, trainer: { name: "Allister", class: "Leader", sprite: 'allister' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Ghost', party: [{ species: 'dusknoir', level: 60 }, { species: 'chandelure', level: 60 }, { species: 'cursola', level: 61 }, { species: 'runerigus', level: 61 }, { species: 'gengar', level: 62 }], cite: "#gym-4 Allister - rematch" },
  { id: 'swsh/opal-1', game: 'swsh', gen: 8, trainer: { name: "Opal", class: "Leader", sprite: 'opal' }, role: 'gym', place: "Ballonlea Gym", gymType: 'Fairy', party: [{ species: 'weezinggalar', level: 36 }, { species: 'mawile', level: 36 }, { species: 'togekiss', level: 37 }, { species: 'alcremie', level: 38 }], cite: "#gym-5 Opal" },
  { id: 'swsh/gordie-1', game: 'swsh', gen: 8, trainer: { name: "Gordie", class: "Leader", sprite: 'gordie' }, role: 'gym', place: "Circhester Gym", gymType: 'Rock', party: [{ species: 'barbaracle', level: 40 }, { species: 'shuckle', level: 40 }, { species: 'stonjourner', level: 41 }, { species: 'coalossal', level: 42 }], cite: "#gym-6 Gordie" },
  { id: 'swsh/gordie-2', game: 'swsh', gen: 8, trainer: { name: "Gordie", class: "Leader", sprite: 'gordie' }, role: 'gym', place: "Circhester Gym", gymType: 'Rock', party: [{ species: 'barbaracle', level: 60 }, { species: 'shuckle', level: 60 }, { species: 'stonjourner', level: 61 }, { species: 'tyranitar', level: 61 }, { species: 'coalossal', level: 62 }], cite: "#gym-6 Gordie - rematch" },
  { id: 'swsh/melony-1', game: 'swsh', gen: 8, trainer: { name: "Melony", class: "Leader", sprite: 'melony' }, role: 'gym', place: "Circhester Gym", gymType: 'Ice', party: [{ species: 'frosmoth', level: 40 }, { species: 'darmanitangalar', level: 40 }, { species: 'eiscue', level: 41 }, { species: 'lapras', level: 42 }], cite: "#gym-6 Melony" },
  { id: 'swsh/melony-2', game: 'swsh', gen: 8, trainer: { name: "Melony", class: "Leader", sprite: 'melony' }, role: 'gym', place: "Circhester Gym", gymType: 'Ice', party: [{ species: 'frosmoth', level: 60 }, { species: 'mrrime', level: 60 }, { species: 'eiscue', level: 61 }, { species: 'darmanitangalar', level: 61 }, { species: 'lapras', level: 62 }], cite: "#gym-6 Melony - rematch" },
  { id: 'swsh/piers-1', game: 'swsh', gen: 8, trainer: { name: "Piers", class: "Leader", sprite: 'piers' }, role: 'gym', place: "Spikemuth Gym", gymType: 'Dark', party: [{ species: 'scrafty', level: 44 }, { species: 'malamar', level: 45 }, { species: 'skuntank', level: 45 }, { species: 'obstagoon', level: 46 }], cite: "#gym-7 Piers" },
  { id: 'swsh/raihan-1', game: 'swsh', gen: 8, trainer: { name: "Raihan", class: "Leader", sprite: 'raihan' }, role: 'gym', place: "Hammerlocke Gym", gymType: 'Dragon', party: [{ species: 'gigalith', level: 46 }, { species: 'flygon', level: 47 }, { species: 'sandaconda', level: 46 }, { species: 'duraludon', level: 48 }], cite: "#gym-8 Raihan" },
  { id: 'swsh/raihan-2', game: 'swsh', gen: 8, trainer: { name: "Raihan", class: "Leader", sprite: 'raihan' }, role: 'gym', place: "Hammerlocke Gym", gymType: 'Dragon', party: [{ species: 'torkoal', level: 60 }, { species: 'goodra', level: 60 }, { species: 'turtonator', level: 61 }, { species: 'flygon', level: 61 }, { species: 'duraludon', level: 62 }], cite: "#gym-8 Raihan - rematch" },
  { id: 'swsh/bede-1', game: 'swsh', gen: 8, trainer: { name: "Bede", class: "Rival", sprite: 'bede' }, role: 'rival', place: "Fairy type Pokémon", party: [{ species: 'mawile', level: 51 }, { species: 'gardevoir', level: 51 }, { species: 'rapidashgalar', level: 52 }, { species: 'hatterene', level: 53 }], cite: "#trainers-misc Bede" },
  { id: 'swsh/bede-2', game: 'swsh', gen: 8, trainer: { name: "Bede", class: "Rival", sprite: 'bede' }, role: 'rival', place: "Fairy type Pokémon", party: [{ species: 'mawile', level: 61 }, { species: 'gardevoir', level: 61 }, { species: 'rapidashgalar', level: 62 }, { species: 'sylveon', level: 62 }, { species: 'hatterene', level: 63 }], cite: "#trainers-misc Bede - rematch" },
];
