/**
 * The party: how many slots it has, what joins it, and what a faint costs.
 *
 * What is left of it is one schedule. Four numbers lived here once, and every
 * one of them was a Stage 4 balance lever rather than a structural constant;
 * they lived together because they were one question asked four ways — *how much
 * does losing a Pokemon cost you?* — and answering it in four files is how the
 * four answers drift apart. Two moved to `tuning.ts` in 4.5.1 and the third was
 * deleted in 4.7; both notes are below, because where a lever went is the part
 * a later pass needs and the part a deletion normally destroys. The fourth, the
 * party's size, became the schedule in Stage 4.8.
 *
 * Separate from `data/tuning.ts` on purpose. `Tuning` is *passed* into
 * generation and the run state machine so a sweep can vary it per run; these
 * are read at module scope by `data/scaling.ts`, which computes opponent team
 * sizes from the capacity schedule and cannot take a tuning object without
 * threading one through every curve function. That is the honest split: a value
 * the curve itself is a function of is not a per-run knob.
 *
 * ## Stage 4.8: the size became a schedule
 *
 * `PARTY_SIZE` lived here and was a single constant. It is **deleted rather than
 * kept alongside the schedule**, because a constant named for the party's size
 * is exactly what a later call site reads instead of asking how many slots the
 * run has *now* — and a slot unlock that does not reach the capture flow means a
 * player is told they have room and then asked to replace someone. Removing the
 * name is what forced every one of its sixteen read sites through review.
 */

/**
 * How many party slots the run has, by **gyms cleared**. Stage 4.8, item 1.
 *
 * Indexed by gym count, zero through eight, so the row is read directly and
 * there is no formula to get wrong at the ends. Before this the party was one
 * number all run, which made a gym clear structurally identical to any other
 * node completion and made the first half of a run play at the roster width of
 * the second.
 *
 * **Three at the start, and that is held rather than lowered.** The opening is
 * what 4.6c measured, and narrowing it would make every early benchmark row
 * incomparable for no gain — the thing this item adds is growth, not a harder
 * opening. The first unlock is at gym 2 because that is the earliest a player
 * has seen enough of the game for another slot to mean something, and because
 * it puts the moment inside the stretch most runs actually reach.
 *
 * **Six by gym 6, so the last two gyms are played at full width** rather than
 * still growing. An unlock at gym 7 would arrive with one segment left to use
 * it, which is a reward the run has no time to spend.
 *
 * Every number here is a balance number. What would move them is the
 * simulator's `party.sizeBySegment` section, which prints the measured party
 * beside what the curve assumed, segment by segment.
 */
export const SLOT_UNLOCK_SCHEDULE: readonly number[] = [3, 3, 4, 4, 5, 5, 6, 6, 6];

/**
 * The most slots a run can ever have. The schedule's own ceiling.
 *
 * Derived rather than written down, so that editing the schedule cannot leave a
 * constant behind disagreeing with it. Clamped by the environment override,
 * which is what keeps `GYMRUN_PARTY_SIZE=1 npm run sim` a valid Stage 3
 * comparison: at 1 every row of the schedule collapses to 1.
 */
export const MAX_PARTY_CAPACITY = Math.min(
  readSizeOverride() ?? Number.POSITIVE_INFINITY,
  SLOT_UNLOCK_SCHEDULE.reduce((top, slots) => Math.max(top, slots), 0),
);

/**
 * Party slots after clearing `gymsCleared` gyms. **The one place that answers.**
 *
 * Pure, and a function of a number rather than of a `RunState`, so that
 * `data/scaling.ts` can read it at module scope and a test can ask it directly.
 * `core/party.partyCapacity` is the `RunState` form and derives the gym count
 * from history; nothing else may compute a capacity.
 *
 * Clamped at both ends rather than trusted: a negative count and a count past
 * the last gym both read the nearest row, because the alternative is an
 * `undefined` that becomes a `NaN` three frames into a render.
 *
 * **Capacity is not the same quantity as the party the player actually has**,
 * and conflating the two is the documented Stage 4 balance bug — see
 * `scaling.expectedPartySize`. This is the ceiling. That is the measurement.
 */
export function partyCapacityAfter(gymsCleared: number): number {
  const index = Math.max(0, Math.min(SLOT_UNLOCK_SCHEDULE.length - 1, Math.floor(gymsCleared)));
  const slots = SLOT_UNLOCK_SCHEDULE[index] ?? MAX_PARTY_CAPACITY;
  return Math.max(1, Math.min(MAX_PARTY_CAPACITY, slots));
}

/**
 * The next gym that grants a slot, and what it grants, or null at the ceiling.
 *
 * Here rather than in `ui/` because it is a fact about the schedule, and the map
 * and the result screen both state it. An attribute readout — "Party slots: 4.
 * Next slot at Gym 6." — and deliberately not advice about whether to save one.
 */
export function nextSlotUnlock(gymsCleared: number): { atGym: number; slots: number } | null {
  const current = partyCapacityAfter(gymsCleared);
  for (let gyms = Math.max(0, Math.floor(gymsCleared)) + 1; gyms < SLOT_UNLOCK_SCHEDULE.length; gyms++) {
    const slots = partyCapacityAfter(gyms);
    if (slots > current) return { atGym: gyms, slots };
  }
  return null;
}

export interface PartyTuning {
  /** The slots a run opens with, which is `partyCapacityAfter(0)`. */
  size: number;
  /*
   * `joinLevelOffset` used to live here — how far *below* the segment's curve
   * an acquired member arrived, as the price of a free Pokemon. **Stage 4.7
   * deleted it rather than setting it to zero**, because the two are different
   * statements: a zero is a lever a tuning pass is invited to move, and the
   * rule now is that a joining Pokemon is simply a party member and the party
   * is at `playerLevel(segment)`. `core/acquisition.joinLevelFor` carries the
   * argument and the measurement.
   *
   * The lever for "captures are too cheap", if the report ever says so, is the
   * *cost* of a capture — the party slot, or the step the wild encounter
   * occupies in a segment of four or five. It is deliberately not this number.
   */
  /*
   * `reviveHpFraction` and `freeRevive` used to live here. **They moved to
   * `tuning.reviveHpPercent` in Stage 4.5.1**, and the two of them collapsed
   * into one number on the way.
   *
   * The split this file's header describes is still the right one — a value the
   * difficulty *curve* is a function of is not a per-run knob — but revival was
   * never such a value. `data/scaling.ts` does not read it; only
   * `party.betweenNodes` does, and that already takes a `Tuning`. Keeping it
   * here bought nothing and cost the simulator the ability to sweep the single
   * lever docs/balance.md §7.6 spends three paragraphs blaming.
   */
}

export const PARTY_TUNING: PartyTuning = {
  size: partyCapacityAfter(0),
};


/*
 * ---------------------------------------------------------------------------
 * There is no bench experience, and there is not going to be.
 * ---------------------------------------------------------------------------
 *
 * **A benched member is never behind, so there is nothing to model.** Stage 2
 * settled that level is a pure function of segment index (design rule 2: the
 * encounters you choose within a segment change *what you get*, not *how strong
 * you are*), and `party.levelParty` applies it to the whole party when a gym
 * falls. A Pokemon that sat out eight fights arrives at segment 5 at exactly the
 * level of one that fought all eight.
 *
 * That is the entire reason an XP system is absent rather than deferred. Adding
 * one would not be adding a feature to the party — it would be reversing the
 * decision that there is no grinding, and it would do it by accident, because
 * the visible symptom ("my bench is underlevelled") does not exist to motivate
 * it. If a later stage wants XP, it wants it as a deliberate change to design
 * rule 2 and to `data/scaling.ts`, not as a patch to this file.
 */

/**
 * A party ceiling from the environment, for the Stage 4 re-baseline and nothing else.
 *
 * The Stage 2 and Stage 3 balance numbers were all measured at `PARTY_SIZE` 1,
 * and the first thing Stage 4 has to establish is that the switching code
 * reproduces the Stage 3 report *before* the party grows — otherwise a
 * completion-rate change cannot be attributed to the party rather than to a bug.
 * `GYMRUN_PARTY_SIZE=1 npm run sim` is that comparison.
 *
 * Read through `globalThis` rather than `process` directly so this file stays
 * importable in a browser, where there is no `process` and no override.
 */
function readSizeOverride(): number | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.['GYMRUN_PARTY_SIZE'];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) {
    throw new RangeError(`GYMRUN_PARTY_SIZE must be 1..6, got "${raw}"`);
  }
  return parsed;
}
