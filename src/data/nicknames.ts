/**
 * The names a run gives the Pokemon that pass through it. **Stage 4.8, item 5.**
 *
 * ## Why a Pokemon needs a name at all
 *
 * The graveyard is the reason, and it is a correctness reason rather than a
 * flavour one. A death record identifies its victim by the name the battle
 * protocol used, which is `spec.nickname ?? spec.species` — so before this table
 * existed, **two Weepinbells in one party were the same string in every line of
 * the log** (`core/battle/contribution.ts` says so directly). A graveyard that
 * cannot tell them apart is not a record, and no amount of work on the death entry
 * fixes it: the ambiguity is upstream, in the protocol.
 *
 * So nicknames are not decoration on the tombstone. They are what makes the
 * tombstone well-defined.
 *
 * ## Player-typed names are deliberately absent
 *
 * A typed name would be a logged decision — a run log bump and a text input in a
 * mobile flow, for a feature whose whole job is to make a death legible. A derived
 * name costs one new RNG key and no schema change.
 *
 * ## Why these words
 *
 * Short, concrete, and readable beside a species and a level: "Bramble,
 * Weepinbell, Lv31" has to parse at a glance on a phone. They carry no species or
 * type association on purpose — a name that sounded like a Fire type would read as
 * a claim about the Pokemon, and the run assigns these before the player has seen
 * what they got. Nothing here is a verdict, a rank, or a joke that ages.
 *
 * Length is a balance-ish number of its own: with this many names a full run of
 * eight captures plus a starter very rarely repeats, and a repeat is harmless
 * anyway because the species and level sit beside it.
 */

/**
 * The pool, in a fixed order.
 *
 * **Order is part of the seed contract.** A nickname is drawn by index from this
 * array, so inserting a name in the middle renames every Pokemon in every recorded
 * run. Append; never insert, never sort, never dedupe in place.
 */
export const NICKNAMES: readonly string[] = [
  'Bramble', 'Cinder', 'Pebble', 'Willow', 'Scamp', 'Thistle', 'Mottle', 'Quill',
  'Brook', 'Flint', 'Nettle', 'Juniper', 'Dapple', 'Rook', 'Tansy', 'Ember',
  'Hollow', 'Sorrel', 'Bracken', 'Marl', 'Vesper', 'Fennel', 'Gorse', 'Ripple',
  'Cobble', 'Heather', 'Aster', 'Birch', 'Clover', 'Drizzle', 'Fallow', 'Gale',
  'Hazel', 'Ivy', 'Jasper', 'Kestrel', 'Lichen', 'Moss', 'Nimbus', 'Onyx',
  'Parsley', 'Quince', 'Rowan', 'Slate', 'Teasel', 'Umber', 'Verbena', 'Wicket',
  'Yarrow', 'Zephyr', 'Acorn', 'Bristle', 'Cedar', 'Dusk', 'Elder', 'Furrow',
  'Grist', 'Husk', 'Inkcap', 'Jute', 'Kindle', 'Loam', 'Mire', 'Nutmeg',
];
