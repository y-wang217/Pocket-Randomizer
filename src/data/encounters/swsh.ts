/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net, serebii.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Sword and Shield: 32 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const SWSH_SOURCE: EncounterSource = {
  repo: 'pokemondb.net, serebii.net',
  sha: '2026-10-05',
  files: ['sword-shield/gymleaders', 'swordshield/championcup.shtml'],
};

export const SWSH_ROWS: readonly EncounterRow[] = [
  { id: 'swsh/milo-1', game: 'swsh', gen: 8, trainer: { name: "Milo", class: "Leader", sprite: 'milo' }, role: 'gym', place: "Turffield Gym", gymType: 'Grass', party: "gossifleur:19|eldegoss:20", cite: "#gym-1 Milo" },
  { id: 'swsh/milo-2', game: 'swsh', gen: 8, trainer: { name: "Milo", class: "Leader", sprite: 'milo' }, role: 'gym', place: "Turffield Gym", gymType: 'Grass', party: "shiftry:60|eldegoss:60|bellossom:61|cherrim:61|flapple:62", cite: "#gym-1 Milo - rematch" },
  { id: 'swsh/nessa-1', game: 'swsh', gen: 8, trainer: { name: "Nessa", class: "Leader", sprite: 'nessa' }, role: 'gym', place: "Hulbury Gym", gymType: 'Water', party: "goldeen:22|arrokuda:23|drednaw:24", cite: "#gym-2 Nessa" },
  { id: 'swsh/nessa-2', game: 'swsh', gen: 8, trainer: { name: "Nessa", class: "Leader", sprite: 'nessa' }, role: 'gym', place: "Hulbury Gym", gymType: 'Water', party: "golisopod:60|pelipper:60|quagsire:61|toxapex:61|drednaw:62", cite: "#gym-2 Nessa - rematch" },
  { id: 'swsh/kabu-1', game: 'swsh', gen: 8, trainer: { name: "Kabu", class: "Leader", sprite: 'kabu' }, role: 'gym', place: "Motostoke Gym", gymType: 'Fire', party: "ninetales:25|arcanine:25|centiskorch:27", cite: "#gym-3 Kabu" },
  { id: 'swsh/kabu-2', game: 'swsh', gen: 8, trainer: { name: "Kabu", class: "Leader", sprite: 'kabu' }, role: 'gym', place: "Motostoke Gym", gymType: 'Fire', party: "torkoal:60|ninetales:60|arcanine:61|salazzle:61|centiskorch:62", cite: "#gym-3 Kabu - rematch" },
  { id: 'swsh/bea-1', game: 'swsh', gen: 8, trainer: { name: "Bea", class: "Leader", sprite: 'bea' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Fighting', party: "hitmontop:34|pangoro:34|sirfetchd:35|machamp:36", cite: "#gym-4 Bea" },
  { id: 'swsh/bea-2', game: 'swsh', gen: 8, trainer: { name: "Bea", class: "Leader", sprite: 'bea' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Fighting', party: "hawlucha:60|grapploct:60|sirfetchd:61|falinks:61|machamp:62", cite: "#gym-4 Bea - rematch" },
  { id: 'swsh/allister-1', game: 'swsh', gen: 8, trainer: { name: "Allister", class: "Leader", sprite: 'allister' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Ghost', party: "yamaskgalar:34|mimikyu:34|cursola:35|gengar:36", cite: "#gym-4 Allister" },
  { id: 'swsh/allister-2', game: 'swsh', gen: 8, trainer: { name: "Allister", class: "Leader", sprite: 'allister' }, role: 'gym', place: "Stow-on-Side Gym", gymType: 'Ghost', party: "dusknoir:60|chandelure:60|cursola:61|runerigus:61|gengar:62", cite: "#gym-4 Allister - rematch" },
  { id: 'swsh/opal-1', game: 'swsh', gen: 8, trainer: { name: "Opal", class: "Leader", sprite: 'opal' }, role: 'gym', place: "Ballonlea Gym", gymType: 'Fairy', party: "weezinggalar:36|mawile:36|togekiss:37|alcremie:38", cite: "#gym-5 Opal" },
  { id: 'swsh/gordie-1', game: 'swsh', gen: 8, trainer: { name: "Gordie", class: "Leader", sprite: 'gordie' }, role: 'gym', place: "Circhester Gym", gymType: 'Rock', party: "barbaracle:40|shuckle:40|stonjourner:41|coalossal:42", cite: "#gym-6 Gordie" },
  { id: 'swsh/gordie-2', game: 'swsh', gen: 8, trainer: { name: "Gordie", class: "Leader", sprite: 'gordie' }, role: 'gym', place: "Circhester Gym", gymType: 'Rock', party: "barbaracle:60|shuckle:60|stonjourner:61|tyranitar:61|coalossal:62", cite: "#gym-6 Gordie - rematch" },
  { id: 'swsh/melony-1', game: 'swsh', gen: 8, trainer: { name: "Melony", class: "Leader", sprite: 'melony' }, role: 'gym', place: "Circhester Gym", gymType: 'Ice', party: "frosmoth:40|darmanitangalar:40|eiscue:41|lapras:42", cite: "#gym-6 Melony" },
  { id: 'swsh/melony-2', game: 'swsh', gen: 8, trainer: { name: "Melony", class: "Leader", sprite: 'melony' }, role: 'gym', place: "Circhester Gym", gymType: 'Ice', party: "frosmoth:60|mrrime:60|eiscue:61|darmanitangalar:61|lapras:62", cite: "#gym-6 Melony - rematch" },
  { id: 'swsh/piers-1', game: 'swsh', gen: 8, trainer: { name: "Piers", class: "Leader", sprite: 'piers' }, role: 'gym', place: "Spikemuth Gym", gymType: 'Dark', party: "scrafty:44|malamar:45|skuntank:45|obstagoon:46", cite: "#gym-7 Piers" },
  { id: 'swsh/raihan-1', game: 'swsh', gen: 8, trainer: { name: "Raihan", class: "Leader", sprite: 'raihan' }, role: 'gym', place: "Hammerlocke Gym", gymType: 'Dragon', party: "gigalith:46|flygon:47|sandaconda:46|duraludon:48", cite: "#gym-8 Raihan" },
  { id: 'swsh/raihan-2', game: 'swsh', gen: 8, trainer: { name: "Raihan", class: "Leader", sprite: 'raihan' }, role: 'gym', place: "Hammerlocke Gym", gymType: 'Dragon', party: "torkoal:60|goodra:60|turtonator:61|flygon:61|duraludon:62", cite: "#gym-8 Raihan - rematch" },
  { id: 'swsh/bede-1', game: 'swsh', gen: 8, trainer: { name: "Bede", class: "Rival", sprite: 'bede' }, role: 'rival', place: "Galar", party: "mawile:51|gardevoir:51|rapidashgalar:52|hatterene:53", cite: "#trainers-misc Bede" },
  { id: 'swsh/bede-2', game: 'swsh', gen: 8, trainer: { name: "Bede", class: "Rival", sprite: 'bede' }, role: 'rival', place: "Galar", party: "mawile:61|gardevoir:61|rapidashgalar:62|sylveon:62|hatterene:63", cite: "#trainers-misc Bede - rematch" },
  { id: 'swsh/marnie-1', game: 'swsh', gen: 8, trainer: { name: "Marnie", class: "Rival", sprite: 'marnie' }, role: 'rival', place: "Wyndon Stadium", party: "liepard:47|toxicroak:47|scrafty:47|morpeko:48|grimmsnarl:49", cite: "championcup.shtml Marnie #1" },
  { id: 'swsh/hop-1', game: 'swsh', gen: 8, trainer: { name: "Hop", class: "Rival", sprite: 'hop' }, role: 'rival', place: "Wyndon Stadium", party: "dubwool:48|corviknight:48|pincurchin:47|snorlax:47|inteleon:49", cite: "championcup.shtml Hop #2" },
  { id: 'swsh/hop-2', game: 'swsh', gen: 8, trainer: { name: "Hop", class: "Rival", sprite: 'hop' }, role: 'rival', place: "Wyndon Stadium", party: "dubwool:48|corviknight:48|pincurchin:47|snorlax:47|rillaboom:49", cite: "championcup.shtml Hop #3" },
  { id: 'swsh/hop-3', game: 'swsh', gen: 8, trainer: { name: "Hop", class: "Rival", sprite: 'hop' }, role: 'rival', place: "Wyndon Stadium", party: "dubwool:48|corviknight:48|pincurchin:47|snorlax:47|cinderace:49", cite: "championcup.shtml Hop #4" },
  { id: 'swsh/bede-3', game: 'swsh', gen: 8, trainer: { name: "Bede", class: "Rival", sprite: 'bede' }, role: 'rival', place: "Wyndon Stadium", party: "mawile:51|gardevoir:51|rapidashgalar:52|hatterene:53", cite: "championcup.shtml Bede #5" },
  { id: 'swsh/nessa-3', game: 'swsh', gen: 8, trainer: { name: "Nessa", class: "Leader", sprite: 'nessa' }, role: 'gym', place: "Wyndon Stadium", gymType: 'Water', party: "golisopod:51|pelipper:51|barraskewda:52|seaking:52|drednaw:53", cite: "championcup.shtml Nessa #6" },
  { id: 'swsh/bea-3', game: 'swsh', gen: 8, trainer: { name: "Bea", class: "Leader", sprite: 'bea' }, role: 'gym', place: "Wyndon Stadium", gymType: 'Fighting', party: "hawlucha:52|grapploct:52|sirfetchd:53|falinks:53|machamp:54", cite: "championcup.shtml Bea #7" },
  { id: 'swsh/allister-3', game: 'swsh', gen: 8, trainer: { name: "Allister", class: "Leader", sprite: 'allister' }, role: 'gym', place: "Wyndon Stadium", gymType: 'Ghost', party: "dusknoir:52|chandelure:52|cursola:53|polteageist:53|gengar:54", cite: "championcup.shtml Allister #8" },
  { id: 'swsh/raihan-3', game: 'swsh', gen: 8, trainer: { name: "Raihan", class: "Leader", sprite: 'raihan' }, role: 'gym', place: "Wyndon Stadium", gymType: 'Dragon', party: "torkoal:53|goodra:54|turtonator:54|flygon:54|duraludon:55", cite: "championcup.shtml Raihan #9" },
  { id: 'swsh/leon-1', game: 'swsh', gen: 8, trainer: { name: "Leon", class: "Champion", sprite: 'leon' }, role: 'champion', place: "Wyndon Stadium", party: "aegislash:62|dragapult:62|haxorus:63|seismitoad:64|cinderace:64|charizard:65", cite: "championcup.shtml Leon #10" },
  { id: 'swsh/leon-2', game: 'swsh', gen: 8, trainer: { name: "Leon", class: "Champion", sprite: 'leon' }, role: 'champion', place: "Wyndon Stadium", party: "aegislash:62|dragapult:62|haxorus:63|mrrime:64|inteleon:64|charizard:65", cite: "championcup.shtml Leon #11" },
  { id: 'swsh/leon-3', game: 'swsh', gen: 8, trainer: { name: "Leon", class: "Champion", sprite: 'leon' }, role: 'champion', place: "Wyndon Stadium", party: "aegislash:62|dragapult:62|haxorus:63|rhyperior:64|rillaboom:64|charizard:65", cite: "championcup.shtml Leon #12" },
];
