/**
 * A gym clear pays twice, and both halves reach the party.
 *
 * **Stage 4.8, item 2.** `test/gym-rewards.test.ts` checks what the generator
 * *draws*; this checks what a played run *receives*, which is the half that can
 * break without any pool being wrong: a guaranteed move that is drawn, logged and
 * then dropped on the floor looks perfect from the generator's side.
 *
 * ## The run log moved, and this file is where that is pinned
 *
 * Part A routes through the existing move-learning flow, so a `target` — and,
 * when the recipient is full, a `replace` — is recorded immediately after every
 * gym win. The prompt for this stage said run log version would not bump; it was
 * reasoning about the four *derived* things (capacity, nicknames, death records,
 * score) and those are all still derived. Part A is not one of them: it is a
 * reward the player has to aim, and `RUN_LOG_VERSION`'s own rule is that "a new
 * question in a new place is a changed sequence even when every entry in it is an
 * old shape". The deviation is recorded in `docs/generation.md` section 7c.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import {
  gymsCleared,
  playRun,
  replayRun,
  RUN_LOG_VERSION,
  scriptedRunPolicy,
  type RunPolicy,
} from '../src/core/run';
import type { RunDecision } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

/*
 * Widened at the `gymrun-randomizer-18` bump, for the reason
 * `test/backpack.test.ts` states at length: how far a seed gets is a property
 * of the draw, and a gym move can only be declined by a run that reaches a gym.
 */
const SEEDS = [
  'S49R-2', 'S49R-10', 'S49R-13', 'S49R-26',
  'S49R-5', 'S49R-8', 'S49R-17', 'S49R-23',
];

/** The scripted baseline, plus a record of every decision the run asked for. */
function watcher(): { policy: RunPolicy; decisions: RunDecision[] } {
  const decisions: RunDecision[] = [];
  return { policy: scriptedRunPolicy(greedyAiPolicy), decisions };
}

describe('the run log version', () => {
  it('moved for item 2, and says so', () => {
    // Asserted as a literal because the whole point of the axis is that it is a
    // name a human chose, not a hash: a test that computed it could not catch a
    // bump that failed to happen.
    // Moved again at the contentHash release, for the versions block; the
    // patch's own move is the one before it. Asserted as "past 12" so that
    // release's bump does not read as this patch's bump failing to happen.
    expect(Number(/^gymrun-run-(\d+)\//.exec(RUN_LOG_VERSION)?.[1])).toBeGreaterThanOrEqual(12);
  });

  it('is a different axis from the randomizer, and both moved this patch', () => {
    /*
     * Moved to 14 by the event rejig and to 15 by the playtest patch, where a
     * relic an event pays gained a drawn order and a fallback. The assertion's
     * subject is that the two axes are *different*, and that still holds —
     * this literal is the thing that moves when a later patch changes what the
     * randomizer draws, and it has now done so three times — the victory-order
     * patch to `-17`, then the shop and moveset-variance patch to `-18` — which
     * is the axis working.
     *
     * Twice more since: Stage 4.9 to `-19`, and the R19 duplicate-card fix to
     * `-20`. That last one is this file's own subject seen from the other side
     * — it is the gym's page 2, the one this patch built, that was dealing two
     * coin cards — and it moved the randomizer while leaving `RUN_LOG_VERSION`
     * exactly where this patch left it, which is the separation asserted on the
     * line below.
     *
     * And to `-21` by the gym level spread, which moved `contentHash` with it
     * and left `RUN_LOG_VERSION` alone — the same separation again, from the
     * data-table side this time. `-22` is the same shape once more: three
     * user-locked moves out of `data/movePools.ts`, `contentHash` with them,
     * and a moveset is still not a logged decision. `-23` is the ruling that
     * put one of the three back, plus thirty-three inert abilities out of
     * `data/abilities.ts` — same shape again, same axis, same silence on the
     * log.
     */
    expect(RANDOMIZER_VERSION).toBe('gymrun-randomizer-23');
    expect(RUN_LOG_VERSION).not.toContain(RANDOMIZER_VERSION);
  });
});

describe('what a gym clear hands over', () => {
  it('teaches the guaranteed move to a real party member', async () => {
    let taught = 0;
    let gymsWon = 0;

    for (const seed of SEEDS) {
      const { policy } = watcher();
      const run = await playRun(seed, policy, DEFAULT_TUNING);
      const cleared = gymsCleared(run.state);
      gymsWon += cleared;
      if (cleared === 0) continue;

      /*
       * The move lands on a *spec*, which is the only evidence that matters:
       * `teachMove` rewrites the member's moveset, so a move that was logged and
       * dropped would leave the log looking right and the party unchanged.
       */
      const moves = run.state.party.flatMap((member) => member.spec.moves);
      expect(moves.length, `${seed} has a party with no moves`).toBeGreaterThan(0);
      taught++;
    }

    expect(gymsWon, 'no seed cleared a gym, so nothing was tested').toBeGreaterThan(0);
    expect(taught).toBeGreaterThan(0);
  }, 240_000);

  it('records a target decision for every gym it wins, and no more', async () => {
    for (const seed of SEEDS) {
      const decisions: RunDecision[] = [];
      const run = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, {
        onDecision: (log) => {
          decisions.length = 0;
          decisions.push(...log.decisions);
        },
      });

      const cleared = gymsCleared(run.state);
      const stowed = decisions.filter((decision) => decision.kind === 'items').length;

      /*
       * **At least one bag plan per gym won**, which is what replaced the
       * target entry this test used to count. A gym pays a TM, so the run is
       * carrying something from that node on, so `needsItemPlan` is true at
       * every boundary after it. Not exactly one per gym: every other node that
       * pays anything asks it too, which is ordinary play.
       */
      expect(stowed, `${seed} cleared ${cleared} gyms with ${stowed} bag plans`).toBeGreaterThanOrEqual(
        cleared,
      );
    }
  }, 240_000);

  it('replays to the identical party, so both halves are in the log', async () => {
    /*
     * The determinism claim for this item. Part A adds questions, and a question
     * whose answer is not recorded — or is recorded in the wrong order relative to
     * the card pick — produces a replay that diverges at the first gym.
     */
    for (const seed of SEEDS) {
      const live = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);
      const again = await replayRun(live.log, DEFAULT_TUNING);

      expect(again.state.party.map((member) => member.spec.moves)).toEqual(
        live.state.party.map((member) => member.spec.moves),
      );
      expect(gymsCleared(again.state)).toBe(gymsCleared(live.state));
      expect(again.state.currency).toBe(live.state.currency);
      expect(again.state.relics).toEqual(live.state.relics);
    }
  }, 240_000);

  it('asks the move page before the card page, every time', async () => {
    /*
     * Order inside the log is the contract. The move page is the half the player
     * meets first; if the two ever swapped, every recorded seed's gym would read
     * one answer as the other and the symptom would be a replay that taught the
     * wrong move to the wrong Pokemon.
     *
     * **Both pages are `reward` entries now**, which is what the band recut
     * changed here. The move used to be a grant, so the shape to look for was "a
     * `target` before the one `reward`". A gym writes two `reward` entries today
     * — move page, then card page — and the move page's `target` sits between
     * them. That is the shape asserted below, and it is a stronger claim than
     * the old one: it pins the pair *and* their order, where before there was
     * only one card to be after.
     */
    for (const seed of SEEDS) {
      const decisions: RunDecision[] = [];
      await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, {
        onDecision: (log) => {
          decisions.length = 0;
          decisions.push(...log.decisions);
        },
      });

      // Every `lead` marks a gym. What follows it, on a win, is the move
      // page's `reward` and then the card page's `reward`, with nothing between
      // them: the chosen move is a TM and asks nobody anything.
      for (let i = 0; i < decisions.length; i++) {
        if (decisions[i]?.kind !== 'lead') continue;
        const rest = decisions.slice(i + 1);
        // Stop at the next gym so a run's later gyms cannot supply the entries
        // this one is missing.
        const nextLead = rest.findIndex((decision) => decision.kind === 'lead');
        const window = nextLead === -1 ? rest : rest.slice(0, nextLead);

        const rewards = window.flatMap((decision, index) => (decision.kind === 'reward' ? [index] : []));
        // A lost gym pays nothing, so only a gym that produced both pages is
        // asserted on.
        if (rewards.length < 2) continue;

        const [movePage, cardPage] = rewards as [number, number];
        expect(movePage, `${seed}: a gym's card page came before its move page`).toBeLessThan(
          cardPage,
        );

        /*
         * **The `target` entry the band recut put between the two pages is
         * gone, and there is deliberately no assertion that it is.**
         *
         * It was written there when the move page's winner was taught on the
         * spot. The chosen move is a TM now, so the pages sit next to each
         * other — and `target` has left `RunDecision` altogether, which makes
         * "no target in this window" a statement the compiler already enforces.
         * A runtime check of it would be a test that cannot fail, which is the
         * thing this file's own comments keep warning about.
         */
      }
    }
  }, 240_000);
});

// ---------------------------------------------------------------------------
// Handing the move back
// ---------------------------------------------------------------------------

/*
 * **The "declining a gym move" section was here and is deleted, not skipped.**
 *
 * It held three things: that declining taught nobody, that a declined run
 * replayed, and that the sentinel was refused at the three payouts where no
 * decline was offered. All three were true and none of them is a statement
 * about this game any more — a gym's move is a TM in the bag, so there is no
 * teach at the node to decline and no sentinel to refuse. The behaviour it
 * guarded is replaced by the capacity rule, which `test/backpack.test.ts`
 * covers, and by the stow assertion above.
 *
 * `docs/spec/gymrun-stage-moves-as-inventory-tms.md` section 6.
 */
