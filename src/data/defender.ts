/**
 * Defender Mode v0: every number the mode's structure is tuned by.
 *
 * **A fun test, not a stage.** `docs/spec/gymrun-defender-mode-v0-fun-test.md`
 * is the prompt; `docs/reports/defender-mode-v0-report.md` is the pre-code
 * report and its rulings. If the mode is not fun by hand the branch is thrown
 * away, and this file goes with it — which is why the mode's numbers live in
 * one file of their own rather than as columns on the attacker's tables.
 *
 * The player is the gym leader: picks a gym type, drafts a roster locked to it,
 * and defends eight ranks of trainers. Nothing here is drawn; every draw that
 * reads it is keyed in `core/streamKeys.ts` under `defender/`.
 */
import type { TypeName } from '../core/types';
import type { RelicId } from './relics';

/**
 * The three gym types a defender run may be. **Order is the offer order** and
 * the `gymType` decision logs an index into it, so re-sorting this list
 * reinterprets every recorded defender log.
 */
export const DEFENDER_GYM_TYPES = ['Fire', 'Psychic', 'Flying'] as const satisfies readonly TypeName[];

export type DefenderGymType = (typeof DEFENDER_GYM_TYPES)[number];

/** How many ranks a defender run is: one wave and one boss each. */
export const DEFENDER_RANKS = 8;

/**
 * The opening draft: `picks` decisions, each a pick of one from `options`.
 *
 * The prompt's three picks of three. Drafted mons are the player's starters
 * and are generated the way starters are, at the starter level and from the
 * starter move bands, but from a pool narrowed to the gym type. Drawn for all
 * three gym types at generation (report ruling R3).
 */
export const DEFENDER_DRAFT = { picks: 3, options: 3 } as const;

/**
 * Battles per wave, by rank. The prompt's starting row; step 3 reads it.
 */
export const DEFENDER_WAVE_LENGTH: readonly number[] = [2, 2, 3, 3, 4, 4, 5, 5];

/**
 * How far ahead of the bosses beaten a defender run reads the shipped slot
 * schedule, `SLOT_UNLOCK_SCHEDULE`. **Report ruling R1(a), 2026-10-04.**
 *
 * The shipped schedule opens at two slots and the prompt drafts three, so the
 * two could not both hold. Read one row ahead, the schedule gives
 * 3, 3, 4, 4, 5, 5, 6, 6 across the ranks: the draft fills the opening three,
 * and a recruit draft fills each slot that unlocks after bosses 2, 4 and 6.
 */
export const DEFENDER_SLOT_SCHEDULE_OFFSET = 1;

/**
 * How many party slots a defender run may fill with a mon that does not carry
 * the gym type, before the off-type relic. Zero: the type lock is total until
 * that relic is held, and the relic grants exactly one (step 5).
 */
export const DEFENDER_BASE_EXEMPT_SLOTS = 0;

/**
 * The relics a defender run's relic cards may shuffle. **Report ruling R2,
 * 2026-10-04.**
 *
 * Every relic grants a capability, so "today's pool minus capability relics"
 * read literally is empty. The ruling: drop the two whose passive is `none`
 * (`woodsmans-hatchet`, `windrider-feather`), because a capability is all they
 * are, and keep the other eight for their passives, with the capability inert
 * because a defender run has no events. A separate list rather than a filter on
 * `RELIC_IDS`, because the attacker's shuffle reads that list's length.
 *
 * **Order is a draw order**, as `RELIC_IDS`'s is. The off-type slot relic joins
 * at step 5.
 */
export const DEFENDER_RELIC_IDS: readonly RelicId[] = [
  'rusted-machete',
  'tidecaller-shell',
  'ferrymans-oar',
  'ironbound-gauntlet',
  'prospectors-hammer',
  'cascade-talisman',
  'abyssal-lens',
  'everburning-lantern',
];
