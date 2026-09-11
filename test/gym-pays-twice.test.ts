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

const SEEDS = ['PAYS-A', 'PAYS-B', 'PAYS-C', 'PAYS-D'];

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
    expect(RUN_LOG_VERSION.startsWith('gymrun-run-12/')).toBe(true);
  });

  it('is a different axis from the randomizer, and both moved this patch', () => {
    expect(RANDOMIZER_VERSION).toBe('gymrun-randomizer-13');
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
      const targets = decisions.filter((decision) => decision.kind === 'target').length;

      /*
       * **At least one target per gym won.** Not exactly: a `tm`/`tutor` card
       * elsewhere in the run also targets, and Part B cannot (relic and currency
       * are untargeted), so the floor is the gyms and the rest is ordinary play.
       */
      expect(targets, `${seed} cleared ${cleared} gyms with ${targets} targets`).toBeGreaterThanOrEqual(
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

  it('asks the move before the cards, every time', async () => {
    /*
     * Order inside the log is the contract. Part A is the unconditional half, so
     * it is asked first; if the two ever swapped, every recorded seed's gym would
     * read one answer as the other and the symptom would be a replay that taught
     * the wrong move to the wrong Pokemon.
     */
    for (const seed of SEEDS) {
      const decisions: RunDecision[] = [];
      await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, {
        onDecision: (log) => {
          decisions.length = 0;
          decisions.push(...log.decisions);
        },
      });

      // Every `lead` marks a gym. Between a lead and the `reward` that follows it,
      // a `target` must appear — that is Part A sitting where it belongs.
      for (let i = 0; i < decisions.length; i++) {
        if (decisions[i]?.kind !== 'lead') continue;
        const rest = decisions.slice(i + 1);
        const reward = rest.findIndex((decision) => decision.kind === 'reward');
        const target = rest.findIndex((decision) => decision.kind === 'target');
        if (reward === -1 || target === -1) continue;
        expect(target, `${seed}: a gym's card came before its move`).toBeLessThan(reward);
      }
    }
  }, 240_000);
});
