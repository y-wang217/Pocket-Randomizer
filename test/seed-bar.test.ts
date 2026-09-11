/**
 * The seed bar shows the versioned seed, copies it, and refuses a foreign one
 * at paste time — before a run starts.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

import { shortContentHash } from '../src/core/contentHash';
import { formatSeedString } from '../src/core/seedString';
import { foreignSeedMessage, SEED_COPY } from '../src/data/seedCopy';
import { createSeedBar } from '../src/ui/seed-bar';

const SHORT = shortContentHash();
const OTHER = SHORT.replace(/[0-9a-f]/g, (c) => ((parseInt(c, 16) + 1) % 16).toString(16));

function mount() {
  const bar = createSeedBar();
  const input = bar.root.querySelector<HTMLInputElement>('.seedbar__input')!;
  const notice = bar.root.querySelector<HTMLElement>('.seedbar__notice')!;
  const started: string[] = [];
  bar.onSubmit((seed) => started.push(seed));
  const submit = (value: string): void => {
    input.value = value;
    bar.root.dispatchEvent(new Event('submit', { cancelable: true }));
  };
  return { bar, input, notice, started, submit };
}

describe('the seed bar', () => {
  it('shows the versioned form on the run start screen', () => {
    const { bar, input } = mount();
    bar.setSeed('SMOKE24');
    expect(input.value).toBe(`GYMRUN-${SHORT}-SMOKE24`);
    expect(input.value).toBe(formatSeedString('SMOKE24'));
  });

  it('copies exactly what it shows', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { bar } = mount();
    bar.setSeed('SMOKE24');
    const copy = bar.root.querySelector<HTMLButtonElement>('.seedbar__copy')!;
    expect(copy.textContent).toBe(SEED_COPY.copy);
    copy.click();
    expect(writeText).toHaveBeenCalledWith(formatSeedString('SMOKE24'));
    await Promise.resolve();
    expect(copy.textContent).toBe(SEED_COPY.copied);
  });

  it('starts the same run from the pasted versioned string', () => {
    const { started, submit, notice } = mount();
    submit(`  gymrun-${SHORT}-smoke24 `);
    expect(started).toEqual(['SMOKE24']);
    expect(notice.hidden).toBe(true);
  });

  it('starts a fresh run from a bare seed, unchanged', () => {
    const { started, submit } = mount();
    submit('smoke24');
    expect(started).toEqual(['SMOKE24']);
  });

  it('refuses a foreign seed at paste time with the copy from data/, and does not start', () => {
    const { started, submit, notice, input } = mount();
    submit(`GYMRUN-${OTHER}-SMOKE24`);
    expect(started).toEqual([]);
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe(foreignSeedMessage(OTHER, SHORT));
    expect(notice.getAttribute('role')).toBe('alert');
    // The bare seed is left in the box, so a second Start is a fresh run on it.
    expect(input.value).toBe('SMOKE24');
    submit(input.value);
    expect(started).toEqual(['SMOKE24']);
    expect(notice.hidden).toBe(true);
  });

  it('can be told to refuse a seed that arrived by URL', () => {
    const { bar, notice, input } = mount();
    bar.refuse({ kind: 'foreign', seed: 'FROM-URL', hash: OTHER, expected: SHORT });
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain(OTHER);
    expect(input.value).toBe('FROM-URL');
  });
});
