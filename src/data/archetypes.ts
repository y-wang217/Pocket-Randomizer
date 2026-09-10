/**
 * Six labels for what a stat block is built to do, and the thresholds that
 * decide between them.
 *
 * ## The problem
 *
 * A player cannot tell a physical attacker from a special attacker at a glance,
 * on either side of the field. So a move choice that ought to be a *read* —
 * this thing has 134 Attack and 45 Special Attack, so its Body Slam is the
 * problem and its Ice Beam is not — is a guess, every turn, for the whole run.
 * The stats are already on screen from Stage 4.5. What is missing is the one
 * word that says what they add up to.
 *
 * ## Why the numbers are here and not in `core/archetype.ts`
 *
 * The classification is a **table edit, not a code edit**. Every threshold and
 * every tie-break below is a judgement about where a line falls, which is
 * exactly the kind of thing a playtest moves — and `core/archetypeOf` is the
 * kind of thing that should not need editing when it does.
 *
 * ## This table must never enter `contentHash`
 *
 * It consumes no RNG and feeds no generation: nothing here changes what a seed
 * produces, and two players on one seed with different copies of this file play
 * the identical run with different words on it. When `contentHash` is built —
 * `docs/generation.md` §9, its own release — its input must be an explicit file
 * list rather than a directory glob, or a comma added to a blurb below would
 * start moving the hash and invalidating shared seeds. The same goes for
 * `data/moveTags.ts`.
 *
 * ## Part 4 applies to every word below
 *
 * A label is a classification of **public data**: base stats, which the player
 * can already read on both panels. It is not a verdict. Nothing here says a
 * `pTank` is good, that a `sAttacker` counters your lead, or that one label
 * beats another — and nothing that consumes it may order a list by archetype or
 * mark an opponent's label as favourable.
 */
import type { StatsTable } from '../core/types';

/**
 * What a stat block is built to do. Six, and deliberately not seven.
 *
 * `wall` and `speedster` are both plausible additions and both are declined.
 * Six is already at the edge of what a player learns incidentally from a chip
 * next to a level, and a vocabulary nobody learns is decoration. Speed in
 * particular is *already* on screen as a number and as a turn-order arrow from
 * Stage 4.5, so a label for it would be a third readout of one fact.
 */
export type Archetype = 'pAttacker' | 'sAttacker' | 'mixAttacker' | 'pTank' | 'sTank' | 'mixTank';

export const ARCHETYPES: readonly Archetype[] = [
  'pAttacker',
  'sAttacker',
  'mixAttacker',
  'pTank',
  'sTank',
  'mixTank',
];

/**
 * How the two axes are cut. **The whole of the classification.**
 *
 * `core/archetype.ts` reads these and does arithmetic; every judgement call is
 * one of the three numbers here.
 */
export interface ArchetypeTuning {
  /**
   * How much offence has to beat bulk by to make a stat block an attacker.
   *
   * `offence / bulk >= attackerRatio`, where offence is the better of Attack
   * and Special Attack and bulk is the mean of HP, Defence and Special Defence.
   *
   * A ratio rather than a difference because the two quantities are on the same
   * scale but not the same footing: a mean of three stats is structurally
   * flatter than a max of two, so a plain comparison would call almost
   * everything an attacker. 1.0 is the neutral cut and is where this ships;
   * raising it makes "tank" the default and is the first thing to try if
   * playtesters report the label saying "attacker" about everything.
   */
  attackerRatio: number;
  /**
   * How close two stats have to be for the block to read as mixed.
   *
   * `min / max >= mixedRatio`. 0.85 means a 100/90 split is mixed and a 100/80
   * split is not. Expressed as a ratio rather than a flat margin so it means
   * the same thing at base 60 as at base 160 — a flat "within 15 points" would
   * make almost every weak Pokemon mixed and almost no strong one.
   */
  mixedRatio: number;
  /**
   * Which side a dead-exact tie lands on, on each axis.
   *
   * Written down rather than left to `>=` because a tie is not rare here:
   * plenty of species carry identical Attack and Special Attack, and "whatever
   * the comparison operator happened to be" is not a rule anybody can check.
   *
   * `offenceTie` decides attacker-versus-tank when the ratio lands exactly on
   * `attackerRatio`; `splitTie` is unreachable while `mixedRatio` is below 1
   * (an exact tie is maximally mixed) and exists so that setting `mixedRatio`
   * to 1 has a defined meaning rather than an accidental one.
   */
  offenceTie: 'attacker' | 'tank';
  splitTie: 'mixed' | 'physical';
}

export const ARCHETYPE_TUNING: ArchetypeTuning = {
  attackerRatio: 1,
  mixedRatio: 0.85,
  offenceTie: 'attacker',
  splitTie: 'mixed',
};

/** How a label reads on screen. */
export interface ArchetypeDisplay {
  /** For a chip next to a level, where there is room for about twelve characters. */
  short: string;
  /** For a tooltip heading and anywhere with room for a sentence. */
  long: string;
  /** What the label is claiming, in one factual sentence. */
  blurb: string;
}

/**
 * Display forms. **Attributes, never verdicts.**
 *
 * Every blurb says what the stat block is *shaped like* and stops. None of them
 * says what to do about it, which fight it is for, or whether it is good.
 */
export const ARCHETYPE_DISPLAY: Record<Archetype, ArchetypeDisplay> = {
  pAttacker: {
    short: 'Phys. Attacker',
    long: 'Physical attacker',
    blurb: 'Attack is this stat block’s highest stat, and higher than its Special Attack.',
  },
  sAttacker: {
    short: 'Spec. Attacker',
    long: 'Special attacker',
    blurb: 'Special Attack is this stat block’s highest stat, and higher than its Attack.',
  },
  mixAttacker: {
    short: 'Mixed Attacker',
    long: 'Mixed attacker',
    blurb: 'Attack and Special Attack are close, and both outweigh the bulk.',
  },
  pTank: {
    short: 'Phys. Tank',
    long: 'Physical tank',
    blurb: 'Bulk outweighs offence, and Defence is higher than Special Defence.',
  },
  sTank: {
    short: 'Spec. Tank',
    long: 'Special tank',
    blurb: 'Bulk outweighs offence, and Special Defence is higher than Defence.',
  },
  mixTank: {
    short: 'Mixed Tank',
    long: 'Mixed tank',
    blurb: 'Bulk outweighs offence, and the two defences are close.',
  },
};

/**
 * The caveat, and it is not optional.
 *
 * **A label describes the stat block, never the moveset.** Under full move
 * randomization a `pAttacker` can and will roll four special moves, and a
 * player who read the chip as "this one will hit you physically" has been
 * misled by the game rather than by their own inference. They will meet this in
 * the first hour.
 *
 * It is stated wherever the label is explained, and the wording deliberately
 * does not soften it into "usually" or "tends to". The label is exact about
 * what it describes; the limitation is that what it describes is not the whole
 * picture.
 */
export const ARCHETYPE_CAVEAT =
  'Read off base stats only, never the moveset. Moves are randomized, so a physical attacker can be holding four special moves.';

/** One line for what the labels are, where the whole set is introduced. */
export const ARCHETYPE_INTRO =
  'Six shapes, from base stats: whether the block leans on offence or bulk, and which side of the split it favours.';

/**
 * The stat names the classification reads, for a caller that wants to say so.
 *
 * Speed is absent, deliberately: see the note on `Archetype` about the seventh
 * label that is not being added.
 */
export const ARCHETYPE_STATS: readonly (keyof StatsTable)[] = ['hp', 'atk', 'def', 'spa', 'spd'];
