/**
 * The journey vignettes. **The map calm-down and journey vignettes patch,
 * bible Rev 30, D109**, its tests 4, 5 and 6, in jsdom.
 *
 * - 4: every moment and node kind has a manifest key and a caption within
 *   section 4's budget, and a moment with no drawing renders the placeholder
 *   at the drawing's size.
 * - 5: a beat never blocks input. A tap ends it at once, and neither the tap
 *   nor the click the browser sends after it reaches the screen beneath.
 * - 6: the setting off skips every beat; reduced motion keeps the frame still.
 *
 * Test 7 (every commit through the one seam) is `test/journey-seam.test.ts`,
 * test 8 (captions off the hash) `test/content-hash.test.ts`.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { VIGNETTE_CAPTION_MAX_WORDS, VIGNETTE_CAPTIONS, VIGNETTE_MOMENTS } from '../src/data/vignetteCopy';
import { assetIcon, MANIFEST, NATIVE, NODE_KINDS } from '../src/ui/assets/manifest';
import { DEFAULT_SETTINGS, initSettings, setVignettes } from '../src/ui/settings';
import { createJourney, renderVignette } from '../src/ui/vignette';

let host: HTMLElement;
let beneath: HTMLButtonElement;
let pressed: number;

function reducedMotion(on: boolean): void {
  globalThis.matchMedia = ((query: string) => ({ matches: on && query.includes('reduce'), media: query })) as unknown as typeof matchMedia;
}

beforeEach(() => {
  globalThis.localStorage.clear();
  initSettings();
  reducedMotion(false);
  host = document.createElement('main');
  beneath = document.createElement('button');
  pressed = 0;
  beneath.addEventListener('click', () => pressed++);
  host.append(beneath);
  document.body.replaceChildren(host);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('every moment has a picture and a caption (test 4)', () => {
  it('covers every node kind and the return to the map', () => {
    expect([...VIGNETTE_MOMENTS].sort()).toEqual([...NODE_KINDS, 'return'].sort());
  });

  it('gives every moment a manifest key and a caption of at most five words', () => {
    for (const moment of VIGNETTE_MOMENTS) {
      expect(MANIFEST.has(`vignette:${moment}`), moment).toBe(true);
      const caption = VIGNETTE_CAPTIONS[moment];
      expect(caption.trim().length, moment).toBeGreaterThan(0);
      expect(caption.split(/\s+/).length, moment).toBeLessThanOrEqual(VIGNETTE_CAPTION_MAX_WORDS);
    }
    expect(VIGNETTE_CAPTION_MAX_WORDS).toBe(5);
  });

  it('gives every kind the same caption wherever it plays: one per kind, none per node', () => {
    // A caption is a function of the moment alone; the module exports no way
    // to word one node of a kind differently from another.
    const a = renderVignette({ moment: 'shop', locale: 'cave' });
    const b = renderVignette({ moment: 'shop', locale: 'shore' });
    expect(a.querySelector('.vignette__caption')?.textContent).toBe(b.querySelector('.vignette__caption')?.textContent);
  });

  it('renders the lettered chip at the drawing size where a moment has no drawing', () => {
    const icon = assetIcon('vignette:return');
    expect(icon.classList.contains('asset--placeholder')).toBe(true);
    expect(icon.textContent?.length).toBeGreaterThan(0);
    expect(icon.style.getPropertyValue('--asset-w')).toBe(String(NATIVE.silhouette.width));
    expect(icon.style.getPropertyValue('--asset-h')).toBe(String(NATIVE.silhouette.height));
    const layer = renderVignette({ moment: 'return', locale: null });
    expect(layer.querySelector('.vignette__sprite .asset--placeholder')).not.toBeNull();
  });

  it('stands the beat in the region: the locale map painting, under the scrim', () => {
    const layer = renderVignette({ moment: 'rest', locale: 'cave' });
    const stage = layer.querySelector<HTMLElement>('.vignette__stage')!;
    expect(stage.dataset['backdrop']).toBe('map-backdrop:cave');
    expect(stage.style.getPropertyValue('--map-scrim')).toBe(String(DEFAULT_DISPLAY_TUNING.mapScrimOpacity));
  });

  it('shows who the moment is about where there is someone', () => {
    const sprite = document.createElement('img');
    const layer = renderVignette({ moment: 'trainer', locale: 'cave', sprite });
    expect(layer.querySelector('.vignette__sprite img')).toBe(sprite);
  });
});

describe('a beat never blocks input (test 5)', () => {
  it('holds for the display number and then gets out of the way', async () => {
    vi.useFakeTimers();
    const journey = createJourney(host);
    let done = false;
    void journey.play({ moment: 'wild', locale: null }).then(() => (done = true));
    expect(host.querySelector('.vignette')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DEFAULT_DISPLAY_TUNING.vignetteMs - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(host.querySelector('.vignette')).toBeNull();
  });

  it('ends at once on a tap, and the tap reaches nothing under it', async () => {
    const journey = createJourney(host);
    const playing = journey.play({ moment: 'shop', locale: null });
    const layer = host.querySelector<HTMLElement>('.vignette')!;
    // A pointer that lands on the layer: taken there, in the capture phase.
    let heardBelow = 0;
    host.addEventListener('pointerdown', () => heardBelow++);
    layer.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    await playing;
    expect(journey.playing()).toBe(false);
    expect(heardBelow).toBe(0);
    // The same tap's click, sent after the layer has gone, onto the screen
    // the beat uncovered: swallowed once.
    beneath.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(pressed).toBe(0);
    // And the guard is one click deep: the next deliberate tap lands.
    beneath.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(pressed).toBe(1);
  });

  it('takes a click on the layer itself and lets none through', async () => {
    const journey = createJourney(host);
    const playing = journey.play({ moment: 'event', locale: null });
    const layer = host.querySelector<HTMLElement>('.vignette')!;
    let heardBelow = 0;
    host.addEventListener('click', () => heardBelow++);
    layer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await playing;
    expect(heardBelow).toBe(0);
  });

  it('draws the screen it leads to beneath it, before it lifts', async () => {
    vi.useFakeTimers();
    const journey = createJourney(host);
    let drawn = false;
    const playing = journey.play({ moment: 'return', locale: null }, () => (drawn = true));
    expect(drawn).toBe(true);
    expect(host.querySelector('.vignette')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DEFAULT_DISPLAY_TUNING.vignetteMs);
    await playing;
  });

  it('never stacks: a second beat ends the first', async () => {
    const journey = createJourney(host);
    const first = journey.play({ moment: 'return', locale: null });
    const second = journey.play({ moment: 'wild', locale: null });
    await first;
    expect(host.querySelectorAll('.vignette')).toHaveLength(1);
    journey.cancel();
    await second;
    expect(host.querySelector('.vignette')).toBeNull();
  });
});

describe('the setting and reduced motion (test 6)', () => {
  it('defaults on', () => {
    expect(DEFAULT_SETTINGS.vignettes).toBe('on');
  });

  it('skips every beat when off, still drawing what lies beneath', async () => {
    setVignettes('off');
    const journey = createJourney(host);
    for (const moment of VIGNETTE_MOMENTS) {
      let drawn = false;
      await journey.play({ moment, locale: null }, () => (drawn = true));
      expect(drawn, moment).toBe(true);
      expect(host.querySelector('.vignette'), moment).toBeNull();
    }
  });

  it('keeps the frame still under reduced motion, and a tap still skips it', async () => {
    reducedMotion(true);
    const journey = createJourney(host);
    const playing = journey.play({ moment: 'rest', locale: null });
    const layer = host.querySelector<HTMLElement>('.vignette')!;
    expect(layer.dataset['still']).toBe('true');
    layer.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    await playing;
    expect(host.querySelector('.vignette')).toBeNull();
  });

  it('moves when motion is allowed, over a third of the hold', () => {
    const journey = createJourney(host);
    void journey.play({ moment: 'gym', locale: null });
    const layer = host.querySelector<HTMLElement>('.vignette')!;
    expect(layer.dataset['still']).toBe('false');
    expect(layer.style.getPropertyValue('--vignette-duration')).toBe(`${DEFAULT_DISPLAY_TUNING.vignetteMs}ms`);
    journey.cancel();
  });
});
