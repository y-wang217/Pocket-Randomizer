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
import type { ItemPlan, RunDecision, RunLog } from '../src/core/types';
import { clearItemDraft, clearRunLog, loadItemDraft, loadRunLog, saveItemDraft, saveRunLog } from '../src/ui/storage';

beforeEach(() => {
  clearRunLog();
  clearItemDraft();
});

describe('the run log round trip', () => {
  it('loads every log a real run saves, whatever kinds it holds', async () => {
    const logs: RunLog[] = [];
    await playRun('S49B-1', scriptedRunPolicy(greedyAiPolicy), undefined, {
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

/**
 * The plan composed on the party screen and not yet spent survives a reload.
 * **The second QA pass, QA-008 and QA-009:** a taught TM and an item moved to
 * the bag both lived only in `app.ts` memory until the next boundary.
 */
describe('the unspent item plan across a reload', () => {
  const teach: ItemPlan = {
    assignments: [{ slot: 0, item: null }],
    discards: [],
    teaches: [{ move: 'Icy Wind', slot: 1, replaceSlot: 2 }],
    discardTms: [],
  };
  const log = (decisions: RunDecision[]): RunLog => ({ seed: 'QA-008', versions: currentVersions(), decisions });
  const head: RunDecision[] = [
    { kind: 'starter', index: 0 },
    { kind: 'locale', index: 0 },
    { kind: 'node', index: 0 },
  ];

  it('comes back for the run and the moment it was composed in', () => {
    saveItemDraft({ seed: 'QA-008', decisions: head.length, plan: teach });
    expect(loadItemDraft(log(head))).toEqual(teach);
    // Walking on without spending it keeps it: it is spent at the next boundary.
    expect(loadItemDraft(log([...head, { kind: 'node', index: 1 }]))).toEqual(teach);
  });

  it('does not come back into another run, or past the entry that spent it', () => {
    saveItemDraft({ seed: 'QA-008', decisions: head.length, plan: teach });
    expect(loadItemDraft({ ...log(head), seed: 'OTHER' })).toBeNull();
    expect(loadItemDraft(log(head.slice(0, 1)))).toBeNull();
    expect(loadItemDraft(log([...head, { kind: 'items', plan: teach }]))).toBeNull();
    expect(loadItemDraft(log([...head, { kind: 'party', edit: { kind: 'reorder', from: 1, to: 0 } }]))).toBeNull();
    expect(
      loadItemDraft(log([...head, { kind: 'acquisition', decision: { kind: 'release', slot: 1 } }])),
    ).toBeNull();
    // An accepted capture appends and moves no slot, so the plan still stands.
    expect(loadItemDraft(log([...head, { kind: 'acquisition', decision: { kind: 'accept' } }]))).toEqual(teach);
  });

  it('is gone once cleared, and refuses a draft that is not a plan', () => {
    saveItemDraft({ seed: 'QA-008', decisions: head.length, plan: teach });
    clearItemDraft();
    expect(loadItemDraft(log(head))).toBeNull();
    globalThis.localStorage.setItem('gymrun.itemDraft', JSON.stringify({ seed: 'QA-008', decisions: 0, plan: {} }));
    expect(loadItemDraft(log(head))).toBeNull();
  });
});
