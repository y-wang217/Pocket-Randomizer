/**
 * A party edit is a logged decision. **The opening playtest QA, QA-001.**
 *
 * A reorder and a release made on the party screen used to change run state
 * directly and reach no log. A resume lost the lead the player chose, and a
 * fight fought after the edit replayed against a different party with the
 * same logged move indexes. These hold the fix: the edit is in the log, a
 * replay reproduces the run it was made in, and a save taken with the party
 * screen still open resumes with the edit applied.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { hasRoom } from '../src/core/acquisition';
import { playRun, replayRun, resumeRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { PartyEdit, PokemonState, RunLog } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

/**
 * Catches whenever there is room, and on every map step with two or more
 * members moves the last one to the front, the way a player sets a lead from
 * the party screen. Releases slot 1 once, the first time the party reaches
 * three, so the log carries both kinds.
 */
function editor(): RunPolicy {
  let edit: ((edit: PartyEdit) => void) | null = null;
  let released = false;
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    bindPartyEditor: (bound) => {
      edit = bound;
    },
    chooseNode: async (options, state) => {
      if (state.party.length >= 2) edit?.({ kind: 'reorder', from: state.party.length - 1, to: 0 });
      if (!released && state.party.length >= 3) {
        released = true;
        edit?.({ kind: 'release', slot: 1 });
      }
      const wild = options.findIndex((option) => option.kind === 'wild');
      return wild === -1 ? 0 : wild;
    },
    chooseAcquisition: async (_offer, party, capacity) => (hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' }),
  };
}

const SEEDS = Array.from({ length: 20 }, (_unused, index) => `PARTY-EDIT-${index}`);

async function editedRun(): Promise<Awaited<ReturnType<typeof playRun>>> {
  for (const seed of SEEDS) {
    const run = await playRun(seed, editor(), DEFAULT_TUNING);
    const kinds = new Set(run.log.decisions.flatMap((decision) => (decision.kind === 'party' ? [decision.edit.kind] : [])));
    if (kinds.has('reorder') && kinds.has('release')) return run;
  }
  throw new Error('no seed in SEEDS produced a run with both a reorder and a release');
}

const species = (party: readonly PokemonState[]): string[] => party.map((member) => member.spec.species);

describe('a party edit', () => {
  it('is logged, and a replay reproduces the run it was made in', async () => {
    const original = await editedRun();
    const replayed = await replayRun(original.log);

    expect(replayed.log.decisions).toEqual(original.log.decisions);
    expect(replayed.outcome).toBe(original.outcome);
    expect(species(replayed.state.party)).toEqual(species(original.state.party));
    expect(replayed.state.backpack).toEqual(original.state.backpack);
  }, 240_000);

  it('made while a question was open resumes with the edit applied', async () => {
    const original = await editedRun();
    const at = original.log.decisions.findIndex((decision) => decision.kind === 'party' && decision.edit.kind === 'reorder');

    // The party right after that edit, in the run that made it. The editor
    // fires `onState` once it has applied an edit, with the edit already logged.
    let after: string[] | null = null;
    let logged = 0;
    await playRun(original.state.seed, editor(), DEFAULT_TUNING, {
      onDecision: (log) => {
        logged = log.decisions.length;
      },
      onState: (state) => {
        if (logged === at + 1 && !after) after = species(state.party);
      },
    });
    expect(after, 'the edit never reported its state').not.toBeNull();

    // Saved with the party screen still open: the edit is the last entry.
    const saved: RunLog = { ...original.log, decisions: original.log.decisions.slice(0, at + 1) };
    let seen: string[] | null = null;
    const tail: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseNode: async (options, state) => {
        seen ??= species(state.party);
        return Math.max(0, options.findIndex((option) => option.kind === 'wild'));
      },
    };
    await resumeRun(saved, tail, DEFAULT_TUNING);

    expect(seen).toEqual(after);
  }, 240_000);

  it('is refused rather than clamped', async () => {
    let edit: ((edit: PartyEdit) => void) | null = null;
    let checked = false;
    const refusing: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      bindPartyEditor: (bound) => {
        edit = bound;
      },
      chooseNode: async (options, state) => {
        if (state.party.length === 1 && !checked) {
          checked = true;
          expect(() => edit?.({ kind: 'release', slot: 0 })).toThrow(/last member/);
          expect(() => edit?.({ kind: 'reorder', from: 0, to: 5 })).toThrow(/outside a party/);
        }
        return Math.max(0, options.findIndex((option) => option.kind === 'wild'));
      },
    };
    const run = await playRun('PARTY-EDIT-REFUSE', refusing, DEFAULT_TUNING);
    expect(checked).toBe(true);
    expect(run.log.decisions.some((decision) => decision.kind === 'party')).toBe(false);
  }, 120_000);
});
