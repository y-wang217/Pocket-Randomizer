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
 * The recruit draft's shape: how many options carry the gym type and how many
 * do not. **2026-10-06.** Every draft offers one off-type mon; there is no cap
 * on how many the party holds. What an off-type member costs is the badge
 * (`core/defender/badge.ts`, `badgesActive`), not a refusal.
 */
export const DEFENDER_RECRUIT = { typed: 2, offType: 1 } as const;

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

/**
 * The three badges' numbers. **Defender Mode v0, step 4.** A badge applies
 * only to party members carrying the gym type.
 *
 * - **Fire.** `fireCritStages[n]` is the crit stage the highlighted move adds
 *   on its `n+1`th consecutive use, the last entry holding from then on: +1,
 *   +2, +3, which in Gen 9 is 1/8, 1/2 and certain on a ratio-1 move.
 * - **Flying.** `flyingSpeed` multiplies Speed through the sim's own
 *   `ModifySpe` event, so every engine read of Speed already carries it. The
 *   fifth move is Peck for a species that can still evolve and Pluck for a
 *   final stage, with `fifthMovePp` uses per battle.
 */
export const DEFENDER_BADGE = {
  fireCritStages: [1, 2, 3],
  flyingSpeed: 1.1,
  fifthMove: { canEvolve: 'Peck', finalStage: 'Pluck' },
  fifthMovePp: 1,
} as const;

/**
 * Trade cards. **Defender Mode v0, step 5.** At most one per offer: each door
 * node draws whether its offer carries one, at `rate`, and a carried trade
 * takes the offer's last card. The offered mon is drawn at `tier`, one step
 * above the rank's `normal` norm. Every number here is a balance number.
 */
export const DEFENDER_TRADE = { rate: 0.25, tier: 'hard' } as const;

/**
 * The reward entry a defender door offer adds to the tier's own pool, so a
 * card can be a consumable. Berries are unchanged: they stay in the item
 * entries they were already in.
 */
export const DEFENDER_CONSUMABLE_ENTRY = {
  kind: 'consumable',
  weight: 3,
  ids: ['potion', 'superpotion', 'hyperpotion'],
} as const;

/**
 * The Stranger's Pass. **Defender Mode v0, step 5; reversed 2026-10-06.** In
 * the boss relic pool only, and offered at most once per run. It used to grant
 * one party slot exempt from the type lock. Now any number of off-type members
 * may join and the badge goes dark while one stands in the party; holding the
 * Pass lights it again (`core/defender/badge.ts`, `badgesActive`). The exempt
 * slot is deleted, not kept behind a flag: `docs/generation.md` section 115.
 */
export const DEFENDER_OFF_TYPE_RELIC = 'strangers-pass';

/** The boss page's relic list: the defender list plus the off-type relic. */
export const DEFENDER_BOSS_RELIC_IDS: readonly RelicId[] = [...DEFENDER_RELIC_IDS, DEFENDER_OFF_TYPE_RELIC];
