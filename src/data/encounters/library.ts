/**
 * The query and fit layer over the encounter library. **Stage 6.0.** Pure: no
 * RNG, no player state, nothing that is not a function of the tables and the
 * curve.
 *
 * Three questions, answered in order:
 *
 *   1. **Which records can the engine play?** `playable` projects a record
 *      through the same filters the pools were generated with: a member whose
 *      species is outside `SPECIES_POOL` or blacklisted is dropped, a set
 *      move outside the move pools is dropped. A record whose ace (the last
 *      member, the games' convention) is dropped is not playable at all.
 *   2. **Which records may a node draw from?** `encounterCandidates` is a
 *      function of the node's *structural* inputs only — its kind, its segment
 *      and its tier — never of anything the player did, which is the
 *      discipline every key in `core/streamKeys.ts` rests on. A boss node
 *      draws a **challenger** (a rival, a protagonist, a gym leader or an
 *      Elite Four member; checkpoint 6's ruling 1); a route node draws a route
 *      trainer or a villain, and at `hard` or `elite` a gym leader too. The
 *      list is ranked by how far the record's canonical ace sits from the
 *      segment's level cap, keeps **one record per trainer name** (Brock's
 *      nearest roster, not five of them), and is cut to a window, so Brock's
 *      Geodude 12 is a segment 0 pick and Roxanne's fifth rematch a segment 5
 *      pick, rather than either shifted forty levels to fit. The list order is
 *      the draw order.
 *   3. **How does a record fit a slot count and a level range?** `fitParty`
 *      trims from the front keeping the ace, shifts every level by one
 *      constant so the ace lands on the cap, clamps into the range, and
 *      devolves any member its fitted level cannot carry. No draw is spent.
 *
 * What is deliberately *not* here: which slots are canonical and which are
 * rolled, and how many draws each costs. That is `core/randomizer.ts`'s
 * contract and it stays in one place.
 */
import { BLACKLISTED_SPECIES } from '../blacklists';
import { entryOfId } from '../evolution';
import { DAMAGING_MOVES, STATUS_MOVES } from '../movePools';
import { opponentLevel, speciesBandsFor } from '../scaling';
import type { Tier } from '../../core/types';
import type { SpeciesEntry } from '../speciesPools';
import { ENCOUNTERS } from './index';
import type { EncounterRecord } from './types';

export type EncounterKind = 'trainer' | 'gym';

/**
 * How many **trainer names** a node draws among, nearest the segment's cap
 * first, one record each.
 *
 * Twelve for a challenger: a dozen names across rivals, leaders and the Elite
 * Four is a cast, and the nearest dozen keeps a Gen 1 roster near the first
 * segment and a late rematch near the last. Forty-eight for a route trainer,
 * because route trainers come in hundreds per level band and a dozen would
 * make a segment's trainers feel like a roster rather than a region.
 */
export const CANDIDATE_WINDOW: Readonly<Record<EncounterKind, number>> = { gym: 12, trainer: 48 };

/** One member of a record as the engine can play it: a pool entry, and move *names* as `PokemonSpec` carries them. */
export interface PlayableMember {
  entry: SpeciesEntry;
  level: number;
  moves: readonly string[];
  item?: string;
}

const MOVE_NAME_BY_ID = new Map([...DAMAGING_MOVES, ...STATUS_MOVES].map((move) => [move.id, move.name]));
const BLACKLISTED = new Set(BLACKLISTED_SPECIES);

const playableCache = new Map<string, readonly PlayableMember[] | null>();

/** The record's party as the engine can play it, in canonical order, or null when its ace cannot be played. */
export function playable(record: EncounterRecord): readonly PlayableMember[] | null {
  const cached = playableCache.get(record.id);
  if (cached !== undefined) return cached;
  const members: PlayableMember[] = [];
  for (const member of record.party) {
    const entry = entryOfId(member.species);
    if (!entry || BLACKLISTED.has(entry.id)) continue;
    const moves = (member.moves ?? []).map((id) => MOVE_NAME_BY_ID.get(id)).filter((name): name is string => name !== undefined);
    const playableMember: PlayableMember = { entry, level: member.level, moves };
    if (member.item) playableMember.item = member.item;
    members.push(playableMember);
  }
  const ace = record.party[record.party.length - 1];
  const last = members[members.length - 1];
  const result = ace && last && last.entry.id === ace.species && members.length > 0 ? members : null;
  playableCache.set(record.id, result);
  return result;
}

/** The canonical ace's level: the last member of the record, which is the games' convention for the strongest. */
function aceLevel(record: EncounterRecord): number {
  return record.party[record.party.length - 1]?.level ?? 0;
}

/**
 * Rivals and protagonists who hold a title in some game, admitted to the
 * challenger pool whatever role the record carries: Blue's Champion fight is
 * the Red and Blue rival the ruling names, Red at Mt. Silver is the
 * protagonist, Trace and Hau are the rival as Champion, Green is Leaf.
 * Every other champion and every villain stays out (ruling 1).
 */
const TITLED_PROTAGONISTS: ReadonlySet<string> = new Set(['Red', 'Blue', 'Green', 'Leaf', 'Trace', 'Hau']);

/** A boss's pool: the challenger. A rival, a gym leader, an Elite Four member, or a titled protagonist. */
function isChallengerCandidate(record: EncounterRecord): boolean {
  if (record.role === 'rival' || record.role === 'gym' || record.role === 'elite') return true;
  return TITLED_PROTAGONISTS.has(record.trainer.name);
}

/**
 * A route's pool: route trainers and villains at every tier, and gym leaders
 * at `hard` and `elite` (ruling 4), where a mono-type roster is the tough
 * fight the tier promises. Rivals are challengers only: Blue on Route 3 and
 * Blue as the stage's boss in one run would be one string meaning two things.
 */
function isTrainerCandidate(record: EncounterRecord, tier: Tier): boolean {
  if (record.role === 'route' || record.role === 'boss') return true;
  return record.role === 'gym' && tier !== 'normal';
}

/**
 * The records whose ace sits in the bands a tier draws, or every record when
 * a tier's bands hold too few to be a list.
 *
 * This is what a node's tier means for a library trainer: `hard` and `elite`
 * widen the species band window (`TIER_MODIFIERS.speciesBand`), and the
 * library's translation is that the trainer's *ace* is from those bands. A
 * Youngster's Rattata is a normal pick where an Ace Trainer's Raticate is a
 * hard one. The floor keeps a thin band from collapsing a tier to one name.
 */
const TIER_POOL_FLOOR = 8;
function inTierBands(records: readonly EncounterRecord[], segment: number, tier: Tier): readonly EncounterRecord[] {
  if (tier === 'normal') return records;
  const bands = new Set(speciesBandsFor(segment, tier));
  const narrowed = records.filter((record) => {
    const members = playable(record)!;
    return bands.has(members[members.length - 1]!.entry.band);
  });
  return narrowed.length >= TIER_POOL_FLOOR ? narrowed : records;
}

const candidateCache = new Map<string, readonly EncounterRecord[]>();

/**
 * The records a node of this kind, at this segment and tier may draw from,
 * nearest the segment's level cap first, ties by id, one record per trainer
 * name (the nearest), cut to `CANDIDATE_WINDOW` names. A boss takes no tier
 * (`core/randomizer.ts` says why) and passes none. Structural inputs only.
 * Throws when there are none, because a node with nothing to draw is a data
 * error and not a draw.
 */
export function encounterCandidates(kind: EncounterKind, segment: number, tier: Tier = 'normal'): readonly EncounterRecord[] {
  const key = `${kind}/${segment}/${tier}`;
  const cached = candidateCache.get(key);
  if (cached) return cached;
  const target = opponentLevel(kind, segment, tier).max;
  const eligible = ENCOUNTERS.filter((record) => playable(record) !== null)
    .filter((record) => (kind === 'gym' ? isChallengerCandidate(record) : isTrainerCandidate(record, tier)));
  const ranked = (kind === 'trainer' ? inTierBands(eligible, segment, tier) : eligible)
    .map((record) => ({ record, distance: Math.abs(aceLevel(record) - target) }))
    .sort((a, b) => a.distance - b.distance || (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0))
    .map((ranked) => ranked.record);
  // One record per name, the nearest: a window of twelve Brocks is one
  // leader with costumes, and the brief wants a cast (ruling 5). Gen 1 names
  // its route trainers by class, so `Youngster` is one name there too, which
  // is the rule applied evenly.
  const names = new Set<string>();
  const distinct: EncounterRecord[] = [];
  for (const record of ranked) {
    if (names.has(record.trainer.name)) continue;
    names.add(record.trainer.name);
    distinct.push(record);
    if (distinct.length === CANDIDATE_WINDOW[kind]) break;
  }
  if (distinct.length === 0) throw new RangeError(`No ${kind} encounter candidates at segment ${segment} at ${tier}`);
  candidateCache.set(key, distinct);
  return distinct;
}

/**
 * The record's party fitted to a slot count and a level range.
 *
 *   1. Trim from the front to `size`, keeping the ace.
 *   2. Shift every level by `level.max − ace.level`, then clamp into the
 *      range: the spread is kept where it fits and compressed at the floor
 *      where it does not. The ace lands on the cap, which is what
 *      `levelOffset.gym.max = 0` means.
 *   3. Devolve any member whose evolution level is above its fitted level,
 *      down the `prevo` chain until a form fits: Morty's Haunter at segment 0
 *      is a Gastly. This is the rule `levelFor` enforces by throwing, applied
 *      as a projection. A member with no fitting form is dropped.
 *   4. One of each species, keeping the occurrence nearest the ace, because a
 *      team is drawn with `seen` and a double would be a second draw of a
 *      species the stream has already placed.
 *
 * The result is at most `size` long; the caller rolls the rest.
 */
export function fitParty(record: EncounterRecord, level: { min: number; max: number }, size: number): PlayableMember[] {
  const members = playable(record);
  if (!members || size < 1) return [];
  const trimmed = members.slice(-size);
  const ace = trimmed[trimmed.length - 1]!;
  const shift = level.max - ace.level;
  const fitted: PlayableMember[] = [];
  for (const member of trimmed) {
    const fittedLevel = Math.max(1, Math.min(100, Math.max(level.min, Math.min(level.max, member.level + shift))));
    let entry: SpeciesEntry | null = member.entry;
    while (entry && entry.evoLevel !== null && entry.evoLevel > fittedLevel) {
      entry = entry.prevo ? entryOfId(entry.prevo) : null;
    }
    if (!entry) continue;
    const next: PlayableMember = { entry, level: fittedLevel, moves: member.moves };
    if (member.item) next.item = member.item;
    fitted.push(next);
  }
  const seen = new Set<string>();
  const distinct: PlayableMember[] = [];
  for (let index = fitted.length - 1; index >= 0; index -= 1) {
    const member = fitted[index]!;
    if (seen.has(member.entry.id)) continue;
    seen.add(member.entry.id);
    distinct.unshift(member);
  }
  return distinct;
}
