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
import { describeMove, describeSpecCard } from '../src/core/battle/driver';
import { moveCardData } from '../src/ui/move-detail';

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
    /*
     * One accent: rematch. Everything else on the row is hollow.
     *
     * **Stage 4.8, item 6 added a third: "Copy result".** The count is updated rather
     * than loosened to a minimum, because the thing worth asserting is that the new
     * button did *not* become a second accent — two primary actions on a screen is
     * two things claiming to be the way forward, and a `toBeGreaterThan` here would
     * have stopped noticing.
     */
    expect(summary.root.querySelectorAll('.primary-action')).toHaveLength(1);
    expect(summary.root.querySelector('.primary-action')?.textContent).toBe('Rematch this seed');
    expect(summary.root.querySelectorAll('.summary__actions .button--hollow')).toHaveLength(3);
  }, 120_000);
});

/**
 * The final party's move cards get the run's tuning, not `map`'s third argument.
 *
 * V5 gave `renderMember` a `tuning` parameter and left the call site a bare
 * `state.party.map(renderMember)`, which handed it the party array. The symptom
 * was silent rather than a crash: `tagsForFace` does
 * `slice(0, Math.max(0, undefined))`, `Math.max(0, undefined)` is `NaN`, and
 * `slice(0, NaN)` is empty — so every move card on this screen lost its face
 * tags while the other five surfaces kept up to three.
 *
 * This asserts the tags are *there*, against the count `moveCardData` produces
 * from the real tuning, rather than asserting "more than zero": a cap of 3 read
 * as 0 and a cap of 3 read as 3 are both non-crashing, and only the comparison
 * tells them apart. The guard below keeps the test from passing on a party whose
 * moves happen to carry no tags at all.
 */
describe('the final party cards are built against the run\'s tuning', () => {
  it('gives the summary the same face tags every other surface draws', async () => {
    const result = await run('SMOKE24');
    const summary = createSummary();
    summary.render(result);

    const members = [...summary.root.querySelectorAll('.summary__member')];
    expect(members.length).toBe(result.state.party.length);
    expect(members.length).toBeGreaterThan(0);

    let expectedTotal = 0;
    for (const member of result.state.party) {
      const detail = describeSpecCard(member.spec);
      for (const move of member.moves) {
        const facts = describeMove(move.name);
        if (!facts) continue;
        expectedTotal += moveCardData(
          { ...facts, maxPp: move.maxPp },
          result.state.tuning,
          { types: detail.types },
        ).tags.length;
      }
    }

    // Without this the assertion below could hold at 0 === 0 on a party that
    // simply has no tagged moves, which is the shape of the bug it is here for.
    expect(expectedTotal, 'this party must carry tagged moves or the test proves nothing').toBeGreaterThan(0);

    const drawn = summary.root.querySelectorAll('.summary__member-moves .move__tags .badge--tag, .summary__member-moves .move__tags .badge');
    expect(drawn.length).toBe(expectedTotal);
  }, 60_000);
});

describe('nothing under data/ moved', () => {
  it('leaves the data digest identical to the baseline', () => {
    const baseline = readFileSync(join(process.cwd(), 'docs/visual/baseline/data-digest.txt'), 'utf8').trim();
    expect(dataDigest()).toBe(baseline);
  });
});
