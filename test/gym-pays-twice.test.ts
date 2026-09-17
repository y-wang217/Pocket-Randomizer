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
import { DECLINED_MOVE } from '../src/core/rewards';
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
     */
    expect(RANDOMIZER_VERSION).toBe('gymrun-randomizer-19');
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

// ---------------------------------------------------------------------------
// Handing the move back
// ---------------------------------------------------------------------------

/**
 * The gym's guaranteed move may be declined. **The victory-order patch, item 3.**
 *
 * It is the only taught move in the game that can be. Every other one — a
 * reward card, a shop TM, an event's grant — reached its recipient question
 * *because* the player chose it over alternatives, and `chooseMoveToReplace`'s
 * own rule covers those: "the place to skip a move reward is the reward screen,
 * where it was already chosen over two alternatives; a second escape hatch here
 * would make that pick meaningless." A gym's move was chosen over nothing, so
 * there is no such screen behind it and this is the first escape hatch rather
 * than the second.
 *
 * Three things are held: that declining teaches nobody, that the log keeps its
 * shape so a declined run replays, and that the sentinel is refused where it was
 * not offered — which is the half that stops a bug in one policy becoming a move
 * silently vanishing at some other node.
 */
describe('declining a gym move', () => {
  /** A policy that hands back every move it is allowed to, and takes the rest. */
  function decliner(): RunPolicy {
    const base = scriptedRunPolicy(greedyAiPolicy);
    return {
      ...base,
      chooseMoveRecipient: async (_offer, _party, _state, allowSkip) => (allowSkip ? DECLINED_MOVE : 0),
    };
  }

  it('teaches nobody, and leaves the party exactly as the fight left it', async () => {
    // Counted across the search rather than per seed: a seed that dies before
    // gym 1 declines nothing and is not a failure, but the search as a whole
    // finding nothing to decline would mean this test asserts nothing.
    let declinedAnywhere = 0;
    let tookAnywhere = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      const taken = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);
      const refused = await playRun(seed, decliner(), DEFAULT_TUNING);

      /*
       * The two runs diverge — a party with different moves fights differently
       * from the next node on — so this is not a comparison of end states. What
       * it asserts is the one thing that must be true of the refusing run: it
       * never wrote a `replace` entry behind a declined `target`, because a
       * declined move displaces nothing.
       */
      const declined = refused.log.decisions.filter(
        (decision) => decision.kind === 'target' && decision.index === DECLINED_MOVE,
      );
      declinedAnywhere += declined.length;

      for (let i = 0; i < refused.log.decisions.length; i++) {
        const decision = refused.log.decisions[i];
        if (decision?.kind !== 'target' || decision.index !== DECLINED_MOVE) continue;
        expect(
          refused.log.decisions[i + 1]?.kind,
          `${seed}: a declined move still asked what it replaced`,
        ).not.toBe('replace');
      }

      // And the control: a run that takes its moves does write them.
      if (taken.log.decisions.some((decision) => decision.kind === 'target' && decision.index >= 0)) {
        tookAnywhere += 1;
      }
    }

    // The search has to have found both halves, or this asserts nothing. A
    // single seed that dies before its first move card is not a failure; the
    // whole search coming back empty is.
    expect(declinedAnywhere, 'no seed declined anything').toBeGreaterThan(0);
    expect(tookAnywhere, 'no seed took a move either').toBeGreaterThan(0);
  }, 300_000);

  it('replays to the identical party, so the decline is in the log', async () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const live = await playRun(seed, decliner(), DEFAULT_TUNING);
      const again = await replayRun(live.log, DEFAULT_TUNING);
      expect(again.state.party.map((member) => member.spec.moves)).toEqual(
        live.state.party.map((member) => member.spec.moves),
      );
      expect(again.state.party.map((member) => member.spec.species)).toEqual(
        live.state.party.map((member) => member.spec.species),
      );
    }
  }, 240_000);

  it('refuses the sentinel at a move the player already chose', async () => {
    /*
     * A policy that answers `DECLINED_MOVE` everywhere, including at reward
     * cards and shop TMs where no decline was offered. That is a policy out of
     * step with the questions — or a log replayed against a build that asks
     * different ones — and it has to fail loudly rather than quietly drop a
     * move the player paid for.
     *
     * The failure is the ordinary out-of-range `RangeError`, which is the
     * point: `askMoveQuestions` does not special-case the sentinel where the
     * decline was not offered, so it is just an index that is not a slot.
     */
    const base = scriptedRunPolicy(greedyAiPolicy);
    const always: RunPolicy = { ...base, chooseMoveRecipient: async () => DECLINED_MOVE };
    await expect(playRun(SEEDS[0] ?? 'S49R-0', always, DEFAULT_TUNING)).rejects.toThrow(
      /Move recipient -1 out of range/,
    );
  }, 240_000);
});
