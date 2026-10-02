/**
 * A run resumed on a fight's result is asked what it was asked the first time,
 * in the same order. **The second QA pass, QA-006.**
 *
 * The replay policy had no `reviewBattle`, so a run saved between the last
 * battle choice and the card asked the live player the capture first and the
 * cards after it, the reverse of the live order, with no result screen. Now the
 * replay hands the review to the live policy where its log has run out, and
 * says "not reviewed" where the log still holds the node's answers.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, resumeRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { RunLog } from '../src/core/types';

/** The scripted baseline with a result screen, recording which question came first. */
function reviewing(): { policy: RunPolicy; asked: string[] } {
  const asked: string[] = [];
  const base = scriptedRunPolicy(greedyAiPolicy);
  const note =
    <A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) =>
    (...args: A): Promise<R> => {
      asked.push(name);
      return fn(...args);
    };
  return {
    asked,
    policy: {
      ...base,
      reviewBattle: note('review', async (review, state) =>
        review.offer ? base.chooseReward(review.offer, state) : null,
      ),
      chooseAcquisition: note('acquisition', base.chooseAcquisition),
      chooseReward: note('reward', base.chooseReward),
      chooseNode: note('node', base.chooseNode),
      chooseItemPlan: note('items', base.chooseItemPlan),
    },
  };
}

describe('resuming on a battle result', () => {
  it('shows the result first, and replays to the same run from every point', async () => {
    const saves: RunLog[] = [];
    const original = await playRun('QA006-0', reviewing().policy, undefined, {
      onDecision: (log) => saves.push(structuredClone(log)),
    });
    const full = original.log.decisions;

    let afterFight = 0;
    let afterCapture = 0;
    for (const save of saves) {
      const at = save.decisions.length;
      const last = save.decisions[at - 1]?.kind;
      const upcoming = full[at]?.kind;
      if (upcoming !== 'acquisition' && upcoming !== 'reward') continue;

      const { policy, asked } = reviewing();
      const resumed = await resumeRun(save, policy);
      expect(resumed.log.decisions, `resuming after ${at} decisions`).toEqual(full);

      if (last === 'battle') {
        afterFight++;
        expect(asked[0], `the result comes first after ${at}`).toBe('review');
      }
      if (last === 'acquisition') {
        afterCapture++;
        // The capture is logged and the card is not: the card is asked alone.
        expect(asked[0], `the card comes next after ${at}`).toBe('reward');
      }
    }
    expect(afterFight).toBeGreaterThan(0);
    expect(afterCapture).toBeGreaterThan(0);
  }, 120_000);
});
