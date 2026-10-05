/**
 * Defender Mode v0, step 6: the benchmark bot does what the prompt says it
 * does, so the rows it produces measure what they claim to.
 */
import { describe, expect, it } from 'vitest';

import { defenderBenchPolicy } from '../src/core/defender/bench';
import { playRun, type RunState } from '../src/core/run';
import { DEFENDER_GYM_TYPES } from '../src/data/defender';
import { DEFAULT_TUNING } from '../src/data/tuning';

describe('the defender benchmark bot', () => {
  it('plays each gym type to an outcome: first door, never a trade, a consumable only under half HP', async () => {
    for (const [index, gymType] of DEFENDER_GYM_TYPES.entries()) {
      let before: RunState | null = null;
      const run = await playRun(`BENCH-${gymType}`, defenderBenchPolicy(index), DEFAULT_TUNING, {
        mode: 'defender',
        onState: (state) => {
          before = state;
        },
        onNodeResolved: (_before, _after, result) => {
          expect(result.reward?.kind).not.toBe('trade');
        },
        onDecision: (log) => {
          const last = log.decisions[log.decisions.length - 1];
          if (last?.kind === 'party' && last.edit.kind === 'consume') {
            const member = before?.party[last.edit.slot];
            expect(member && member.hp * 2 < member.maxHp).toBe(true);
          }
        },
      });
      expect(['victory', 'defeat']).toContain(run.outcome);
      expect(run.state.defender?.gymType).toBe(gymType);
      for (const visit of run.state.history) {
        if (visit.node.kind === 'trainer') expect(visit.node.id).toMatch(/-0$/);
      }
      expect(run.log.decisions.filter((d) => d.kind === 'door').every((d) => d.kind === 'door' && d.index === 0)).toBe(true);
    }
  }, 120_000);
});
