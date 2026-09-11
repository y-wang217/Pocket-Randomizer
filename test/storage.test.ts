/**
 * A saved run must load again. Every kind of decision, not three of them.
 *
 * @vitest-environment jsdom
 *
 * The shape check in `ui/storage.ts` accepted `starter`, `node` and `battle`
 * from Stage 1 until Stage V1, and every kind added after Stage 1 made a saved
 * log unloadable: the reload started a fresh seed with the log still in
 * storage, and nothing said so. So this plays a real run, saves the log at
 * every decision, and loads each one back, so a new kind that the check does
 * not know is a red test rather than a quiet fresh seed.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { currentVersions, isReplayable, playRun, scriptedRunPolicy } from '../src/core/run';
import type { RunLog } from '../src/core/types';
import { clearRunLog, loadRunLog, saveRunLog } from '../src/ui/storage';

beforeEach(() => {
  clearRunLog();
});

describe('the run log round trip', () => {
  it('loads every log a real run saves, whatever kinds it holds', async () => {
    const logs: RunLog[] = [];
    await playRun('SMOKE24', scriptedRunPolicy(greedyAiPolicy), undefined, {
      opponent: greedyAiPolicy,
      onDecision: (log) => logs.push(structuredClone(log)),
    });
    const kinds = new Set(logs[logs.length - 1]?.decisions.map((decision) => decision.kind));
    // The run has to exercise more than the three kinds the old check knew.
    expect([...kinds]).toEqual(expect.arrayContaining(['starter', 'locale', 'node', 'battle', 'reward']));

    for (const log of logs) {
      saveRunLog(log);
      const loaded = loadRunLog();
      expect(loaded, `log with ${log.decisions.length} decisions loads`).toEqual(log);
      expect(loaded && isReplayable(loaded)).toBe(true);
    }
  }, 120_000);

  it('still rejects a log whose decisions are not decisions', () => {
    globalThis.localStorage.setItem(
      'gymrun.lastRun',
      JSON.stringify({ seed: 'X', versions: currentVersions(), decisions: [{ kind: 'locale' }] }),
    );
    expect(loadRunLog()).toBeNull();
    globalThis.localStorage.setItem(
      'gymrun.lastRun',
      JSON.stringify({ seed: 'X', versions: currentVersions(), decisions: [{ kind: 'wish', index: 1 }] }),
    );
    expect(loadRunLog()).toBeNull();
  });
});
