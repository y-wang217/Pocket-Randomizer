/**
 * The corner stamps say what the run is, and the seed one copies it. Stage V2.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

import { shortContentHash } from '../src/core/contentHash';
import { formatSeedString } from '../src/core/seedString';
import { createStamps, formatBuildStamp, formatSeedStamp } from '../src/ui/stamps';

describe('the stamps', () => {
  it('render the locale, the segment of eight, the seed and the build', () => {
    const stamps = createStamps();
    stamps.update({ locale: 'ruins', segment: 3, segments: 8, seed: 'SMOKE24' });
    expect(stamps.root.querySelector('.stamp--locale')?.textContent).toBe('Ruins');
    expect(stamps.root.querySelector('.stamp--segment')?.textContent).toBe('3 / 8');
    expect(stamps.root.querySelector('.stamp--seed')?.textContent).toBe(formatSeedStamp('SMOKE24'));
    expect(stamps.root.querySelector('.stamp--build')?.textContent).toBe(formatBuildStamp());
    expect(formatBuildStamp()).toMatch(/^\d+\.\d+\.\d+ · r\d+$/);
  });

  it('hide what a run does not have yet, and clear the locale on the summary', () => {
    const stamps = createStamps();
    stamps.update({ locale: null, segment: null, segments: 0, seed: null });
    expect((stamps.root.querySelector('.stamp--locale') as HTMLElement).hidden).toBe(true);
    expect((stamps.root.querySelector('.stamp--segment') as HTMLElement).hidden).toBe(true);
    expect((stamps.root.querySelector('.stamp--seed') as HTMLElement).hidden).toBe(true);
    stamps.update({ locale: null, segment: 5, segments: 8, seed: 'X' });
    expect((stamps.root.querySelector('.stamp--locale') as HTMLElement).hidden).toBe(true);
    expect((stamps.root.querySelector('.stamp--segment') as HTMLElement).hidden).toBe(false);
  });

  it('copies the full seed string on tap', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText }, configurable: true });
    const stamps = createStamps();
    stamps.update({ locale: 'cave', segment: 1, segments: 8, seed: 'SMOKE24' });
    (stamps.root.querySelector('.stamp--seed') as HTMLElement).click();
    expect(writeText).toHaveBeenCalledWith(formatSeedStamp('SMOKE24'));
    await Promise.resolve();
    expect((stamps.root.querySelector('.stamp--seed') as HTMLElement).dataset['copied']).toBe('true');
  });

  it('is the versioned seed string form, from one function', () => {
    // The GYMRUN-xxxxxx-nnnnnnn form arrived with contentHash, and this is
    // the function that renders it for the stamp.
    expect(formatSeedStamp('ABC123')).toBe(formatSeedString('ABC123'));
    expect(formatSeedStamp('ABC123')).toBe(`GYMRUN-${shortContentHash()}-ABC123`);
  });
});
