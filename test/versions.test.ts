/**
 * The versions block, and the one guard over its four axes.
 *
 * `RunLog` carried `version` and `randomizerVersion` as two loose fields, each
 * with its own check and its own message, and nothing at all for the AI. The
 * `contentHash` release folds them into `versions` with four axes, checked by
 * one function in one order with one message format. What this file holds:
 *
 *   - A run's log carries the block, and every axis is the constant this
 *     build was built with — including `contentHash`, the hash of `src/data/`.
 *   - Each axis refuses independently. A log current on three axes and stale
 *     on the fourth is refused, and the message names that axis and both
 *     values, whichever axis it is.
 *   - A pre-block log (a real `gymrun-run-12` shape, two loose fields, no
 *     `versions`) is refused on the `runLog` axis with its old version quoted.
 *   - The bump itself happened: `RUN_LOG_VERSION` is past 12.
 *
 * Byte identity of the generated run is the sim fixture's job
 * (`test/sim-fixture.test.ts`) and the visual baseline's; this file is about
 * the header, which is the only thing the release changed.
 */
import { describe, expect, it } from 'vitest';

import { AI_VERSION, greedyAiPolicy } from '../src/core/battle/ai';
import { CONTENT_HASH } from '../src/core/contentHash';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import {
  assertReplayable,
  currentVersions,
  describeVersionMismatch,
  isReplayable,
  playRun,
  replayRun,
  RUN_LOG_VERSION,
  scriptedRunPolicy,
  VERSION_AXES,
  versionMismatch,
} from '../src/core/run';
import type { RunLog } from '../src/core/types';

describe('the versions block', () => {
  it('is recorded on every log, from the four constants', async () => {
    const run = await playRun('VERSIONS-BLOCK', scriptedRunPolicy(greedyAiPolicy));
    expect(run.log.versions).toEqual({
      runLog: RUN_LOG_VERSION,
      contentHash: CONTENT_HASH,
      aiVersion: AI_VERSION,
      randomizerVersion: RANDOMIZER_VERSION,
    });
    expect(run.log.versions).toEqual(currentVersions());
    // The hash really is a hash, and the AI axis really is the AI's constant —
    // read from `core/battle/ai.ts`, so the next patch bumps it there and
    // nowhere else.
    expect(run.log.versions.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(run.log.versions.aiVersion).toMatch(/^gymrun-ai-/);
    expect(Object.keys(run.log).sort()).toEqual(['decisions', 'seed', 'versions']);
  });

  it('names the four axes, schema first', () => {
    expect([...VERSION_AXES]).toEqual(['runLog', 'contentHash', 'aiVersion', 'randomizerVersion']);
  });

  it('moved RUN_LOG_VERSION for the block', () => {
    expect(RUN_LOG_VERSION.startsWith('gymrun-run-13/')).toBe(true);
    expect(RUN_LOG_VERSION).not.toContain('gymrun-run-12/');
  });
});

describe('the guard refuses each axis independently', () => {
  const decisions: RunLog['decisions'] = [{ kind: 'starter', index: 0 }];

  for (const axis of VERSION_AXES) {
    it(`refuses a log stale only on ${axis}, naming the axis and both values`, () => {
      const stale: RunLog = {
        seed: `STALE-${axis}`,
        versions: { ...currentVersions(), [axis]: `other-${axis}` },
        decisions,
      };
      expect(isReplayable(stale)).toBe(false);

      const mismatch = versionMismatch(stale);
      expect(mismatch).toEqual({ axis, recorded: `other-${axis}`, expected: currentVersions()[axis] });

      const message = describeVersionMismatch(mismatch!);
      expect(message).toContain(`mismatch on ${axis}`);
      expect(message).toContain(`other-${axis}`);
      expect(message).toContain(currentVersions()[axis]);
      expect(() => assertReplayable(stale)).toThrow(message);
      // Synchronously, before a single node is reconstructed.
      expect(() => replayRun(stale)).toThrow(new RegExp(`mismatch on ${axis}`));
    });
  }

  it('accepts a log recorded on this build', () => {
    const current: RunLog = { seed: 'CURRENT', versions: currentVersions(), decisions };
    expect(isReplayable(current)).toBe(true);
    expect(versionMismatch(current)).toBeNull();
    expect(() => assertReplayable(current)).not.toThrow();
  });

  it('reports the first stale axis in order when several are stale', () => {
    const stale: RunLog = {
      seed: 'TWO-STALE',
      versions: { ...currentVersions(), aiVersion: 'gymrun-ai-1', randomizerVersion: 'gymrun-randomizer-1' },
      decisions,
    };
    expect(versionMismatch(stale)?.axis).toBe('aiVersion');
  });
});

describe('a pre-block log', () => {
  /**
   * The literal shape a `gymrun-run-12` build wrote, not a synthetic one: two
   * loose fields and no `versions`. The refusal quotes the old `version` so
   * the player is told what their log was, not just that it is `(none)`.
   */
  it('is refused on the runLog axis with its old version quoted', () => {
    const prePatch = {
      seed: 'PRE-BLOCK',
      version: 'gymrun-run-12/gymrun-0.3.0',
      randomizerVersion: 'gymrun-randomizer-13',
      decisions,
    } as unknown as RunLog;

    expect(isReplayable(prePatch)).toBe(false);
    expect(versionMismatch(prePatch)).toEqual({
      axis: 'runLog',
      recorded: 'gymrun-run-12/gymrun-0.3.0',
      expected: RUN_LOG_VERSION,
    });
    expect(() => assertReplayable(prePatch)).toThrow(/mismatch on runLog/);
    expect(() => assertReplayable(prePatch)).toThrow(/gymrun-run-12\/gymrun-0\.3\.0/);
    expect(() => assertReplayable(prePatch)).toThrow(new RegExp(RUN_LOG_VERSION.replace(/[./]/g, '\\$&')));
  });

  it('with nothing at all is refused as (none)', () => {
    const bare = { seed: 'BARE', decisions } as unknown as RunLog;
    expect(versionMismatch(bare)).toEqual({ axis: 'runLog', recorded: '(none)', expected: RUN_LOG_VERSION });
  });

  const decisions: RunLog['decisions'] = [];
});
