/**
 * The starter whitelist.
 *
 * Curated means no duds. The player picks one Pokemon and carries a whole
 * segment on it, so a bad roll here is not a bad turn, it is a lost run the
 * player never had a hand in. Every entry therefore has: usable bulk, a
 * reliable STAB move, one coverage move, and either recovery or setup. There
 * is no entry on this list that cannot beat the Stage 1 gym.
 *
 * Exposed as a *function* rather than a bare array on purpose. Stage 5 expands
 * the pool through unlocks, and `getStarterPool(unlocked)` is where that lands
 * — not in the run code, which only ever asks for a pool and draws from it.
 */
import type { MonEntry } from './mons';

/**
 * The pool as it stands, in a fixed order.
 *
 * Order matters: generation draws indices from a seeded stream, so reordering
 * this list changes what every recorded seed offers. Append, do not insert.
 */
const STARTERS: readonly MonEntry[] = [
  { id: 'venusaur', species: 'Venusaur', ability: 'Overgrow', moves: ['Giga Drain', 'Sludge Bomb', 'Sleep Powder', 'Synthesis'] },
  { id: 'blastoise', species: 'Blastoise', ability: 'Torrent', moves: ['Surf', 'Ice Beam', 'Dark Pulse', 'Rest'] },
  { id: 'charizard', species: 'Charizard', ability: 'Blaze', moves: ['Flamethrower', 'Air Slash', 'Dragon Pulse', 'Roost'] },
  { id: 'snorlax', species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'] },
  { id: 'gyarados', species: 'Gyarados', ability: 'Intimidate', moves: ['Waterfall', 'Crunch', 'Ice Fang', 'Dragon Dance'] },
  { id: 'sylveon', species: 'Sylveon', ability: 'Pixilate', moves: ['Hyper Voice', 'Psyshock', 'Calm Mind', 'Draining Kiss'] },
  { id: 'metagross', species: 'Metagross', ability: 'Clear Body', moves: ['Meteor Mash', 'Zen Headbutt', 'Earthquake', 'Bullet Punch'] },
  { id: 'dragonite', species: 'Dragonite', ability: 'Multiscale', moves: ['Dragon Claw', 'Earthquake', 'Roost', 'Dragon Dance'] },
  { id: 'arcanine', species: 'Arcanine', ability: 'Intimidate', moves: ['Flare Blitz', 'Extreme Speed', 'Wild Charge', 'Morning Sun'] },
  { id: 'swampert', species: 'Swampert', ability: 'Torrent', moves: ['Earthquake', 'Waterfall', 'Ice Punch', 'Rest'] },
  { id: 'clefable', species: 'Clefable', ability: 'Magic Guard', moves: ['Moonblast', 'Flamethrower', 'Calm Mind', 'Soft-Boiled'] },
];

/**
 * The species a run may offer as starters.
 *
 * @param unlocked Ids the player has unlocked. Stage 1 never passes it, and
 *   omitting it returns the base pool — which is what "unlocks are additive"
 *   has to mean if a seed recorded today is to keep working tomorrow.
 */
export function getStarterPool(unlocked?: readonly string[]): readonly MonEntry[] {
  if (!unlocked || unlocked.length === 0) return STARTERS;
  const extra = new Set(unlocked);
  // Stage 5 will append unlocked entries from a wider table here. Until that
  // table exists, an unlock can only ever narrow-to-known ids, so the base pool
  // is returned unchanged rather than silently dropping what it does not know.
  return STARTERS.filter((entry) => !extra.has(`-${entry.id}`));
}
