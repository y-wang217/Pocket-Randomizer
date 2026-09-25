/**
 * The exposure labels. **Milestone M6.1, design bible R7's enforce clause.**
 *
 * @vitest-environment jsdom
 *
 * R7: *"A test asserts each family's label renders on exposure 1 and 3 and not
 * on exposure 4."* Exposure 2 is asserted too, since a label on every visit
 * would pass a test that only looked at 1, 3 and 4.
 *
 * Every family is drawn the way the game draws it, through `glyphNode` for a
 * mark the sheet carries and `markFamily` for the two it does not (D41), so a
 * family the screens cannot report fails here rather than on a phone.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { GLYPH_FAMILIES, type GlyphFamily } from '../src/data/glyphFamilies';
import { bandChip, effectChip, statusChip } from '../src/ui/chip';
import { EXPOSURE_LABEL_CLASS, labelExposures } from '../src/ui/exposure-labels';
import { exposureCount, initSettings, resetExposureScreen, resetSettings, resetTutorial } from '../src/ui/settings';
import { glyphNode } from '../src/ui/theme/glyph';

/** One mark of each family, drawn by the code the screens use. */
const DRAW: Readonly<Record<GlyphFamily, () => HTMLElement>> = {
  type: () => glyphNode('type-fire', { label: 'Fire' }) as HTMLElement,
  category: () => glyphNode('category-physical') as HTMLElement,
  band: () => bandChip(3),
  pp: () => glyphNode('pp') as HTMLElement,
  accuracy: () => glyphNode('accuracy-target') as HTMLElement,
  priority: () => glyphNode('priority-up') as HTMLElement,
  effectiveness: () => effectChip('2', 'super'),
  status: () => statusChip('brn'),
  stat: () => glyphNode('stat-atk') as HTMLElement,
  capability: () => glyphNode('capability-cut') as HTMLElement,
  node: () => glyphNode('node-wild') as HTMLElement,
};

function screenWith(family: GlyphFamily): HTMLElement {
  const root = document.createElement('section');
  const slot = document.createElement('div');
  slot.append(DRAW[family]());
  root.append(slot);
  document.body.replaceChildren(root);
  return root;
}

const labels = (root: ParentNode): number => root.querySelectorAll(`.${EXPOSURE_LABEL_CLASS}`).length;

beforeEach(() => {
  globalThis.localStorage.clear();
  resetSettings();
  initSettings();
  resetExposureScreen();
});

describe.each(GLYPH_FAMILIES)('the %s family', (family) => {
  it('is labelled on exposures 1 and 3, and not on 2 or 4', () => {
    const seen: boolean[] = [];
    for (let visit = 1; visit <= 4; visit++) {
      // A different screen each time, so each visit is a new arrival.
      const root = screenWith(family);
      labelExposures(visit % 2 ? 'battle' : 'map', root);
      seen.push(labels(root) > 0);
    }
    expect(exposureCount(family)).toBe(4);
    expect(seen).toEqual([true, false, true, false]);
  });

  it('keeps its label through a redraw on the same visit, without counting twice', () => {
    let root = screenWith(family);
    labelExposures('battle', root);
    root = screenWith(family);
    labelExposures('battle', root);
    expect(exposureCount(family)).toBe(1);
    expect(labels(root)).toBeGreaterThan(0);
  });
});

describe('what an exposure is (D43)', () => {
  it('does not count a family under a hidden ancestor', () => {
    const root = screenWith('category');
    root.hidden = true;
    labelExposures('battle', root);
    expect(exposureCount('category')).toBe(0);
    expect(labels(root)).toBe(0);
  });

  it('puts one label after a band, not one per pip', () => {
    const root = screenWith('band');
    labelExposures('battle', root);
    expect(labels(root)).toBe(1);
    expect(root.querySelector('.band')?.nextElementSibling?.classList.contains(EXPOSURE_LABEL_CLASS)).toBe(true);
  });

  it('names the glyph, not the family: a fist says Physical', () => {
    const root = screenWith('category');
    labelExposures('battle', root);
    expect(root.querySelector(`.${EXPOSURE_LABEL_CLASS}`)?.textContent).toBe('Physical');
  });

  it('hides every label from assistive tech, since the glyph already carries the word', () => {
    const root = screenWith('type');
    labelExposures('battle', root);
    expect(root.querySelector(`.${EXPOSURE_LABEL_CLASS}`)?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the four defects the review found', () => {
  it('does not start the screen\'s visit again when the drawer opens and closes over it', () => {
    const screen = screenWith('category');
    const drawer = document.createElement('div');
    drawer.append(DRAW.type());
    document.body.append(drawer);
    for (let i = 0; i < 3; i++) {
      labelExposures('battle', screen);
      labelExposures('drawer', drawer, 'battle');
    }
    labelExposures('battle', screen);
    expect(exposureCount('category'), 'one battle visit, however often the drawer opened').toBe(1);
    expect(exposureCount('type'), 'the drawer counted once within the visit').toBe(1);
  });

  it('leaves a status chip readable, since its lettering is its only content', () => {
    const chip = statusChip('brn');
    expect(chip.textContent).toBe('BRN');
    expect(chip.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('takes a label off a screen whose DOM survives into a visit where the family is not due', () => {
    const root = screenWith('category');
    labelExposures('map', root);
    expect(labels(root)).toBe(1);
    labelExposures('battle', document.createElement('div'));
    labelExposures('map', root);
    expect(exposureCount('category')).toBe(2);
    expect(labels(root), 'visit 2 is not a due exposure').toBe(0);
  });

  it('takes a label away when the mark it names is hidden in place', () => {
    const root = screenWith('status');
    labelExposures('battle', root);
    expect(labels(root)).toBe(1);
    (root.querySelector('.badge--status') as HTMLElement).hidden = true;
    labelExposures('battle', root);
    expect(labels(root)).toBe(0);
  });

  it('labels the current screen again after "show tutorial again"', () => {
    const root = screenWith('pp');
    labelExposures('battle', root);
    labelExposures('battle', root);
    resetTutorial();
    const fresh = screenWith('pp');
    labelExposures('battle', fresh);
    expect(exposureCount('pp')).toBe(1);
    expect(labels(fresh)).toBe(1);
  });
});

describe('the driven browser store', () => {
  it('names every family, so no driven run meets a first-run label', async () => {
    const { EXPOSED_FAMILIES } = await import('../scripts/first-launch.mjs');
    expect([...EXPOSED_FAMILIES].sort()).toEqual([...GLYPH_FAMILIES].sort());
  });
});
