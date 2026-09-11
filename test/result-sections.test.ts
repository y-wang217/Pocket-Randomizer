/**
 * The result screen's new sections, in a DOM. **Stage 4.8, items 1, 4, 5 and 6.**
 *
 * @vitest-environment jsdom
 *
 * The run summary *is* the result screen, and this patch gave it four things: a score
 * with its parts shown, the slot readout, the graveyard, and a button that puts the
 * whole run on the clipboard. `scoring.test.ts` and `share-text.test.ts` own the pure
 * functions; this owns what reaches the screen.
 *
 * jsdom rather than a browser for the same reason `test/threat-readout.test.ts` gives:
 * nothing here is about layout. These are assertions about which elements exist, in
 * what order, carrying which text — and the most important of them are *negatives*,
 * which is the kind of rule a plausible one-line change violates.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { hasRoom } from '../src/core/acquisition';
import { deathsFrom } from '../src/core/graveyard';
import { playRun, scriptedRunPolicy, type RunPolicy, type RunResult } from '../src/core/run';
import { scoreRun } from '../src/core/scoring';
import { createSummary } from '../src/ui/screens/summary';
import { SCORE_COMPONENTS } from '../src/data/scoring';
import { DEFAULT_TUNING } from '../src/data/tuning';

/** Catches whatever it can, so the run has captures, deaths and relics in it. */
function catcher(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseAcquisition: async (_offer, party, capacity) =>
      hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
  };
}

let result: RunResult;

beforeEach(() => {
  document.body.replaceChildren();
});

describe('the result screen', () => {
  it('renders a run without throwing, and mounts every new section', async () => {
    result = await playRun('RESULT-A', catcher(), DEFAULT_TUNING);
    const summary = createSummary();
    summary.render(result);
    document.body.append(summary.root);

    expect(summary.root.querySelector('.summary__score')).toBeTruthy();
    expect(summary.root.querySelector('.summary__score-total')).toBeTruthy();
    expect(summary.root.querySelector('.summary__slots')).toBeTruthy();
  }, 240_000);

  it('shows the score total and every component, weight zero included', async () => {
    const summary = createSummary();
    summary.render(result);

    const score = scoreRun(result.state);
    expect(summary.root.querySelector('.summary__score-total')?.textContent).toContain(
      String(score.total),
    );

    // Every component, in the declared order. A breakdown that hid the zero-weighted
    // row would be hiding the column a later pace decision reads.
    const labels = [...summary.root.querySelectorAll('.summary__score-label')].map(
      (node) => node.textContent,
    );
    expect(labels).toHaveLength(SCORE_COMPONENTS.length);
    expect(labels).toContain('Turns taken');
  }, 240_000);

  it('states the slots and the next unlock as attributes, with no advice', async () => {
    const summary = createSummary();
    summary.render(result);

    const text = summary.root.querySelector('.summary__slots')?.textContent ?? '';
    expect(text).toMatch(/^Party slots: \d+\./);
    // Part 4: the sentence that must not be here.
    expect(text).not.toMatch(/should|save|keep|better|best|try/i);
  }, 240_000);

  it('lists the graveyard in run order when there is one, and hides it when not', async () => {
    const summary = createSummary();
    summary.render(result);

    const deaths = deathsFrom(result.state);
    const rows = [...summary.root.querySelectorAll('.summary__grave-row')];
    expect(rows).toHaveLength(deaths.length);

    const grave = summary.root.querySelector('.summary__grave') as HTMLElement | null;
    expect(grave?.hidden).toBe(deaths.length === 0);

    // Each row is the same line the clipboard gets, so the two cannot drift.
    // 4.8.0.1: the line names the species, and the nickname the record still
    // carries is not printed.
    rows.forEach((row, index) => {
      const death = deaths[index];
      expect(row.textContent).toContain(death!.species);
      if (death!.nickname !== death!.species) expect(row.textContent).not.toContain(death!.nickname);
    });
  }, 240_000);

  it('renders members by species, never by the nickname the spec carries', async () => {
    const summary = createSummary();
    summary.render(result);

    const names = [...summary.root.querySelectorAll('.summary__team .starter__name')].map(
      (node) => node.textContent ?? '',
    );
    expect(names.length).toBeGreaterThan(0);
    for (const [index, name] of names.entries()) {
      const member = result.state.party[index];
      expect(name, 'a member rendered under something other than its species').toBe(
        member?.spec.species,
      );
    }
  }, 240_000);

  it('offers one copy action for the whole run, beside the seed one', async () => {
    const summary = createSummary();
    summary.render(result);

    const labels = [...summary.root.querySelectorAll('.summary__actions button')].map(
      (node) => node.textContent,
    );
    expect(labels).toContain('Copy result');
    expect(labels).toContain('Copy seed');
  }, 240_000);

  it('keeps exactly one primary action, which the new button must not become', async () => {
    // The V0 rule, and the reason the share button is hollow: two accents on a screen
    // is two things claiming to be the way forward.
    const summary = createSummary();
    summary.render(result);
    expect(summary.root.querySelectorAll('.primary-action')).toHaveLength(1);
  }, 240_000);

  it('renders a run that lost nobody without an empty graveyard heading', async () => {
    /*
     * The negative that a screen gets wrong by default: a heading over nothing reads
     * as a section that failed to load. Built by hand rather than played, because a
     * run with no casualties at all is not something a seed can be relied on for.
     */
    const clean: RunResult = {
      ...result,
      state: { ...result.state, history: result.state.history.map((v) => ({ ...v, casualties: [] })) },
    };
    const summary = createSummary();
    summary.render(clean);

    expect(deathsFrom(clean.state)).toEqual([]);
    expect((summary.root.querySelector('.summary__grave') as HTMLElement).hidden).toBe(true);
    expect((summary.root.querySelectorAll('.summary__section')[2] as HTMLElement | undefined)?.hidden).toBeDefined();
  }, 240_000);
});
