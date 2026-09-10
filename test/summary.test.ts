/**
 * The run summary as payoff. Stage V4.
 *
 * @vitest-environment jsdom
 *
 * The tier row for every value 0 to 8, the route's dots against the decision
 * log, the coverage wheel's eighteen spokes, the cause band absent on a
 * victory, and the rule that this stage touched nothing under `data/`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { dataDigest } from '../scripts/visual/baseline';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { gymsCleared, playRun, scriptedRunPolicy, type RunResult } from '../src/core/run';
import { TIER_ROWS, tierRowFor } from '../src/ui/copy/summary';
import { createSummary } from '../src/ui/screens/summary';

const run = (seed: string): Promise<RunResult> => playRun(seed, scriptedRunPolicy(greedyAiPolicy), undefined, { opponent: greedyAiPolicy });

describe('the tier table', () => {
  it('lands every value 0 to 8 on exactly one row, and bolds it', () => {
    for (let cleared = 0; cleared <= 8; cleared++) {
      const row = tierRowFor(cleared);
      expect(TIER_ROWS.filter((r) => cleared >= r.min && cleared <= r.max)).toEqual([row]);
    }
    expect(TIER_ROWS.map((r) => r.range)).toEqual(['0 – 2', '3 – 4', '5 – 6', '7', '8']);
  });

  it('bolds the row the run landed on, in the DOM, for a played run', async () => {
    const result = await run('SMOKE24');
    const summary = createSummary();
    summary.render(result);
    const cleared = gymsCleared(result.state);
    const rows = [...summary.root.querySelectorAll('.tiers__row')];
    expect(rows).toHaveLength(5);
    const bold = rows.filter((row) => row.classList.contains('tiers__row--here'));
    expect(bold).toHaveLength(1);
    expect(bold[0]?.querySelector('.tiers__range')?.textContent).toBe(tierRowFor(cleared).range);
    expect(bold[0]?.getAttribute('aria-current')).toBe('true');
    expect(summary.root.querySelector('.summary__gyms-count')?.textContent).toBe(String(cleared));
  }, 60_000);
});

describe('the decoration', () => {
  it('draws one dot per node taken on SMOKE24, and the non-gym dots equal the logged node decisions', async () => {
    const result = await run('SMOKE24');
    const summary = createSummary();
    summary.render(result);
    const dots = [...summary.root.querySelectorAll('.route__dot')];
    expect(dots).toHaveLength(result.state.history.length);
    const nodeDecisions = result.log.decisions.filter((decision) => decision.kind === 'node').length;
    expect(dots.filter((dot) => !dot.classList.contains('route__dot--gym'))).toHaveLength(nodeDecisions);
    expect(dots.filter((dot) => dot.classList.contains('route__dot--gym'))).toHaveLength(result.state.history.filter((v) => v.node.kind === 'gym').length);
    // A defeat marks its last dot; eight bands, the walked ones in a locale.
    expect(result.outcome).toBe('defeat');
    expect(dots[dots.length - 1]?.classList.contains('route__dot--death')).toBe(true);
    const bands = [...summary.root.querySelectorAll('.route__band')];
    expect(bands).toHaveLength(8);
    expect(bands.filter((band) => !band.classList.contains('route__band--unreached'))).toHaveLength(result.state.currentSegment + 1);
    // The wheel, the party in slots, the cause band present.
    expect(summary.root.querySelectorAll('.coverage__spoke')).toHaveLength(18);
    expect(summary.root.querySelectorAll('.summary__member')).toHaveLength(result.state.party.length);
    expect(summary.root.querySelectorAll('.summary__member .move--card').length).toBeGreaterThan(0);
    expect((summary.root.querySelector('.summary__cause') as HTMLElement).hidden).toBe(false);
    expect(summary.root.querySelector('.summary__outcome')?.textContent).toBe('FALLEN');
  }, 60_000);

  it('is the same screen on a victory with the top word changed and no cause band', async () => {
    const result = await run('V4-3');
    expect(result.outcome).toBe('victory');
    const summary = createSummary();
    summary.render(result);
    expect(summary.root.querySelector('.summary__outcome')?.textContent).toBe('VICTORY');
    expect((summary.root.querySelector('.summary__cause') as HTMLElement).hidden).toBe(true);
    expect(summary.root.querySelectorAll('.route__dot--death')).toHaveLength(0);
    expect(summary.root.querySelectorAll('.tiers__row--here .tiers__range')[0]?.textContent).toBe('8');
    // One accent: rematch. Copy seed and new seed are hollow.
    expect(summary.root.querySelectorAll('.primary-action')).toHaveLength(1);
    expect(summary.root.querySelector('.primary-action')?.textContent).toBe('Rematch this seed');
    expect(summary.root.querySelectorAll('.summary__actions .button--hollow')).toHaveLength(2);
  }, 120_000);
});

describe('nothing under data/ moved', () => {
  it('leaves the data digest identical to the baseline', () => {
    const baseline = readFileSync(join(process.cwd(), 'docs/visual/baseline/data-digest.txt'), 'utf8').trim();
    expect(dataDigest()).toBe(baseline);
  });
});
