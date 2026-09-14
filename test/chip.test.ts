/**
 * One chip component, and no chip built by hand anywhere else. Stage V2.
 *
 * @vitest-environment jsdom
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { bandChip, capabilityBandChip, capabilityChip, categoryChip, effectChip, neutralChip, stageChip, statusChip, tierChip, typeChip } from '../src/ui/chip';
import { renderRewardCard } from '../src/ui/screens/reward';
import { createRun } from '../src/core/run';
import { BAND_PIPS } from '../src/data/bandInfo';

const ROOT = process.cwd();

describe('the chip', () => {
  it('renders every variant on the one class, with its legacy class kept', () => {
    const cases: [HTMLElement, string[], string][] = [
      [typeChip('Fire'), ['chip', 'chip--type', 'type', 'type--fire'], 'Fire'],
      [tierChip('hard'), ['chip', 'chip--tier', 'tier', 'tier--hard'], 'HARD'],
      /*
       * **Patch 4.8.0.3 changed three of these strings, and the shape of two.**
       *
       * `bandChip` is four pips now and carries no text at all: the number
       * moved behind the tap it always had. `stageChip` prints the multiplier
       * a stage applies rather than the stage integer, because a stage integer
       * is a number only a Pokemon player can read — the integer survives on
       * the ladder the chip now contains and in its `aria-label`. The cases
       * are updated rather than dropped: what this test asserts is that every
       * variant is built through the one component and keeps its legacy class,
       * and that is as true of a meter as it was of a word.
       */
      [bandChip(3), ['chip', 'chip--band', 'band', 'band--3'], ''],
      [statusChip('brn'), ['chip', 'chip--status', 'badge', 'badge--status'], 'BRN'],
      [stageChip(2), ['chip', 'chip--stage', 'badge', 'badge--up'], '2.0x'],
      [stageChip(-1), ['chip', 'chip--stage', 'badge', 'badge--down'], '0.7x'],
      [capabilityChip('Requires Cut'), ['chip', 'chip--capability', 'node__gate-need'], 'Requires Cut'],
      [capabilityBandChip('neither'), ['chip', 'chip--capability-band', 'node__gate-band'], 'neither'],
      [categoryChip('Physical', 'PHYS'), ['chip', 'chip--category', 'badge', 'badge--category', 'badge--cat-physical'], 'PHYS'],
      [effectChip('2x', 'super'), ['chip', 'chip--effect', 'badge', 'badge--effect'], '2x'],
      [neutralChip('Lead', 'lead'), ['chip', 'chip--neutral', 'badge', 'badge--lead'], 'Lead'],
    ];
    for (const [node, classes, text] of cases) {
      expect([...node.classList], text).toEqual(expect.arrayContaining(classes));
      expect(node.textContent).toBe(text);
    }
    expect(bandChip(4).dataset['tip']).toBe('band:4');
    expect(statusChip('par').dataset['status']).toBe('par');
    expect(effectChip('0x', 'none').dataset['band']).toBe('none');
  });

  /**
   * **The badge moved at R12, and this assertion moved with it.**
   *
   * Through V2 this read `.reward__name .band`, which was the truth then: the
   * reward screen appended the badge to its own name line and was the only
   * caller of `bandChip`. R12 moved it into the shared move card, so it now
   * renders on eight surfaces and none of them is `.reward__name`.
   *
   * What stays here is the V2 rule this test was written for — the badge is
   * still the one chip component, still on the reward card, still reading
   * `BAND n`. Where it renders on every *other* surface, and that every one of
   * them resolves it through `bandOfMove`, is `test/band-badge.test.ts`.
   */
  it('keeps BAND n on the reward card, now inside the move card it describes', () => {
    const state = createRun('CHIP-BAND');
    const card = renderRewardCard({ kind: 'tm', move: 'Ice Beam' }, state, () => undefined);
    const badge = card.querySelector('.move .band');
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains('chip')).toBe(true);
    // Patch 4.8.0.3: the badge is a meter. The band it shows is still a number
    // between 1 and `BAND_PIPS`, read back as the count of lit pips, and the
    // word moved behind the tap the badge already had.
    const lit = badge?.querySelectorAll('.band__pip[data-on="true"]').length ?? 0;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThanOrEqual(BAND_PIPS);
    expect(badge?.querySelectorAll('.band__pip')).toHaveLength(BAND_PIPS);
    expect((badge as HTMLElement).dataset['tip']).toBe(`band:${lit}`);
    // And nowhere else on the card, so the two homes cannot both be live.
    expect(card.querySelectorAll('.band')).toHaveLength(1);
  });
});

describe('no screen builds a chip by hand', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
    });
  }

  it('builds tiers, bands, types, statuses, stages and gates through ui/chip.ts only', () => {
    const offenders = walk(join(ROOT, 'src/ui'))
      .filter((file) => !file.endsWith('chip.ts'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
        return /['"`](?:[a-z_ -]*\s)?(?:type type--|tier tier--|band band--|badge badge--(?:status|up|down|category|effect)|node__gate-(?:need|band))/.test(source);
      })
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
