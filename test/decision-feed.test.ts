/**
 * The decision feed, headless. **Stage 5.0/1**, bible R11's carve-out (D55).
 *
 * Three properties, each the reason the feed is allowed to exist:
 *
 *   1. **It changes nothing.** A run played through the feed's wrapper logs
 *      the same decisions, byte for byte, as the same run played without it.
 *   2. **It is the log.** One line per logged decision, in logged order, each
 *      naming its kind, and no line left blank by a missing offer.
 *   3. **It survives a reload.** A run resumed from any save, with the feed
 *      wrapped around the replay, rebuilds the same lines as the run that
 *      was never interrupted. Nothing is persisted, so this is the only way
 *      the feed on a resumed run can be right.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, replayRunPolicy, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { RunLog } from '../src/core/types';
import { createDecisionFeed } from '../src/ui/decision-feed';

const SEED = 'FEED-1';

/**
 * A scripted run that also reorders the party once, so a party edit is logged.
 * `done` is for a resume whose log already holds the edit: the replay applies
 * it, and a live policy that made it again would be a different run.
 */
function editing(done = false): RunPolicy {
  const base = scriptedRunPolicy(greedyAiPolicy);
  let edit: ((edit: { kind: 'reorder'; from: number; to: number }) => void) | null = null;
  let reordered = done;
  return {
    ...base,
    bindPartyEditor: (bound) => {
      edit = bound;
    },
    chooseNode: async (options, state) => {
      if (!reordered && edit && state.party.length >= 2) {
        reordered = true;
        edit({ kind: 'reorder', from: 1, to: 0 });
      }
      return base.chooseNode(options, state);
    },
  };
}

async function played(policy: RunPolicy): Promise<{ log: RunLog; saves: RunLog[]; lines: string[] }> {
  const feed = createDecisionFeed(policy);
  const saves: RunLog[] = [];
  const result = await playRun(SEED, feed.policy, undefined, {
    onDecision: (log) => {
      saves.push(JSON.parse(JSON.stringify(log)) as RunLog);
      feed.record(log);
    },
  });
  return { log: result.log, saves, lines: feed.entries().map((entry) => entry.text) };
}

describe('the decision feed', () => {
  it('changes nothing: the log is byte for byte the run without it', async () => {
    const bare = await playRun(SEED, editing());
    const fed = await played(editing());
    expect(JSON.stringify(fed.log)).toBe(JSON.stringify(bare.log));
  }, 120_000);

  it('is the log: one named line per decision, in order', async () => {
    const feed = createDecisionFeed(editing());
    const result = await playRun(SEED, feed.policy, undefined, { onDecision: (log) => feed.record(log) });
    const entries = feed.entries();

    expect(entries.length).toBe(result.log.decisions.length);
    entries.forEach((entry, index) => {
      expect(entry.index).toBe(index);
      expect(entry.kind).toBe(result.log.decisions[index]?.kind);
      // A missing offer leaves a label with nothing after it, or worse.
      expect(entry.text, `${index}: ${entry.kind}`).not.toMatch(/·\s*$|undefined|null|NaN/);
    });

    // The run covers the kinds a real run does, so the check is not vacuous.
    const kinds = new Set(entries.map((entry) => entry.kind));
    for (const kind of ['starter', 'locale', 'node', 'battle', 'reward', 'party'] as const) {
      expect(kinds, kind).toContain(kind);
    }
    expect(entries[0]?.text).toMatch(/^Starter · /);
  }, 120_000);

  it('rebuilds the same lines on a run resumed from any save', async () => {
    const original = await played(editing());
    // Every twentieth save, and the last: resuming from all of them is the
    // replay suite's job, and this is about the feed, not the replay.
    const points = original.saves.filter((_, index) => index % 20 === 0).concat(original.saves.slice(-1));
    for (const save of points) {
      const edited = save.decisions.some((decision) => decision.kind === 'party');
      const feed = createDecisionFeed(replayRunPolicy(save, editing(edited)));
      await playRun(save.seed, feed.policy, undefined, { onDecision: (log) => feed.record(log) });
      expect(
        feed.entries().map((entry) => entry.text),
        `resumed after ${save.decisions.length} decisions`,
      ).toEqual(original.lines);
    }
  }, 600_000);
});
