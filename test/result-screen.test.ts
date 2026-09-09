/**
 * Every battle completion reaches the result screen. Item D.
 *
 * The failure this guards is the one the playtest found: a win that carried no
 * reward cards asked the policy nothing at all, so the player was dropped back
 * on the map with no confirmation the node had happened. The reward screen was
 * the only thing a finished fight could reach, and a fight with nothing to
 * offer reached nothing.
 *
 * **Asserted on the policy call, not on the DOM.** `reviewBattle` is what
 * `playRun` calls once per battle node, and a screen that is never asked to
 * render is a screen the player never sees — so counting calls against battle
 * nodes is the same claim as "the screen appeared", made in a form a headless
 * test can hold. The DOM half is covered by `scripts/smoke.mjs`, which clicks
 * through the real screen in a real browser.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import {
  createRun,
  playRun,
  scriptedRunPolicy,
  type BattleReview,
  type RunPolicy,
} from '../src/core/run';
import type { RunLog } from '../src/core/types';

/** The scripted baseline, driven by the same battle policy the sim uses. */
const baseline = (): RunPolicy => scriptedRunPolicy(greedyAiPolicy);

const seeds = ['RESULT-0', 'RESULT-1', 'RESULT-2', 'RESULT-3'];

/** The scripted baseline, plus a recorder for every review it is shown. */
function reviewing(): { policy: RunPolicy; reviews: BattleReview[] } {
  const reviews: BattleReview[] = [];
  const base = baseline();

  return {
    reviews,
    policy: {
      ...base,
      reviewBattle: async (review) => {
        reviews.push(review);
        // Take the first card when there is one, and answer null when there is
        // not — the two shapes the hook has to support.
        return review.offer ? 0 : null;
      },
    },
  };
}

describe('every battle completion reaches the result screen', () => {
  it('reviews exactly once per battle node, including rewardless wins', async () => {
    for (const seed of seeds) {
      const { policy, reviews } = reviewing();
      const run = await playRun(seed, policy);

      // One review per battle in the run's own history. Not "at least one":
      // a second review of the same node would be a second completion path,
      // which is what item D forbids.
      const battles = run.state.history.filter((visit) => visit.result !== null);
      expect(reviews, `${seed}`).toHaveLength(battles.length);

      // And every one of them saw the outcome that actually happened.
      for (const [index, visit] of battles.entries()) {
        expect(reviews[index]?.won).toBe(visit.result?.winner === 'p1');
      }
    }
  });

  /**
   * **The case that used to reach no screen at all, and the finding behind it.**
   *
   * Item D was written against "there is no result screen after wins that carry
   * no reward". After item E that exact case no longer exists: every battle node
   * either carries a tier (and therefore an offer) or is a gym (which now
   * carries one too), so *every won fight pays cards*. Item E closed the win
   * half of item D by accident.
   *
   * What was left uncovered — and is the real gap now — is the **loss**. A lost
   * fight has never asked the policy anything: no offer, no question, straight
   * to the summary with nothing to say what the party looked like when it went
   * down. That is what this asserts.
   *
   * The `offer === null` branch of the hook is therefore exercised by losses
   * rather than by rewardless wins, which is why `reviewing()` answers null for
   * it and why the identical-log test below matters: the branch is live.
   */
  it('reviews a fight the player lost, which reached no screen before', async () => {
    const losses: BattleReview[] = [];

    for (const seed of seeds) {
      const { policy, reviews } = reviewing();
      await playRun(seed, policy);
      losses.push(...reviews.filter((review) => !review.won));
    }

    expect(losses.length, 'no seed here lost a fight — the fixture is stale').toBeGreaterThan(0);
    for (const loss of losses) {
      expect(loss.offer).toBeNull();
      expect(loss.currencyEarned).toBe(0);
      // The party is still carried, which is the whole point: a defeat screen
      // that could not show what went down would be a title and nothing else.
      expect(loss.party.length).toBeGreaterThan(0);
    }
  });

  /**
   * The invariant item E created, recorded so a regression is loud.
   *
   * If a future node kind fields a battle and draws no cards, this fails and
   * the rewardless-win path is live again — which is fine and is what the
   * screen already handles, but it should be a decision rather than a surprise.
   */
  it('offers cards for every fight the player wins', async () => {
    for (const seed of seeds) {
      const { policy, reviews } = reviewing();
      await playRun(seed, policy);
      for (const review of reviews) {
        if (review.won) {
          expect(review.offer, `${review.node.id} won and offered nothing`).not.toBeNull();
        }
      }
    }
  });

  it('carries the party as the fight left it, before the node boundary heals', async () => {
    const { policy, reviews } = reviewing();
    await playRun('RESULT-PARTY', policy);

    expect(reviews.length).toBeGreaterThan(0);
    for (const review of reviews) {
      expect(review.party.length).toBeGreaterThan(0);
      // Post-battle state, so HP is a real number and a fainted member is still
      // fainted — `betweenNodes` has not run yet.
      for (const member of review.party) {
        expect(member.hp).toBeGreaterThanOrEqual(0);
        expect(member.hp).toBeLessThanOrEqual(member.maxHp);
        if (member.fainted) expect(member.hp).toBe(0);
      }
    }
  });

  it('reports currency only for a win, and only what the node pays', async () => {
    const { policy, reviews } = reviewing();
    await playRun('RESULT-COINS', policy);

    for (const review of reviews) {
      if (!review.won) expect(review.currencyEarned).toBe(0);
      expect(review.currencyEarned).toBeGreaterThanOrEqual(0);
    }
    expect(reviews.some((review) => review.won && review.currencyEarned > 0)).toBe(true);
  });

  it('never offers cards for a fight the player lost', async () => {
    for (const seed of seeds) {
      const { policy, reviews } = reviewing();
      await playRun(seed, policy);
      for (const review of reviews) {
        if (!review.won) expect(review.offer, 'a lost fight pays nothing').toBeNull();
      }
    }
  });
});

describe('the hook is a presentation, not a second path', () => {
  /**
   * **The property that makes `reviewBattle` optional rather than a fork.**
   *
   * A policy that implements it and one that does not must produce the *same
   * log* from the same seed — same decisions, same order, same indexes. If they
   * diverge, then answering through the result screen is a different run from
   * answering through `chooseReward`, and the simulator would be measuring a
   * game nobody plays.
   */
  it('writes an identical log whether the review hook answered or chooseReward did', async () => {
    for (const seed of seeds) {
      const base = baseline();

      // Through chooseReward, which is what the sim and every replay use.
      const withoutHook = await playRun(seed, base);

      // Through reviewBattle, answering with exactly what chooseReward would.
      const withHook = await playRun(seed, {
        ...base,
        reviewBattle: async (review, state) =>
          review.offer ? await base.chooseReward(review.offer, state) : null,
      });

      expect(logOf(withHook), `${seed}`).toEqual(logOf(withoutHook));
    }
  });

  it('falls back to chooseReward when no review hook is given', async () => {
    let asked = 0;
    const base = baseline();
    const run = await playRun('RESULT-FALLBACK', {
      ...base,
      chooseReward: async (offer, state) => {
        asked++;
        return base.chooseReward(offer, state);
      },
    });

    // The headless path is untouched: no review hook, and the reward question
    // still gets asked exactly where it always was.
    expect(asked).toBeGreaterThan(0);
    expect(run.log.decisions.filter((decision) => decision.kind === 'reward')).toHaveLength(asked);
  });
});

function logOf(run: { log: RunLog }): RunLog {
  return JSON.parse(JSON.stringify(run.log)) as RunLog;
}

/** A guard on the fixture itself: these seeds must produce real runs. */
describe('the seeds used above', () => {
  it('generate maps with battles in them', () => {
    for (const seed of seeds) {
      expect(createRun(seed).segments.length).toBeGreaterThan(0);
    }
  });
});
