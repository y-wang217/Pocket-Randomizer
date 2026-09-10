/**
 * The party: how many slots it has, what joins it, and what a faint costs.
 *
 * What is left of it is one number. Four lived here once, and every one of them
 * was a Stage 4 balance lever rather than a structural constant; they lived
 * together because they were one question asked four ways — *how much does
 * losing a Pokemon cost you?* — and answering it in four files is how the four
 * answers drift apart. Two moved to `tuning.ts` in 4.5.1 and the third was
 * deleted in 4.7; both notes are below, because where a lever went is the part
 * a later pass needs and the part a deletion normally destroys.
 *
 * Separate from `data/tuning.ts` on purpose. `Tuning` is *passed* into
 * generation and the run state machine so a sweep can vary it per run; these
 * are read at module scope by `data/scaling.ts`, which computes opponent team
 * sizes from `PARTY_SIZE` and cannot take a tuning object without threading one
 * through every curve function. That is the honest split: a value the curve
 * itself is a function of is not a per-run knob.
 */

/**
 * How many Pokemon the player fields. **The Stage 4 constant.**
 *
 * Three, and the recommendation is held rather than raised for two reasons the
 * simulator can check. Battle length is now multiplied by both party size and
 * switch turns, and a thousand-seed sweep has to stay usable. And three keeps
 * every acquisition consequential: the party fills early, so the release choice
 * — take the new member and lose one, or decline — arrives in most runs rather
 * than in the tail of them.
 *
 * What would change it is the party-composition metric in the simulator report.
 * Losses at a full healthy bench mean the party is not the binding constraint
 * and a fourth slot buys nothing; losses at zero or one member alive with the
 * bench chewed through are a depth signal worth testing 4 against.
 *
 * Everything that would otherwise assume a single player Pokemon reads this:
 * `party.battleTeamFor`, `party.carryOverFor`, `acquisition`, and
 * `scaling.opponentTeamSize`, which adds the segment's *advantage* to it so
 * that raising the party keeps the shape of the difficulty curve rather than
 * trivialising the back half of the run.
 */
export const PARTY_SIZE = readSizeOverride() ?? 3;

export interface PartyTuning {
  /** Party slots. The same number as `PARTY_SIZE`; see the note there. */
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
  size: PARTY_SIZE,
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
 * A party size from the environment, for the Stage 4 re-baseline and nothing else.
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
